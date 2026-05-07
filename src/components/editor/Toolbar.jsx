import {
  ArrowRight,
  Circle,
  Copy,
  Download,
  Eraser,
  Minus,
  MousePointer2,
  Pen,
  Redo,
  RotateCcw,
  Scissors,
  Shapes,
  Square,
  Trash2,
  Type,
  Undo,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

function ToolButton({ title, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-lg border transition ${
        active
          ? "border-teal-200 bg-teal-300 text-slate-950 shadow-glow"
          : "border-white/10 bg-white/[0.06] text-slate-200 hover:-translate-y-0.5 hover:bg-white/[0.12]"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

export default function Toolbar({
  activeTool,
  hasSelection,
  onSelectTool,
  onAddText,
  onAddShape,
  onDelete,
  onDuplicate,
  onExport,
  onAddLine,
  onAddArrow,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetCanvas,
}) {
  return (
    <aside className="flex w-20 shrink-0 flex-col items-center gap-3 border-r border-white/10 bg-slate-950/95 px-3 py-5">
      <ToolButton title="Select (V)" active={activeTool === "select"} onClick={() => onSelectTool("select")}>
        <MousePointer2 size={20} />
      </ToolButton>
      <ToolButton title="Crop (C)" active={activeTool === "crop"} onClick={() => onSelectTool("crop")}>
        <Scissors size={20} />
      </ToolButton>

      <div className="my-1 h-px w-full bg-white/10" />

      <ToolButton title="Draw (D)" active={activeTool === "draw"} onClick={() => onSelectTool("draw")}>
        <Pen size={20} />
      </ToolButton>
      <ToolButton title="Eraser (E)" active={activeTool === "eraser"} onClick={() => onSelectTool("eraser")}>
        <Eraser size={20} />
      </ToolButton>

      <div className="my-1 h-px w-full bg-white/10" />

      <ToolButton title="Add text (T)" onClick={onAddText}>
        <Type size={20} />
      </ToolButton>
      <ToolButton title="Add line (L)" onClick={onAddLine}>
        <Minus size={20} />
      </ToolButton>
      <ToolButton title="Add arrow (A)" onClick={onAddArrow}>
        <ArrowRight size={20} />
      </ToolButton>
      <ToolButton title="Add rectangle (R)" onClick={() => onAddShape("rect")}>
        <Square size={20} />
      </ToolButton>
      <ToolButton title="Add circle (O)" onClick={() => onAddShape("circle")}>
        <Circle size={20} />
      </ToolButton>
      <ToolButton title="Add triangle" onClick={() => onAddShape("triangle")}>
        <Shapes size={20} />
      </ToolButton>

      <div className="my-1 h-px w-full bg-white/10" />

      <ToolButton title="Duplicate (Ctrl+D)" disabled={!hasSelection} onClick={onDuplicate}>
        <Copy size={20} />
      </ToolButton>
      <ToolButton title="Delete (Del)" disabled={!hasSelection} onClick={onDelete}>
        <Trash2 size={20} />
      </ToolButton>

      <div className="my-1 h-px w-full bg-white/10" />

      <ToolButton title="Undo (Ctrl+Z)" onClick={onUndo}>
        <Undo size={20} />
      </ToolButton>
      <ToolButton title="Redo (Ctrl+Y)" onClick={onRedo}>
        <Redo size={20} />
      </ToolButton>
      <ToolButton title="Zoom in" onClick={onZoomIn}>
        <ZoomIn size={20} />
      </ToolButton>
      <ToolButton title="Zoom out" onClick={onZoomOut}>
        <ZoomOut size={20} />
      </ToolButton>
      <ToolButton title="Reset canvas" onClick={onResetCanvas}>
        <RotateCcw size={20} />
      </ToolButton>

      <div className="mt-auto">
        <ToolButton title="Export PNG" onClick={onExport}>
          <Download size={20} />
        </ToolButton>
      </div>
    </aside>
  );
}
