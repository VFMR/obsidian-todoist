import { TodoistApi } from "@doist/todoist-api-typescript";


export interface TodoistProject {
    id: string;
    name: string;
};


interface TodoistTask {
  content: string;
  project_id: string;
  project_name: string;
  priority: number;
  due_string: string;
  due_lang: string;
};


export async function getProjects(api: TodoistApi): TodoistProject[] {
    const projects = await api.getProjects();
    new Notice(projects)

    const project_list: TodoistProject[] = [];
    for (let i = 0; i < projects.length; i++) {
      project_list.push({
        id: projects[i].id,
        name: projects[i].name
      });
    }
    return project_list;
}


// function to create a task. return whether it was successful or not
export async function createTask(api: TodoistApi, task: TodoistTask) {
  // BUG: project_id is not working - "{}" ist sent to the API
  const response = await api.addTask({
    content: task.content, 
    priority: task.priority,
    // project_id: task.project_id,
    due_string: task.due_string,
    due_lang: task.due_lang,
    description: task.description,
  });
  return response;
}


export async function getActiveTasks(api: TodoistApi): string[] {
  const tasks = await api.getTasks();

  const task_list: string[] = [];
  for (let i = 0; i < tasks.length; i++) {
    task_list.push(tasks[i].id);
  }
  return task_list;
}
