
# Obsidian to Todoist

Obsidian to Todoist is a plugin for the [Obsidian](https://obsidian.md/) note-taking tool that allows users to seamlessly sync and manage their tasks between Obsidian and Todoist.

## Features

- Sync tasks between Obsidian and Todoist
- Identify and send Markdown tasks to Todoist
- Update task status in Obsidian from Todoist
- Automatically sync all files in the vault on startup if they contain a specific pattern (`{{todoist}}` by default)
- Add bullet points a d Codeblocks below the markdown to the Todoist task description


## Installation

> **Warning**
> This plugin makes changes to files in your vault and is in an early stage of development.
> Use at your own risk and make backups to prevent data loss.


1. Download the latest release of the Obsidian Todoist Integration plugin from the [releases page](https://github.com/VFMR/obsidian-todoist/releases).
2. Copy the plugin folder into `.obsidian/plugins/` in your vault.
3. Open Obsidian and go to **Settings** -> **Third-Party Plugins**.
4. Enable **Obsidian Todoist Integration** by toggling the switch.
5. Enjoy the seamless integration of Obsidian and Todoist!


## Usage

1. Open an Obsidian note that contains Markdown tasks in the following format:
   ```markdown
   - [ ] Task 1
   - [ ] Task 2
   - [x] Completed Task
   ```
2. Use a command or ribbon menu icon to trigger the Todoist integration.
3. The plugin will identify Markdown tasks alongside other information (such as descriptions, due dates, and priority)
  ```markdown
  - [ ] my task
      - a line for the description
      - another line for the description

  - [x] this task will not be sent to Todoist
  - [ ] A task with high priority p1
  - [ ] Another task with high priority ⏫
  - [ ] A task with due date due: tomorrow
  ```
4. The tasks will be sent to Todoist, and their status will be synced between Obsidian and Todoist.


## Configuration

To use the Obsidian Todoist Integration plugin, you need to set up your Todoist API token. Follow these steps to configure the plugin:

1. Log in to Todoist and go to the [Developer page](https://todoist.com/app/settings/integrations/developer)
2. Copy your API-Token
3. Open Obsidian and go to **Community plugins** and click on the gear next to **Obsidian to Todoist**
4. Paste your Todoist API token in the designated field.


## Contributing

Contributions to the Obsidian Todoist Integration plugin are welcome! If you encounter any issues or have suggestions for improvements, please open an issue on the [GitHub repository](https://github.com/MVFR/obsidian-todoist) or submit a pull request.


## License

This project is licensed under the [MIT License](LICENSE).

