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

import {
  exportAllWorkspaceImages,
  exportSingleObject,
  exportWorkspaceImage,
} from "../utils/exportUtils.js";

import {

  FABRIC_SERIALIZATION_PROPS,

  assignObjectMeta,

  cloneFabricObject,

  fitImageToCanvas,

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






export default function Editor({ imageUrl }) {

  const canvasElementRef = useRef(null);

  const canvasContainerRef = useRef(null);

  const toolManagerRef = useRef(null);

  const historyRef = useRef([]);

  const historyIndexRef = useRef(-1);

  const isRestoringHistoryRef = useRef(false);

  const previousWorkspaceIdRef = useRef("page-1");

  const clipboardObjectRef = useRef(null);

  const baseImageIdRef = useRef(null);

  const baseImageInitializedRef = useRef(false);

  // Background removal toggle state
  const [originalImageData, setOriginalImageData] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);

  useFabric(canvasElementRef, imageUrl);



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

    historyIndexRef.current = -1;

    previousWorkspaceIdRef.current = "page-1";

    baseImageIdRef.current = null;

    baseImageInitializedRef.current = false;

    setToolMessage("");

    setActiveTool("select");

    setWorkspaces([

      {

        id: "page-1",

        name: "Main",

        canvasJSON: null,

        history: [],

        historyIndex: -1,

      },

    ]);

    setActiveWorkspaceId("page-1");

  }, [imageUrl]);






  const snapshotCanvas = useCallback(

    (targetCanvas = canvas) => {

      if (!targetCanvas || isRestoringHistoryRef.current) {

        return;

      }



      const snapshot = JSON.stringify(targetCanvas.toJSON(FABRIC_SERIALIZATION_PROPS));

      const nextHistoryBase = historyRef.current.slice(0, historyIndexRef.current + 1);



      // Always add the snapshot to ensure each action is recorded

      const nextHistory = [...nextHistoryBase, snapshot].slice(-50);

      const nextIndex = nextHistory.length - 1;



      historyRef.current = nextHistory;

      historyIndexRef.current = nextIndex;

      setHistory(nextHistory);

      setHistoryIndex(nextIndex);

      if (activeWorkspaceId) {

        saveWorkspace(activeWorkspaceId, {

          canvasJSON: targetCanvas.toJSON(FABRIC_SERIALIZATION_PROPS),

          history: nextHistory,

          historyIndex: nextIndex,

        });

      }


    },

    [activeWorkspaceId, canvas, saveWorkspace],

  );



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



    const nextHistory = workspace.history || [];

    const nextHistoryIndex = workspace.historyIndex ?? (nextHistory.length ? nextHistory.length - 1 : -1);



    historyRef.current = nextHistory;

    historyIndexRef.current = nextHistoryIndex;

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

  }, [activeWorkspaceId, canvas, loadWorkspaceToCanvas, refreshSelectionOutline, setActiveObject, syncObjects, workspaces]);



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



    if (container.clientWidth <= 0 || container.clientHeight <= 0) {

      return;

    }



    canvas.setWidth(container.clientWidth);

    canvas.setHeight(container.clientHeight);



    if (!baseImageInitializedRef.current) {

      const centered = centerBaseImageInWorkspace();



      if (centered) {

        baseImageInitializedRef.current = true;

      }

    }



    canvas.requestRenderAll();

  }, [canvas, centerBaseImageInWorkspace]);



  useEffect(() => {

    const handleResize = () => {

      updateCanvasSize();

    };



    const timer = window.setTimeout(() => updateCanvasSize(), 100);

    window.addEventListener("resize", handleResize);



    return () => {

      window.clearTimeout(timer);

      window.removeEventListener("resize", handleResize);

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



    return () => {

      canvas.off("selection:created", handleSelection);

      canvas.off("selection:updated", handleSelection);

      canvas.off("selection:cleared", handleSelectionCleared);

      canvas.off("mouse:move", handleMouseMove);

      canvas.off("mouse:out", handleMouseOut);

      canvas.off("mouse:down", handleMouseClick);

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

    if (!canvas || objects.length === 0 || historyIndex !== -1) {

      return;

    }



    snapshotCanvas(canvas);

  }, [canvas, historyIndex, objects.length, snapshotCanvas]);



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



    const handleObjectModified = () => {

      const activeObject = canvas.getActiveObject();

      refreshSelectionOutline(activeObject);

      snapshotCanvas(canvas);

    };



      canvas.on("object:modified", handleObjectModified);



    return () => {

      canvas.off("object:modified", handleObjectModified);

    };

  }, [canvas, snapshotCanvas, refreshSelectionOutline]);



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

        const scaleForProcessed = currentDisplayWidth / processedImage.width;

        processedImage.set({
          left: currentImage.left,
          top: currentImage.top,
          scaleX: scaleForProcessed,
          scaleY: scaleForProcessed,
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

        const scaleForOriginal = currentDisplayWidth / originalImage.width;

        originalImage.set({
          left: currentImage.left,
          top: currentImage.top,
          scaleX: scaleForOriginal,
          scaleY: scaleForOriginal,
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



        const maxWidth = Math.max(160, canvas.getWidth() * 0.75);

        const maxHeight = Math.max(160, canvas.getHeight() * 0.75);

        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);



        image.set({

          left: (canvas.getWidth() - image.width * scale) / 2,

          top: (canvas.getHeight() - image.height * scale) / 2,

          scaleX: scale,

          scaleY: scale,

          selectable: true,

          evented: true,

          erasable: true,

          visible: true,

          opacity: 1,

          hasBeenSelected: true, // Show controls immediately when pasted

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



        const maxWidth = Math.max(160, canvas.getWidth() * 0.75);

        const maxHeight = Math.max(160, canvas.getHeight() * 0.75);

        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);



        image.set({

          left: (canvas.getWidth() - (image.width || 0) * scale) / 2,

          top: (canvas.getHeight() - (image.height || 0) * scale) / 2,

          scaleX: scale,

          scaleY: scale,

          selectable: true,

          evented: true,

          erasable: true,

          visible: true,

          opacity: 1,

          hasBeenSelected: true, // Show controls immediately when uploaded

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



          fitImageToCanvas(image, canvas);

          image.set({

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



  const loadHistoryState = useCallback(

    (nextIndex) => {

      if (!canvas || nextIndex < 0 || nextIndex >= historyRef.current.length) {

        return;

      }



      isRestoringHistoryRef.current = true;

      historyIndexRef.current = nextIndex;

      setHistoryIndex(nextIndex);



      canvas.loadFromJSON(historyRef.current[nextIndex], () => {

        canvas.discardActiveObject();

        setActiveObject(null);

        refreshSelectionOutline(null);

        canvas.requestRenderAll();

        syncObjects(canvas);

        if (activeWorkspaceId) {

          saveWorkspace(activeWorkspaceId, {

            canvasJSON: JSON.parse(historyRef.current[nextIndex]),

            history: historyRef.current,

            historyIndex: nextIndex,

          });

        }

        isRestoringHistoryRef.current = false;

      });

    },

    [activeWorkspaceId, canvas, refreshSelectionOutline, saveWorkspace, setActiveObject, syncObjects],

  );



  const undo = useCallback(() => {

    if (historyIndexRef.current > 0) {

      loadHistoryState(historyIndexRef.current - 1);

    }

  }, [loadHistoryState]);



  const redo = useCallback(() => {

    if (historyIndexRef.current < historyRef.current.length - 1) {

      loadHistoryState(historyIndexRef.current + 1);

    }

  }, [loadHistoryState]);



  const saveActiveWorkspaceState = useCallback(() => {

    if (!canvas || !activeWorkspaceId) {

      return;

    }



    saveWorkspace(activeWorkspaceId, {

      canvasJSON: canvas.toJSON(FABRIC_SERIALIZATION_PROPS),

      history: historyRef.current,

      historyIndex: historyIndexRef.current,

    });

  }, [activeWorkspaceId, canvas, saveWorkspace]);



  const handleSwitchWorkspace = useCallback(

    (workspaceId) => {

      saveActiveWorkspaceState();

      switchWorkspace(workspaceId, canvas);

    },

    [canvas, saveActiveWorkspaceState, switchWorkspace],

  );



  const handleCreateWorkspace = useCallback(

    (name) => {

      saveActiveWorkspaceState();

      createWorkspaceFromCurrentCanvas(canvas, name?.trim() || "New");

    },

    [canvas, createWorkspaceFromCurrentCanvas, saveActiveWorkspaceState],

  );



  const handleDeleteWorkspace = useCallback(

    (workspaceId) => {

      if (workspaces.length <= 1) {

        return;

      }



      const remainingWorkspaces = workspaces.filter((workspace) => workspace.id !== workspaceId);

      const nextActiveId =

        workspaceId === activeWorkspaceId

          ? remainingWorkspaces[0]?.id

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

        

        // FIX: Calculate proper scaling to fit canvas while maintaining aspect ratio

        const canvasWidth = canvas.getWidth();

        const canvasHeight = canvas.getHeight();

        const imageWidth = originalImage.width;

        const imageHeight = originalImage.height;

        

        // Calculate scale to fit image within canvas

        const scaleX = canvasWidth / imageWidth;

        const scaleY = canvasHeight / imageHeight;

        const scale = Math.min(scaleX, scaleY, 1); // Don't upscale, only downscale if needed

        

        // Set the original image properties to center it with proper scaling

        originalImage.set({

          left: canvasWidth / 2,

          top: canvasHeight / 2,

          originX: 'center',

          originY: 'center',

          scaleX: scale,

          scaleY: scale,

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

    historyIndexRef.current = -1;

    // Clear any active tool

    setActiveTool("select");

    setToolMessage("");

  }, [canvas, refreshSelectionOutline, setActiveObject, syncObjects, imageUrl]);



  const saveProject = useCallback(() => {

    if (!canvas) {

      return;

    }



    const projectData = {

      version: "1.0",

      canvas: canvas.toJSON(FABRIC_SERIALIZATION_PROPS),

      timestamp: new Date().toISOString(),

    };



    const blob = new Blob([JSON.stringify(projectData, null, 2)], {

      type: "application/json",

    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = `pixelforge-project-${Date.now()}.json`;

    link.click();

    URL.revokeObjectURL(url);

  }, [canvas]);



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

  const exportSelectedObject = useCallback(
    async (options = {}) => {
      const selectedObject = canvas?.getActiveObject() || activeObject;

      if (!selectedObject) {
        return;
      }

      await exportSingleObject(selectedObject, canvas, options);
    },
    [activeObject, canvas],
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



      if (event.ctrlKey && event.key.toLowerCase() === "d") {

        event.preventDefault();

        duplicateSelected();

        return;

      }



      if (event.ctrlKey && event.key.toLowerCase() === "z") {

        event.preventDefault();

        undo();

        return;

      }



      if (event.ctrlKey && event.key.toLowerCase() === "y") {

        event.preventDefault();

        redo();

        return;

      }



      if (event.ctrlKey && event.key.toLowerCase() === "g") {

        event.preventDefault();

        toggleGroup();

        return;

      }



      if (event.ctrlKey || event.metaKey) {

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

        onExportSelected={exportSelectedObject}

        onSaveProject={saveProject}

        zoom={zoom}

        activeObject={activeObject}

        hasBackgroundRemoval={!!originalImageData}

        showOriginal={showOriginal}

        onToggleBackground={handleToggleBackground}

      />



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

