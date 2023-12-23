import {getProjects, getActiveTasks, createTask, TodoistProject} from './todoist-api';


const DEFAULT_PATTERNS = {
  taskPattern: /- \[ \] .*(\n|$)/g,
  taskRemovePattern: /- \[ \] /g,
  duePattern: /((due: )|(📅 ))([a-zA-Z0-9\-\.]+)/g,
  dueRemovePattern: /((due: )|(📅 ))/g,
  prioPattern: /( (p\d|⏫|🔼|🔽|⏬)( |$))/g,
  syncPattern: /{{todoist}}/g,
  todoistIdPattern: /{{todoist-id[0-9]+}}/g,
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
  let codeBlockIndentLevel: number = 0;
  let taskRow: number | null = null;
  let row: number = -1;
  let currentIndentLevel: number = 0;
  let taskCounter: number = 0;
  // let isChild: boolean = false;
  // let childLevel: number = 0;
  let parentId: number | null = null;
  let taskId: number | null = null;
  let parentIndentLevel: number | null = 0;
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
          taskDescription = '';
          taskRow = null;
          parentId = null;
          parentIndentLevel = 0;
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
        // send any previous tasks to the array:
        if (task_string) {
          tdTask = makeTask(projects,
                            taskId,
                            parentId,
                            task_string,
                            dueLanguage,
                            taskDescription, 
                            taskRow);

          tasks.push(tdTask);
          task_string = '';
          taskDescription = '';
          taskRow = null;
        }

        taskCounter += 1;
        taskId = taskCounter;

        // Task already sent?
        if (idMatch) {  
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
          if (currentIndentLevel > indentLevel) {
            parentId = taskId - 1;
            parentIndentLevel = indentLevel;
          } else if (currentIndentLevel < indentLevel) {
            parentId = taskId;
            parentIndentLevel = currentIndentLevel;
          }

          // new parent?
          if (currentIndentLevel <= parentIndentLevel) {
            parentId = taskId;
            parentIndentLevel = currentIndentLevel;
          }


          task_string = task_match[0];
          indentLevel = currentIndentLevel;
          taskRow = row;
        }

      // no task match:
      } else {
        if (task_string !== '') {  // only act if we have a task to add
          // check for subordinate bullet points -> description
          if (currentIndentLevel > indentLevel) {
            const lineWithoutIndent = line.substring(indentLevel);
            taskDescription += lineWithoutIndent + '\n';

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
            parentId = null;
            parentIndentLevel = 0;

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
    parentId = null;
    parentIndentLevel = 0;
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
  const priority = task.match(DEFAULT_PATTERNS.prioPattern)

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
      const cleanPrio = priority[0].replace(' ', '');
      prio_num = parseInt(cleanPrio.slice(1));
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


function cleanTaskContent(rawContent: string): string {
  var cleanContent = rawContent.replace(DEFAULT_PATTERNS.taskRemovePattern, '');
  cleanContent = cleanContent.replace(DEFAULT_PATTERNS.duePattern, '');
  cleanContent = cleanContent.replace(DEFAULT_PATTERNS.prioPattern, '');
  cleanContent = cleanContent.replace('\n', '');
  return cleanContent;
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
    "content": cleanTaskContent(task_string),
    // "project_id": getProjectId(projects, task_string.match(/#.*(\s|$)/)),
    "project_name": task_string.match(/#.*(\s|$)/),
    "priority": findPriority(task_string),
    "due_string": findDueDate(task_string),
    "due_lang": dueLanguage,
    "description": descripton,
    "textRow": textRow,
    "parentId": parentId,
    "parentTodoistId": null,
    "taskId": taskId
    };
  return task;
}


export async function findAndSendTasks(api: TodistApi,
                                text: string,
                                dueLanguage: string,
                                editor?: Editor) {
  // TODO: currently only works with for the active file, not the vault
  let projects: TodoistProject[];
  const activeTasks = await getActiveTasks(api);
  const allTasks = findTasksWithContext(projects, activeTasks, dueLanguage, text);
  const newTasks = allTasks.newTasks;
  const completedTasks = allTasks.completedTasks;
  let response = null;
  let task = null;

  // query active tasks:
  if (allTasks.length === 0) {
    console.log("No tasks found");

  } else {
    projects = await getProjects(api);

    const newTaskIds = {};  // maps internal taskId to todoist ID

    for (task of newTasks) {
      if (task.parentId === task.taskId) {  // is parent
        response = await createTask(api, task);
        newTaskIds[task.taskId] = response.id;

      } else {  // is child
        // setting the parentTodoistId to the todoist ID of the parent task
        task.parentTodoistId = newTaskIds[task.parentId];
        response = await createTask(api, task);
        newTaskIds[task.taskId] = response.id;
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

