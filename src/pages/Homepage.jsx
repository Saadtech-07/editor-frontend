import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Copy,
  Edit3,
  FolderOpen,
  ImagePlus,
  Layers3,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Header from "../components/layout/Header.jsx";
import {
  deleteSavedProject,
  duplicateSavedProject,
  getWorkspaceCount,
  listSavedProjects,
  renameSavedProject,
} from "../utils/projectStorage.js";

function formatEditedTime(value) {
  if (!value) {
    return "Not edited yet";
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (error) {
    return "Recently edited";
  }
}

function ProjectThumbnail({ project }) {
  if (project.thumbnail) {
    return (
      <img
        src={project.thumbnail}
        alt={project.name || "Project thumbnail"}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <span className="grid h-full place-items-center bg-slate-100 text-sm font-medium text-slate-400">
      No preview
    </span>
  );
}

export default function Homepage({ imageState, onUpload, onClearImage, onOpenProject }) {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [recentProjects, setRecentProjects] = useState([]);

  const uploadedFileName = useMemo(
    () => imageState.originalFile?.name || "No image selected",
    [imageState.originalFile],
  );

  const refreshProjects = () => {
    setRecentProjects(listSavedProjects());
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  const uploadFile = (file) => {
    try {
      onUpload(file);
      setError("");
    } catch (uploadError) {
      setError(uploadError.message);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];

    if (file) {
      uploadFile(file);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      uploadFile(file);
    }
  };

  const openEditor = () => {
    navigate("/editor");
  };

  const clearUploadedImage = () => {
    onClearImage?.();
    setError("");
    setIsDragging(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const openProject = (project) => {
    onOpenProject?.(project);
    navigate("/editor");
  };

  const renameProject = (project) => {
    const nextName = window.prompt("Rename project", project.name || "Untitled Project");

    if (!nextName?.trim()) {
      return;
    }

    renameSavedProject(project.id, nextName);
    refreshProjects();
  };

  const duplicateProject = (project) => {
    duplicateSavedProject(project.id);
    refreshProjects();
  };

  const deleteProject = (project) => {
    const confirmed = window.confirm(`Delete "${project.name || "Untitled Project"}"?`);

    if (!confirmed) {
      return;
    }

    deleteSavedProject(project.id);
    refreshProjects();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <Header />

      <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Start</p>
              <h1 className="mt-3 text-3xl font-bold tracking-normal text-slate-950">
                Open your editor workspace
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Upload from local storage or open the editor directly. If no image is selected, the editor starts with an empty workspace.
              </p>
            </div>

            <div className="mt-7 grid gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
              >
                <ImagePlus size={18} />
                Upload From Local
              </button>

              <button
                type="button"
                onClick={openEditor}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
              >
                Open Editor
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Selected Image</p>
                  <p className="mt-2 truncate text-sm font-semibold text-slate-800">{uploadedFileName}</p>
                </div>

                {imageState.originalUrl ? (
                  <button
                    type="button"
                    onClick={clearUploadedImage}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                    title="Remove uploaded image"
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}
          </aside>

          <section
            onDrop={handleDrop}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`rounded-lg border bg-white p-5 shadow-sm transition ${
              isDragging ? "border-blue-400 ring-4 ring-blue-100" : "border-slate-200"
            }`}
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Upload From Local</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">
                  {imageState.originalUrl ? "Image ready for editor" : "Preview appears here"}
                </h2>
              </div>

              {imageState.originalUrl ? (
                <p className="max-w-sm truncate text-sm font-medium text-slate-500">{uploadedFileName}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`checkerboard mt-5 grid h-[420px] w-full place-items-center overflow-hidden rounded-lg border text-center transition xl:h-[520px] ${
                isDragging ? "border-blue-400" : "border-slate-300 hover:border-blue-300"
              }`}
            >
              {imageState.originalUrl ? (
                <span className="flex h-full w-full items-center justify-center bg-slate-950/5 p-5">
                  <img
                    src={imageState.originalUrl}
                    alt="Uploaded preview"
                    className="max-h-full max-w-full rounded-md object-contain shadow-2xl shadow-slate-950/25"
                  />
                </span>
              ) : (
                <span className="px-6">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-lg bg-slate-950 text-white">
                    <UploadCloud size={28} />
                  </span>
                  <span className="mt-5 block text-xl font-bold text-white">Drop an image here</span>
                  <span className="mt-2 block text-sm leading-6 text-slate-300">
                    Or click this preview area to choose a file.
                  </span>
                </span>
              )}
            </button>
          </section>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Recent Projects</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Continue where you left off</h2>
            </div>
            <p className="text-sm font-medium text-slate-500">
              {recentProjects.length} saved project{recentProjects.length === 1 ? "" : "s"}
            </p>
          </div>

          {recentProjects.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {recentProjects.map((project) => {
                const workspaceCount = getWorkspaceCount(project);

                return (
                  <article
                    key={project.id}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() => openProject(project)}
                      className="block aspect-video w-full bg-slate-100"
                      title={`Open ${project.name || "Untitled Project"}`}
                    >
                      <ProjectThumbnail project={project} />
                    </button>

                    <div className="space-y-3 p-4">
                      <button type="button" onClick={() => openProject(project)} className="block w-full text-left">
                        <h3 className="truncate text-sm font-bold text-slate-950">
                          {project.name || "Untitled Project"}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">{formatEditedTime(project.updatedAt)}</p>
                      </button>

                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <Layers3 size={14} />
                        <span>
                          {workspaceCount} workspace{workspaceCount === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openProject(project)}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-slate-950 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          <FolderOpen size={14} />
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => renameProject(project)}
                          className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                          title="Rename"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateProject(project)}
                          className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                          title="Duplicate"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProject(project)}
                          className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
              <span>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-slate-100 text-slate-500">
                  <FolderOpen size={22} />
                </span>
                <span className="mt-3 block font-semibold text-slate-700">Saved projects will appear here.</span>
              </span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
