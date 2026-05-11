import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Save,
  Grid3x3,
  ArrowLeftRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  ChevronDown,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import ExportModal from "./ExportModal.jsx";

const ALIGNMENT_ACTIONS = [
  { id: "left", label: "Align Left", Icon: AlignStartVertical },
  { id: "centerX", label: "Align Center Horizontally", Icon: AlignCenterVertical },
  { id: "right", label: "Align Right", Icon: AlignEndVertical },
  { id: "top", label: "Align Top", Icon: AlignStartHorizontal },
  { id: "centerY", label: "Align Center Vertically", Icon: AlignCenterHorizontal },
  { id: "bottom", label: "Align Bottom", Icon: AlignEndHorizontal },
];

const CANVAS_BACKGROUND_COLOR = "#0f172a";
const GRID_SIZE = 24;

function createGridPatternSource() {
  const gridCanvas = document.createElement("canvas");
  gridCanvas.width = GRID_SIZE;
  gridCanvas.height = GRID_SIZE;

  const gridContext = gridCanvas.getContext("2d");

  if (!gridContext) {
    return null;
  }

  gridContext.fillStyle = CANVAS_BACKGROUND_COLOR;
  gridContext.fillRect(0, 0, GRID_SIZE, GRID_SIZE);
  gridContext.strokeStyle = "rgba(148, 163, 184, 0.12)";
  gridContext.lineWidth = 1;
  gridContext.beginPath();
  gridContext.moveTo(0.5, 0);
  gridContext.lineTo(0.5, GRID_SIZE);
  gridContext.moveTo(0, 0.5);
  gridContext.lineTo(GRID_SIZE, 0.5);
  gridContext.stroke();

  return gridCanvas;
}

function getBounds(fabricObject) {
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

function getObjectsBounds(objects) {
  const bounds = objects.map(getBounds);
  const left = Math.min(...bounds.map((objectBounds) => objectBounds.left));
  const top = Math.min(...bounds.map((objectBounds) => objectBounds.top));
  const right = Math.max(...bounds.map((objectBounds) => objectBounds.right));
  const bottom = Math.max(...bounds.map((objectBounds) => objectBounds.bottom));

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: left + (right - left) / 2,
    centerY: top + (bottom - top) / 2,
  };
}

