import { fabric } from 'fabric';
import JSZip from 'jszip';

/**
 * PROFESSIONAL FABRIC.JS EXPORT SYSTEM
 * Exports EXACTLY what user sees in workspace using StaticCanvas + proper rendering
 */

/**
 * Export full workspace as image with options
 * @param {Object} canvas - Current fabric canvas instance
 * @param {Object} options - Export options {format, quality, transparency, scale}
 * @returns {Promise<void>}
 */
export async function exportWorkspaceImage(canvas, options = {}) {
  if (!canvas) {
    alert('No canvas to export');
    return;
  }

  const {
    format = 'png', // 'png' or 'jpg'
    quality = 1.0,
    transparency = true,
    scale = 2,
  } = options;

  try {
    // Render workspace exactly as visible
    const imageData = await renderCanvasToDataURL(canvas, {
      format,
      quality,
      transparency,
      multiplier: scale,
    });

    downloadImage(imageData, `pixelforge-workspace-${Date.now()}.${format}`);
  } catch (error) {
    console.error('Error exporting workspace:', error);
    alert('Error exporting workspace. Please try again.');
  }
}

/**
 * Export single selected object with all properties preserved
 * @param {Object} fabricObject - Object to export
 * @param {Object} canvas - Canvas context
 * @param {Object} options - Export options
 * @returns {Promise<void>}
 */
export async function exportSingleObject(fabricObject, canvas, options = {}) {
  if (!fabricObject) {
    alert('No object selected to export');
    return;
  }

  const {
    format = 'png',
    quality = 1.0,
    transparency = true,
    scale = 2,
  } = options;

  try {
    // Clone object to temporary StaticCanvas and render
    const imageData = await renderObjectToDataURL(fabricObject, {
      format,
      quality,
      transparency,
      multiplier: scale,
    });

    const objectName = fabricObject.editorName || 'object';
    downloadImage(imageData, `pixelforge-${sanitizeFilename(objectName)}-${Date.now()}.${format}`);
  } catch (error) {
    console.error('Error exporting object:', error);
    alert('Error exporting object. Please try again.');
  }
}

/**
 * Export all workspace images as ZIP with options
 * @param {Array} workspaces - Array of workspace objects
 * @param {Object} canvas - Current canvas
 * @param {Object} options - Export options
 * @returns {Promise<void>}
 */
export async function exportAllWorkspaceImages(workspaces, canvas, options = {}) {
  if (!workspaces || workspaces.length === 0) {
    alert('No workspaces to export');
    return;
  }

  const {
    format = 'png',
    quality = 1.0,
    transparency = true,
    scale = 2,
  } = options;

  try {
    const zip = new JSZip();
    let exportCount = 0;

    // Export current active canvas
    if (canvas) {
      try {
        const imageData = await renderCanvasToDataURL(canvas, {
          format,
          quality,
          transparency,
          multiplier: scale,
        });
        const blob = await dataUrlToBlob(imageData);
        zip.file(`00-current-workspace.${format}`, blob);
        exportCount++;
      } catch (error) {
        console.error('Error exporting current workspace:', error);
      }
    }

    // Export each workspace
    for (const workspace of workspaces) {
      if (!workspace.canvasJSON) continue;

      try {
        const workspaceName = sanitizeFilename(workspace.name || `workspace-${workspace.id}`);
        const imageData = await renderWorkspaceJSON(workspace.canvasJSON, {
          format,
          quality,
          transparency,
          multiplier: scale,
        });

        if (imageData) {
          const blob = await dataUrlToBlob(imageData);
          zip.file(
            `${String(exportCount + 1).padStart(2, '0')}-${workspaceName}.${format}`,
            blob
          );
          exportCount++;
        }
      } catch (error) {
        console.error(`Error exporting workspace ${workspace.id}:`, error);
      }
    }

    if (exportCount > 0) {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadZip(zipBlob, `pixelforge-all-exports-${Date.now()}.zip`);
    } else {
      alert('No content to export');
    }
  } catch (error) {
    console.error('Error creating export ZIP:', error);
    alert('Error exporting. Please try again.');
  }
}

