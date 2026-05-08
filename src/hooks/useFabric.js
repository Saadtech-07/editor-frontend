import { useEffect, useRef } from "react";
import { fabric } from "fabric";
import { useEditor } from "../context/EditorContext.jsx";
import { ensureFabricEraserSupport } from "../utils/fabricEraserSupport.js";
import { assignObjectMeta, fitImageToCanvas } from "../utils/fabricHelpers.js";

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
      fireRightClick: false,
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

    fabricCanvasRef.current = canvas;
    setCanvas(canvas);

    canvas.on("selection:created", syncSelection);
    canvas.on("selection:updated", syncSelection);
    canvas.on("selection:cleared", syncSelection);
    canvas.on("object:added", syncMutation);
    canvas.on("object:removed", syncMutation);
    canvas.on("object:modified", syncMutation);

    return () => {
      canvas.off("selection:created", syncSelection);
      canvas.off("selection:updated", syncSelection);
      canvas.off("selection:cleared", syncSelection);
      canvas.off("object:added", syncMutation);
      canvas.off("object:removed", syncMutation);
      canvas.off("object:modified", syncMutation);
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
