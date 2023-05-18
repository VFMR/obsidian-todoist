import {App, Plugin, PluginSettingTab, Setting} from 'obsidian';
import ObsidianTodoist from './main';

export class MySettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h2', {text: 'Settings for Obsidian Todoist'});

		containerEl.createEl('h3', {text: 'API Settings'});


    // setting for api token
		new Setting(containerEl)
			.setName('apiToken')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue('*'.repeat(this.plugin.settings.apiToken.length))
				.onChange(async (value) => {
					this.plugin.settings.apiToken = value;
					await this.plugin.saveSettings();
				}));


		containerEl.createEl('h3', {text: 'Task settings'});

    // Setting for pattern to detect tasks
    new Setting(containerEl)
      .setName('Pattern for tasks')
      .setDesc('Specify a regex pattern to detect tasks that shall be sent to todoist. Default is "/- \[ \] .*/g" to send all markdown tasks.')
      .addText(text => text
        .setPlaceholder('/- \[ \] .*/g')
        .setValue(this.plugin.settings.taskPattern)
        .onChange(async (value) => {
          this.plugin.settings.taskPattern = value;
          await this.plugin.saveSettings();
        }));


    new Setting(containerEl)
      .setName('Pattern for due dates')
      .setDesc('Specify a regex pattern to detect due dates. Default is /due: [a-zA-Z0-9\-\.]+/g')
      .addText(text => text
        .setPlaceholder('/due: [a-zA-Z0-9\-\.]+/g')
        .setValue(this.plugin.settings.duePattern)
        .onChange(async (value) => {
          this.plugin.settings.duePattern = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Language for due dates')
      .setDesc('Specify a language to detect due dates. Default is "en"')
      .addText(text => text
        .setPlaceholder('en')
        .setValue(this.plugin.settings.dueLanguage)
        .onChange(async (value) => {
          this.plugin.settings.dueLanguage = value;
          await this.plugin.saveSettings();
        }));



		containerEl.createEl('h3', {text: 'Auto sync settings'});


    // Setting for pattern to detect files for sync
    new Setting(containerEl)
      .setName('Pattern for files to sync')
      .setDesc('Specify a pattern to detect files for sync')
      .addText(text => text
        .setPlaceholder('/{{todoist}}/g')
        .setValue(this.plugin.settings.syncPattern)
        .onChange(async (value) => {
          this.plugin.settings.syncPattern = value;
          await this.plugin.saveSettings();
        }));

    // setting for sync on plugin load
    new Setting(containerEl)
      .setName('Sync on Plugin Load')
      .setDesc('Specify whether to find and send all tagged files in the vault to Todoist on plugin load')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.syncOnLoad)
        .onChange(async (value) => {
          this.plugin.settings.syncOnLoad = value;
          await this.plugin.saveSettings();
        }));
	}
}
