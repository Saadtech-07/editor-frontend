import {
  applyCanvasCursor,
  assignObjectMeta,
  doesRectCoverRect,
  getCropCursor,
  getNextObjectName,
  getRectIntersection,
  normalizeCanvasRect,
  removeObjectFromCanvas,
  setCanvasObjectInteractivity,
  setCanvasObjectSelection,
} from "../utils/fabricHelpers.js";

const MIN_CROP_SIZE = 8;

export default class CropTool {
  constructor({ canvas, fabric, findImageTargetUnderCursor, onObjectCreated, onRequestToolChange, onWarning }) {
    this.canvas = canvas;
    this.fabric = fabric;
    this.findImageTargetUnderCursor = findImageTargetUnderCursor;
    this.onObjectCreated = onObjectCreated;
    this.onRequestToolChange = onRequestToolChange;
    this.onWarning = onWarning;
    this.dragStart = null;
    this.previewRect = null;
    this.sourceObject = null;
    this.isProcessing = false;
    this.handlers = null;
  }

  activate() {
    if (!this.canvas) {
      return false;
    }

    this.sourceObject = null; // Don't pre-select, find on mouse down
    this.canvas.selection = false;
    this.canvas.discardActiveObject();
    setCanvasObjectSelection(this.canvas, false); // Keep events enabled for hover
    applyCanvasCursor(this.canvas, getCropCursor());

    this.handlers = {
      mouseDown: (event) => this.handleMouseDown(event),
      mouseMove: (event) => this.handleMouseMove(event),
      mouseUp: () => {
        void this.handleMouseUp();
      },
    };

    this.canvas.on("mouse:down", this.handlers.mouseDown);
    this.canvas.on("mouse:move", this.handlers.mouseMove);
    this.canvas.on("mouse:up", this.handlers.mouseUp);
    return true;
  }

  deactivate() {
    if (this.handlers) {
      this.canvas.off("mouse:down", this.handlers.mouseDown);
      this.canvas.off("mouse:move", this.handlers.mouseMove);
      this.canvas.off("mouse:up", this.handlers.mouseUp);
    }

    this.handlers = null;
    this.dragStart = null;
    this.sourceObject = null;
    this.removePreviewRect();
    setCanvasObjectInteractivity(this.canvas, true); // Restore full interactivity
  }

  updateOptions() {}

  handleMouseDown(event) {
    if (this.isProcessing || (event.e?.button !== undefined && event.e.button !== 0)) {
      return;
    }

    // Find image target under cursor
    this.sourceObject = this.findImageTargetUnderCursor?.(event.e) || null;
    
    if (!this.sourceObject) {
      this.onWarning?.("Click on an image to use Crop tool.");
      return;
    }

    this.removePreviewRect();

    const pointer = this.canvas.getPointer(event.e);
    this.dragStart = pointer;
    this.previewRect = new this.fabric.Rect({
      left: pointer.x,
      top: pointer.y,
      width: 0,
      height: 0,
      fill: "rgba(34, 211, 238, 0.18)",
      stroke: "#22d3ee",
      strokeWidth: 2,
      strokeDashArray: [8, 6],
      selectable: false,
      evented: false,
      erasable: false,
      excludeFromLayer: true,
      excludeFromExport: true,
    });

    this.canvas.add(this.previewRect);
    this.canvas.requestRenderAll();
  }

  handleMouseMove(event) {
    if (!this.dragStart || !this.previewRect) {
      return;
    }

    const pointer = this.canvas.getPointer(event.e);
    const left = Math.min(this.dragStart.x, pointer.x);
    const top = Math.min(this.dragStart.y, pointer.y);
    const width = Math.abs(pointer.x - this.dragStart.x);
    const height = Math.abs(pointer.y - this.dragStart.y);

    this.previewRect.set({
      left,
      top,
      width,
      height,
    });
    this.previewRect.setCoords();
    this.canvas.requestRenderAll();
  }

  async handleMouseUp() {
    const previewBounds = normalizeCanvasRect(this.previewRect?.getBoundingRect(true, true));

    this.dragStart = null;

    if (!previewBounds || previewBounds.width < MIN_CROP_SIZE || previewBounds.height < MIN_CROP_SIZE) {
      this.removePreviewRect();
      return;
    }

    const sourceObject = this.resolveSourceObject();

    if (!sourceObject) {
      this.removePreviewRect();
      this.onWarning?.("Select an image object before using Crop.");
      return;
    }

    const sourceBounds = normalizeCanvasRect(sourceObject.getBoundingRect(true, true));
    const cropRegion = getRectIntersection(previewBounds, sourceBounds);

    this.removePreviewRect();

    if (!cropRegion || cropRegion.width < 1 || cropRegion.height < 1) {
      this.onWarning?.("The crop cut needs to overlap the selected image.");
      return;
    }

    if (sourceObject.type !== "image" || !sourceObject._element) {
      this.onWarning?.("Crop only works on image objects.");
      return;
    }

    // Additional validation for background-removed images
    let hasValidImageSource = false;
    try {
      if (sourceObject._element.src || sourceObject._element.currentSrc) {
        hasValidImageSource = true;
      } else if (typeof sourceObject.getSrc === "function" && sourceObject.getSrc()) {
        hasValidImageSource = true;
      } else if (sourceObject.toDataURL && sourceObject.toDataURL().length > 100) {
        hasValidImageSource = true;
      }
    } catch (error) {
      console.warn("Image source validation failed:", error);
    }

    if (!hasValidImageSource) {
      this.onWarning?.("Image source is not available. Please try selecting a different image.");
      return;
    }

    this.isProcessing = true;

    try {
      const localCrop = this.getLocalCropRegion(sourceObject, cropRegion);

      if (!localCrop) {
        this.onWarning?.("The crop area is outside the selected image.");
        return;
      }

      const croppedData = this.createCroppedPieceData(sourceObject, localCrop);
      const croppedImage = await this.createCroppedImageObject(croppedData, cropRegion, sourceObject);

      assignObjectMeta(croppedImage, getNextObjectName(this.canvas, "Crop"), "crop", {
        forceNewId: true,
      });

      if (doesRectCoverRect(localCrop, {
        left: 0,
        top: 0,
        width: Math.round(sourceObject.width || 0),
        height: Math.round(sourceObject.height || 0),
      })) {
        removeObjectFromCanvas(this.canvas, sourceObject);
      } else {
        const destructivelyCutSource = this.createSourceWithoutCrop(sourceObject, localCrop);
        await this.updateSourceImage(sourceObject, destructivelyCutSource);
        sourceObject.setCoords();
        this.canvas.requestRenderAll();
      }

      this.onWarning?.("");
      this.onObjectCreated?.(croppedImage);
      this.onRequestToolChange?.("select");
    } catch (error) {
      console.error("Crop tool failed:", error);
      this.onWarning?.("Crop cut failed. Please try again.");
    } finally {
      this.isProcessing = false;
    }
  }

