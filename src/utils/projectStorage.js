const PROJECTS_STORAGE_KEY = "pixelforge:projects";
const PROJECT_RECORD_TYPE = "pixelforge-project";
const PROJECT_SCHEMA_VERSION = 2;
const DEFAULT_PROJECT_NAME = "Untitled Project";

function createProjectId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hasCanvasPayload(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      (Array.isArray(value.objects) ||
        value.background ||
        value.backgroundColor ||
        value.backgroundImage ||
        value.overlayImage),
  );
}

function cleanText(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function normalizeWorkspaceRecord(workspace, index = 0) {
  if (!workspace || typeof workspace !== "object") {
    return null;
  }

  const canvasJSON =
    workspace.canvasJSON ||
    workspace.canvas ||
    workspace.fabricJSON ||
    (hasCanvasPayload(workspace) ? workspace : null);
  const fallbackName = index === 0 ? "Main" : `Workspace ${index + 1}`;

  return {
    id: workspace.id || workspace.workspaceId || `workspace-${index + 1}`,
    name: cleanText(workspace.name || workspace.workspaceName, fallbackName),
    canvasJSON,
    editorState: workspace.editorState || null,
    createdAt: workspace.createdAt || null,
    updatedAt: workspace.updatedAt || null,
  };
}

function normalizeWorkspaceRecords(workspaces = []) {
  return workspaces
    .map((workspace, index) => normalizeWorkspaceRecord(workspace, index))
    .filter(Boolean);
}

function normalizeProjectRecord(project, index = 0) {
  if (!project || typeof project !== "object") {
    return null;
  }

  const workspaces = Array.isArray(project.workspaces)
    ? normalizeWorkspaceRecords(project.workspaces)
    : normalizeWorkspaceRecords([
        {
          id: project.workspaceId || project.activeWorkspaceId || `workspace-${index + 1}`,
          name: project.workspaceName || project.name || "Main",
          canvasJSON: project.canvasJSON || project.canvas || (hasCanvasPayload(project) ? project : null),
          editorState: project.editorState || null,
          createdAt: project.createdAt || null,
          updatedAt: project.updatedAt || null,
        },
      ]);

  if (workspaces.length === 0) {
    return null;
  }

  const activeWorkspaceId = workspaces.some((workspace) => workspace.id === project.activeWorkspaceId)
    ? project.activeWorkspaceId
    : workspaces[0].id;

  return {
    ...project,
    type: PROJECT_RECORD_TYPE,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: project.id || createProjectId(),
    name: cleanText(project.projectName || project.name, DEFAULT_PROJECT_NAME),
    thumbnail: project.thumbnail || "",
    createdAt: project.createdAt || project.updatedAt || new Date(0).toISOString(),
    updatedAt: project.updatedAt || project.createdAt || new Date(0).toISOString(),
    activeWorkspaceId,
    workspaces,
    metadata: {
      ...(project.metadata || {}),
      workspaceCount: workspaces.length,
    },
  };
}

function readProjects() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawProjects = window.localStorage.getItem(PROJECTS_STORAGE_KEY);

    if (!rawProjects) {
      return [];
    }

    const projects = JSON.parse(rawProjects);

    if (!Array.isArray(projects)) {
      return [];
    }

    const seenProjectIds = new Set();

    return projects
      .map((project, index) => normalizeProjectRecord(project, index))
      .filter((project) => {
        if (!project || seenProjectIds.has(project.id)) {
          return false;
        }

        seenProjectIds.add(project.id);
        return true;
      });
  } catch (error) {
    console.error("Unable to read saved projects:", error);
    return [];
  }
}

function writeProjects(projects) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

export function listSavedProjects() {
  return readProjects().sort((projectA, projectB) => {
    const dateA = new Date(projectA.updatedAt || projectA.createdAt || 0).getTime();
    const dateB = new Date(projectB.updatedAt || projectB.createdAt || 0).getTime();

    return dateB - dateA;
  });
}

export function getSavedProject(projectId) {
  return readProjects().find((project) => project.id === projectId) || null;
}

export function saveProjectRecord(project) {
  const now = new Date().toISOString();
  const projects = readProjects();
  const existingProject = project.id ? projects.find((item) => item.id === project.id) : null;
  const workspaces = normalizeWorkspaceRecords(project.workspaces || existingProject?.workspaces || []);
  const activeWorkspaceId = workspaces.some((workspace) => workspace.id === project.activeWorkspaceId)
    ? project.activeWorkspaceId
    : workspaces[0]?.id || null;
  const nextProject = {
    ...existingProject,
    ...project,
    type: PROJECT_RECORD_TYPE,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: project.id || createProjectId(),
    name: cleanText(project.name, existingProject?.name || DEFAULT_PROJECT_NAME),
    thumbnail: project.thumbnail || existingProject?.thumbnail || "",
    createdAt: project.createdAt || existingProject?.createdAt || now,
    updatedAt: now,
    activeWorkspaceId,
    workspaces,
    metadata: {
      ...(existingProject?.metadata || {}),
      ...(project.metadata || {}),
      workspaceCount: workspaces.length,
    },
  };
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
  const nextProjects = [
    nextProject,
    ...projects.filter((item) => {
      if (item.id === nextProject.id) {
        return false;
      }

      const isLegacyWorkspaceCard =
        workspaceIds.has(item.id) ||
        item.projectId === nextProject.id ||
        item.parentProjectId === nextProject.id;

      return !isLegacyWorkspaceCard;
    }),
  ];

  writeProjects(nextProjects);
  return nextProject;
}

export function deleteSavedProject(projectId) {
  const nextProjects = readProjects().filter((project) => project.id !== projectId);
  writeProjects(nextProjects);
}

export function renameSavedProject(projectId, nextName) {
  const cleanName = nextName?.trim();

  if (!cleanName) {
    return null;
  }

  const now = new Date().toISOString();
  let renamedProject = null;
  const nextProjects = readProjects().map((project) => {
    if (project.id !== projectId) {
      return project;
    }

    renamedProject = {
      ...project,
      name: cleanName,
      updatedAt: now,
    };

    return renamedProject;
  });

  writeProjects(nextProjects);
  return renamedProject;
}

export function duplicateSavedProject(projectId) {
  const sourceProject = getSavedProject(projectId);

  if (!sourceProject) {
    return null;
  }

  const now = new Date().toISOString();
  const duplicatedProject = {
    ...sourceProject,
    id: createProjectId(),
    name: `${sourceProject.name || "Untitled Project"} Copy`,
    createdAt: now,
    updatedAt: now,
  };

  writeProjects([duplicatedProject, ...readProjects()]);
  return duplicatedProject;
}

export function getWorkspaceCount(project) {
  if (Array.isArray(project?.workspaces)) {
    return project.workspaces.length;
  }

  return hasCanvasPayload(project?.canvasJSON || project?.canvas || project) ? 1 : 0;
}
