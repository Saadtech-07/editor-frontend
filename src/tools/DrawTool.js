import {
  applyCanvasCursor,
  assignObjectMeta,
  createRasterObjectFromRegion,
  getDrawCursor,
  getNextObjectName,
  getRectIntersection,
  normalizeCanvasRect,
  setCanvasObjectInteractivity,
  setCanvasObjectSelection,
} from "../utils/fabricHelpers.js";

const DEFAULT_DRAW_OPTIONS = {
  color: "#2dd4bf",
  size: 6,
};

export default class DrawTool {
  constructor({ canvas, fabric, findImageTargetUnderCursor, onObjectCreated, onRequestToolChange, onWarning }) {
    this.canvas = canvas;
    this.fabric = fabric;
    this.findImageTargetUnderCursor = findImageTargetUnderCursor;
    this.onObjectCreated = onObjectCreated;
    this.onRequestToolChange = onRequestToolChange;
    this.onWarning = onWarning;
    this.options = { ...DEFAULT_DRAW_OPTIONS };
    this.isProcessing = false;
    this.pathCreatedHandler = null;
  }

  activate(options = {}) {
    if (!this.canvas) {
      return false;
    }

    this.options = {
      ...this.options,
      ...options,
    };

    setCanvasObjectSelection(this.canvas, false);
    this.canvas.freeDrawingBrush = new this.fabric.PencilBrush(this.canvas);
    this.applyBrushOptions();
    applyCanvasCursor(this.canvas, getDrawCursor());
    this.canvas.isDrawingMode = true;

    this.canvas.off("path:created");
    this.pathCreatedHandler = (event) => {
      void this.handlePathCreated(event);
    };
    this.canvas.on("path:created", this.pathCreatedHandler);

    return true;
  }

  deactivate() {
    if (this.pathCreatedHandler) {
      this.canvas.off("path:created", this.pathCreatedHandler);
      this.pathCreatedHandler = null;
    }

    this.canvas.isDrawingMode = false;
    setCanvasObjectInteractivity(this.canvas, true);
    this.isProcessing = false;
  }

  setOptions(options = {}) {
    this.options = {
      ...this.options,
      ...options,
    };
    this.applyBrushOptions();
  }

  applyBrushOptions() {
    if (!this.canvas.freeDrawingBrush) {
      return;
    }

    this.canvas.freeDrawingBrush.width = this.options.size || DEFAULT_DRAW_OPTIONS.size;
    this.canvas.freeDrawingBrush.color = this.options.color || DEFAULT_DRAW_OPTIONS.color;
  }