export default function TopBar({
  canvas,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetCanvas,
  onExport,
  onExportAll,
  onSaveProject,
  zoom = 1,
  hasBackgroundRemoval = false,
  showOriginal = false,
  onToggleBackground = null,
  onCanvasUpdate = null,
}) {
  const alignmentMenuRef = useRef(null);
  const [showGrid, setShowGrid] = useState(false);
  const [alignmentMenuOpen, setAlignmentMenuOpen] = useState(false);
  const [lastAlignment, setLastAlignment] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState("workspace");
  const [isExporting, setIsExporting] = useState(false);
  const hasSelection = Boolean(canvas?.getActiveObjects?.().length);

  const exportSourceSize = useMemo(() => {
    return {
      width: Math.max(1, Math.ceil(canvas?.getWidth?.() || 1)),
      height: Math.max(1, Math.ceil(canvas?.getHeight?.() || 1)),
    };
  }, [canvas]);

  const toggleGrid = useCallback(() => {
    if (!canvas) return;

    setShowGrid((currentShowGrid) => {
      const nextShowGrid = !currentShowGrid;

      if (nextShowGrid) {
        const gridSource = createGridPatternSource();

        if (!gridSource) {
          return currentShowGrid;
        }

        canvas.setBackgroundColor(
          {
            source: gridSource,
            repeat: "repeat",
          },
          canvas.requestRenderAll.bind(canvas),
        );
      } else {
        canvas.setBackgroundColor(CANVAS_BACKGROUND_COLOR, canvas.requestRenderAll.bind(canvas));
      }

      return nextShowGrid;
    });
  }, [canvas]);

  const handleAlign = useCallback(
    async (alignment) => {
      if (!canvas) return;

      const objectsToAlign = canvas
        .getActiveObjects()
        .filter((object) => object && !object.excludeFromLayer && object.visible !== false);

      if (!objectsToAlign.length) return;

      const isMultiSelection = objectsToAlign.length > 1;
      const ActiveSelection = isMultiSelection ? (await import("fabric")).fabric.ActiveSelection : null;

      if (isMultiSelection) {
        canvas.discardActiveObject();
      }

      const referenceBounds = isMultiSelection
        ? getObjectsBounds(objectsToAlign)
        : {
            left: 0,
            top: 0,
            right: canvas.getWidth(),
            bottom: canvas.getHeight(),
            width: canvas.getWidth(),
            height: canvas.getHeight(),
            centerX: canvas.getWidth() / 2,
            centerY: canvas.getHeight() / 2,
          };

      objectsToAlign.forEach((object) => {
        const bounds = getBounds(object);
        let deltaX = 0;
        let deltaY = 0;

        switch (alignment) {
          case "left":
            deltaX = referenceBounds.left - bounds.left;
            break;
          case "centerX":
            deltaX = referenceBounds.centerX - bounds.centerX;
            break;
          case "right":
            deltaX = referenceBounds.right - bounds.right;
            break;
          case "top":
            deltaY = referenceBounds.top - bounds.top;
            break;
          case "centerY":
            deltaY = referenceBounds.centerY - bounds.centerY;
            break;
          case "bottom":
            deltaY = referenceBounds.bottom - bounds.bottom;
            break;
          default:
            break;
        }

        object.set({
          left: (object.left || 0) + deltaX,
          top: (object.top || 0) + deltaY,
        });
        object.setCoords();
      });

      if (objectsToAlign.length > 1) {
        const nextSelection = new ActiveSelection(objectsToAlign, { canvas });
        canvas.setActiveObject(nextSelection);
      } else {
        canvas.setActiveObject(objectsToAlign[0]);
      }

      setLastAlignment(alignment);
      setAlignmentMenuOpen(false);
      canvas.requestRenderAll();
      onCanvasUpdate?.();
    },
    [canvas, onCanvasUpdate],
  );

  useEffect(() => {
    if (!alignmentMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!alignmentMenuRef.current?.contains(event.target)) {
        setAlignmentMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setAlignmentMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [alignmentMenuOpen]);

  const handleExportClick = useCallback((type) => {
    setExportType(type);
    setExportModalOpen(true);
  }, []);

  const handleExportModalClose = useCallback(() => {
    setExportModalOpen(false);
    setIsExporting(false);
  }, []);

  const handleExportConfirm = useCallback(
    async (options) => {
      setIsExporting(true);
      try {
        if (exportType === "workspace") {
          await onExport?.(options);
        } else if (exportType === "all") {
          await onExportAll?.(options);
        }
        handleExportModalClose();
      } catch (error) {
        console.error("Export error:", error);
      } finally {
        setIsExporting(false);
      }
    },
    [exportType, onExport, onExportAll, handleExportModalClose]
  );

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-slate-950 px-4">
      {/* Left Section */}
      <div className="flex items-center gap-3">
        <Link
          to="/home"
          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-slate-200 transition hover:bg-white/[0.12]"
          title="Back to upload"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-sm font-semibold text-white">PixelForge Editor</h1>
          <p className="text-xs text-slate-400">Professional Image Editor</p>
        </div>
      </div>

      {/* Center Section - Zoom Controls */}
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1">
        <button
          onClick={onZoomOut}
          className="grid h-7 w-7 place-items-center rounded text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <span className="min-w-[3rem] text-center text-sm font-medium text-white">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          className="grid h-7 w-7 place-items-center rounded text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <div className="mx-1 h-4 w-px bg-white/20" />
        <button
          onClick={onResetCanvas}
          className="grid h-7 w-7 place-items-center rounded text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
          title="Reset View"
        >
          <RotateCcw size={16} />
        </button>
        <div className="mx-1 h-4 w-px bg-white/20" />
        <div ref={alignmentMenuRef} className="relative">
          <button
            onClick={() => setAlignmentMenuOpen((isOpen) => !isOpen)}
            className={`flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium transition ${
              alignmentMenuOpen
                ? 'bg-white/[0.14] text-white'
                : 'text-slate-200 hover:bg-white/[0.12] hover:text-white'
            }`}
            title="Alignment and settings"
          >
            <SlidersHorizontal size={15} />
            <span>Align</span>
            <ChevronDown
              size={13}
              className={`transition-transform ${alignmentMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {alignmentMenuOpen && (
            <div className="absolute left-1/2 top-9 z-[70] w-64 -translate-x-1/2 rounded-lg border border-white/10 bg-slate-950/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-md">
              <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Align
              </div>

              <div className="space-y-0.5">
                {ALIGNMENT_ACTIONS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleAlign(id)}
                    disabled={!hasSelection}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                      lastAlignment === id
                        ? 'bg-teal-400/15 text-teal-200'
                        : 'text-slate-200 hover:bg-white/[0.08] hover:text-white'
                    } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-200`}
                  >
                    <Icon size={15} />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {lastAlignment === id && <Check size={14} />}
                  </button>
                ))}
              </div>

              <div className="my-1.5 h-px bg-white/10" />

              <button
                onClick={toggleGrid}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                  showGrid
                    ? 'bg-teal-400/15 text-teal-200'
                    : 'text-slate-200 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <Grid3x3 size={15} />
                <span className="min-w-0 flex-1 truncate">Grid</span>
                {showGrid && <Check size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-2">
        {/* Toggle Original/Background Removed Button */}
        {hasBackgroundRemoval && onToggleBackground && (
          <button
            onClick={onToggleBackground}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              showOriginal
                ? 'border-teal-500 bg-teal-500/20 text-teal-400'
                : 'border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]'
            }`}
            title={showOriginal ? "Show Background Removed" : "Show Original"}
          >
            <ArrowLeftRight size={16} />
            <span>{showOriginal ? "Original" : "No BG"}</span>
          </button>
        )}

        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06]">
          <button
            onClick={onUndo}
            className="grid h-8 w-8 place-items-center rounded-l-lg text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
            title="Undo (Ctrl+Z)"
          >
            <Undo size={16} />
          </button>
          <button
            onClick={onRedo}
            className="grid h-8 w-8 place-items-center rounded-r-lg text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
            title="Redo (Ctrl+Y)"
          >
            <Redo size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06]">
          <button
            onClick={() => handleExportClick("workspace")}
            className="grid h-8 w-8 place-items-center rounded-l-lg text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
            title="Export Current Workspace"
          >
            <Download size={14} />
          </button>
          <button
            onClick={() => onSaveProject?.()}
            className="grid h-8 w-8 place-items-center border-l border-white/10 text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
            title="Save Project"
          >
            <Save size={16} />
          </button>
          {onExportAll && (
            <button
              onClick={() => handleExportClick("all")}
              className="grid h-8 w-8 place-items-center rounded-r-lg border-l border-white/10 text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
              title="Export All Workspaces as ZIP"
            >
              <Archive size={15} />
            </button>
          )}
        </div>
      </div>

      <ExportModal
        isOpen={exportModalOpen}
        onClose={handleExportModalClose}
        onExport={handleExportConfirm}
        exportType={exportType}
        isLoading={isExporting}
        sourceWidth={exportSourceSize.width}
        sourceHeight={exportSourceSize.height}
      />
    </header>
  );
}
