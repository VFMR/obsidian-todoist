import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { TodoistApi } from "@doist/todoist-api-typescript";

import {MySettingTab} from './settings';
import {getProjects, getActiveTasks, createTask, TodoistProject} from './todoist-api';
import { findAndSendTasks } from './tasks';


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


const DEFAULT_SETTINGS: Partial<MyPluginSettings> = {
  apiToken: '',
  syncOnLoad: true,
  syncPattern: '/{{todoist}}/g',
  taskPattern: '/- \[ \] .*(\n|$)/g', 
  dueLanguage: 'en'
};


export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;


	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MySettingTab(this.app, this));
    this.api = new TodoistApi(this.settings.apiToken);

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Send to Todoist', async (evt: MouseEvent) => {
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


		this.addCommand({
			id: 'todoist-send-file',
			name: 'Send file to Todoist',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
        const fileContents = await editor.getValue();
        try {
          await findAndSendTasks(this.api, fileContents, this.settings.dueLanguage, editor);
        }
        catch (e) {
          console.log(e)
        }
      }
		});
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