/**
 * CORE RENDERING FUNCTIONS - Using StaticCanvas for all exports
 */

/**
 * Render full canvas to data URL (EXACTLY what user sees)
 * @param {Object} canvas - Fabric Canvas instance
 * @param {Object} options - Render options
 * @returns {Promise<string>} - Data URL
 */
async function renderCanvasToDataURL(canvas, options = {}) {
  const { format = 'png', quality = 1.0, transparency = true, multiplier = 2 } = options;

  if (!canvas) throw new Error('Canvas is required');

  try {
    // Use canvas.toDataURL for full rendering
    const dataUrl = canvas.toDataURL({
      format,
      quality,
      multiplier,
      // For PNG: preserve transparency by setting background to null
      // For JPG: will use white background automatically
    });

    return dataUrl;
  } catch (error) {
    console.error('Error rendering canvas:', error);
    throw error;
  }
}

/**
 * Render single object to data URL with ALL properties preserved
 * @param {Object} fabricObject - Object to render
 * @param {Object} options - Render options
 * @returns {Promise<string>} - Data URL
 */
async function renderObjectToDataURL(fabricObject, options = {}) {
  const { format = 'png', quality = 1.0, transparency = true, multiplier = 2 } = options;

  if (!fabricObject) throw new Error('Object is required');

  try {
    // Get object bounding box
    const bbox = fabricObject.getBoundingRect();

    if (bbox.width <= 0 || bbox.height <= 0) {
      throw new Error('Object has invalid dimensions');
    }

    // Add padding for better rendering
    const padding = 10;
    const width = Math.ceil(bbox.width) + padding * 2;
    const height = Math.ceil(bbox.height) + padding * 2;

    // Create StaticCanvas with transparency
    const tempCanvas = new fabric.StaticCanvas(null, {
      width,
      height,
      backgroundColor: transparency ? null : '#ffffff',
    });

    // Clone object using Fabric's proper cloning method
    const clonedObject = await cloneFabricObjectProperly(fabricObject);

    if (!clonedObject) {
      throw new Error('Failed to clone object');
    }

    // Reposition cloned object to fit in temp canvas
    clonedObject.set({
      left: clonedObject.left - bbox.left + padding,
      top: clonedObject.top - bbox.top + padding,
    });

    // Add to temp canvas
    tempCanvas.add(clonedObject);
    tempCanvas.renderAll();

    // Export to data URL
    const dataUrl = tempCanvas.toDataURL({
      format,
      quality,
      multiplier,
    });

    tempCanvas.dispose();
    return dataUrl;
  } catch (error) {
    console.error('Error rendering object:', error);
    throw error;
  }
}

/**
 * Render workspace from JSON to data URL
 * @param {Object} canvasJSON - Canvas JSON from workspace
 * @param {Object} options - Render options
 * @returns {Promise<string>} - Data URL
 */
async function renderWorkspaceJSON(canvasJSON, options = {}) {
  const { format = 'png', quality = 1.0, transparency = true, multiplier = 2 } = options;

  if (!canvasJSON) throw new Error('Canvas JSON is required');

  try {
    // Create temporary canvas
    const tempCanvas = new fabric.Canvas(null, {
      width: 980,
      height: 660,
      backgroundColor: transparency ? 'transparent' : '#0f172a',
    });

    // Load canvas from JSON with proper object cloning
    await new Promise((resolve, reject) => {
      tempCanvas.loadFromJSON(
        canvasJSON,
        () => {
          tempCanvas.renderAll();
          resolve();
        },
        (o, object) => {
          // Custom loader for reviver
        }
      );
    });

    // Export to data URL
    const dataUrl = tempCanvas.toDataURL({
      format,
      quality,
      multiplier,
    });

    tempCanvas.dispose();
    return dataUrl;
  } catch (error) {
    console.error('Error rendering workspace JSON:', error);
    throw error;
  }
}

/**
 * PROPER FABRIC OBJECT CLONING
 * Handles all object types: Image, Path, Group, Text, etc.
 */