  async handlePathCreated(event) {
    const path = event.path;
    if (this.isProcessing || !path) {
      return;
    }

    this.isProcessing = true;

    const pointer = this.canvas.getPointer(event.e);
    const allObjects = this.canvas.getObjects();
    let targetImage = this.findImageTargetUnderCursor?.(event.e) || null;

    const isValidImage = (obj) => obj?.type === "image" && !obj.excludeFromLayer;

    if (!isValidImage(targetImage)) {
      targetImage = null;
    }

    if (!targetImage) {
      for (let i = allObjects.length - 1; i >= 0; i--) {
        const obj = allObjects[i];
        if (!isValidImage(obj)) {
          continue;
        }

        const bounds = obj.getBoundingRect(true, true);
        if (pointer.x >= bounds.left && pointer.x <= bounds.left + bounds.width &&
            pointer.y >= bounds.top && pointer.y <= bounds.top + bounds.height) {
          targetImage = obj;
          break;
        }
      }
    }

    if (!targetImage) {
      const activeObject = this.canvas.getActiveObject();
      if (isValidImage(activeObject)) {
        targetImage = activeObject;
      }
    }

    if (!targetImage) {
      const pathBounds = normalizeCanvasRect(path.getBoundingRect(true, true));
      const pathCenter = path.getCenterPoint ? path.getCenterPoint() : {
        x: pathBounds.left + pathBounds.width / 2,
        y: pathBounds.top + pathBounds.height / 2,
      };

      for (let i = allObjects.length - 1; i >= 0; i--) {
        const obj = allObjects[i];
        if (!isValidImage(obj)) {
          continue;
        }

        if (typeof obj.containsPoint === "function") {
          try {
            if (obj.containsPoint(pathCenter)) {
              targetImage = obj;
              break;
            }
          } catch (error) {
            // fallback to bounds below
          }
        }
      }

      if (!targetImage) {
        for (let i = allObjects.length - 1; i >= 0; i--) {
          const obj = allObjects[i];
          if (!isValidImage(obj)) {
            continue;
          }
          const imageBounds = normalizeCanvasRect(obj.getBoundingRect(true, true));
          if (getRectIntersection(pathBounds, imageBounds)) {
            targetImage = obj;
            break;
          }
        }
      }
    }

    if (!targetImage) {
      this.onWarning?.("No image found under the drawn area. Please draw over an image.");
      this.canvas.requestRenderAll();
      this.isProcessing = false;
      return;
    }

    const image = targetImage;
    const pathBounds = normalizeCanvasRect(path.getBoundingRect(true, true));
    const imageBounds = normalizeCanvasRect(image.getBoundingRect(true, true));
    if (!getRectIntersection(pathBounds, imageBounds)) {
      this.onWarning?.("Draw area doesn't overlap with image. Please draw over the image.");
      this.canvas.requestRenderAll();
      this.isProcessing = false;
      return;
    }

    let hasValidSource = false;
    try {
      if (typeof image.toDataURL === "function") {
        const dataUrl = image.toDataURL({ format: "png", quality: 1 });
        if (dataUrl && dataUrl.length > 100) {
          hasValidSource = true;
        }
      }

      if (!hasValidSource && image._element) {
        if (image._element.src || image._element.currentSrc) {
          hasValidSource = true;
        }
      }

      if (!hasValidSource && typeof image.getSrc === "function") {
        const srcResult = image.getSrc();
        if (srcResult) {
          hasValidSource = true;
        }
      }

      if (!hasValidSource && image._element && image.width > 0 && image.height > 0) {
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 1;
        testCanvas.height = 1;
        const testCtx = testCanvas.getContext('2d');
        try {
          testCtx.drawImage(image._element, 0, 0, 1, 1);
          hasValidSource = true;
        } catch (drawError) {
          console.warn("Image draw test failed:", drawError);
        }
      }
    } catch (error) {
      console.warn("Image source validation failed:", error);
    }

    if (!hasValidSource) {
      this.onWarning?.("Image source is not available. Please try selecting a different image.");
      this.canvas.requestRenderAll();
      this.isProcessing = false;
      return;
    }

    try {
      const extractedImage = await createRasterObjectFromRegion({
        fabric: this.fabric,
        canvas: this.canvas,
        sourceObject: image,
        region: pathBounds,
        clipPath: path,
      });

      if (!extractedImage || extractedImage.type !== "image") {
        console.error("Invalid extracted image");
        this.onWarning?.("Draw created an empty image. Please try drawing a larger area.");
        return;
      }

      assignObjectMeta(extractedImage, getNextObjectName(this.canvas, "Draw"), "draw", {
        forceNewId: true,
      });

      this.onWarning?.("");
      this.onObjectCreated?.(extractedImage);
      this.onRequestToolChange?.("select");
    } catch (error) {
      console.error("Draw tool failed:", error);
      this.onWarning?.("Draw operation failed. Please try again.");
    } finally {
      if (path && this.canvas) {
        try {
          this.canvas.remove(path);
        } catch (removeError) {
          // ignore removal failures
        }
        this.canvas.requestRenderAll();
      }
      this.isProcessing = false;
    }
  }

  resolveSourceObject() {
    return this.canvas?.getActiveObject() || null;
  }

}