  resolveSourceObject() {
    // Return the target found during mouse down
    return this.sourceObject;
  }

  getLocalCropRegion(sourceObject, cropRegion) {
    const scaleX = Math.abs(sourceObject.scaleX || 1);
    const scaleY = Math.abs(sourceObject.scaleY || 1);
    const objectTopLeft = sourceObject.getPointByOrigin
      ? sourceObject.getPointByOrigin("left", "top")
      : { x: sourceObject.left || 0, y: sourceObject.top || 0 };
    const imageWidth = Math.round(sourceObject.width || sourceObject._element?.naturalWidth || sourceObject._element?.width || 0);
    const imageHeight = Math.round(sourceObject.height || sourceObject._element?.naturalHeight || sourceObject._element?.height || 0);
    const left = Math.max(0, Math.round((cropRegion.left - objectTopLeft.x) / scaleX));
    const top = Math.max(0, Math.round((cropRegion.top - objectTopLeft.y) / scaleY));
    const width = Math.min(imageWidth - left, Math.round(cropRegion.width / scaleX));
    const height = Math.min(imageHeight - top, Math.round(cropRegion.height / scaleY));

    if (width < 1 || height < 1) {
      return null;
    }

    return {
      left,
      top,
      width,
      height,
    };
  }

  createCroppedPieceData(sourceObject, localCrop) {
    const pieceCanvas = document.createElement("canvas");
    const pieceContext = pieceCanvas.getContext("2d");

    pieceCanvas.width = localCrop.width;
    pieceCanvas.height = localCrop.height;

    pieceContext.drawImage(
      sourceObject._element,
      localCrop.left,
      localCrop.top,
      localCrop.width,
      localCrop.height,
      0,
      0,
      localCrop.width,
      localCrop.height,
    );

    return pieceCanvas.toDataURL("image/png");
  }

  createSourceWithoutCrop(sourceObject, localCrop) {
    const tempCanvas = document.createElement("canvas");
    const context = tempCanvas.getContext("2d");
    const imageWidth = Math.round(sourceObject.width || sourceObject._element?.naturalWidth || sourceObject._element?.width || 0);
    const imageHeight = Math.round(sourceObject.height || sourceObject._element?.naturalHeight || sourceObject._element?.height || 0);

    tempCanvas.width = imageWidth;
    tempCanvas.height = imageHeight;

    context.drawImage(sourceObject._element, 0, 0, imageWidth, imageHeight);
    context.clearRect(localCrop.left, localCrop.top, localCrop.width, localCrop.height);

    return tempCanvas.toDataURL("image/png");
  }

  createCroppedImageObject(croppedData, cropRegion, sourceObject) {
    return new Promise((resolve, reject) => {
      const fabricApi = window.fabric || this.fabric;

      if (!fabricApi?.Image?.fromURL) {
        reject(new Error("Fabric image loader is unavailable."));
        return;
      }

      fabricApi.Image.fromURL(croppedData, (image) => {
        if (!image) {
          reject(new Error("Unable to create cropped image."));
          return;
        }

        image.set({
          left: cropRegion.left,
          top: cropRegion.top,
          originX: "left",
          originY: "top",
          scaleX: sourceObject.scaleX || 1,
          scaleY: sourceObject.scaleY || 1,
          selectable: true,
          evented: true,
          erasable: true,
        });
        image.setCoords();
        resolve(image);
      });
    });
  }

  updateSourceImage(sourceObject, dataUrl) {
    return new Promise((resolve, reject) => {
      if (typeof sourceObject.setSrc !== "function") {
        reject(new Error("Target object does not support setSrc."));
        return;
      }

      sourceObject.setSrc(dataUrl, () => {
        sourceObject.set({
          dirty: true,
          selectable: true,
          evented: true,
          erasable: true,
        });
        resolve();
      });
    });
  }

  removePreviewRect() {
    if (this.previewRect) {
      this.canvas.remove(this.previewRect);
      this.previewRect = null;
      this.canvas.requestRenderAll();
    }
  }
}
