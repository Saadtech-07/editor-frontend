import { useCallback, useEffect, useRef, useState } from "react";

import { fabric } from "fabric";

import LeftSidebar from "../components/editor/LeftSidebar.jsx";

import FloatingToolbar from "../components/editor/FloatingToolbar.jsx";

import TopBar from "../components/editor/TopBar.jsx";

import RightPanel from "../components/editor/RightPanel.jsx";

import WorkspaceManager from "../components/editor/WorkspaceManager.jsx";
import { useEditor } from "../context/EditorContext.jsx";

import useFabric from "../hooks/useFabric.js";

import ToolManager from "../tools/ToolManager.js";

import CropTool from "../tools/CropTool.js";

import DrawTool from "../tools/DrawTool.js";

import EraserTool from "../tools/EraserTool.js";


import { ensureFabricEraserSupport, hasFabricEraserSupport } from "../utils/fabricEraserSupport.js";
import { saveProjectRecord } from "../utils/projectStorage.js";

import {
  exportAllWorkspaceImages,
  exportWorkspaceImage,
} from "../utils/exportUtils.js";

import {

  FABRIC_SERIALIZATION_PROPS,

  assignObjectMeta,

  cloneFabricObject,

  getBaseImageObject,

  getNextObjectName,

  getSelectedOrBaseImageObject,

  removeObjectFromCanvas,

} from "../utils/fabricHelpers.js";



const shapeStyles = {

  fill: "rgba(45, 212, 191, 0.76)",

  stroke: "#ccfbf1",

  strokeWidth: 2,

};



const INITIAL_TOOL_SETTINGS = {

  draw: {

    color: "#2dd4bf",

    size: 6,

  },

  eraser: {

    size: 24,

    inverted: false,

  },

};



const INITIAL_CANVAS_WIDTH = 980;

const INITIAL_CANVAS_HEIGHT = 660;

const HISTORY_LIMIT = 80;

const HISTORY_SAVE_DEBOUNCE_MS = 160;

function normalizeHistoryEntry(entry) {
  if (!entry) {
    return null;
  }

  if (typeof entry === "string") {
    try {
      return {
        canvasJSON: JSON.parse(entry),
        activeObjectIds: [],
        viewportTransform: null,
        zoom: 1,
      };
    } catch (error) {
      console.warn("Unable to parse legacy history entry:", error);
      return null;
    }
  }

  if (entry.canvasJSON) {
    return {
      ...entry,
      activeObjectIds: Array.isArray(entry.activeObjectIds) ? entry.activeObjectIds : [],
      viewportTransform: Array.isArray(entry.viewportTransform) ? entry.viewportTransform : null,
      zoom: Number.isFinite(entry.zoom) ? entry.zoom : 1,
    };
  }

  if (entry.objects || entry.background || entry.backgroundColor || entry.backgroundImage) {
    return {
      canvasJSON: entry,
      activeObjectIds: [],
      viewportTransform: Array.isArray(entry.viewportTransform) ? entry.viewportTransform : null,
      zoom: Number.isFinite(entry.zoom) ? entry.zoom : 1,
    };
  }

  return null;
}

function getHistorySignature(entry) {
  if (!entry) {
    return "";
  }

  try {
    return JSON.stringify({
      canvasJSON: entry.canvasJSON,
      activeObjectIds: entry.activeObjectIds || [],
    });
  } catch (error) {
    console.warn("Unable to create history signature:", error);
    return `${Date.now()}`;
  }
}

function getCanvasActiveObjectIds(targetCanvas) {
  const activeObject = targetCanvas?.getActiveObject?.();

  if (!activeObject) {
    return [];
  }

  if (activeObject.type === "activeSelection" && typeof activeObject.getObjects === "function") {
    return activeObject
      .getObjects()
      .map((object) => object.editorId)
      .filter(Boolean);
  }

  return activeObject.editorId ? [activeObject.editorId] : [];
}

function getImageElementDataUrl(fabricObject) {
  const imageElement = fabricObject?._element || fabricObject?._originalElement || fabricObject?.getElement?.();

  if (!imageElement) {
    return null;
  }

  const width = imageElement.naturalWidth || imageElement.videoWidth || imageElement.width;
  const height = imageElement.naturalHeight || imageElement.videoHeight || imageElement.height;

  if (!width || !height) {
    return null;
  }

  try {
    const imageCanvas = document.createElement("canvas");
    imageCanvas.width = width;
    imageCanvas.height = height;
    imageCanvas.getContext("2d")?.drawImage(imageElement, 0, 0, width, height);
    return imageCanvas.toDataURL("image/png");
  } catch (error) {
    console.warn("Unable to inline Fabric image source for history:", error);
    return null;
  }
}

function inlineHistoryImageSources(jsonObject, fabricObject) {
  if (!jsonObject || !fabricObject) {
    return;
  }

  if (jsonObject.type === "image") {
    const source = jsonObject.src || fabricObject._element?.src || fabricObject.getSrc?.();

    if (typeof source === "string" && source.startsWith("blob:")) {
      const dataUrl = getImageElementDataUrl(fabricObject);

      if (dataUrl) {
        jsonObject.src = dataUrl;
      }
    }
  }

  if (jsonObject.clipPath && fabricObject.clipPath) {
    inlineHistoryImageSources(jsonObject.clipPath, fabricObject.clipPath);
  }

  if (Array.isArray(jsonObject.objects) && Array.isArray(fabricObject._objects)) {
    jsonObject.objects.forEach((childJsonObject, index) => {
      inlineHistoryImageSources(childJsonObject, fabricObject._objects[index]);
    });
  }
}

