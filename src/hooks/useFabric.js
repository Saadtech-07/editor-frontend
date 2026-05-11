import { useEffect, useRef } from "react";
import { fabric } from "fabric";
import { useEditor } from "../context/EditorContext.jsx";
import { ensureFabricEraserSupport } from "../utils/fabricEraserSupport.js";
import { assignObjectMeta, fitImageToCanvas } from "../utils/fabricHelpers.js";

const SNAP_SCREEN_THRESHOLD = 7;
const GUIDE_COLOR = "rgba(56, 189, 248, 0.95)";
const GUIDE_SHADOW = "rgba(15, 23, 42, 0.6)";

function getObjectBounds(fabricObject) {
  if (!fabricObject) {
    return null;
  }

  fabricObject.setCoords?.();

  const bounds = fabricObject.getBoundingRect(true, true);

  return {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
    right: bounds.left + bounds.width,
    bottom: bounds.top + bounds.height,
    centerX: bounds.left + bounds.width / 2,
    centerY: bounds.top + bounds.height / 2,
  };
}

function getAxisPoints(bounds, axis) {
  if (!bounds) {
    return [];
  }

  if (axis === "x") {
    return [
      { value: bounds.left, role: "edge" },
      { value: bounds.centerX, role: "center" },
      { value: bounds.right, role: "edge" },
    ];
  }

  return [
    { value: bounds.top, role: "edge" },
    { value: bounds.centerY, role: "center" },
    { value: bounds.bottom, role: "edge" },
  ];
}

function getCanvasSnapSources(canvas) {
  const width = canvas.getWidth();
  const height = canvas.getHeight();

  return {
    vertical: [
      { value: 0, role: "edge", kind: "canvas" },
      { value: width / 2, role: "center", kind: "canvas" },
      { value: width, role: "edge", kind: "canvas" },
    ],
    horizontal: [
      { value: 0, role: "edge", kind: "canvas" },
      { value: height / 2, role: "center", kind: "canvas" },
      { value: height, role: "edge", kind: "canvas" },
    ],
  };
}

function getSelectedSnapObjects(target) {
  const selectedObjects = new Set([target]);

  if (target?.type === "activeSelection" && typeof target.getObjects === "function") {
    target.getObjects().forEach((object) => selectedObjects.add(object));
  }

  return selectedObjects;
}

function getObjectSnapSources(canvas, selectedObjects) {
  const sources = getCanvasSnapSources(canvas);

  canvas.getObjects().forEach((object) => {
    if (
      !object ||
      selectedObjects.has(object) ||
      object.excludeFromLayer ||
      object.visible === false ||
      object.type === "activeSelection"
    ) {
      return;
    }

    const bounds = getObjectBounds(object);

    if (!bounds) {
      return;
    }

    sources.vertical.push(
      { value: bounds.left, role: "edge", kind: "object", bounds },
      { value: bounds.centerX, role: "center", kind: "object", bounds },
      { value: bounds.right, role: "edge", kind: "object", bounds },
    );

    sources.horizontal.push(
      { value: bounds.top, role: "edge", kind: "object", bounds },
      { value: bounds.centerY, role: "center", kind: "object", bounds },
      { value: bounds.bottom, role: "edge", kind: "object", bounds },
    );
  });

  return sources;
}

function findNearestSnap(targetPoints, sources, threshold) {
  let nearestSnap = null;

  targetPoints.forEach((targetPoint) => {
    sources.forEach((source) => {
      if (targetPoint.role !== source.role) {
        return;
      }

      const delta = source.value - targetPoint.value;
      const distance = Math.abs(delta);

      if (distance > threshold) {
        return;
      }

      if (!nearestSnap || distance < nearestSnap.distance) {
        nearestSnap = {
          delta,
          distance,
          source,
        };
      }
    });
  });

  return nearestSnap;
}

function createGuide(axis, snap, targetBounds, canvas) {
  if (!snap || !targetBounds) {
    return null;
  }

  const padding = 8;

  if (axis === "vertical") {
    const bounds = snap.source.bounds;

    return {
      axis,
      x: snap.source.value,
      y1: bounds ? Math.min(bounds.top, targetBounds.top) - padding : 0,
      y2: bounds ? Math.max(bounds.bottom, targetBounds.bottom) + padding : canvas.getHeight(),
    };
  }

  const bounds = snap.source.bounds;

  return {
    axis,
    y: snap.source.value,
    x1: bounds ? Math.min(bounds.left, targetBounds.left) - padding : 0,
    x2: bounds ? Math.max(bounds.right, targetBounds.right) + padding : canvas.getWidth(),
  };
}

function drawGuides(canvas, guides) {
  const context = canvas.contextTop;

  if (!context || (!guides.vertical.length && !guides.horizontal.length)) {
    return;
  }

  const zoom = Math.max(canvas.getZoom?.() || 1, 0.1);
  const viewportTransform = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];

  context.save();
  context.transform(...viewportTransform);
  context.strokeStyle = GUIDE_COLOR;
  context.lineWidth = 1 / zoom;
  context.shadowColor = GUIDE_SHADOW;
  context.shadowBlur = 2 / zoom;
  context.setLineDash([]);

  guides.vertical.forEach((guide) => {
    context.beginPath();
    context.moveTo(guide.x, guide.y1);
    context.lineTo(guide.x, guide.y2);
    context.stroke();
  });

  guides.horizontal.forEach((guide) => {
    context.beginPath();
    context.moveTo(guide.x1, guide.y);
    context.lineTo(guide.x2, guide.y);
    context.stroke();
  });

  context.restore();
}

