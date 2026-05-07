import { fabric } from "fabric";
import JSZip from "jszip";
import { FABRIC_SERIALIZATION_PROPS } from "./fabricHelpers.js";

const DEFAULT_WORKSPACE_BACKGROUND = "#0f172a";
const OBJECT_EXPORT_PADDING = 0;

const EXPORT_SERIALIZATION_PROPS = [
  ...FABRIC_SERIALIZATION_PROPS,
  "absolutePositioned",
  "clipPath",
  "cropX",
  "cropY",
  "dirty",
  "eraser",
  "fillRule",
  "globalCompositeOperation",
  "inverted",
  "paintFirst",
];

export async function exportWorkspaceImage(canvas, options = {}) {
  if (!canvas) {
    alert("No canvas to export");
    return;
  }

  const exportOptions = normalizeExportOptions(options);

  try {
    const imageData = await renderCanvasToDataURL(canvas, exportOptions);
    downloadImage(imageData, `pixelforge-workspace-${Date.now()}.${exportOptions.extension}`);
  } catch (error) {
    console.error("Error exporting workspace:", error);
    alert("Error exporting workspace. Please try again.");
    throw error;
  }
}

export async function exportSingleObject(fabricObject, canvas, options = {}) {
  if (!fabricObject) {
    alert("No object selected to export");
    return;
  }

  const exportOptions = normalizeExportOptions(options);

  try {
    const imageData = await renderObjectToDataURL(fabricObject, exportOptions);
    const objectName = fabricObject.editorName || fabricObject.name || "object";

    downloadImage(
      imageData,
      `pixelforge-${sanitizeFilename(objectName)}-${Date.now()}.${exportOptions.extension}`,
    );
  } catch (error) {
    console.error("Error exporting object:", error);
    alert("Error exporting object. Please try again.");
    throw error;
  }
}

export async function exportAllWorkspaceImages(workspaces, canvas, options = {}) {
  if (!workspaces || workspaces.length === 0) {
    alert("No workspaces to export");
    return;
  }

  const exportOptions = normalizeExportOptions(options);

  try {
    const zip = new JSZip();
    let exportCount = 0;

    if (canvas) {
      try {
        const imageData = await renderCanvasToDataURL(canvas, exportOptions);
        const blob = await dataUrlToBlob(imageData);
        zip.file(`00-current-workspace.${exportOptions.extension}`, blob);
        exportCount += 1;
      } catch (error) {
        console.error("Error exporting current workspace:", error);
      }
    }

    for (const workspace of workspaces) {
      if (!workspace.canvasJSON) {
        continue;
      }

      try {
        const workspaceName = sanitizeFilename(workspace.name || `workspace-${workspace.id}`);
        const imageData = await renderWorkspaceJSON(workspace.canvasJSON, exportOptions);

        if (imageData) {
          const blob = await dataUrlToBlob(imageData);
          zip.file(
            `${String(exportCount + 1).padStart(2, "0")}-${workspaceName}.${exportOptions.extension}`,
            blob,
          );
          exportCount += 1;
        }
      } catch (error) {
        console.error(`Error exporting workspace ${workspace.id}:`, error);
      }
    }

    if (exportCount > 0) {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadZip(zipBlob, `pixelforge-all-exports-${Date.now()}.zip`);
    } else {
      alert("No content to export");
    }
  } catch (error) {
    console.error("Error creating export ZIP:", error);
    alert("Error exporting. Please try again.");
    throw error;
  }
}

async function renderCanvasToDataURL(canvas, options) {
  const width = Math.max(1, Math.ceil(canvas.getWidth()));
  const height = Math.max(1, Math.ceil(canvas.getHeight()));
  const tempCanvas = createStaticCanvas(width, height, resolveWorkspaceBackground(canvas, options));

  try {
    await copyCanvasBackgroundAndOverlay(canvas, tempCanvas, options);
    tempCanvas.viewportTransform = getViewportTransform(canvas);

    const visibleObjects = canvas.getObjects().filter((object) => object.visible !== false);
    const clonedObjects = await Promise.all(visibleObjects.map((object) => cloneFabricObjectForExport(object)));

    clonedObjects.forEach((object) => {
      object.set({
        selectable: false,
        evented: false,
      });
      object.setCoords();
      tempCanvas.add(object);
    });

    tempCanvas.renderAll();
    return canvasToDataURL(tempCanvas, options);
  } finally {
    tempCanvas.dispose();
  }
}

