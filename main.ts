import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

import {MySettingTab} from './settings'
import {createTask, TodoistProject} from './todoist-api'


interface TodoistTask {
  content: string;
  project_id: string;
  project_name: string;
  priority: number;
  due_string: string;
  due_lang: string;
}


// function to find all the tasks in the current file
// returns an array of strings
function findTasks() {
  const editor = this.app.workspace.getActiveViewOfType(MarkdownView).editor;
  const tasks = editor.getValue().match(/- \[.\] .*(\n|$)/g);
  if (tasks) {
    return tasks;
  } else {
    return [];
  }
}


// function to get project id from project name
async function getProjectId(projects: TodoistProject[], project_name: string): string {
    var project_id = 0;

    // find the name most similar to the project_name
    if (project_name != null) {
      for (var i = 0; i < projects.length; i++) {
        var project_name_clean = project_name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        var project_name_clean2 = projects[i].name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        if (project_name_clean2.includes(project_name_clean)) {
          project_id = projects[i].id;
          break;
        }
      }
    }
    return project_id;
}


function findPriority(task: string) {
  const priority = task.match(/p\d/);
  // return integer
  if (priority) {
    return parseInt(priority[0].slice(1));
  } else {
    return 4;
  }
}


function findDueDate(task: string) {
  const dueDate = task.match(/due: .*(,|$)/);
  if (dueDate) {
    return dueDate[0].slice(5, -1);
  } else {
    return null;
  }
}


function makeTask(projects: TodoistProject[], 
                  task_string: string): TodoistTask {
  return TodoistTask = {
    content: task_string.replace(/^- \[ \]/, '').replace('\n', ''),
    project_id: getProjectId(projects, task_string.match(/#.*(\s|$)/)),
    project_name: task_string.match(/#.*(\s|$)/),
    priority: findPriority(task_string),
    due_string: findDueDate(task_string),
    due_lang: "de",
  };
}


function makeMultipleTasks(tasks: string[]): TodoistTask[] {
  const task_objects = [];
  for (const task of tasks) {
    task_objects.push(makeTask(task));
  }
  return task_objects;
}

function sendTask(token: string, task_string: string) {
  const task = makeTask(editor);
  createTask(token, task.content, task.priority, task.due_string);
}


function sendMultipleTasks(token: string, tasks: string[]) {
  const task_objects = makeMultipleTasks(tasks);
  for (const task of task_objects) {
    createTask(token, task.content, task.priority, task.due_string);
  }
}


interface MyPluginSettings {
	apiToken: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  apiToken: '',
}


export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;




	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Send to Todoist', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('Sending tasks');
      const editor = this.app.workspace.getActiveViewOfType(MarkdownView).editor;
      const tasks = findTasks(editor);
      new Notice(this.settings.apiToken);

      if (tasks.length === 1) {
        sendTask(this.settings.apiToken, tasks[0]);
      }
      else {
        sendMultipleTasks(this.settings.apiToken, tasks);
      }
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
			editorCallback: (editor: Editor, view: MarkdownView) => {
        const selection = editor.getSelection();
        try {
          sendTask(this.settings.apiToken, selection);
        }
        catch (e) {
          new Notice(e);
			  }
      }
		});


		this.addCommand({
			id: 'todoist-send-file',
			name: 'Send file to Todoist',
			editorCallback: (editor: Editor, view: MarkdownView) => {
        const tasks = findTasks(editor);
        try {
          sendMultipleTasks(this.settings.apiToken, tasks);
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

