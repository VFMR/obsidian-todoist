import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { TodoistApi } from "@doist/todoist-api-typescript";

import {MySettingTab} from './settings';
import {getProjects, getActiveTasks, createTask, TodoistProject} from './todoist-api';



interface MyPluginSettings {
	apiToken: string;
  taskPattern: string;
  taskRemovePattern: string;
  duePattern: string;
  dueRemovePattern: string;
  syncPattern: string;
  syncOnLoad: boolean;
  dueLanguage: string;
}


interface TodoistTask {
  content: string;
  project_id: string;
  project_name: string;
  priority: number;
  due_string: string;
  due_lang: string;
  parentId: string;
  parentTodoistId: string;
  taskId: string;
};


const DEFAULT_PATTERNS = {
  taskPattern: /- \[ \] .*(\n|$)/g,
  taskRemovePattern: /- \[ \] /g,
  duePattern: /((due: )|(📅 ))([a-zA-Z0-9\-\.]+)/g,
  dueRemovePattern: /((due: )|(📅 ))/g,
  prioPattern: /( (p\d|⏫|🔼|🔽|⏬)(\n| |$))/)/g,
  syncPattern: /{{todoist}}/g,
  todoistIdPattern: /{{todoist-id[0-9]+}}/g,
};


const DEFAULT_SETTINGS: Partial<MyPluginSettings> = {
  apiToken: '',
  syncOnLoad: true,
  syncPattern: '/{{todoist}}/g',
  taskPattern: '/- \[ \] .*(\n|$)/g', 
  dueLanguage: 'en'
};


function findTasks(text: string): string[] {
  const tasks = text.match(DEFAULT_PATTERNS.taskPattern);
  if (tasks) {
    return tasks;
  } else {
    return [];
  }
}