function createHistoryEntry(targetCanvas) {
  const canvasJSON = targetCanvas.toJSON(FABRIC_SERIALIZATION_PROPS);

  canvasJSON.width = targetCanvas.getWidth();
  canvasJSON.height = targetCanvas.getHeight();
  canvasJSON.viewportTransform = Array.isArray(targetCanvas.viewportTransform)
    ? [...targetCanvas.viewportTransform]
    : [1, 0, 0, 1, 0, 0];

  targetCanvas.getObjects().forEach((fabricObject, index) => {
    inlineHistoryImageSources(canvasJSON.objects?.[index], fabricObject);
  });

  if (canvasJSON.backgroundImage && targetCanvas.backgroundImage) {
    inlineHistoryImageSources(canvasJSON.backgroundImage, targetCanvas.backgroundImage);
  }

  if (canvasJSON.overlayImage && targetCanvas.overlayImage) {
    inlineHistoryImageSources(canvasJSON.overlayImage, targetCanvas.overlayImage);
  }

  return {
    canvasJSON,
    activeObjectIds: getCanvasActiveObjectIds(targetCanvas),
    viewportTransform: [...canvasJSON.viewportTransform],
    zoom: typeof targetCanvas.getZoom === "function" ? targetCanvas.getZoom() : 1,
    timestamp: Date.now(),
  };
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function imageSourceToDataUrl(source) {
  if (typeof source !== "string" || !source.startsWith("blob:")) {
    return source;
  }

  try {
    const response = await fetch(source);
    const blob = await response.blob();
    return await readBlobAsDataUrl(blob);
  } catch (error) {
    console.warn("Unable to convert blob image source for project save:", error);
    return source;
  }
}

async function inlineCanvasJsonImageSources(jsonObject) {
  if (!jsonObject || typeof jsonObject !== "object") {
    return jsonObject;
  }

  if (jsonObject.type === "image" && typeof jsonObject.src === "string") {
    jsonObject.src = await imageSourceToDataUrl(jsonObject.src);
  }

  if (jsonObject.clipPath) {
    await inlineCanvasJsonImageSources(jsonObject.clipPath);
  }

  if (jsonObject.eraser) {
    await inlineCanvasJsonImageSources(jsonObject.eraser);
  }

  if (Array.isArray(jsonObject.objects)) {
    for (const childObject of jsonObject.objects) {
      await inlineCanvasJsonImageSources(childObject);
    }
  }

  if (jsonObject.backgroundImage) {
    await inlineCanvasJsonImageSources(jsonObject.backgroundImage);
  }

  if (jsonObject.overlayImage) {
    await inlineCanvasJsonImageSources(jsonObject.overlayImage);
  }

  return jsonObject;
}

async function createProjectCanvasJSON(targetCanvas) {
  const historyEntry = createHistoryEntry(targetCanvas);
  return inlineCanvasJsonImageSources(structuredClone(historyEntry.canvasJSON));
}

async function prepareWorkspaceCanvasJSON(canvasJSON) {
  if (!canvasJSON) {
    return null;
  }

  return inlineCanvasJsonImageSources(structuredClone(canvasJSON));
}

function getCanvasJSONSize(canvasJSON) {
  return {
    width: Number.isFinite(canvasJSON?.width) ? canvasJSON.width : INITIAL_CANVAS_WIDTH,
    height: Number.isFinite(canvasJSON?.height) ? canvasJSON.height : INITIAL_CANVAS_HEIGHT,
  };
}

function getWorkspaceObjectCount(canvasJSON) {
  return Array.isArray(canvasJSON?.objects)
    ? canvasJSON.objects.filter((object) => !object.excludeFromLayer).length
    : 0;
}

function createClientProjectId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Editor({ imageUrl, projectToLoad = null }) {

  const canvasElementRef = useRef(null);

  const canvasContainerRef = useRef(null);

  const toolManagerRef = useRef(null);

  const historyRef = useRef([]);

  const redoHistoryRef = useRef([]);

  const historyIndexRef = useRef(-1);

  const isRestoringHistoryRef = useRef(false);

  const pendingHistorySaveRef = useRef(null);

  const pendingHistoryCanvasRef = useRef(null);

  const lastHistorySignatureRef = useRef("");

  const previousWorkspaceIdRef = useRef("page-1");

  const clipboardObjectRef = useRef(null);

  const baseImageIdRef = useRef(null);

  const baseImageInitializedRef = useRef(false);

  const currentProjectIdRef = useRef(projectToLoad?.id || null);

  const currentProjectNameRef = useRef(projectToLoad?.name || "Untitled Project");

  // Background removal toggle state
  const [originalImageData, setOriginalImageData] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);

  useFabric(canvasElementRef, imageUrl, { skipInitialImageLoad: Boolean(projectToLoad) });



  const { 

    canvas, 

    objects, 

    activeObject, 

    setActiveObject, 

    syncObjects,

    workspaces,

    setWorkspaces,

    activeWorkspaceId,

    setActiveWorkspaceId,

    createWorkspaceFromCurrentCanvas,

    loadWorkspaceToCanvas,

    switchWorkspace,

    saveWorkspace,

    hoveredLayerId,

    setHoveredLayerId,

    selectedLayerIds,

    setSelectedLayerIds,

  } = useEditor();

  const [activeTool, setActiveTool] = useState("select");

  const [toolSettings, setToolSettings] = useState(INITIAL_TOOL_SETTINGS);

  const [toolMessage, setToolMessage] = useState("");

  const [eraserSupported, setEraserSupported] = useState(() => hasFabricEraserSupport());

  const [zoom, setZoom] = useState(1);

  const [history, setHistory] = useState([]);

  const [historyIndex, setHistoryIndex] = useState(-1);

  const [saveToast, setSaveToast] = useState("");



  useEffect(() => {

    let isMounted = true;



    void ensureFabricEraserSupport().then((supported) => {

      if (isMounted) {

        setEraserSupported(supported);

      }

    });



    return () => {

      isMounted = false;

    };

  }, []);



  useEffect(() => {

    historyRef.current = history;

    historyIndexRef.current = historyIndex;

  }, [history, historyIndex]);



  useEffect(() => {

    setHistory([]);

    setHistoryIndex(-1);

    historyRef.current = [];

    redoHistoryRef.current = [];

    historyIndexRef.current = -1;

    lastHistorySignatureRef.current = "";

    if (pendingHistorySaveRef.current) {

      window.clearTimeout(pendingHistorySaveRef.current);

      pendingHistorySaveRef.current = null;

      pendingHistoryCanvasRef.current = null;

    }

    previousWorkspaceIdRef.current = "page-1";

    baseImageIdRef.current = null;

    baseImageInitializedRef.current = false;

    currentProjectIdRef.current = projectToLoad?.id || null;

    currentProjectNameRef.current = projectToLoad?.name || "Untitled Project";

    setToolMessage("");

    setActiveTool("select");

    setWorkspaces([

      {

        id: "page-1",

        name: "Main",

        canvasJSON: null,

        history: [],

        historyIndex: -1,

        redoHistory: [],

      },

    ]);

    setActiveWorkspaceId("page-1");

  }, [imageUrl, projectToLoad?.id]);






  const persistHistoryState = useCallback(
    (targetCanvas, undoStack = historyRef.current, redoStack = redoHistoryRef.current) => {
      const currentEntry = undoStack[undoStack.length - 1] || null;
      const nextIndex = undoStack.length - 1;

      historyRef.current = undoStack;
      redoHistoryRef.current = redoStack;
      historyIndexRef.current = nextIndex;

      setHistory(undoStack);
      setHistoryIndex(nextIndex);

      if (activeWorkspaceId && currentEntry) {
        saveWorkspace(activeWorkspaceId, {
          canvasJSON: currentEntry.canvasJSON,
          history: undoStack,
          historyIndex: nextIndex,
          redoHistory: redoStack,
        });
      }
    },
    [activeWorkspaceId, saveWorkspace],
  );

  const commitHistorySnapshot = useCallback(
    (targetCanvas = canvas, options = {}) => {
      if (!targetCanvas || isRestoringHistoryRef.current) {
        return;
      }

      const historyEntry = createHistoryEntry(targetCanvas);
      const historySignature = getHistorySignature(historyEntry);

      if (historySignature === lastHistorySignatureRef.current) {
        return;
      }

      const nextHistoryBase = historyRef.current.slice(0, historyIndexRef.current + 1);
      const nextHistory = [...nextHistoryBase, historyEntry].slice(-HISTORY_LIMIT);
      const nextRedoHistory = options.clearRedo === false ? redoHistoryRef.current : [];

      lastHistorySignatureRef.current = historySignature;
      persistHistoryState(targetCanvas, nextHistory, nextRedoHistory);
    },
    [canvas, persistHistoryState],
  );

  const flushPendingHistorySave = useCallback(() => {
    if (!pendingHistorySaveRef.current) {
      return;
    }

    window.clearTimeout(pendingHistorySaveRef.current);
    pendingHistorySaveRef.current = null;

    const targetCanvas = pendingHistoryCanvasRef.current || canvas;
    pendingHistoryCanvasRef.current = null;

    commitHistorySnapshot(targetCanvas);
  }, [canvas, commitHistorySnapshot]);

  const snapshotCanvas = useCallback(
    (targetCanvas = canvas, options = {}) => {
      if (!targetCanvas || isRestoringHistoryRef.current) {
        return;
      }

      if (options.immediate) {
        if (pendingHistorySaveRef.current) {
          window.clearTimeout(pendingHistorySaveRef.current);
          pendingHistorySaveRef.current = null;
          pendingHistoryCanvasRef.current = null;
        }

        commitHistorySnapshot(targetCanvas, options);
        return;
      }

      pendingHistoryCanvasRef.current = targetCanvas;

      if (pendingHistorySaveRef.current) {
        window.clearTimeout(pendingHistorySaveRef.current);
      }

      pendingHistorySaveRef.current = window.setTimeout(() => {
        pendingHistorySaveRef.current = null;

        const pendingCanvas = pendingHistoryCanvasRef.current || targetCanvas;
        pendingHistoryCanvasRef.current = null;
        commitHistorySnapshot(pendingCanvas, options);
      }, HISTORY_SAVE_DEBOUNCE_MS);
    },
    [canvas, commitHistorySnapshot],
  );

  useEffect(() => {
    return () => {
      if (pendingHistorySaveRef.current) {
        window.clearTimeout(pendingHistorySaveRef.current);
        pendingHistorySaveRef.current = null;
        pendingHistoryCanvasRef.current = null;
      }
    };
  }, []);



  const refreshSelectionOutline = useCallback(

    (selectedObject = canvas?.getActiveObject() || null) => {

      if (!canvas) {

        return;

      }



      canvas.getObjects().forEach((object) => {

        const isBaseImage = Boolean(baseImageIdRef.current && object.editorId === baseImageIdRef.current);

        const isSelected = selectedObject === object;

        const isImage = object.type === "image" && !object.excludeFromLayer;



        object.isBaseImage = isBaseImage;

        

        // Always show square outline for all objects

        if (isSelected) {

          // Selected object gets prominent cyan outline and resize/rotate handles

          object.set({

            borderColor: "#22d3ee",

            cornerColor: "#22d3ee",

            cornerStrokeColor: "#22d3ee",

            cornerSize: 10,

            cornerStyle: "rect",

            transparentCorners: false,

            hasBorders: true,

            hasControls: true,

            hasRotatingPoint: true,

            rotatingPointOffset: 20,

            borderDashArray: [],

          });

        } else if (isImage && object.hasBeenSelected) {

          // Previously selected image keeps its resize/rotate controls permanently visible

          object.set({

            borderColor: "#22d3ee",

            cornerColor: "#22d3ee",

            cornerStrokeColor: "#22d3ee",

            cornerSize: 10,

            cornerStyle: "rect",

            transparentCorners: false,

            hasBorders: true,

            hasControls: true,

            hasRotatingPoint: true,

            rotatingPointOffset: 20,

            borderDashArray: [],

          });

        } else {

          // Non-selected objects get subtle light blue square outline

          object.set({

            borderColor: "#60a5fa",

            cornerColor: "transparent",

            cornerStrokeColor: "transparent",

            cornerSize: 0,

            transparentCorners: true,

            hasBorders: true,

            hasControls: false,

            borderDashArray: [5, 5],

          });

        }

      });



      canvas.requestRenderAll();

    },

    [canvas],

  );



  // Handle workspace switching

  useEffect(() => {

    if (!canvas || !activeWorkspaceId || previousWorkspaceIdRef.current === activeWorkspaceId) {

      return;

    }



    const workspace = workspaces.find(w => w.id === activeWorkspaceId);



    if (!workspace) {

      return;

    }



    previousWorkspaceIdRef.current = activeWorkspaceId;

    let isCurrentLoad = true;

    isRestoringHistoryRef.current = true;

    setActiveTool("select");

    setToolMessage("");

    toolManagerRef.current?.setActiveTool("select");

    canvas.discardActiveObject();

    setActiveObject(null);

    setSelectedLayerIds([]);

    if (pendingHistorySaveRef.current) {

      window.clearTimeout(pendingHistorySaveRef.current);

      pendingHistorySaveRef.current = null;

      pendingHistoryCanvasRef.current = null;

    }

    const storedHistory = (workspace.history || []).map(normalizeHistoryEntry).filter(Boolean);

    const storedHistoryIndex = workspace.historyIndex ?? (storedHistory.length ? storedHistory.length - 1 : -1);

    const nextHistory = storedHistoryIndex >= 0 ? storedHistory.slice(0, storedHistoryIndex + 1) : [];

    const nextRedoHistory = Array.isArray(workspace.redoHistory)
      ? workspace.redoHistory.map(normalizeHistoryEntry).filter(Boolean)
      : storedHistory.slice(storedHistoryIndex + 1);

    const nextHistoryIndex = nextHistory.length ? nextHistory.length - 1 : -1;



    historyRef.current = nextHistory;

    redoHistoryRef.current = nextRedoHistory;

    historyIndexRef.current = nextHistoryIndex;

    lastHistorySignatureRef.current = getHistorySignature(nextHistory[nextHistory.length - 1]);

    setHistory(nextHistory);

    setHistoryIndex(nextHistoryIndex);



    void loadWorkspaceToCanvas(canvas, workspace).then(() => {

      if (!isCurrentLoad) {

        return;

      }



      syncObjects(canvas);

      refreshSelectionOutline(null);

      isRestoringHistoryRef.current = false;

    });



    return () => {

      isCurrentLoad = false;

      isRestoringHistoryRef.current = false;

    };

  }, [activeWorkspaceId, canvas, loadWorkspaceToCanvas, refreshSelectionOutline, setActiveObject, setSelectedLayerIds, syncObjects, workspaces]);


  useEffect(() => {

    if (!canvas || !projectToLoad?.workspaces?.length) {

      return undefined;

    }

    let isCurrentRestore = true;

    const restoreProject = async () => {

      if (pendingHistorySaveRef.current) {

        window.clearTimeout(pendingHistorySaveRef.current);

        pendingHistorySaveRef.current = null;

        pendingHistoryCanvasRef.current = null;

      }

      isRestoringHistoryRef.current = true;
      currentProjectIdRef.current = projectToLoad.id || null;
      currentProjectNameRef.current = projectToLoad.name || "Untitled Project";
      baseImageInitializedRef.current = true;

      const restoredWorkspaces = projectToLoad.workspaces.map((workspace, index) => {
        const restoredHistory = Array.isArray(workspace.history)
          ? workspace.history.map(normalizeHistoryEntry).filter(Boolean)
          : [];
        const restoredRedoHistory = Array.isArray(workspace.redoHistory)
          ? workspace.redoHistory.map(normalizeHistoryEntry).filter(Boolean)
          : [];
        const restoredHistoryIndex = Number.isFinite(workspace.historyIndex)
          ? Math.min(workspace.historyIndex, restoredHistory.length - 1)
          : restoredHistory.length - 1;

        return {
          id: workspace.id || `page-${index + 1}`,
          name: workspace.name || (index === 0 ? "Main" : `Workspace ${index + 1}`),
          canvasJSON: workspace.canvasJSON || null,
          history: restoredHistory,
          historyIndex: restoredHistoryIndex,
          redoHistory: restoredRedoHistory,
          editorState: workspace.editorState || null,
          createdAt: workspace.createdAt || null,
          updatedAt: workspace.updatedAt || null,
        };
      });
      const activeId = restoredWorkspaces.some((workspace) => workspace.id === projectToLoad.activeWorkspaceId)
        ? projectToLoad.activeWorkspaceId
        : restoredWorkspaces[0].id;
      const activeWorkspace = restoredWorkspaces.find((workspace) => workspace.id === activeId) || restoredWorkspaces[0];

      previousWorkspaceIdRef.current = activeId;
      setWorkspaces(restoredWorkspaces);
      setActiveWorkspaceId(activeId);
      setActiveTool("select");
      setToolMessage("");
      toolManagerRef.current?.setActiveTool("select");
      setActiveObject(null);
      setSelectedLayerIds([]);

      await loadWorkspaceToCanvas(canvas, activeWorkspace);

      if (!isCurrentRestore) {

        return;

      }

      const activeWorkspaceEditorState = activeWorkspace.editorState || projectToLoad.editorState || {};
      const viewportTransform =
        activeWorkspaceEditorState.viewportTransform ||
        activeWorkspace.canvasJSON?.viewportTransform;

      if (Array.isArray(viewportTransform)) {

        canvas.setViewportTransform([...viewportTransform]);

      }

      if (Number.isFinite(activeWorkspaceEditorState.zoom)) {

        setZoom(activeWorkspaceEditorState.zoom);

      } else {

        setZoom(canvas.getZoom());

      }

      canvas.discardActiveObject();
      const restoredObjects = canvas.getObjects();

      restoredObjects.forEach((object) => {

        if (!object.excludeFromLayer) {

          object.set({
            selectable: true,
            evented: true,
          });

        }

        object.setCoords();

      });

      const activeObjectIds = Array.isArray(activeWorkspaceEditorState.activeObjectIds)
        ? activeWorkspaceEditorState.activeObjectIds
        : [];
      const selectedObjects = activeObjectIds
        .map((objectId) => restoredObjects.find((object) => object.editorId === objectId))
        .filter(Boolean);
      let restoredActiveObject = null;

      if (selectedObjects.length > 1) {

        restoredActiveObject = new fabric.ActiveSelection(selectedObjects, {
          canvas,
        });
        canvas.setActiveObject(restoredActiveObject);

      } else if (selectedObjects.length === 1) {

        restoredActiveObject = selectedObjects[0];
        canvas.setActiveObject(restoredActiveObject);

      }

      baseImageIdRef.current = canvas.getObjects().find((object) => object.isBaseImage)?.editorId || null;
      setActiveObject(restoredActiveObject);
      setSelectedLayerIds(selectedObjects.map((object) => object.editorId).filter(Boolean));
      refreshSelectionOutline(restoredActiveObject);
      syncObjects(canvas);
      canvas.requestRenderAll();

      const initialEntry = createHistoryEntry(canvas);
      const activeSavedHistory = activeWorkspace.history || [];
      const activeSavedHistoryIndex = Number.isFinite(activeWorkspace.historyIndex)
        ? Math.min(activeWorkspace.historyIndex, activeSavedHistory.length - 1)
        : activeSavedHistory.length - 1;
      const nextHistory =
        activeSavedHistory.length > 0 && activeSavedHistoryIndex >= 0
          ? activeSavedHistory.slice(0, activeSavedHistoryIndex + 1)
          : [initialEntry];
      const nextRedoHistory = Array.isArray(activeWorkspace.redoHistory) ? activeWorkspace.redoHistory : [];
      const nextHistoryIndex = nextHistory.length - 1;

      historyRef.current = nextHistory;
      redoHistoryRef.current = nextRedoHistory;
      historyIndexRef.current = nextHistoryIndex;
      lastHistorySignatureRef.current = getHistorySignature(nextHistory[nextHistory.length - 1]);
      setHistory(nextHistory);
      setHistoryIndex(nextHistoryIndex);

      setWorkspaces((currentWorkspaces) =>
        currentWorkspaces.map((workspace) =>
          workspace.id === activeId
            ? {
                ...workspace,
                canvasJSON: initialEntry.canvasJSON,
                history: nextHistory,
                historyIndex: nextHistoryIndex,
                redoHistory: nextRedoHistory,
              }
            : workspace,
        ),
      );

      isRestoringHistoryRef.current = false;
    };

    void restoreProject().catch((error) => {

      console.error("Unable to restore saved project:", error);

      isRestoringHistoryRef.current = false;

    });

    return () => {

      isCurrentRestore = false;

    };

  }, [canvas, loadWorkspaceToCanvas, projectToLoad, refreshSelectionOutline, setActiveObject, setActiveWorkspaceId, setSelectedLayerIds, setWorkspaces, syncObjects]);



  const isCanvasSizedToWorkspace = useCallback(() => {

    if (!canvas || !canvasContainerRef.current) {

      return false;

    }



    const container = canvasContainerRef.current;



    if (container.clientWidth <= 0 || container.clientHeight <= 0) {

      return false;

    }



    return (

      Math.abs(canvas.getWidth() - container.clientWidth) <= 1 &&

      Math.abs(canvas.getHeight() - container.clientHeight) <= 1

    );

  }, [canvas]);



  const centerBaseImageInWorkspace = useCallback(() => {

    if (!canvas || !canvasContainerRef.current) {

      return false;

    }



    const canvasWidth = canvas.getWidth();

    const canvasHeight = canvas.getHeight();



    if (canvasWidth <= 0 || canvasHeight <= 0) {

      return false;

    }



    const baseImage = getBaseImageObject(canvas);



    if (!baseImage || !baseImage.width || !baseImage.height) {

      return false;

    }



    const scale = Math.min(

      canvasWidth / baseImage.width,

      canvasHeight / baseImage.height,

      1,

    );



    baseImageIdRef.current = baseImage.editorId;

    baseImage.isBaseImage = true;

    baseImage.set({

      scaleX: scale,

      scaleY: scale,

      left: canvasWidth / 2,

      top: canvasHeight / 2,

      originX: "center",

      originY: "center",

    });

    baseImage.setCoords();

    canvas.setActiveObject(baseImage);

    refreshSelectionOutline(baseImage);

    syncObjects(canvas);



    return true;

  }, [canvas, refreshSelectionOutline, syncObjects]);



  const shouldRecenterRestoredBaseImage = useCallback(() => {

    if (!canvas || !isCanvasSizedToWorkspace()) {

      return false;

    }



    const layerObjects = canvas.getObjects().filter((object) => !object.excludeFromLayer);



    if (layerObjects.length !== 1) {

      return false;

    }



    const baseImage = getBaseImageObject(canvas);



    if (!baseImage) {

      return false;

    }



    const viewportTransform = Array.isArray(canvas.viewportTransform)

      ? canvas.viewportTransform

      : [1, 0, 0, 1, 0, 0];

    const [a, b, c, d, e, f] = viewportTransform;

    const hasDefaultViewport =

      Math.abs(a - 1) <= 0.001 &&

      Math.abs(b) <= 0.001 &&

      Math.abs(c) <= 0.001 &&

      Math.abs(d - 1) <= 0.001 &&

      Math.abs(e) <= 0.001 &&

      Math.abs(f) <= 0.001;



    if (!hasDefaultViewport) {

      return false;

    }



    const centerPoint = baseImage.getCenterPoint();



    return (

      Math.abs(centerPoint.x - INITIAL_CANVAS_WIDTH / 2) <= 2 &&

      Math.abs(centerPoint.y - INITIAL_CANVAS_HEIGHT / 2) <= 2 &&

      (Math.abs(canvas.getWidth() - INITIAL_CANVAS_WIDTH) > 1 ||

        Math.abs(canvas.getHeight() - INITIAL_CANVAS_HEIGHT) > 1)

    );

  }, [canvas, isCanvasSizedToWorkspace]);



  const updateCanvasSize = useCallback(() => {

    if (!canvas || !canvasContainerRef.current) {

      return;

    }



    const container = canvasContainerRef.current;



    const nextWidth = Math.max(1, Math.round(container.clientWidth));

    const nextHeight = Math.max(1, Math.round(container.clientHeight));

    if (nextWidth <= 0 || nextHeight <= 0) {

      return;

    }



    const previousWidth = canvas.getWidth();

    const previousHeight = canvas.getHeight();

    const widthDelta = nextWidth - previousWidth;

    const heightDelta = nextHeight - previousHeight;

    const hasSizeChanged = Math.abs(widthDelta) > 1 || Math.abs(heightDelta) > 1;

    if (hasSizeChanged) {

      canvas.setWidth(nextWidth);

      canvas.setHeight(nextHeight);

      if (baseImageInitializedRef.current && Array.isArray(canvas.viewportTransform)) {

        const nextViewportTransform = [...canvas.viewportTransform];

        nextViewportTransform[4] += widthDelta / 2;

        nextViewportTransform[5] += heightDelta / 2;

        canvas.setViewportTransform(nextViewportTransform);

      }

      canvas.calcOffset();

    }



    if (!baseImageInitializedRef.current) {

      const centered = centerBaseImageInWorkspace();



      if (centered) {

        baseImageInitializedRef.current = true;

      }

    }



    canvas.requestRenderAll();

  }, [canvas, centerBaseImageInWorkspace]);



  useEffect(() => {

    let resizeFrame = null;

    const handleResize = () => {

      if (resizeFrame) {

        window.cancelAnimationFrame(resizeFrame);

      }

      resizeFrame = window.requestAnimationFrame(() => {

        resizeFrame = null;

        updateCanvasSize();

      });

    };



    const timer = window.setTimeout(() => updateCanvasSize(), 100);

    window.addEventListener("resize", handleResize);

    const resizeObserver =

      typeof ResizeObserver !== "undefined" && canvasContainerRef.current

        ? new ResizeObserver(handleResize)

        : null;

    resizeObserver?.observe(canvasContainerRef.current);



    return () => {

      if (resizeFrame) {

        window.cancelAnimationFrame(resizeFrame);

      }

      window.clearTimeout(timer);

      window.removeEventListener("resize", handleResize);

      resizeObserver?.disconnect();

    };

  }, [updateCanvasSize]);



  useEffect(() => {

    if (

      !canvas ||

      baseImageInitializedRef.current ||

      objects.length === 0 ||

      !isCanvasSizedToWorkspace()

    ) {

      return;

    }



    const centered = centerBaseImageInWorkspace();



    if (centered) {

      baseImageInitializedRef.current = true;

    }

  }, [canvas, centerBaseImageInWorkspace, isCanvasSizedToWorkspace, objects.length]);






  useEffect(() => {

    if (!canvas) {

      return undefined;

    }



    const handleSelection = (event) => {

      const selectedObject = event.selected?.[0] || canvas.getActiveObject() || null;

      if (selectedObject?.type === "image" && !selectedObject.excludeFromLayer) {

        selectedObject.hasBeenSelected = true;

      }

      refreshSelectionOutline(selectedObject);

    };



    const handleSelectionCleared = () => {

      refreshSelectionOutline(null);

    };



    const handleMouseMove = (event) => {

      const target = canvas.findTarget(event.e);

      

      if (target && target.type === "image" && !target.excludeFromLayer && target.editorId) {

        setHoveredLayerId(target.editorId);

      } else {

        setHoveredLayerId(null);

      }

    };



    const handleMouseOut = () => {

      setHoveredLayerId(null);

    };

    const keepTransformControlsVisible = (event) => {

      const target = event?.target || canvas.getActiveObject();

      if (!target || target.excludeFromLayer) {

        return;

      }

      if (target.type === "image" && !target.excludeFromLayer) {

        target.hasBeenSelected = true;

      }

      target.set({

        borderColor: "#22d3ee",

        cornerColor: "#22d3ee",

        cornerStrokeColor: "#22d3ee",

        cornerSize: 10,

        cornerStyle: "rect",

        transparentCorners: false,

        hasBorders: true,

        hasControls: true,

        hasRotatingPoint: true,

        rotatingPointOffset: 20,

        borderDashArray: [],

      });

      target.setCoords();

      if (canvas.getActiveObject() !== target) {

        canvas.setActiveObject(target);

        setActiveObject(target);

      }

    };



    const selectTargetObject = (target, event) => {

      if (!target || target.excludeFromLayer) {

        return false;

      }



      if (canvas.getActiveObject() === target) {

        return true;

      }



      canvas.discardActiveObject();

      target.set({

        selectable: true,

        evented: true,

      });



      // Mark image objects as hasBeenSelected to keep controls permanently visible

      if (target.type === "image" && !target.excludeFromLayer) {

        target.hasBeenSelected = true;

      }



      canvas.setActiveObject(target, event);

      setActiveObject(target);

      refreshSelectionOutline(target);

      syncObjects(canvas);

      canvas.requestRenderAll();

      return true;

    };



    const handleMouseClick = (event) => {

      const target = canvas.findTarget(event.e);



      if (selectTargetObject(target, event)) {

        return;

      }



      canvas.discardActiveObject();

      setActiveObject(null);

      refreshSelectionOutline(null);

      syncObjects(canvas);

      canvas.requestRenderAll();

    };



    canvas.on("selection:created", handleSelection);

    canvas.on("selection:updated", handleSelection);

    canvas.on("selection:cleared", handleSelectionCleared);

    canvas.on("mouse:move", handleMouseMove);

    canvas.on("mouse:out", handleMouseOut);

    canvas.on("mouse:down", handleMouseClick);

    canvas.on("object:moving", keepTransformControlsVisible);



    return () => {
      canvas.off("selection:created", handleSelection);
      canvas.off("selection:updated", handleSelection);
      canvas.off("selection:cleared", handleSelectionCleared);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:out", handleMouseOut);
      canvas.off("mouse:down", handleMouseClick);
      canvas.off("object:moving", keepTransformControlsVisible);
    };

  }, [canvas, refreshSelectionOutline, setHoveredLayerId, objects, setActiveObject, syncObjects]);



  useEffect(() => {

    if (!canvas || !canvas.getElement() || !canvas.getContext()) {

      return undefined;

    }



    const handleWheel = (event) => {

      const e = event.e;



      // Only handle zoom when Ctrl key is pressed

      if (!e.ctrlKey) {

        return;

      }



      // Additional canvas validation

      if (!canvas || !canvas.getContext()) {

        return;

      }



      e.preventDefault();

      e.stopPropagation();



      const delta = e.deltaY;

      const activeObject = canvas.getActiveObject();



      // Define zoom limits

      const MIN_ZOOM = 0.2;

      const MAX_ZOOM = 5;

      const MIN_OBJECT_SCALE = 0.1;

      const MAX_OBJECT_SCALE = 10;

      

      try {

        if (activeObject) {

          // OBJECT SCALE - Scale selected object

          let scale = activeObject.scaleX || 1;

          scale *= delta > 0 ? 0.95 : 1.05;

          scale = Math.max(MIN_OBJECT_SCALE, Math.min(scale, MAX_OBJECT_SCALE));



          activeObject.set({

            scaleX: scale,

            scaleY: scale,

          });

          activeObject.setCoords();



          // Only render if canvas context is available

          if (canvas.getContext()) {

            canvas.requestRenderAll();

            snapshotCanvas(canvas);

          }

        } else {

          // CANVAS ZOOM - Zoom canvas centered at mouse position

          let currentZoom = canvas.getZoom();

          currentZoom *= delta > 0 ? 0.95 : 1.05;

          currentZoom = Math.max(MIN_ZOOM, Math.min(currentZoom, MAX_ZOOM));



          // Use correct pointer coordinates (e.offsetX, e.offsetY) instead of transformed coordinates

          const point = new fabric.Point(e.offsetX, e.offsetY);



          // Use Fabric.js built-in zoomToPoint for proper zoom behavior

          canvas.zoomToPoint(point, currentZoom);



          // Update zoom state

          setZoom(currentZoom);



          // Optional: Prevent canvas drift by constraining viewport

          const vpt = canvas.viewportTransform;

          if (vpt) {

            const canvasWidth = canvas.getWidth();

            const canvasHeight = canvas.getHeight();

            

            vpt[4] = Math.min(0, Math.max(vpt[4], canvasWidth - canvasWidth * currentZoom));

            vpt[5] = Math.min(0, Math.max(vpt[5], canvasHeight - canvasHeight * currentZoom));

            

            canvas.setViewportTransform(vpt);

          }



          // Only render if canvas context is available

          if (canvas.getContext()) {

            canvas.requestRenderAll();

  
          }

        }

      } catch (error) {

        console.warn('Zoom operation failed:', error);

      }

    };



    // Use Fabric.js built-in mouse:wheel event

    canvas.on('mouse:wheel', handleWheel);



    return () => {

      canvas.off('mouse:wheel', handleWheel);

    };

  }, [canvas, setZoom, snapshotCanvas]);



  useEffect(() => {

    if (!canvas) {

      return;

    }



    // Sync layer selection with Fabric canvas

    const objects = canvas.getObjects().filter(obj =>

      selectedLayerIds.includes(obj.editorId)

    );



    if (objects.length > 1) {

      // Create multi-selection

      const selection = new fabric.ActiveSelection(objects, {

        canvas: canvas,

      });

      canvas.setActiveObject(selection);

      setActiveObject(selection);

    } else if (objects.length === 1) {

      // Single selection

      canvas.setActiveObject(objects[0]);

      setActiveObject(objects[0]);

    } else {

      // No selection

      canvas.discardActiveObject();

      setActiveObject(null);

    }



    canvas.requestRenderAll();

  }, [selectedLayerIds, canvas, setActiveObject]);



  useEffect(() => {

    if (!canvas || objects.length === 0 || historyRef.current.length > 0) {

      return;

    }



    snapshotCanvas(canvas, { immediate: true });

  }, [canvas, objects.length, snapshotCanvas]);



  const selectTool = useCallback((toolId) => {

    setToolMessage("");

    setActiveTool(toolId);

  }, []);



  const updateToolSettings = useCallback((toolId, nextSettings) => {

    setToolSettings((currentSettings) => ({

      ...currentSettings,

      [toolId]: {

        ...currentSettings[toolId],

        ...nextSettings,

      },

    }));

  }, []);



  const switchToSelectMode = useCallback(() => {

    setToolMessage("");

    toolManagerRef.current?.setActiveTool("select");

    setActiveTool("select");

  }, []);



  const resolveToolSourceObject = useCallback(() => getSelectedOrBaseImageObject(canvas), [canvas]);



  const findImageTargetUnderCursor = useCallback((event) => {

    if (!canvas || !event) {

      return null;

    }

    

    let pointer;

    if (event.clientX !== undefined && event.clientY !== undefined) {

      // Direct pointer coordinates (like from mock events)

      pointer = { x: event.clientX, y: event.clientY };

    } else {

      // Fabric.js event structure

      pointer = canvas.getPointer(event);

    }

    

    const target = canvas.findTarget(pointer, null);

    

    // Only return image objects (not groups, text, shapes, etc.)

    if (target && target.type === "image" && !target.excludeFromLayer) {

      return target;

    }

    

    return null;

  }, [canvas]);



  const handleToolObjectCreated = useCallback(

    (fabricObject) => {

      if (!canvas) {

        return;

      }



      fabricObject.isBaseImage = false;

      canvas.add(fabricObject);

      canvas.setActiveObject(fabricObject);

      setActiveObject(fabricObject);

      refreshSelectionOutline(fabricObject);

      canvas.requestRenderAll();

      syncObjects(canvas);

      snapshotCanvas(canvas);

    },

    [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, syncObjects],

  );



  const handleEraserMutation = useCallback(() => {

    if (!canvas) {

      return;

    }



    canvas.requestRenderAll();

    syncObjects(canvas);

    snapshotCanvas(canvas);

  }, [canvas, snapshotCanvas, syncObjects]);



  const requestToolChange = useCallback((toolId) => {

    setActiveTool(toolId);

  }, []);



  useEffect(() => {

    if (!canvas) {

      return undefined;

    }



    const manager = new ToolManager({

      canvas,

      tools: {

        crop: new CropTool({

          canvas,

          fabric,

          findImageTargetUnderCursor,

          onObjectCreated: handleToolObjectCreated,

          onRequestToolChange: requestToolChange,

          onWarning: setToolMessage,

        }),

        draw: new DrawTool({

          canvas,

          fabric,

          findImageTargetUnderCursor,

          onObjectCreated: handleToolObjectCreated,

          onRequestToolChange: requestToolChange,

          onWarning: setToolMessage,

        }),

        eraser: new EraserTool({

          canvas,

          fabric,

          findImageTargetUnderCursor,

          onCanvasMutation: handleEraserMutation,

          onWarning: setToolMessage,

        }),

      },

    });



    toolManagerRef.current = manager;



    return () => {

      manager.dispose();



      if (toolManagerRef.current === manager) {

        toolManagerRef.current = null;

      }

    };

  }, [canvas, handleEraserMutation, handleToolObjectCreated, requestToolChange, resolveToolSourceObject, findImageTargetUnderCursor]);



  const activeToolOptions = activeTool === "draw" ? toolSettings.draw : activeTool === "eraser" ? toolSettings.eraser : undefined;



  useEffect(() => {

    const manager = toolManagerRef.current;



    if (!manager) {

      return;

    }



    const activated = manager.setActiveTool(activeTool, activeToolOptions);



    if (!activated && activeTool !== "select") {

      setActiveTool("select");

    }

  }, [activeTool, activeToolOptions]);



  useEffect(() => {

    if (!canvas) {

      return undefined;

    }



    const shouldIgnoreHistoryEventTarget = (target) =>
      isRestoringHistoryRef.current ||
      !target ||
      target.excludeFromLayer ||
      target.excludeFromExport ||
      target.type === "path" ||
      target.type === "activeSelection";

    const handleObjectModified = (event) => {

      if (shouldIgnoreHistoryEventTarget(event?.target)) {

        return;

      }

      const activeObject = canvas.getActiveObject() || event?.target || null;

      if (activeObject && canvas.getActiveObject() !== activeObject) {

        canvas.setActiveObject(activeObject);

      }

      syncObjects(canvas);

      if (activeObject) {

        setActiveObject(activeObject);

      }

      refreshSelectionOutline(activeObject);

      snapshotCanvas(canvas);

    };

    const handleObjectCollectionChanged = (event) => {

      if (shouldIgnoreHistoryEventTarget(event?.target)) {

        return;

      }

      syncObjects(canvas);

      snapshotCanvas(canvas);

    };

    const handleTextChanged = (event) => {

      if (shouldIgnoreHistoryEventTarget(event?.target)) {

        return;

      }

      syncObjects(canvas);

      snapshotCanvas(canvas);

    };

    const handleExplicitHistoryChange = () => {

      if (isRestoringHistoryRef.current) {

        return;

      }

      syncObjects(canvas);

      snapshotCanvas(canvas);

    };



    canvas.on("object:modified", handleObjectModified);

    canvas.on("object:added", handleObjectCollectionChanged);

    canvas.on("object:removed", handleObjectCollectionChanged);

    canvas.on("text:changed", handleTextChanged);

    canvas.on("history:changed", handleExplicitHistoryChange);



    return () => {

      canvas.off("object:modified", handleObjectModified);

      canvas.off("object:added", handleObjectCollectionChanged);

      canvas.off("object:removed", handleObjectCollectionChanged);

      canvas.off("text:changed", handleTextChanged);

      canvas.off("history:changed", handleExplicitHistoryChange);

    };

  }, [canvas, snapshotCanvas, refreshSelectionOutline, setActiveObject, syncObjects]);



  const addText = useCallback(

    (options = {}) => {

      if (!canvas) {

        return;

      }



      switchToSelectMode();



      const canvasWidth = canvas.getWidth();

      const canvasHeight = canvas.getHeight();

      const textbox = new fabric.Textbox("Edit text", {

        left: canvasWidth / 2,

        top: canvasHeight / 2,

        originX: "center",

        originY: "center",

        width: 260,

        fontSize: options.fontSize || 36,

        fontFamily: options.fontFamily || "Inter, ui-sans-serif, system-ui",

        fontWeight: options.fontWeight || 700,

        fontStyle: options.fontStyle || "normal",

        underline: options.underline || false,

        textAlign: options.textAlign || "left",

        fill: options.color || "#f8fafc",

      });



      assignObjectMeta(textbox, getNextObjectName(canvas, "Text"), "text");

      textbox.isBaseImage = false;

      canvas.add(textbox);

      canvas.setActiveObject(textbox);

      setActiveObject(textbox);

      refreshSelectionOutline(textbox);

      canvas.requestRenderAll();

      syncObjects(canvas);

      snapshotCanvas(canvas);

    },

    [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, switchToSelectMode, syncObjects],

  );



  const updateSelectedTextProperties = useCallback((properties) => {

    if (!canvas) {

      return;

    }



    const activeObject = canvas.getActiveObject();



    if (!activeObject || activeObject.type !== "textbox") {

      return;

    }



    activeObject.set(properties);

    activeObject.setCoords();

    canvas.requestRenderAll();

    syncObjects(canvas);

    snapshotCanvas(canvas);

  }, [canvas, syncObjects, snapshotCanvas]);



  // Toggle between original and background-removed image
  const handleToggleBackground = useCallback(async () => {
    if (!originalImageData || !canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    const currentImage = activeObject;
    const currentDisplayWidth = currentImage.width * currentImage.scaleX;
    const currentDisplayHeight = currentImage.height * currentImage.scaleY;

    if (showOriginal) {
      // Switch back to background-removed version
      setShowOriginal(false);

      if (!originalImageData.processedBlob) {
        console.error("Processed image blob not available");
        return;
      }

      const processedUrl = URL.createObjectURL(originalImageData.processedBlob);

      fabric.Image.fromURL(processedUrl, (processedImage) => {
        if (!processedImage) {
          console.error("Failed to load processed image");
          URL.revokeObjectURL(processedUrl);
          return;
        }

        processedImage.set({
          left: currentImage.left,
          top: currentImage.top,
          scaleX: 1,
          scaleY: 1,
          angle: currentImage.angle,
          originX: currentImage.originX,
          originY: currentImage.originY,
          selectable: true,
          evented: true,
        });

        if (originalImageData.editorId) {
          processedImage.editorId = originalImageData.editorId;
        }
        if (originalImageData.name) {
          processedImage.name = originalImageData.name;
        }
        if (originalImageData.editorKind) {
          processedImage.editorKind = originalImageData.editorKind;
        }
        if (originalImageData.editorName) {
          processedImage.editorName = originalImageData.editorName;
        }

        processedImage.set({
          erasable: originalImageData.erasable ?? true,
          excludeFromLayer: originalImageData.excludeFromLayer ?? false,
        });

        canvas.remove(currentImage);
        canvas.add(processedImage);
        canvas.setActiveObject(processedImage);
        canvas.requestRenderAll();
        processedImage.setCoords();
        setActiveObject(processedImage);

        URL.revokeObjectURL(processedUrl);
      }, (error) => {
        console.error("Error loading processed image:", error);
        URL.revokeObjectURL(processedUrl);
      });
    } else {
      // Switch to original version
      setShowOriginal(true);

      if (!originalImageData.originalBlob) {
        console.error("Original image blob not available");
        return;
      }

      const originalUrl = URL.createObjectURL(originalImageData.originalBlob);

      fabric.Image.fromURL(originalUrl, (originalImage) => {
        if (!originalImage) {
          console.error("Failed to load original image");
          URL.revokeObjectURL(originalUrl);
          return;
        }

        originalImage.set({
          left: currentImage.left,
          top: currentImage.top,
          scaleX: 1,
          scaleY: 1,
          angle: currentImage.angle,
          originX: currentImage.originX,
          originY: currentImage.originY,
          selectable: true,
          evented: true,
        });

        if (originalImageData.editorId) {
          originalImage.editorId = originalImageData.editorId;
        }
        if (originalImageData.name) {
          originalImage.name = originalImageData.name;
        }
        if (originalImageData.editorKind) {
          originalImage.editorKind = originalImageData.editorKind;
        }
        if (originalImageData.editorName) {
          originalImage.editorName = originalImageData.editorName;
        }

        originalImage.set({
          erasable: originalImageData.erasable ?? true,
          excludeFromLayer: originalImageData.excludeFromLayer ?? false,
        });

        canvas.remove(currentImage);
        canvas.add(originalImage);
        canvas.setActiveObject(originalImage);
        canvas.requestRenderAll();
        originalImage.setCoords();
        setActiveObject(originalImage);

        URL.revokeObjectURL(originalUrl);
      }, (error) => {
        console.error("Error loading original image:", error);
        URL.revokeObjectURL(originalUrl);
      });
    }
  }, [canvas, originalImageData, showOriginal, setActiveObject]);



  const addShape = useCallback(

    (shapeType) => {

      if (!canvas) {

        return;

      }



      switchToSelectMode();



      let shape;



      if (shapeType === "circle") {

        shape = new fabric.Circle({

          ...shapeStyles,

          left: 150,

          top: 150,

          radius: 70,

        });

      } else if (shapeType === "triangle") {

        shape = new fabric.Triangle({

          ...shapeStyles,

          left: 160,

          top: 160,

          width: 150,

          height: 130,

        });

      } else {

        shape = new fabric.Rect({

          ...shapeStyles,

          left: 150,

          top: 150,

          width: 180,

          height: 120,

          rx: 8,

          ry: 8,

        });

      }



      assignObjectMeta(shape, getNextObjectName(canvas, "Shape"), "shape");

      shape.isBaseImage = false;

      canvas.add(shape);

      canvas.setActiveObject(shape);

      setActiveObject(shape);

      refreshSelectionOutline(shape);

      canvas.requestRenderAll();

      syncObjects(canvas);

      snapshotCanvas(canvas);

    },

    [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, switchToSelectMode, syncObjects],

  );



  const deleteSelected = useCallback(() => {

    const selectedObject = canvas?.getActiveObject();



    if (!canvas || !selectedObject) {

      return;

    }



    removeObjectFromCanvas(canvas, selectedObject);

    setActiveObject(null);

    refreshSelectionOutline(null);

    canvas.requestRenderAll();

    syncObjects(canvas);

    snapshotCanvas(canvas);

  }, [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, syncObjects]);



  const duplicateSelected = useCallback(async () => {

    const selectedObject = canvas?.getActiveObject();



    if (!canvas || !selectedObject || selectedObject.type === "activeSelection") {

      return;

    }



    const clonedObject = await cloneFabricObject(selectedObject);

    const prefixByKind = {

      text: "Text",

      shape: "Shape",

      crop: "Crop",

      cut: "Cut",

      line: "Line",

      arrow: "Arrow",

    };

    const prefix = prefixByKind[selectedObject.editorKind] || "Object";



    assignObjectMeta(clonedObject, getNextObjectName(canvas, prefix), selectedObject.editorKind || "object", {

      forceNewId: true,

    });

    clonedObject.isBaseImage = false;

    clonedObject.set({

      left: (selectedObject.left || 0) + 28,

      top: (selectedObject.top || 0) + 28,

      visible: true,

      selectable: true,

      evented: true,

    });

    clonedObject.setCoords();



    canvas.add(clonedObject);

    canvas.setActiveObject(clonedObject);

    setActiveObject(clonedObject);

    refreshSelectionOutline(clonedObject);

    canvas.requestRenderAll();

    syncObjects(canvas);

    snapshotCanvas(canvas);

  }, [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, syncObjects]);



  const addObjectToCanvas = useCallback(

    (fabricObject, { offset = 28, prefix = "Object" } = {}) => {

      if (!canvas || !fabricObject) {

        return;

      }



      assignObjectMeta(fabricObject, getNextObjectName(canvas, prefix), fabricObject.editorKind || "object", {

        forceNewId: true,

      });

      fabricObject.isBaseImage = false;

      fabricObject.set({

        left: (fabricObject.left || 0) + offset,

        top: (fabricObject.top || 0) + offset,

        visible: true,

        opacity: 1,

        selectable: true,

        evented: true,

      });

      fabricObject.setCoords();



      canvas.add(fabricObject);

      canvas.setActiveObject(fabricObject);

      setActiveObject(fabricObject);

      refreshSelectionOutline(fabricObject);

      canvas.requestRenderAll();

      syncObjects(canvas);

      snapshotCanvas(canvas);

    },

    [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, syncObjects],

  );



  const copySelected = useCallback(async () => {

    const selectedObject = canvas?.getActiveObject();



    if (!selectedObject || selectedObject.type === "activeSelection") {

      return;

    }



    if (selectedObject.type === "image" && typeof selectedObject.toDataURL === "function") {

      const dataUrl = selectedObject.toDataURL({

        format: "png",

        multiplier: 1,

      });



      if (dataUrl && dataUrl.length > 100) {

        clipboardObjectRef.current = {

          type: "rasterImage",

          dataUrl,

          editorKind: selectedObject.editorKind || "image",

          width: selectedObject.getScaledWidth?.() || selectedObject.width || 0,

          height: selectedObject.getScaledHeight?.() || selectedObject.height || 0,

        };

        return;

      }

    }



    clipboardObjectRef.current = {

      type: "fabricObject",

      object: await cloneFabricObject(selectedObject),

    };

  }, [canvas]);



  const pasteCopied = useCallback(async () => {

    if (!canvas || !clipboardObjectRef.current) {

      return false;

    }



    if (clipboardObjectRef.current.type === "rasterImage") {

      fabric.Image.fromURL(clipboardObjectRef.current.dataUrl, (image) => {

        if (!image || !image.width || !image.height) {

          return;

        }

        image.set({
          left: (canvas.getWidth() - image.width) / 2,
          top: (canvas.getHeight() - image.height) / 2,
          scaleX: 1,
          scaleY: 1,
          selectable: true,
          evented: true,
          erasable: true,
          visible: true,
          opacity: 1,
          hasBeenSelected: true,
        });

        image.editorKind = clipboardObjectRef.current.editorKind || "image";

        addObjectToCanvas(image, { offset: 0, prefix: "Object" });

      });



      return true;

    }



    const pastedObject = await cloneFabricObject(clipboardObjectRef.current.object);

    const prefixByKind = {

      text: "Text",

      shape: "Shape",

      crop: "Crop",

      cut: "Cut",

      draw: "Draw",

      line: "Line",

      arrow: "Arrow",

      upload: "Object",

      image: "Object",

    };

    const prefix = prefixByKind[pastedObject.editorKind] || "Object";



    addObjectToCanvas(pastedObject, { prefix });

    return true;

  }, [addObjectToCanvas, canvas]);



  const pasteClipboardImage = useCallback(

    async (clipboardData) => {

      if (!canvas || !clipboardData?.items?.length) {

        return false;

      }



      const imageItem = [...clipboardData.items].find((item) => item.type?.startsWith("image/"));



      if (!imageItem) {

        return false;

      }



      const file = imageItem.getAsFile();



      if (!file) {

        return false;

      }



      const dataUrl = await new Promise((resolve, reject) => {

        const reader = new FileReader();



        reader.onload = (event) => resolve(event.target?.result);

        reader.onerror = reject;

        reader.readAsDataURL(file);

      });



      fabric.Image.fromURL(dataUrl, (image) => {

        if (!image) {

          return;

        }

        image.set({
          left: (canvas.getWidth() - (image.width || 0)) / 2,
          top: (canvas.getHeight() - (image.height || 0)) / 2,
          scaleX: 1,
          scaleY: 1,
          selectable: true,
          evented: true,
          erasable: true,
          visible: true,
          opacity: 1,
          hasBeenSelected: true,
        });


        addObjectToCanvas(image, { offset: 0, prefix: "Object" });

      });



      return true;

    },

    [addObjectToCanvas, canvas],

  );



  const uploadImage = useCallback(

    (file) => {

      if (!canvas) {

        return;

      }



      switchToSelectMode();



      const reader = new FileReader();



      reader.onload = (event) => {

        fabric.Image.fromURL(event.target?.result, (image) => {

          if (!image) {

            return;

          }

          image.set({
            left: 100,
            top: 100,
            scaleX: 1,
            scaleY: 1,
            originX: 'left',
            originY: 'top',
            selectable: true,
            evented: true,
            erasable: true,
            hasBeenSelected: true, // Show controls immediately when uploaded
          });

          image.setCoords();



          assignObjectMeta(image, getNextObjectName(canvas, "Object"), "upload", {

            forceNewId: true,

          });

          image.isBaseImage = false;



          canvas.add(image);

          canvas.setActiveObject(image);

          setActiveObject(image);

          refreshSelectionOutline(image);

          canvas.requestRenderAll();

          syncObjects(canvas);

          snapshotCanvas(canvas);

        });

      };



      reader.readAsDataURL(file);

    },

    [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, switchToSelectMode, syncObjects],

  );



  const addLine = useCallback(() => {

    if (!canvas) {

      return;

    }



    switchToSelectMode();



    const line = new fabric.Line([50, 100, 200, 100], {

      ...shapeStyles,

      strokeWidth: 3,

      selectable: true,

      evented: true,

    });



    assignObjectMeta(line, getNextObjectName(canvas, "Line"), "line");

    line.isBaseImage = false;

    canvas.add(line);

    canvas.setActiveObject(line);

    setActiveObject(line);

    refreshSelectionOutline(line);

    canvas.requestRenderAll();

    syncObjects(canvas);

    snapshotCanvas(canvas);

  }, [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, switchToSelectMode, syncObjects]);



  const addArrow = useCallback(() => {

    if (!canvas) {

      return;

    }



    switchToSelectMode();



    const line = new fabric.Line([50, 100, 150, 100], {

      ...shapeStyles,

      strokeWidth: 3,

      selectable: false,

      evented: false,

    });



    const triangle = new fabric.Triangle({

      ...shapeStyles,

      left: 150,

      top: 100,

      width: 20,

      height: 20,

      angle: 90,

      selectable: false,

      evented: false,

    });



    const arrow = new fabric.Group([line, triangle], {

      left: 100,

      top: 100,

      selectable: true,

      evented: true,

    });



    assignObjectMeta(arrow, getNextObjectName(canvas, "Arrow"), "arrow");

    arrow.isBaseImage = false;

    canvas.add(arrow);

    canvas.setActiveObject(arrow);

    setActiveObject(arrow);

    refreshSelectionOutline(arrow);

    canvas.requestRenderAll();

    syncObjects(canvas);

    snapshotCanvas(canvas);

  }, [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, switchToSelectMode, syncObjects]);



  const restoreHistoryEntry = useCallback(
    (historyEntry, undoStack = historyRef.current, redoStack = redoHistoryRef.current) => {
      const normalizedEntry = normalizeHistoryEntry(historyEntry);

      if (!canvas || !normalizedEntry || isRestoringHistoryRef.current) {
        return;
      }

      isRestoringHistoryRef.current = true;
      canvas.discardActiveObject();
      canvas.clear();

      canvas.loadFromJSON(normalizedEntry.canvasJSON, () => {
        const restoredObjects = canvas.getObjects();

        restoredObjects.forEach((object) => {
          if (!object.excludeFromLayer) {
            object.set({
              selectable: true,
              evented: true,
            });
          }

          object.setCoords();
        });

        const selectedIds = Array.isArray(normalizedEntry.activeObjectIds)
          ? normalizedEntry.activeObjectIds
          : [];
        const selectedObjects = selectedIds
          .map((objectId) => restoredObjects.find((object) => object.editorId === objectId))
          .filter(Boolean);

        let restoredActiveObject = null;

        if (selectedObjects.length > 1) {
          restoredActiveObject = new fabric.ActiveSelection(selectedObjects, {
            canvas,
          });
          canvas.setActiveObject(restoredActiveObject);
        } else if (selectedObjects.length === 1) {
          restoredActiveObject = selectedObjects[0];
          canvas.setActiveObject(restoredActiveObject);
        }

        if (Array.isArray(normalizedEntry.viewportTransform)) {
          canvas.setViewportTransform([...normalizedEntry.viewportTransform]);
        }

        setZoom(Number.isFinite(normalizedEntry.zoom) ? normalizedEntry.zoom : canvas.getZoom());
        setActiveObject(restoredActiveObject);
        setSelectedLayerIds(selectedObjects.map((object) => object.editorId).filter(Boolean));
        refreshSelectionOutline(restoredActiveObject);
        canvas.requestRenderAll();
        syncObjects(canvas);

        lastHistorySignatureRef.current = getHistorySignature(normalizedEntry);
        persistHistoryState(canvas, undoStack, redoStack);
        isRestoringHistoryRef.current = false;
      });
    },
    [canvas, persistHistoryState, refreshSelectionOutline, setActiveObject, setSelectedLayerIds, syncObjects],
  );



  const undo = useCallback(() => {
    if (isRestoringHistoryRef.current) {
      return;
    }

    flushPendingHistorySave();

    if (historyRef.current.length <= 1) {
      return;
    }

    const currentEntry = historyRef.current[historyRef.current.length - 1] || createHistoryEntry(canvas);
    const nextUndoHistory = historyRef.current.slice(0, -1);
    const nextRedoHistory = [currentEntry, ...redoHistoryRef.current].slice(0, HISTORY_LIMIT);
    const previousEntry = nextUndoHistory[nextUndoHistory.length - 1];

    historyRef.current = nextUndoHistory;
    redoHistoryRef.current = nextRedoHistory;
    historyIndexRef.current = nextUndoHistory.length - 1;
    setHistory(nextUndoHistory);
    setHistoryIndex(nextUndoHistory.length - 1);

    restoreHistoryEntry(previousEntry, nextUndoHistory, nextRedoHistory);
  }, [flushPendingHistorySave, restoreHistoryEntry]);



  const redo = useCallback(() => {
    if (isRestoringHistoryRef.current) {
      return;
    }

    flushPendingHistorySave();

    if (redoHistoryRef.current.length === 0) {
      return;
    }

    const [nextEntry, ...remainingRedoHistory] = redoHistoryRef.current;
    const nextUndoHistory = [...historyRef.current, nextEntry].slice(-HISTORY_LIMIT);

    historyRef.current = nextUndoHistory;
    redoHistoryRef.current = remainingRedoHistory;
    historyIndexRef.current = nextUndoHistory.length - 1;
    setHistory(nextUndoHistory);
    setHistoryIndex(nextUndoHistory.length - 1);

    restoreHistoryEntry(nextEntry, nextUndoHistory, remainingRedoHistory);
  }, [flushPendingHistorySave, restoreHistoryEntry]);



  const saveActiveWorkspaceState = useCallback(() => {

    if (!canvas || !activeWorkspaceId) {

      return;

    }

    flushPendingHistorySave();

    const currentEntry = historyRef.current[historyRef.current.length - 1] || createHistoryEntry(canvas);
    const nextHistory = historyRef.current.length ? historyRef.current : [currentEntry];
    const nextHistoryIndex = historyRef.current.length ? historyIndexRef.current : 0;



    saveWorkspace(activeWorkspaceId, {

      canvasJSON: currentEntry.canvasJSON,

      history: nextHistory,

      historyIndex: nextHistoryIndex,

      redoHistory: redoHistoryRef.current,

    });

  }, [activeWorkspaceId, canvas, flushPendingHistorySave, saveWorkspace]);



  const handleSwitchWorkspace = useCallback(

    (workspaceId) => {

      saveActiveWorkspaceState();

      switchWorkspace(workspaceId, null);

    },

    [saveActiveWorkspaceState, switchWorkspace],

  );



  const handleCreateWorkspace = useCallback(

    (name) => {

      saveActiveWorkspaceState();

      createWorkspaceFromCurrentCanvas(null, name?.trim() || "New");

    },

    [createWorkspaceFromCurrentCanvas, saveActiveWorkspaceState],

  );



  const handleDeleteWorkspace = useCallback(

    (workspaceId) => {

      if (workspaces.length <= 1) {

        return;

      }



      const workspaceIndex = workspaces.findIndex((workspace) => workspace.id === workspaceId);

      const remainingWorkspaces = workspaces.filter((workspace) => workspace.id !== workspaceId);

      const previousWorkspace = workspaceIndex > 0 ? workspaces[workspaceIndex - 1] : null;

      const nextWorkspace = workspaceIndex >= 0 ? workspaces[workspaceIndex + 1] : null;

      const nextActiveId =

        workspaceId === activeWorkspaceId

          ? previousWorkspace?.id || nextWorkspace?.id || remainingWorkspaces[0]?.id

          : activeWorkspaceId;



      if (workspaceId === activeWorkspaceId) {

        previousWorkspaceIdRef.current = "";

      } else {

        saveActiveWorkspaceState();

      }



      setWorkspaces(remainingWorkspaces);



      if (nextActiveId) {

        setActiveWorkspaceId(nextActiveId);

      }

    },

    [activeWorkspaceId, saveActiveWorkspaceState, setActiveWorkspaceId, setWorkspaces, workspaces],

  );



  const zoomIn = useCallback(() => {

    if (!canvas) {

      return;

    }



    const nextZoom = Math.min(zoom * 1.2, 5);

    const activeObject = canvas.getActiveObject();

    

    if (activeObject) {

      // Get the center point of the selected object

      const objectCenter = activeObject.getCenterPoint();

      

      // Calculate the viewport transform to center on the object

      const canvasCenter = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);

      const viewportTransform = canvas.viewportTransform;

      

      // Calculate the new viewport transform to zoom into the object

      const newViewportTransform = [

        nextZoom,

        0,

        0,

        nextZoom,

        canvasCenter.x - objectCenter.x * nextZoom,

        canvasCenter.y - objectCenter.y * nextZoom

      ];

      

      canvas.setViewportTransform(newViewportTransform);

    } else {

      // No object selected, zoom to canvas center

      canvas.setZoom(nextZoom);

    }

    

    setZoom(nextZoom);

    canvas.requestRenderAll();

  }, [canvas, zoom]);



  const zoomOut = useCallback(() => {

    if (!canvas) {

      return;

    }



    const nextZoom = Math.max(zoom / 1.2, 0.1);

    const activeObject = canvas.getActiveObject();

    

    if (activeObject) {

      // Get the center point of the selected object

      const objectCenter = activeObject.getCenterPoint();

      

      // Calculate the viewport transform to center on the object

      const canvasCenter = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);

      const viewportTransform = canvas.viewportTransform;

      

      // Calculate the new viewport transform to zoom into the object

      const newViewportTransform = [

        nextZoom,

        0,

        0,

        nextZoom,

        canvasCenter.x - objectCenter.x * nextZoom,

        canvasCenter.y - objectCenter.y * nextZoom

      ];

      

      canvas.setViewportTransform(newViewportTransform);

    } else {

      // No object selected, zoom to canvas center

      canvas.setZoom(nextZoom);

    }

    

    setZoom(nextZoom);

    canvas.requestRenderAll();

  }, [canvas, zoom]);



  const resetCanvas = useCallback(() => {

    if (!canvas) {

      return;

    }



    // Clear all objects from canvas

    canvas.clear();

    

    // Reset zoom and viewport

    setZoom(1);

    canvas.setZoom(1);

    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    

    // Restore the original uploaded image

    // We need to reload the original image from the stored URL

    // since cropping might have replaced the base image

    if (imageUrl) {

      // Create a new image from the original URL

      fabric.Image.fromURL(imageUrl, (originalImage) => {

        if (!originalImage) {

          console.error("Failed to load original image for reset");

          return;

        }

        

        // Set the original image properties to center it without scaling
        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();

        originalImage.set({
          left: canvasWidth / 2,
          top: canvasHeight / 2,
          originX: 'center',
          originY: 'center',
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          visible: true,
          selectable: true,
          evented: true,
        });

        

        // Add metadata to the original image

        assignObjectMeta(originalImage, "Original Image", "image");

        originalImage.isBaseImage = true;

        originalImage.setCoords();

        

        // Add the original image to canvas

        canvas.add(originalImage);

        canvas.setActiveObject(originalImage);

        setActiveObject(originalImage);

        baseImageIdRef.current = originalImage.editorId;

        

        // Apply selection outline

        refreshSelectionOutline(originalImage);

        canvas.requestRenderAll();

        syncObjects(canvas);

      });

    }

    

    // Clear history and reset state

    setHistory([]);

    setHistoryIndex(-1);

    historyRef.current = [];

    redoHistoryRef.current = [];

    historyIndexRef.current = -1;

    lastHistorySignatureRef.current = "";

    if (pendingHistorySaveRef.current) {

      window.clearTimeout(pendingHistorySaveRef.current);

      pendingHistorySaveRef.current = null;

      pendingHistoryCanvasRef.current = null;

    }

    // Clear any active tool

    setActiveTool("select");

    setToolMessage("");

  }, [canvas, refreshSelectionOutline, setActiveObject, syncObjects, imageUrl]);



  const saveProject = useCallback(async ({ silent = false } = {}) => {

    if (!canvas) {

      return null;

    }



    flushPendingHistorySave();

    if (!currentProjectIdRef.current) {

      currentProjectIdRef.current = createClientProjectId();

    }

    const hasProjectContent =
      canvas.getObjects().some((object) => !object.excludeFromLayer) ||
      workspaces.some((workspace) => workspace.canvasJSON?.objects?.length);

    if (silent && !hasProjectContent) {

      return null;

    }

    try {

      const currentCanvasJSON = await createProjectCanvasJSON(canvas);
      const activeObjectIds = getCanvasActiveObjectIds(canvas);
      const activeViewportTransform = Array.isArray(canvas.viewportTransform)
        ? [...canvas.viewportTransform]
        : [1, 0, 0, 1, 0, 0];
      const sourceWorkspaces = workspaces.length
        ? workspaces
        : [
            {
              id: activeWorkspaceId || "page-1",
              name: "Main",
              canvasJSON: currentCanvasJSON,
            },
          ];
      const preparedWorkspaces = [];

      for (const workspace of sourceWorkspaces) {

        const isActiveWorkspace = workspace.id === activeWorkspaceId;
        const canvasJSON =
          isActiveWorkspace
            ? currentCanvasJSON
            : await prepareWorkspaceCanvasJSON(workspace.canvasJSON);
        const canvasSize = getCanvasJSONSize(canvasJSON);
        const workspaceEditorState = isActiveWorkspace
          ? {
              zoom,
              activeObjectIds,
              viewportTransform: activeViewportTransform,
              canvasWidth: canvas.getWidth(),
              canvasHeight: canvas.getHeight(),
              objectCount: getWorkspaceObjectCount(canvasJSON),
            }
          : {
              ...(workspace.editorState || {}),
              canvasWidth: canvasSize.width,
              canvasHeight: canvasSize.height,
              viewportTransform:
                workspace.editorState?.viewportTransform ||
                (Array.isArray(canvasJSON?.viewportTransform) ? [...canvasJSON.viewportTransform] : null),
              objectCount: getWorkspaceObjectCount(canvasJSON),
            };

        preparedWorkspaces.push({
          id: workspace.id,
          name: workspace.name || "Workspace",
          canvasJSON,
          editorState: workspaceEditorState,
          createdAt: workspace.createdAt || null,
          updatedAt: new Date().toISOString(),
        });

      }

      let thumbnail = "";

      try {

        thumbnail = canvas.toDataURL({
          format: "jpeg",
          quality: 0.6,
          multiplier: 0.3,
          enableRetinaScaling: false,
        });

      } catch (thumbnailError) {

        console.warn("Unable to generate project thumbnail:", thumbnailError);

      }

      const savedProject = saveProjectRecord({
        id: currentProjectIdRef.current,
        name: currentProjectNameRef.current,
        thumbnail,
        activeWorkspaceId,
        workspaces: preparedWorkspaces,
        editorState: {
          zoom,
          activeObjectIds,
          viewportTransform: activeViewportTransform,
          canvasWidth: canvas.getWidth(),
          canvasHeight: canvas.getHeight(),
          workspaceCount: preparedWorkspaces.length,
        },
        metadata: {
          workspaceCount: preparedWorkspaces.length,
        },
      });

      currentProjectIdRef.current = savedProject.id;
      currentProjectNameRef.current = savedProject.name;

      if (!silent) {

        setSaveToast("Project Saved");

        window.setTimeout(() => {

          setSaveToast("");

        }, 1800);

      }

      return savedProject;

    } catch (error) {

      console.error("Unable to save project:", error);

      if (!silent) {

        setSaveToast("Project Save Failed");

        window.setTimeout(() => {

          setSaveToast("");

        }, 2200);

      }

      return null;

    }

  }, [activeWorkspaceId, canvas, flushPendingHistorySave, workspaces, zoom]);


  useEffect(() => {

    if (!canvas) {

      return undefined;

    }

    const autoSaveTimer = window.setInterval(() => {

      void saveProject({ silent: true });

    }, 15000);

    return () => {

      window.clearInterval(autoSaveTimer);

    };

  }, [canvas, saveProject]);



  const exportCanvas = useCallback(
    async (options = {}) => {
      if (!canvas) {
        return;
      }

      canvas.discardActiveObject();
      canvas.requestRenderAll();

      await exportWorkspaceImage(canvas, options);
    },
    [canvas],
  );

  const exportAllWorkspaces = useCallback(
    async (options = {}) => {
      if (!canvas) {
        return;
      }

      const syncedWorkspaces = workspaces.map((workspace) =>
        workspace.id === activeWorkspaceId
          ? { ...workspace, canvasJSON: canvas.toJSON(FABRIC_SERIALIZATION_PROPS) }
          : workspace,
      );

      await exportAllWorkspaceImages(syncedWorkspaces, canvas, options);
    },
    [activeWorkspaceId, canvas, workspaces],
  );



  const groupSelected = useCallback(() => {

    if (!canvas) {

      return;

    }



    const activeObject = canvas.getActiveObject();

    

    // If we have multiple objects selected, group them

    if (activeObject && activeObject.type === 'activeSelection') {

      const objects = activeObject.getObjects();

      if (objects.length > 1) {

        // Store original names before grouping

        const originalNames = objects.map(obj => ({

          name: obj.editorName || obj.name || "Object",

          type: obj.type || "object"

        }));

        

        // Use Fabric.js's built-in toGroup method which handles positioning correctly

        const group = activeObject.toGroup();

        

        // Assign metadata to the group

        assignObjectMeta(group, getNextObjectName(canvas, "Group"), "group");

        group.isBaseImage = false;

        

        // Store original names in the group object for later restoration

        group.originalNames = originalNames;

        

        // Ensure the group is visible and has proper properties

        group.set({

          visible: true,

          selectable: true,

          evented: true,

        });

        

        // Set the group as the active object

        canvas.setActiveObject(group);

        setActiveObject(group);

        refreshSelectionOutline(group);

        canvas.requestRenderAll();

        syncObjects(canvas);

        snapshotCanvas(canvas);

      }

    }

  }, [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, syncObjects]);



  const ungroupSelected = useCallback(() => {

    if (!canvas) {

      return;

    }



    const activeObject = canvas.getActiveObject();

    

    // If we have a group selected, ungroup it

    if (activeObject && activeObject.type === 'group') {

      // Use Fabric.js's built-in toActiveSelection method

      const selection = activeObject.toActiveSelection();

      

      // Ensure all objects are visible and selectable

      const objects = selection.getObjects();

      objects.forEach((obj, index) => {

        obj.set({

          visible: true,

          selectable: true,

          evented: true,

        });

        

        // Restore original name if available, otherwise use generic name

        const originalName = activeObject.originalNames?.[index]?.name || `${activeObject.editorName || "Group"} Item ${index + 1}`;

        const originalType = activeObject.originalNames?.[index]?.type || obj.type || "object";

        

        // Assign metadata to individual objects with original names

        assignObjectMeta(obj, originalName, originalType);

        obj.isBaseImage = false;

      });

      

      // Set the selection as the active object

      canvas.setActiveObject(selection);

      setActiveObject(selection);

      refreshSelectionOutline(selection);

      canvas.requestRenderAll();

      syncObjects(canvas);

      snapshotCanvas(canvas);

    }

  }, [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, syncObjects]);



  const toggleGroup = useCallback(() => {

    const activeObject = canvas?.getActiveObject();

    

    if (!activeObject) {

      return;

    }

    

    // If multiple objects are selected (activeSelection), group them

    if (activeObject.type === 'activeSelection') {

      groupSelected();

    }

    // If a group is selected, ungroup it

    else if (activeObject.type === 'group') {

      ungroupSelected();

    }

  }, [canvas, groupSelected, ungroupSelected]);



  useEffect(() => {

    const handleKeyDown = (event) => {

      if (!canvas) {

        return;

      }



      const targetTag = event.target?.tagName;



      if (targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT") {

        return;

      }



      if (event.key === "Delete" || event.key === "Backspace") {

        event.preventDefault();

        deleteSelected();

        return;

      }



      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {

        event.preventDefault();

        void copySelected();

        return;

      }



      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x") {

        event.preventDefault();

        void copySelected().then(() => deleteSelected());

        return;

      }



      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v" && clipboardObjectRef.current) {

        event.preventDefault();

        void pasteCopied();

        return;

      }



      const isModifierKey = event.ctrlKey || event.metaKey;

      if (isModifierKey && event.key.toLowerCase() === "z") {

        event.preventDefault();

        if (event.shiftKey) {

          redo();

        } else {

          undo();

        }

        return;

      }



      if (isModifierKey && event.key.toLowerCase() === "y") {

        event.preventDefault();

        redo();

        return;

      }



      if (event.ctrlKey && event.key.toLowerCase() === "d") {

        event.preventDefault();

        duplicateSelected();

        return;

      }



      if (event.ctrlKey && event.key.toLowerCase() === "g") {

        event.preventDefault();

        toggleGroup();

        return;

      }



      if (isModifierKey) {

        return;

      }



      switch (event.key.toLowerCase()) {

        case "v":

          selectTool("select");

          break;

        case "c":

          selectTool("crop");

          break;

        case "d":

          selectTool("draw");

          break;

        case "e":

          selectTool("eraser");

          break;

        case "t":

          addText();

          break;

        case "l":

          addLine();

          break;

        case "a":

          addArrow();

          break;

        case "r":

          addShape("rect");

          break;

        case "o":

          addShape("circle");

          break;

        default:

          break;

      }

    };



    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);

  }, [addArrow, addLine, addShape, addText, canvas, copySelected, deleteSelected, duplicateSelected, pasteCopied, redo, selectTool, toggleGroup, undo]);



  useEffect(() => {

    const handlePaste = (event) => {

      const targetTag = event.target?.tagName;



      if (targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT") {

        return;

      }



      const hasClipboardImage = [...(event.clipboardData?.items || [])].some((item) =>

        item.type?.startsWith("image/"),

      );



      if (hasClipboardImage) {

        event.preventDefault();

        void pasteClipboardImage(event.clipboardData);

      }

    };



    window.addEventListener("paste", handlePaste);

    return () => window.removeEventListener("paste", handlePaste);

  }, [pasteClipboardImage]);



  // Allow editor to open even without an image for empty workspace functionality



  return (

    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">

      {/* Workspace Manager */}

      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700">

        <WorkspaceManager

          workspaces={workspaces}

          activeWorkspaceId={activeWorkspaceId}

          onSwitchWorkspace={handleSwitchWorkspace}

          onCreateWorkspace={handleCreateWorkspace}

          onDeleteWorkspace={handleDeleteWorkspace}

        />

      </div>



      <TopBar

        canvas={canvas}

        onUndo={undo}

        onRedo={redo}

        onZoomIn={zoomIn}

        onZoomOut={zoomOut}

        onResetCanvas={resetCanvas}

        onExport={exportCanvas}

        onExportAll={exportAllWorkspaces}

        onSaveProject={saveProject}

        zoom={zoom}

        hasBackgroundRemoval={!!originalImageData}

        showOriginal={showOriginal}

        onToggleBackground={handleToggleBackground}

        onCanvasUpdate={() => {

          if (!canvas) {

            return;

          }



          syncObjects(canvas);

          snapshotCanvas(canvas);

        }}

      />

      {saveToast ? (
        <div className="fixed right-5 top-24 z-[60] rounded-lg border border-teal-300/40 bg-slate-900 px-4 py-2 text-sm font-semibold text-teal-100 shadow-xl shadow-black/30">
          {saveToast}
        </div>
      ) : null}



      <div className="flex min-h-0 flex-1 overflow-hidden">

        <LeftSidebar

          activeTool={activeTool}

          toolSettings={toolSettings}

          toolMessage={toolMessage}

          eraserSupported={eraserSupported}

          hasSelection={Boolean(activeObject)}

          onToolSelect={selectTool}

          onToolSettingsChange={updateToolSettings}

          onAddText={addText}

          onUpdateTextProperties={updateSelectedTextProperties}

          onAddShape={addShape}

          onDuplicate={duplicateSelected}

          onDelete={deleteSelected}

          onUpload={uploadImage}

        />



        <main className="relative flex min-w-0 flex-1 bg-slate-900">

          <div ref={canvasContainerRef} className="fabric-canvas-wrapper relative h-full w-full">

            <canvas ref={canvasElementRef} />

          </div>



          <FloatingToolbar

            selectedObject={activeObject}

            canvas={canvas}

            onGroup={toggleGroup}

            onUngroup={ungroupSelected}

            onDelete={deleteSelected}

            onDuplicate={duplicateSelected}

            onSelectTool={selectTool}

            activeTool={activeTool}

            originalImageData={originalImageData}

            setOriginalImageData={setOriginalImageData}

            onUpdate={() => {

              if (!canvas) {

                return;

              }



              syncObjects(canvas);

              snapshotCanvas(canvas);

            }}

          />

        </main>



        <RightPanel />

      </div>

    </div>

  );

}
