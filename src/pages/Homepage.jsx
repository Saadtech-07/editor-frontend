import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Copy, Edit3, FolderOpen, ImagePlus, Layers3, Trash2, UploadCloud } from "lucide-react";
import Header from "../components/layout/Header.jsx";
import {
  deleteSavedProject,
  duplicateSavedProject,
  getWorkspaceCount,
  listSavedProjects,
  renameSavedProject,
} from "../utils/projectStorage.js";


const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function PreviewPanel({ title, imageUrl, emptyLabel }) {
  return (
    <section className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 flex min-h-[420px] flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-600">{title}</h2>
      </div>
        
      <div className="checkerboard mt-4 grid flex-1 place-items-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="max-h-[520px] w-full object-contain" />
        ) : (
          <p className="px-6 text-center text-sm text-gray-400">{emptyLabel}</p>
        )}
      </div>
    </section>
  );
}

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

export default function Homepage({ imageState, onUpload, onProcessed, onOpenProject }) {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [recentProjects, setRecentProjects] = useState([]);

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
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-blue-50 text-gray-900">
      <Header onUpload={onUpload} />

      <main className="w-full px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Preview</p>
            <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">Upload, remove background, then edit</h1>
            <p className="mt-3 max-w-2xl text-gray-600">
              Compare the uploaded image with the transparent result before opening the editor.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-md transition hover:-translate-y-0.5 hover:bg-gray-50"
            >
              <ImagePlus size={18} />
              Upload Image
            </button>
            <button
              type="button"
              onClick={() => navigate("/editor")}
              className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-green-600"
            >
              Open Editor
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {!imageState.originalUrl ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`grid min-h-[460px] w-full place-items-center rounded-lg border border-dashed p-8 text-center transition ${
              isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white hover:bg-gray-50"
            }`}
          >
            <span>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-lg bg-blue-500 text-white">
                <UploadCloud size={28} />
              </span>
              <span className="mt-5 block text-xl font-semibold text-gray-900">Drop an image here or browse</span>
              <span className="mt-2 block text-sm text-gray-600">PNG, JPG, WEBP, or any browser-supported image file</span>
            </span>
          </button>
        ) : (
          <div className="grid gap-5 lg:grid-cols-1">
            <PreviewPanel title="Original Image" imageUrl={imageState.originalUrl} emptyLabel="Upload an image to begin." />
          </div>
        )}

        {error ? (
          <div className="mt-5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">Recent Projects</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">Continue where you left off</h2>
            </div>
          </div>

          {recentProjects.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {recentProjects.map((project) => (
                <article key={project.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => openProject(project)}
                    className="block aspect-video w-full bg-gray-100"
                    title={`Open ${project.name || "Untitled Project"}`}
                  >
                    {project.thumbnail ? (
                      <img
                        src={project.thumbnail}
                        alt={project.name || "Project thumbnail"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="grid h-full place-items-center text-sm text-gray-400">No preview</span>
                    )}
                  </button>

                  <div className="space-y-3 p-4">
                    <div>
                      <h3 className="truncate text-sm font-bold text-gray-900">{project.name || "Untitled Project"}</h3>
                      <p className="mt-1 text-xs text-gray-500">{formatEditedTime(project.updatedAt)}</p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Layers3 size={14} />
                      <span>{getWorkspaceCount(project)} workspace{getWorkspaceCount(project) === 1 ? "" : "s"}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openProject(project)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        <FolderOpen size={14} />
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => renameProject(project)}
                        className="grid h-8 w-8 place-items-center rounded-md border border-gray-200 text-gray-600 transition hover:bg-gray-50"
                        title="Rename"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateProject(project)}
                        className="grid h-8 w-8 place-items-center rounded-md border border-gray-200 text-gray-600 transition hover:bg-gray-50"
                        title="Duplicate"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProject(project)}
                        className="grid h-8 w-8 place-items-center rounded-md border border-gray-200 text-gray-600 transition hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-8 text-sm text-gray-500">
              Saved projects will appear here.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