async function renderObjectToDataURL(fabricObject, options) {
  const bounds = getObjectBounds(fabricObject);

  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    throw new Error("Object has invalid dimensions");
  }

  const width = Math.max(1, Math.ceil(bounds.width + OBJECT_EXPORT_PADDING * 2));
  const height = Math.max(1, Math.ceil(bounds.height + OBJECT_EXPORT_PADDING * 2));
  const tempCanvas = createStaticCanvas(width, height, resolveObjectBackground(options));

  try {
    tempCanvas.viewportTransform = [
      1,
      0,
      0,
      1,
      -bounds.left + OBJECT_EXPORT_PADDING,
      -bounds.top + OBJECT_EXPORT_PADDING,
    ];

    const clonedObject = await cloneFabricObjectForExport(fabricObject);
    clonedObject.set({
      selectable: false,
      evented: false,
    });
    clonedObject.setCoords();

    tempCanvas.add(clonedObject);
    tempCanvas.renderAll();

    return canvasToDataURL(tempCanvas, options);
  } finally {
    tempCanvas.dispose();
  }
}

async function renderWorkspaceJSON(canvasJSON, options) {
  if (!canvasJSON) {
    throw new Error("Canvas JSON is required");
  }

  const width = Math.max(1, Math.ceil(canvasJSON.width || 980));
  const height = Math.max(1, Math.ceil(canvasJSON.height || 660));
  const tempCanvas = createStaticCanvas(width, height, resolveWorkspaceBackground(null, options));

  try {
    await new Promise((resolve, reject) => {
      tempCanvas.loadFromJSON(
        canvasJSON,
        () => {
          tempCanvas.backgroundColor = resolveWorkspaceBackground(tempCanvas, options);
          tempCanvas.renderAll();
          resolve();
        },
        undefined,
      );
    });

    return canvasToDataURL(tempCanvas, options);
  } finally {
    tempCanvas.dispose();
  }
}

function createStaticCanvas(width, height, backgroundColor) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;

  return new fabric.StaticCanvas(element, {
    width,
    height,
    backgroundColor,
    enableRetinaScaling: false,
    preserveObjectStacking: true,
    renderOnAddRemove: false,
  });
}

async function copyCanvasBackgroundAndOverlay(sourceCanvas, targetCanvas, options) {
  targetCanvas.backgroundColor = resolveWorkspaceBackground(sourceCanvas, options);

  if (sourceCanvas.backgroundImage) {
    targetCanvas.backgroundImage = await cloneFabricObjectForExport(sourceCanvas.backgroundImage);
  }

  if (sourceCanvas.overlayColor) {
    targetCanvas.overlayColor = sourceCanvas.overlayColor;
  }

  if (sourceCanvas.overlayImage) {
    targetCanvas.overlayImage = await cloneFabricObjectForExport(sourceCanvas.overlayImage);
  }
}

async function cloneFabricObjectForExport(fabricObject) {
  if (!fabricObject) {
    throw new Error("Cannot clone an empty Fabric object");
  }

  const clonedObject = await new Promise((resolve, reject) => {
    let settled = false;

    const finish = (clone) => {
      if (settled) {
        return;
      }

      settled = true;

      if (!clone) {
        reject(new Error("Failed to clone Fabric object"));
        return;
      }

      resolve(clone);
    };

    try {
      const cloneResult = fabricObject.clone(finish, EXPORT_SERIALIZATION_PROPS);

      if (cloneResult?.then) {
        cloneResult.then(finish).catch(reject);
      }
    } catch (error) {
      reject(error);
    }
  });

  await preserveRuntimeExportProperties(fabricObject, clonedObject);
  return clonedObject;
}