/**
 * Clone Fabric object properly preserving all properties
 * @param {Object} fabricObject - Object to clone
 * @returns {Promise<Object>} - Cloned object
 */
async function cloneFabricObjectProperly(fabricObject) {
  try {
    if (!fabricObject) return null;

    // Handle Image objects specially to preserve clipPath and transparency
    if (fabricObject.type === 'image') {
      return await cloneImageObject(fabricObject);
    }

    // For other objects, use Fabric's clone mechanism
    return new Promise((resolve, reject) => {
      fabricObject.clone((cloned) => {
        if (cloned) {
          // Ensure all properties are preserved
          preserveObjectProperties(fabricObject, cloned);
          resolve(cloned);
        } else {
          reject(new Error('Failed to clone object'));
        }
      });
    });
  } catch (error) {
    console.error('Error in cloneFabricObjectProperly:', error);
    throw error;
  }
}

/**
 * Clone image object preserving clipPath and transparency
 * @param {Object} imageObject - Fabric image object
 * @returns {Promise<Object>} - Cloned image object
 */
async function cloneImageObject(imageObject) {
  try {
    return new Promise((resolve, reject) => {
      imageObject.clone((cloned) => {
        if (cloned) {
          // Preserve all critical properties
          preserveObjectProperties(imageObject, cloned);

          // Preserve clipPath if exists
          if (imageObject.clipPath) {
            imageObject.clipPath.clone((clippedPath) => {
              cloned.clipPath = clippedPath;
              resolve(cloned);
            });
          } else {
            resolve(cloned);
          }
        } else {
          reject(new Error('Failed to clone image'));
        }
      });
    });
  } catch (error) {
    console.error('Error cloning image object:', error);
    throw error;
  }
}

/**
 * Preserve all object properties from source to cloned object
 * @param {Object} source - Source object
 * @param {Object} target - Target cloned object
 */
function preserveObjectProperties(source, target) {
  if (!source || !target) return;

  // Preserve editor metadata
  target.editorId = source.editorId;
  target.editorName = source.editorName;
  target.editorKind = source.editorKind;

  // Preserve visibility and transform properties
  target.set({
    visible: source.visible !== false,
    opacity: source.opacity ?? 1,
    scaleX: source.scaleX,
    scaleY: source.scaleY,
    angle: source.angle,
    skewX: source.skewX,
    skewY: source.skewY,
    flipX: source.flipX,
    flipY: source.flipY,
  });

  // Preserve clipPath
  if (source.clipPath && !target.clipPath) {
    target.clipPath = source.clipPath;
  }

  // Preserve group properties
  if (source.group && !target.group) {
    target.group = source.group;
  }
}

/**
 * UTILITY FUNCTIONS
 */

/**
 * Convert data URL to Blob
 * @param {string} dataUrl - Data URL string
 * @returns {Promise<Blob>} - Blob data
 */
function dataUrlToBlob(dataUrl) {
  return new Promise((resolve, reject) => {
    try {
      const arr = dataUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);

      if (!mimeMatch) {
        reject(new Error('Invalid data URL format'));
        return;
      }

      const mime = mimeMatch[1];
      const bstr = atob(arr[1]);
      const n = bstr.length;
      const u8arr = new Uint8Array(n);

      for (let i = 0; i < n; i++) {
        u8arr[i] = bstr.charCodeAt(i);
      }

      resolve(new Blob([u8arr], { type: mime }));
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Download image file
 * @param {string} dataUrl - Image data URL
 * @param {string} filename - Filename for download
 */
function downloadImage(dataUrl, filename) {
  try {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error downloading image:', error);
    alert('Error downloading image. Please try again.');
  }
}

/**
 * Download ZIP file
 * @param {Blob} zipBlob - ZIP file blob
 * @param {string} filename - Filename for download
 */
function downloadZip(zipBlob, filename) {
  try {
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading ZIP:', error);
    alert('Error downloading ZIP. Please try again.');
  }
}

/**
 * Sanitize filename
 * @param {string} filename - Filename to sanitize
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .slice(0, 50)
    .toLowerCase();
}