export default function useFabric(canvasElementRef, imageUrl, options = {}) {
  const fabricCanvasRef = useRef(null);
  const { setCanvas, setActiveObject, syncObjects } = useEditor();
  const { skipInitialImageLoad = false } = options;

  useEffect(() => {
    void ensureFabricEraserSupport();
  }, []);

  useEffect(() => {
    if (!canvasElementRef.current || fabricCanvasRef.current) {
      return undefined;
    }
    
    const canvas = new fabric.Canvas(canvasElementRef.current, {
      width: 980,
      height: 660,
      backgroundColor: "#0f172a",
      preserveObjectStacking: true,
      selection: true,
      skipTargetFind: false,
      fireRightClick: true,
      selectionKey: 'ctrlKey',
      // Allow images to extend beyond canvas boundaries
      renderOnAddRemove: true,
    });

    const syncSelection = () => {
      setActiveObject(canvas.getActiveObject() || null);
      syncObjects(canvas);
    };

    const syncMutation = () => {
      syncObjects(canvas);
    };

    const activeGuides = {
      vertical: [],
      horizontal: [],
    };

    const hasActiveGuides = () => activeGuides.vertical.length > 0 || activeGuides.horizontal.length > 0;

    const setGuides = (nextGuides) => {
      activeGuides.vertical = nextGuides.vertical;
      activeGuides.horizontal = nextGuides.horizontal;
      canvas.requestRenderAll();
    };

    const clearGuides = () => {
      if (!hasActiveGuides()) {
        return;
      }

      activeGuides.vertical = [];
      activeGuides.horizontal = [];
      if (canvas.contextTop) {
        canvas.clearContext(canvas.contextTop);
      }
      canvas.requestRenderAll();
    };

    const handleBeforeRender = () => {
      if (hasActiveGuides() && canvas.contextTop) {
        canvas.clearContext(canvas.contextTop);
      }
    };

    const handleAfterRender = () => {
      drawGuides(canvas, activeGuides);
    };

    const handleObjectMoving = (event) => {
      const target = event?.target;

      if (!target || target.excludeFromLayer || target.visible === false) {
        clearGuides();
        return;
      }

      const targetBounds = getObjectBounds(target);

      if (!targetBounds) {
        clearGuides();
        return;
      }

      const selectedObjects = getSelectedSnapObjects(target);
      const sources = getObjectSnapSources(canvas, selectedObjects);
      const threshold = SNAP_SCREEN_THRESHOLD / Math.max(canvas.getZoom?.() || 1, 0.1);
      const horizontalSnap = findNearestSnap(getAxisPoints(targetBounds, "x"), sources.vertical, threshold);
      const verticalSnap = findNearestSnap(getAxisPoints(targetBounds, "y"), sources.horizontal, threshold);

      if (!horizontalSnap && !verticalSnap) {
        clearGuides();
        return;
      }

      target.set({
        left: (target.left || 0) + (horizontalSnap?.delta || 0),
        top: (target.top || 0) + (verticalSnap?.delta || 0),
      });
      target.setCoords();

      const snappedBounds = getObjectBounds(target);

      setGuides({
        vertical: horizontalSnap ? [createGuide("vertical", horizontalSnap, snappedBounds, canvas)].filter(Boolean) : [],
        horizontal: verticalSnap ? [createGuide("horizontal", verticalSnap, snappedBounds, canvas)].filter(Boolean) : [],
      });
    };

    fabricCanvasRef.current = canvas;
    setCanvas(canvas);

    canvas.on("selection:created", syncSelection);
    canvas.on("selection:updated", syncSelection);
    canvas.on("selection:cleared", syncSelection);
    canvas.on("object:added", syncMutation);
    canvas.on("object:removed", syncMutation);
    canvas.on("object:modified", syncMutation);
    canvas.on("object:moving", handleObjectMoving);
    canvas.on("object:modified", clearGuides);
    canvas.on("object:scaling", clearGuides);
    canvas.on("object:rotating", clearGuides);
    canvas.on("mouse:up", clearGuides);
    canvas.on("before:render", handleBeforeRender);
    canvas.on("after:render", handleAfterRender);

    return () => {
      canvas.off("selection:created", syncSelection);
      canvas.off("selection:updated", syncSelection);
      canvas.off("selection:cleared", syncSelection);
      canvas.off("object:added", syncMutation);
      canvas.off("object:removed", syncMutation);
      canvas.off("object:modified", syncMutation);
      canvas.off("object:moving", handleObjectMoving);
      canvas.off("object:modified", clearGuides);
      canvas.off("object:scaling", clearGuides);
      canvas.off("object:rotating", clearGuides);
      canvas.off("mouse:up", clearGuides);
      canvas.off("before:render", handleBeforeRender);
      canvas.off("after:render", handleAfterRender);
      canvas.dispose();
      fabricCanvasRef.current = null;
      setCanvas(null);
    };
  }, [canvasElementRef, setActiveObject, setCanvas, syncObjects]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return undefined;
    }

    canvas.clear();
    canvas.setBackgroundColor("#0f172a", canvas.requestRenderAll.bind(canvas));
    setActiveObject(null);

    if (skipInitialImageLoad) {
      syncObjects(canvas);
      return undefined;
    }

    if (!imageUrl) {
      syncObjects(canvas);
      return undefined;
    }

    let isCancelled = false;

    fabric.Image.fromURL(imageUrl, (image) => {
      if (isCancelled || !image) {
        return;
      }

      assignObjectMeta(image, "Object 1", "image");
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
      });
      image.setCoords();

      canvas.add(image);
      canvas.setActiveObject(image);
      setActiveObject(image);
      canvas.requestRenderAll();
      syncObjects(canvas);
    });

    return () => {
      isCancelled = true;
    };
  }, [imageUrl, setActiveObject, skipInitialImageLoad, syncObjects]);

  return fabricCanvasRef;
}