function findTasksWithContext(projects: TodoistProject[],
                              activeTasks: string[],
                              dueLanguage: string,
                              text: string) {
  const lines = text.split('\n');
  let tdTask: TodoistTask | null = null;
  let tasks: TodoistTask[] = []; 
  let completedTasks: number[] = [];
  let task_string: string = '';
  let indentLevel: number = 0;
  let taskDescription: string = '';
  let isInCodeBlock: boolean = false;
  let taskRow: number | null = null;
  let row: number = -1;
  let currentIndentLevel: number = 0;
  let taskCounter: number = 0;
  // let isChild: boolean = false;
  // let childLevel: number = 0;
  let parentId: number | null = null;
  let taskId: number | null = null;
  // let parentEnd: boolean = true;
  // let parentIndent: number = 0;
  let inTask: boolean = false;
  let idMatch: RegExpMatchArray | null = null;
  let todoistId: string | null = null;

  for (const line of lines) {
    row += 1;

    // check for reset:
    // empty line -> push task to tasks
    if (line.trim() === '') {
      if (!isInCodeBlock) {  // allow for empty lines in code blocks
        if (task_string !== '') {
          tdTask = makeTask(projects,
                            taskId,
                            parentId,
                            task_string,
                            dueLanguage,
                            taskDescription, 
                            taskRow);

          tasks.push(tdTask);
          task_string = '';
          indentLevel = 0;
          taskDescription = '';
          taskRow = null;
          // childLevel = 0;
          // parentEnd = true;
          // parentIndent = 0;
          parentId = null;
        }
        continue;
      }
    }


    // get current indent level:
    const match = line.match(/^(\s*-+)\s*(.*)/);
    if (match) {
      currentIndentLevel = match[1].length;
    } else  {
      currentIndentLevel = 0;
    }

    // Starting and ending code blocks
    const codeBlockStart = line.match(/^```(?:([a-zA-Z0-9]+))?$/);
    if (codeBlockStart) {
      const codeBlockIndentLevel = currentIndentLevel;
      // ending code block?
      if (isInCodeBlock) {
        isInCodeBlock = false; // Exiting an existing code block
        if (task_string !== '') {
          taskDescription += line + '\n';
        }
      } else {
        isInCodeBlock = codeBlockStart[1] || true; // Entering a new code block
        if (task_string !== '') {
          taskDescription += line + '\n';
        }
      }
      continue;
    }

    // add line if inside a code block
    if (isInCodeBlock) {
      if (task_string !== '') {
        // remove the indent level of the task line
        const lineWithoutIndent = line.substring(codeBlockIndentLevel);
        taskDescription += lineWithoutIndent + '\n';
      }
      continue;
    }

    // check if line is a task or a description
    if (match) {
      task_match = line.match(DEFAULT_PATTERNS.taskPattern);
      idMatch = line.match(/\{\{todoist-id(\d+)\}\}/);

      if (task_match) {
        taskCounter += 1;
        taskId = taskCounter;

        // Task already sent?
        if (idMatch) {  // BUG: this appears to fail
          todoistId = idMatch[1];

          // check if this is an active task
          if (activeTasks.includes(todoistId)) {
            continue;
          } else {
            completedTasks.push(row);
          }
        
        // handling of new tasks
        } else {
          // check if this is a subtask
          // TODO: Because there is only one parent ID and we can have both
          // parallel and nested subtasks, I need a way to keep track of
          // the parent IDs of all subtasks. This is a temporary solution
          // and only allows for one level of subtasks.
          if (parentId) {
            if (currentIndentLevel > indentLevel) {
              // this is a subtask of the previous task
              task_string = task_match[0];
              indentLevel = currentIndentLevel;
              taskRow = row;
            } else if (currentIndentLevel == indentLevel) {
              // this must be a second or later subtask
              task_string = task_match[0];
              indentLevel = currentIndentLevel;
              taskRow = row;
            }
          } else {
            task_string = task_match[0] // .replace(/{{todoist-id\d+}}/, '');
            indentLevel = currentIndentLevel;
            taskRow = row;
            parentId = taskId;
          }
        }

      // no task match:
      } else {
        // check for subordinate bullet points -> description
        if (currentIndentLevel > indentLevel) {
          const lineWithoutIndent = line.substring(indentLevel);
          taskDescription += lineWithoutIndent + '\n';
        }

      }
    }

      // Otherwise, create the task
      } else {
        tdTask = makeTask(projects,
                          taskId,
                          parentId,
                          task_string,
                          dueLanguage,
                          taskDescription, 
                          taskRow);

        tasks.push(tdTask);
        task_string = '';
        indentLevel = 0;
        taskDescription = '';
        taskRow = null;
        // childLevel = 0;
        // parentEnd = true;
        // parentIndent = 0;
        parentId = null;

        // Check if the line contains a new task instead
        task_match = line.match(DEFAULT_PATTERNS.taskPattern);
        if (task_match) {
          task_string = task_match[0];
          indentLevel = currentIndentLevel;
          taskRow = row;
        }
        indentLevel = currentIndentLevel;
        taskDescription = '';
      }
    }
  }

  // push last task
  if (task_string !== '') {
    tdTask = makeTask(projects,
                      taskId,
                      parentId,
                      task_string,
                      dueLanguage,
                      taskDescription, 
                      taskRow);

    tasks.push(tdTask);
    task_string = '';
    indentLevel = 0;
    taskDescription = '';
    taskRow = null;
    // childLevel = 0;
    // parentEnd = true;
    // parentIndent = 0;
    parentId = null;
  }

  const allTasks = {
    completedTasks: completedTasks,
    newTasks: tasks
  };

  return allTasks;
}


function updateTaskRowEditor(tdTask: TodoistTask, taskId: string, editor: Editor) {
  const tdIDString = ' %%{{todoist-id' + taskId + '}}%%';

  const currentTaskLine = editor.getLine(tdTask.textRow);
  const updatedTaskLine = currentTaskLine + tdIDString;

  // update line in the text:
  const endPosition = { line: tdTask.textRow, ch: currentTaskLine.length };
  editor.replaceRange(updatedTaskLine, { line: tdTask.textRow, ch: 0 }, endPosition);
}


function markTaskAsCompleted(row, editor: Editor) {
  const currentTaskLine = editor.getLine(row);
  const updatedTaskLine = currentTaskLine.replace('[ ]', '[x]');
  editor.replaceRange(updatedTaskLine, { line: row, ch: 0 }, { line: row, ch: currentTaskLine.length });
}


function findPriority(task: string): number {
  const priority = task.match(DEFAULT_PATTERNS.prioPattern).strip();

  var prio_num = 4;
  // return integer
  if (priority) {
    if (priority[0] === '⏫') {
      prio_num = 1;
    } else if (priority[0] === '🔼') {
      prio_num = 2;
    } else if (priority[0] === '🔽') {
      prio_num = 3;
    } else if (priority[0] === '⏬') {
      prio_num = 4;
    } else {
      prio_num = parseInt(priority[0].slice(1));
    } 
  }
  // reverse numbers to be consistent with app, where 1 is highest priority:
  return parseInt(5 - prio_num);
}


function findDueDate(task: string): string {
  // FIXME - this only allows for due dates without spaces
  const dueDate = task.match(DEFAULT_PATTERNS.duePattern);
  if (dueDate) {
    return dueDate[0].replace(DEFAULT_PATTERNS.dueRemovePattern, '');
  } else {
    return null;
  }
}


function makeTask(projects: TodoistProject[], 
                  taskId: string,
                  parentId: string,
                  task_string: string,
                  dueLanguage: string,
                  descripton: string,
                  textRow: number): TodoistTask {
    // TODO: add support for labels
    // TODO: add support for assignee
    // TODO: add support for due dates with spaces
    // TODO: fix project_id recognition 
    const task: TodoistTask = {
    "content": task_string.replace(DEFAULT_PATTERNS.taskRemovePattern, '')\
                          .replace(DEFAULT_PATTERNS.duePattern, '')\
                          .replace(DEFAULT_PATTERNS.prioPattern, '')\
                          .replace('\n', ''),
    // "project_id": getProjectId(projects, task_string.match(/#.*(\s|$)/)),
    "project_name": task_string.match(/#.*(\s|$)/),
    "priority": findPriority(task_string),
    "due_string": findDueDate(task_string),
    "due_lang": dueLanguage,
    "description": descripton,
    "textRow": textRow,
    "parentId": parentId
    "parentTodoistId": null
    "taskId": taskId
    };
  // console.log(task)
  return task;
}


async function findAndSendTasks(api: TodistApi,
                                text: string,
                                dueLanguage: string,
                                editor?: Editor) {
  // TODO: currently only works with for the active file, not the vault
  let projects: TodoistProject[];
  const activeTasks = await getActiveTasks(api);
  console.log(activeTasks);
  const allTasks = findTasksWithContext(projects, activeTasks, dueLanguage, text);
  const newTasks = allTasks.newTasks;
  const completedTasks = allTasks.completedTasks;

  // query active tasks:
  
  if (allTasks.length === 0) {
    new Notice('No tasks found');

  // } else if (tasks.length === 1) {
  //   projects = await getProjects(api);
  //   activeTasks = await getActiveTasks(api);
  //   const response = await createTask(api, tasks[0]);
  //   if (editor) {
  //     updateTaskRowEditor(tasks[0], response.id, editor)
  //   }
  } else {
    projects = await getProjects(api);

    // re-sort the tasks in newTask such that tasks with parentId = null are first
    // because the API requires that parent tasks are created first
    newTasks.sort((a, b) => {
      if (a.parentId === null && b.parentId !== null) {
        return -1;
      } else if (a.parentId !== null && b.parentId === null) {
        return 1;
      } else {
        return 0;
      }
    });


    const newTaskIds = {};  // maps internal taskId to todoist ID

    for (const task of newTasks) {
      if (!task.parentId) {  // is parent
        const response = await createTask(api, task);
        newTaskIds[task.id] = response.id;

      } else {  // is child
        // setting the parentTodoistId to the todoist ID of the parent task
        task.parentTodoistId = newTaskIds[task.parentId];
        const response = await createTask(api, task);
        newTaskIds[task.id] = response.id;
      }

      // update the information on the editor
      if (editor) {
        updateTaskRowEditor(task, response.id, editor);
      }
    }

    // update completed tasks
    for (const taskRow of completedTasks) {
      if (editor) {
        markTaskAsCompleted(taskRow, editor);
      }
    }
  }
}


// function to get project id from project name
async function getProjectId(projects: TodoistProject[], project_name: string): string {
  var project_id = "0";

  // find the name most similar to the project_name
  if (project_name != null) {
    if (project_name != "") {
      for (var i = 0; i < projects.length; i++) {
        var project_name_clean = project_name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        var project_name_clean2 = projects[i].name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        if (project_name_clean2.includes(project_name_clean)) {
          project_id = projects[i].id;
          break;
        }
      }
    }
  }
  return project_id;
}


export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;


	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MySettingTab(this.app, this));
    
    this.api = new TodoistApi(this.settings.apiToken);

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Send to Todoist', async (evt: MouseEvent) => {
			// Called when the user clicks the icon.
      const editor = this.app.workspace.getActiveViewOfType(MarkdownView).editor;
      const fileContents = await editor.getValue();
      findAndSendTasks(this.api, 
                       fileContents,
                       this.settings.dueLanguage,
                       editor);
		});
    
   
		this.addCommand({
			id: 'todoist-sync',
			name: 'Sync with Todoist',
			Callback: async () => {

        // TODO: Check if navigator is available in obsidian (it is in browser)
        if (!navigator.onLine) {
          new Notice('No active internet connection.');
          return;
        }

        const vault = this.app.vault;
        const files = vault.getMarkdownFiles();

        
        var task_counter = 0;
        for (const file of files) {
          const fileContents = await vault.read(file);
          if (this.settings.todoistPattern.test(fileContents)) {

            // Remove the pattern from file contents
            const updatedContents = fileContents.replace(this.settings.todoistPattern, '');

            // Send the file contents to Todoist
            try {
              await findAndSendTasks(this.api, updatedContents, this.settings.dueLanguage)
              task_counter += 1;
            } catch (error) {
              new Notice(`Error sending ${file.path} to Todoist: ${error}`);
            }
          }
        }
        new Notice(`Sent ${task_counter} tasks to Todoist.`);
      }
		});


		// this.addCommand({
		// 	id: 'todoist-send-selection',
		// 	name: 'Send selection to Todoist',
		// 	editorCallback: async (editor: Editor, view: MarkdownView) => {
  //       const selection = editor.getSelection();
  //       try {
  //         await sendTask(this.api, selection, this.settings.dueLanguage);
  //       }
  //       catch (e) {
  //         new Notice(e);
		// 	  }
  //     }
		// });


		this.addCommand({
			id: 'todoist-send-file',
			name: 'Send file to Todoist',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
        const fileContents = await editor.getValue();
        try {
          await findAndSendTasks(this.api, fileContents, this.settings.dueLanguage, editor);
        }
        catch (e) {
          new Notice(e);
        }
      }
		});



    //

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