async function preserveRuntimeExportProperties(source, target) {
  const directProps = {
    angle: source.angle || 0,
    flipX: Boolean(source.flipX),
    flipY: Boolean(source.flipY),
    globalCompositeOperation: source.globalCompositeOperation || "source-over",
    height: source.height,
    left: source.left || 0,
    opacity: source.opacity ?? 1,
    originX: source.originX || "left",
    originY: source.originY || "top",
    scaleX: source.scaleX ?? 1,
    scaleY: source.scaleY ?? 1,
    skewX: source.skewX || 0,
    skewY: source.skewY || 0,
    top: source.top || 0,
    visible: source.visible !== false,
    width: source.width,
  };

  if (source.type === "image") {
    directProps.cropX = source.cropX || 0;
    directProps.cropY = source.cropY || 0;
  }

  target.set(directProps);

  target.editorId = source.editorId;
  target.editorName = source.editorName;
  target.editorKind = source.editorKind;
  target.excludeFromLayer = source.excludeFromLayer;
  target.erasable = source.erasable;
  target.objectCaching = source.objectCaching;
  target.dirty = true;

  if (source.clipPath) {
    if (!target.clipPath) {
      target.clipPath = await cloneFabricObjectForExport(source.clipPath);
    }

    target.clipPath.absolutePositioned = Boolean(source.clipPath.absolutePositioned);
    target.clipPath.inverted = Boolean(source.clipPath.inverted);
    target.clipPath.setCoords();
  }

  if (source.eraser && !target.eraser) {
    try {
      target.eraser = await cloneFabricObjectForExport(source.eraser);
    } catch (error) {
      console.warn("Unable to clone eraser data for export:", error);
    }
  }
}

function getObjectBounds(fabricObject) {
  if (typeof fabricObject.getBoundingRect === "function") {
    return fabricObject.getBoundingRect(true, true);
  }

  return null;
}

function getViewportTransform(canvas) {
  if (Array.isArray(canvas?.viewportTransform)) {
    return [...canvas.viewportTransform];
  }

  return [1, 0, 0, 1, 0, 0];
}

function resolveWorkspaceBackground(canvas, options) {
  if (options.isJpeg) {
    return "#ffffff";
  }

  if (options.transparency) {
    return null;
  }

  const sourceBackground = canvas?.backgroundColor;

  if (
    !sourceBackground ||
    sourceBackground === "transparent" ||
    sourceBackground === "rgba(0,0,0,0)" ||
    sourceBackground === "rgba(0, 0, 0, 0)"
  ) {
    return DEFAULT_WORKSPACE_BACKGROUND;
  }

  return sourceBackground;
}

function resolveObjectBackground(options) {
  if (options.isJpeg) {
    return "#ffffff";
  }

  return options.transparency ? null : DEFAULT_WORKSPACE_BACKGROUND;
}

function canvasToDataURL(canvas, options) {
  return canvas.toDataURL({
    format: options.fabricFormat,
    multiplier: options.scale,
    quality: options.quality,
    enableRetinaScaling: false,
  });
}

function normalizeExportOptions(options = {}) {
  const requestedFormat = String(options.format || "png").toLowerCase();
  const isJpeg = requestedFormat === "jpg" || requestedFormat === "jpeg";
  const fabricFormat = isJpeg ? "jpeg" : "png";
  const extension = isJpeg ? "jpg" : "png";
  const quality = clampNumber(options.quality ?? 1, 0.1, 1);
  const scale = clampNumber(options.scale ?? options.multiplier ?? 2, 0.1, 6);

  return {
    ...options,
    extension,
    fabricFormat,
    isJpeg,
    quality,
    scale,
    transparency: isJpeg ? false : options.transparency !== false,
  };
}

function clampNumber(value, min, max) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function dataUrlToBlob(dataUrl) {
  return new Promise((resolve, reject) => {
    try {
      const parts = dataUrl.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);

      if (!mimeMatch) {
        reject(new Error("Invalid data URL format"));
        return;
      }

      const mime = mimeMatch[1];
      const binaryString = atob(parts[1]);
      const bytes = new Uint8Array(binaryString.length);

      for (let index = 0; index < binaryString.length; index += 1) {
        bytes[index] = binaryString.charCodeAt(index);
      }

      resolve(new Blob([bytes], { type: mime }));
    } catch (error) {
      reject(error);
    }
  });
}

function downloadImage(dataUrl, filename) {
  try {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error downloading image:", error);
    alert("Error downloading image. Please try again.");
  }
}

function downloadZip(zipBlob, filename) {
  try {
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading ZIP:", error);
    alert("Error downloading ZIP. Please try again.");
  }
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .slice(0, 50)
    .toLowerCase();
}
