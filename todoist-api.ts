import { TodoistApi } from "@doist/todoist-api-typescript"

import {MySettingTab} from './settings'


async function getProjects(token) {
    const api = TodoistApi(token);
    const projects = await api.getProjects();
    return projects;
}


async function getProjectList(token) {
    const api = TodoistApi(token);
    const projects = await api.getProjects();
    var project_list = [];
    for (var i = 0; i < projects.length; i++) {
        project_list.push(projects[i].name);
    }
    return project_list;
}


// function to get project id from project name
async function getProjectId(token, project_name) {
    const api = TodoistApi(token);
    const projects = await api.getProjects();
    var project_id = 0;

    // find the name most similar to the project_name
    for (var i = 0; i < projects.length; i++) {
      var project_name_clean = project_name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      var project_name_clean2 = projects[i].name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      if (project_name_clean2.includes(project_name_clean)) {
        project_id = projects[i].id;
        break;
      }

    return project_id
}


// function to create a task. return whether it was successful or not
async function createTaskWithProjectID(token, 
                                              content,
                                              project_id,
                                              priority,
                                              due) {
    const api = TodoistApi(token)
    // create task add project id only if it is not 0
    // if project id is 0, it will be added to inbox
    if (project_id != 0) {
        await api.addTask({content, project_id, priority, due});
    } else {
        await api.addTask({content, priority, due});
    }
}

export function createTask(token, 
                          content,
                          project_name,
                          priority,
                          due) {
    const project_id = await getProjectId(token, project_name);
    return createTaskWithProjectID(token, 
                                   content,
                                   project_id,
                                   priority,
                                   due)
}



