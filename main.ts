import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { TodoistApi } from "@doist/todoist-api-typescript";

import {MySettingTab} from './settings';
import {getProjects, createTask, TodoistProject} from './todoist-api';



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
};


// TODO: add as parameters to the plugin settings instead of hardcoding.
// requires me to specify the patterns in strings, with double backslashes 
// (i.e. '- \\[ \\] ') for the regex to work. and then use 
// ` new RegExp(string_pattern, 'g') `
// to create a regex 
// I can create such an escaped pattern from a regular regex entry with this:
// userPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const DEFAULT_PATTERNS = {
  taskPattern: /- \[ \] .*(\n|$)/g,
  taskRemovePattern: /- \[ \] /g,
  duePattern: /((due: )|(📅 ))(.*)(\n|$)/g,
  dueRemovePattern: /due: /g,
  syncPattern: /{{todoist}}/g,
}


const DEFAULT_SETTINGS: Partial<MyPluginSettings> = {
  apiToken: '',
  syncOnLoad: true,
  syncPattern: '/{{todoist}}/g',
  taskPattern: '/- \[ \] .*(\n|$)/g', 
  dueLanguage: 'en'
}


// // find all the tasks in the current file
// function findTasks(editor: Editor): string[] {
//   const tasks = editor.getValue().match(/- \[.\] .*(\n|$)/g);
//   if (tasks) {
//     return tasks;
//   } else {
//     return [];
//   }
//   new Notice(tasks);
// }

function findTasks(text: string): string[] {
  const tasks = text.match(DEFAULT_PATTERNS.taskPattern);
  if (tasks) {
    return tasks;
  } else {
    return [];
  }
}


function findTasksWithContext(projects: TodoistProject[],
                              dueLanguage: string,
                              text: string): string[] {
  const lines = text.split('\n');
  let tasks: TodoistTask[] = []; 
  let task_string = '';
  let indentLevel = 0;
  let taskDescription = '';
  let isInCodeBlock = false;

  // empty line -> push task to tasks
  for (const line of lines) {
    if (line.trim() === '') {
      if (task_string !== '') {
        const tdTask = makeTask(projects, task_string, dueLanguage, taskDescription);

        tasks.push(tdTask);
        task_string = '';
        indentLevel = 0;
        taskDescription = '';
      }
      continue;
    }

    const codeBlockStart = line.match(/^```(?:([a-zA-Z0-9]+))?$/);
      if (codeBlockStart) {
        if (isInCodeBlock) {
          isInCodeBlock = false; // Exiting an existing code block
          if (task_string !== '') {
            taskDescription += line + '\n';
        } else {
          isInCodeBlock = codeBlockStart[1] || true; // Entering a new code block
        }
        continue;
      }

      // Skip processing the line if inside a code block
      if (isInCodeBlock) {
        if (task_string !== '') {
          taskDescription += line + '\n';
        }
      }

    // check if line is a task or a description
    const match = line.match(/^(\s*-+)\s*(.*)/);
      if (match) {
        const currentIndentLevel = match[1].length;
        if (task_string === '') {
          task_string = line.match(DEFAULT_PATTERNS.taskPattern)[0];
          indentLevel = currentIndentLevel;
        }
        else if (currentIndentLevel > indentLevel) {
          taskDescription += match[2].trim() + '\n';
        }
        else {
          const tdTask = makeTask(projects, task_string, dueLanguage, taskDescription);
          tasks.push(tdTask);
          task_string = line.match(DEFAULT_PATTERNS.taskPattern)[0];
          indentLevel = currentIndentLevel;
          taskDescription = '';
        }
      }
  }

  // push last task
  if (task_string !== '') {
    const tdTask = makeTask(projects, task_string, dueLanguage, taskDescription);
    tasks.push(tdTask);
  }

  return tasks;
}



function findPriority(task: string): number {
  // match either /p\d/ or "⏫", "🔼", "🔽 ", or "⏬"
  const priority = task.match(/(p\d|⏫|🔼|🔽|⏬)/);

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
  // reverse numbers to be consistent with app, where 1 is highest priority:
  return parseInt(5 - prio_num);
}


function findDueDate(task: string): string {
  // FIXME - this only allows for due dates without spaces
  const dueDate = task.match(DEFAULT_PATTERNS.duePattern);
  if (dueDate) {
    return dueDate[0].replace(DEFAULT_PATTERNS.dueRemovePattern, '')
  } else {
    return null;
  }
}


function makeTask(projects: TodoistProject[], 
                  task_string: string,
                  dueLanguage: string,
                  descripton: string): TodoistTask {
    // TODO: add support for labels
    // TODO: add support for description
    // TODO: add support for assignee
    // TODO: add support for due dates with spaces
    // TODO: fix project_id recognition 
    const task: TodoistTask = {
    "content": task_string.replace(DEFAULT_PATTERNS.taskRemovePattern, '').replace('\n', ''),
    "project_id": getProjectId(projects, task_string.match(/#.*(\s|$)/)),
    "project_name": task_string.match(/#.*(\s|$)/),
    "priority": findPriority(task_string),
    "due_string": findDueDate(task_string),
    "due_lang": dueLanguage,
    };
  new Notice(task)
  return task;
}



function sendTask(api: TodoistApi,
                  projects: TodoistProject[], 
                  task_string: string,
                  dueLanguage: string) {
  const task = makeTask(projects, task_string, dueLanguage);
  createTask(api, task);
}


function sendMultipleTasks(api: TodoistApi,
                           projects: TodoistProject[],
                           task_strings: string[],
                           dueLanguage: string) {
  for (const task_string of task_strings) {
    sendTask(api, projects, task_string, dueLanguage)
  }
}


async function findAndSendTasks(api: TodistApi,
                                text: string,
                                dueLanguage: string) {
  const tasks = findTasks(text);
  let projects: TodoistProject[];
  
  if (tasks.length === 0) {
    new Notice('No tasks found');

  } else if (tasks.length === 1) {
    projects = await getProjects(api);
    await sendTask(api, projects, tasks[0], dueLanguage);

  } else {
    projects = await getProjects(api);
    new Notice(projects)
    await sendMultipleTasks(api, projects, tasks, dueLanguage);
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
                       this.settings.dueLanguage);
		});
    
   
		this.addCommand({
			id: 'todoist-sync',
			name: 'Sync with Todoist',
			Callback: async () => {

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
              await findAndSendTasks(updatedContents, this.settings.dueLanguage)
              task_counter += 1;
            } catch (error) {
              new Notice(`Error sending ${file.path} to Todoist: ${error}`);
            }
          }
        }
        new Notice(`Sent ${task_counter} tasks to Todoist.`);
      }
		});


		this.addCommand({
			id: 'todoist-send-selection',
			name: 'Send selection to Todoist',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
        const selection = editor.getSelection();
        try {
          await sendTask(this.api, selection, this.settings.dueLanguage);
        }
        catch (e) {
          new Notice(e);
			  }
      }
		});


		this.addCommand({
			id: 'todoist-send-file',
			name: 'Send file to Todoist',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
        const fileContents = await editor.getValue();
        try {
          await findAndSendTasks(this.api, fileContents, this.dueLanguage);
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

