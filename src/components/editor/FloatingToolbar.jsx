import { useState, useRef } from "react";
import { 
  RotateCw, 
  FlipHorizontal, 
  Group, 
  Ungroup, 
  Trash2, 
  Copy, 
  Download,
  WandSparkles,
  Crop,
  Brush,
  Eraser
} from "lucide-react";
import { removeBackground } from "../../utils/imageHelpers.js";
import { exportSingleObject } from "../../utils/exportUtils.js";

export default function FloatingToolbar({ selectedObject, canvas, onUpdate, onGroup, onUngroup, onDelete, onDuplicate, onSelectTool, activeTool, originalImageData, setOriginalImageData }) {
  const toolbarRef = useRef(null);
  const [isRemovingBG, setIsRemovingBG] = useState(false);

  // Calculate toolbar position
  const getToolbarPosition = () => {
    if (!selectedObject || !canvas) return { top: 0, left: 0 };

    const bounds = selectedObject.getBoundingRect();
    const canvasElement = canvas.getElement();
    const canvasRect = canvasElement.getBoundingClientRect();

    // Convert canvas coordinates to viewport coordinates
    const viewportTop = canvasRect.top + bounds.top - 100;
    const viewportLeft = canvasRect.left + bounds.left + bounds.width / 2;

    return {
      top: viewportTop,
      left: viewportLeft,
    };
  };

  const position = getToolbarPosition();

  // Handle rotate
  const handleRotate = () => {
    if (!selectedObject) return;
    
    selectedObject.rotate(selectedObject.angle + 10);
    canvas.renderAll();
    onUpdate?.();
  };

  // Handle flip
  const handleFlip = () => {
    if (!selectedObject) return;
    
    selectedObject.set("flipX", !selectedObject.flipX);
    canvas.renderAll();
    onUpdate?.();
  };

  // Handle group/ungroup
  const handleGroupToggle = () => {
    if (!selectedObject) return;
    
    if (selectedObject.type === 'activeSelection' || (selectedObject.type !== 'group' && canvas.getActiveObjects().length > 1)) {
      onGroup?.();
    } else if (selectedObject.type === 'group') {
      onUngroup?.();
    }
  };

  // Handle delete
  const handleDelete = () => {
    if (!selectedObject) return;
    onDelete?.();
  };

  // Handle duplicate
  const handleDuplicate = () => {
    if (!selectedObject) return;
    onDuplicate?.();
  };

  // Handle remove background
  const handleRemoveBG = async () => {
    if (!selectedObject || selectedObject.type !== 'image' || isRemovingBG) return;

    setIsRemovingBG(true);

    try {
      // Store original image data before removal
      const originalDataURL = selectedObject.toDataURL({
        format: "png",
        multiplier: 1,
      });

      // Store original properties for size preservation
      const originalProps = {
        left: selectedObject.left,
        top: selectedObject.top,
        scaleX: selectedObject.scaleX,
        scaleY: selectedObject.scaleY,
        angle: selectedObject.angle,
        originX: selectedObject.originX,
        originY: selectedObject.originY,
        width: selectedObject.width,
        height: selectedObject.height,
      };

      // Get the actual original image dimensions (unscaled)
      const originalImageWidth = selectedObject.width;
      const originalImageHeight = selectedObject.height;

      // Convert fabric image to dataURL, then to blob
      const blob = await new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(resolve, 'image/png');
        };
        
        img.src = originalDataURL;
      });

      // Create File from blob
      const imageFile = new File([blob], "image.png", { type: "image/png" });

      // Use existing removeBackground function with correct API URL
      const processedBlob = await removeBackground(imageFile);

      // Resize processed image to match original dimensions
      const tempProcessedUrl = URL.createObjectURL(processedBlob);
      const resizedBlob = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = originalImageWidth;
          canvas.height = originalImageHeight;
          const ctx = canvas.getContext('2d');
          
          // Draw the processed image centered on the canvas to maintain original dimensions
          ctx.drawImage(img, 0, 0, originalImageWidth, originalImageHeight);
          canvas.toBlob(resolve, 'image/png');
          URL.revokeObjectURL(tempProcessedUrl);
        };
        img.src = tempProcessedUrl;
      });

      // Store the original blob as well for toggling
      const originalBlob = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = originalImageWidth;
          canvas.height = originalImageHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(resolve, 'image/png');
        };
        img.src = originalDataURL;
      });

      // Create URL for processed image
      const processedUrl = URL.createObjectURL(resizedBlob);

      // Load processed image back to canvas
      const { fabric } = await import('fabric');
      
      fabric.Image.fromURL(processedUrl, (processedImage) => {
        // Preserve original size by using the original dimensions
        processedImage.set({
          left: originalProps.left,
          top: originalProps.top,
          scaleX: 1,
          scaleY: 1,
          angle: originalProps.angle,
          originX: originalProps.originX,
          originY: originalProps.originY,
          selectable: true,
          evented: true,
        });

        // Copy editor metadata
        if (selectedObject.editorId) {
          processedImage.editorId = selectedObject.editorId;
        }
        if (selectedObject.name) {
          processedImage.name = selectedObject.name;
        }
        if (selectedObject.editorKind) {
          processedImage.editorKind = selectedObject.editorKind;
        }
        if (selectedObject.editorName) {
          processedImage.editorName = selectedObject.editorName;
        }
        
        // Ensure the processed image has the same properties as the original
        processedImage.set({
          erasable: selectedObject.erasable ?? true,
          excludeFromLayer: selectedObject.excludeFromLayer ?? false,
        });

        // Store original image data for toggle functionality
        setOriginalImageData({
          originalBlob: originalBlob,
          processedBlob: resizedBlob,
          originalNaturalWidth: selectedObject.width,
          originalNaturalHeight: selectedObject.height,
          processedNaturalWidth: processedImage.width,
          processedNaturalHeight: processedImage.height,
          props: originalProps,
          editorId: selectedObject.editorId,
          name: selectedObject.name,
          editorKind: selectedObject.editorKind,
          editorName: selectedObject.editorName,
          erasable: selectedObject.erasable ?? true,
          excludeFromLayer: selectedObject.excludeFromLayer ?? false,
        });

        // Replace image
        canvas.remove(selectedObject);
        canvas.add(processedImage);
        canvas.setActiveObject(processedImage);
        canvas.requestRenderAll();
        
        // Ensure the processed image is fully loaded and accessible
        processedImage.setCoords();

        // Don't revoke processedUrl - it's needed for toggling
        // It will be cleaned up when originalImageData is reset

        // Notify parent
        onUpdate?.();
      });

    } catch (error) {
      console.error("Remove BG failed:", error);
    } finally {
      setIsRemovingBG(false);
    }
  };

  // Handle download
  const handleDownload = async () => {
    if (!selectedObject) return;

    await exportSingleObject(selectedObject, canvas, {
      format: "png",
      quality: 1,
      transparency: true,
      scale: 2,
    });
  };

  // Handle tool shortcuts
  const handleCropTool = () => {
    onSelectTool?.('crop');
  };

  const handleDrawTool = () => {
    onSelectTool?.('draw');
  };

  const handleEraserTool = () => {
    onSelectTool?.('eraser');
  };

  if (!selectedObject) return null;

  // Check if group button should show as ungroup
  const isGrouped = selectedObject.type === 'group';
  const canGroup = selectedObject.type === 'activeSelection' || canvas.getActiveObjects().length > 1;
  
  // Check if remove background should show (only for images)
  const canRemoveBG = selectedObject.type === 'image';

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1 bg-[#111827] backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-slate-600"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Rotate Button */}
      <button
        onClick={handleRotate}
        className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
        title="Rotate"
      >
        <RotateCw size={16} />
      </button>

      {/* Flip Button */}
      <button
        onClick={handleFlip}
        className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
        title="Flip Horizontal"
      >
        <FlipHorizontal size={16} />
      </button>

      {/* Group/Ungroup Button */}
      {(canGroup || isGrouped) && (
        <button
          onClick={handleGroupToggle}
          className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
          title={isGrouped ? "Ungroup" : "Group"}
        >
          {isGrouped ? <Ungroup size={16} /> : <Group size={16} />}
        </button>
      )}

      {/* Remove Background Button */}
      {canRemoveBG && (
        <button
          onClick={handleRemoveBG}
          disabled={isRemovingBG}
          className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-purple-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Remove Background"
        >
          {isRemovingBG ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <WandSparkles size={16} />
          )}
        </button>
      )}

      {/* Delete Button */}
      <button
        onClick={handleDelete}
        className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-red-600 rounded transition-colors"
        title="Delete"
      >
        <Trash2 size={16} />
      </button>

      {/* Duplicate Button */}
      <button
        onClick={handleDuplicate}
        className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
        title="Duplicate"
      >
        <Copy size={16} />
      </button>

      {/* Download Button */}
      <button
        onClick={handleDownload}
        className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
        title="Download"
      >
        <Download size={16} />
      </button>

      {/* Tool Shortcuts Divider */}
      <div className="w-px h-6 bg-slate-600 mx-1" />

      {/* Crop Tool Button */}
      <button
        onClick={handleCropTool}
        className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
          activeTool === 'crop' 
            ? 'text-white bg-green-600' 
            : 'text-slate-300 hover:text-white hover:bg-slate-600'
        }`}
        title="Crop Tool"
      >
        <Crop size={16} />
      </button>

      {/* Draw Tool Button */}
      <button
        onClick={handleDrawTool}
        className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
          activeTool === 'draw' 
            ? 'text-white bg-blue-600' 
            : 'text-slate-300 hover:text-white hover:bg-slate-600'
        }`}
        title="Draw Tool"
      >
        <Brush size={16} />
      </button>

      {/* Eraser Tool Button */}
      <button
        onClick={handleEraserTool}
        className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
          activeTool === 'eraser' 
            ? 'text-white bg-orange-600' 
            : 'text-slate-300 hover:text-white hover:bg-slate-600'
        }`}
        title="Eraser Tool"
      >
        <Eraser size={16} />
      </button>
    </div>
  );
}
