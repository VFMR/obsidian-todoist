import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { TodoistApi } from "@doist/todoist-api-typescript";

import {MySettingTab} from './settings';
import {getProjects, createTask, TodoistProject} from './todoist-api';



interface MyPluginSettings {
	apiToken: string;
}

interface TodoistTask {
  content: string;
  project_id: string;
  project_name: string;
  priority: number;
  due_string: string;
  due_lang: string;
};


const DEFAULT_SETTINGS: MyPluginSettings = {
  apiToken: '',
}


// function to find all the tasks in the current file
// returns an array of strings
function findTasks(editor: Editor): string[] {
  const tasks = editor.getValue().match(/- \[.\] .*(\n|$)/g);
  if (tasks) {
    return tasks;
  } else {
    return [];
  }
  new Notice(tasks);
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


function findPriority(task: string): number {
  const priority = task.match(/p\d/);
  // return integer
  if (priority) {
    return parseInt(priority[0].slice(1));
  } else {
    return 4;
  }
}


function findDueDate(task: string): string {
  // FIXME - this only allows for due dates without spaces
  const dueDate = task.match(/due: .*/);
  if (dueDate) {
    return dueDate[0].slice(5);
  } else {
    return null;
  }
}


function makeTask(projects: TodoistProject[], 
                  task_string: string): TodoistTask {
    const task: TodoistTask = {
    "content": task_string.replace(/^- \[ \]/, '').replace('\n', ''),
    "project_id": getProjectId(projects, task_string.match(/#.*(\s|$)/)),
    "project_name": task_string.match(/#.*(\s|$)/),
    "priority": findPriority(task_string),
    "due_string": findDueDate(task_string),
    "due_lang": "de"
    };
  new Notice(task)
  return task;
}


// function makeMultipleTasks(projects: TodoistProject[], 
//                            tasks: string[]): TodoistTask[] {
//   const task_objects = TodoistTask[];
//   for (const task of tasks) {
//     task_objects.push(makeTask(task));
//   }
//   return task_objects;
// }


function sendTask(api: TodoistApi,
                  projects: TodoistProject[], 
                  task_string: string) {
  const task = makeTask(projects, task_string);
  createTask(api, task);
}


function sendMultipleTasks(api: TodoistApi,
                           projects: TodoistProject[],
                           task_strings: string[]) {
  for (const task_string of task_strings) {
    sendTask(api, projects, task_string)
  }
}


async function findAndSendTasks(api: TodistApi, editor: Editor) {
  const tasks = findTasks(editor);
  let projects: TodoistProject[];
  
  if (tasks.length === 0) {
    new Notice('No tasks found');

  } else if (tasks.length === 1) {
    projects = await getProjects(api);
    await sendTask(api, projects, tasks[0]);

  } else {
    projects = await getProjects(api);
    new Notice(projects)
    await sendMultipleTasks(api, projects, tasks);
  }

}



export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
    
    this.api = new TodoistApi(this.settings.apiToken);

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Send to Todoist', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
      const editor = this.app.workspace.getActiveViewOfType(MarkdownView).editor;
      findAndSendTasks(this.api, editor);
		});
    
		// Perform additional things with the ribbon
		
   
		// this.addCommand({
		// 	id: 'todoist-sync',
		// 	name: 'Sync with Todoist',
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		//
	 //        // TODO: implement sync
		// 	}
		// });


		this.addCommand({
			id: 'todoist-send-selection',
			name: 'Send selection to Todoist',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
        const selection = editor.getSelection();
        try {
          await sendTask(this.api, selection);
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
        try {
          await findAndSendTasks(this.api, editor);
        }
        catch (e) {
          new Notice(e);
        }
      }
		});


    // this.addCommand({
    //     id: 'todoist-new',
    //     name: 'New Todoist task',
    //     callback: () => {
    //       // TODO: implement new
    //     },
    // });

    //
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MySettingTab(this.app, this));

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

