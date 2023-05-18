import { TodoistApi } from "@doist/todoist-api-typescript";


export interface TodoistProject {
    id: string;
    name: string;
}


async function getProjects(token: string): TodoistProjects[] {
    const api = new TodoistApi(token);
    const projects = await api.getProjects();

    var project_list = [];
    for (var i = 0; i < projects.length; i++) {
        project_list.push(new TodoistProject(projects[i].id, projects[i].name));
    }
    return project_list;
}



// function to create a task. return whether it was successful or not
async function createTaskWithProjectID(token: string, 
                                       content: string,
                                       project_id: number,
                                       priority: number,
                                       due: string) {
    const api = new TodoistApi(token);
    // create task add project id only if it is not 0
    // if project id is 0, it will be added to inbox
    if (project_id != 0) {
        response = await api.addTask({
          "content": content, 
          "project_id": project_id,
          "priority": priority,
          "dueString": due,
          "dueLang": "de",
        });
    } else {
        respone = await api.addTask({
          "content": content, 
          "priority": priority,
          "dueString": due,
          "dueLang": "de",
        });
    }
    return response;
}

export async function createTask(token: string, 
                                 content: string,
                                 project_name: string,
                                 priority: number,
                                 due: string) {
    const project_id = await getProjectId(token, project_name);
    return createTaskWithProjectID(token, 
                                   content,
                                   project_id,
                                   priority,
                                   due);
}



