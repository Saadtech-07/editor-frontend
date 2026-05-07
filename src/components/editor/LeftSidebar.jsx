import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Crop,
  Eraser,
  MousePointer2,
  PenTool,
  Plus,
  Settings2,
  Square,
  Trash2,
  Triangle,
  Type,
  Circle,
} from "lucide-react";

const toolIds = new Set(["crop", "draw", "eraser"]);

function RailButton({ active, disabled = false, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      className={`flex h-12 w-12 items-center justify-center rounded-lg transition ${
        active
          ? "bg-teal-600 text-white shadow-lg shadow-teal-600/20"
          : "text-slate-400 hover:bg-slate-700 hover:text-white"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <Icon size={20} />
    </button>
  );
}

function ToolModeButton({ active, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
        active
          ? "border-teal-400 bg-teal-400/10 text-white"
          : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {label}
    </button>
  );
}

export default function LeftSidebar({
  activeTool,
  toolSettings,
  toolMessage,
  eraserSupported,
  hasSelection,
  onToolSelect,
  onToolSettingsChange,
  onAddText,
  onUpdateTextProperties,
  onAddShape,
  onDuplicate,
  onDelete,
  onUpload,
}) {
  const [openPanel, setOpenPanel] = useState(null);
  const [fontSize, setFontSize] = useState(36);
  const [textColor, setTextColor] = useState("#f8fafc");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState("left");
  const sidebarRef = useRef(null);

  // Removed auto-open behavior to allow floating toolbar shortcuts without opening sidebar panel

  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";

    input.onchange = (event) => {
      const file = event.target.files?.[0];

      if (file) {
        onUpload(file);
      }

      document.body.removeChild(input);
    };

    document.body.appendChild(input);
    input.click();
  };

  const handleRailAction = (actionId) => {
    if (actionId === "select") {
      onToolSelect("select");
      setOpenPanel(null);
      return;
    }

    if (actionId === "tools" || actionId === "text" || actionId === "shapes") {
      setOpenPanel((currentPanel) => (currentPanel === actionId ? null : actionId));
      return;
    }

    if (actionId === "upload") {
      handleUpload();
      return;
    }

    if (actionId === "duplicate") {
      onDuplicate();
      return;
    }

    if (actionId === "delete") {
      onDelete();
    }
  };

  const renderToolsPanel = () => (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Tools</h2>
        <p className="mt-1 text-xs text-slate-400">Only one tool runs at a time. Crop cuts from the source, Draw copies from the source, and Erase edits pixels directly.</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Crop size={14} />
          Crop
        </div>
        <ToolModeButton active={activeTool === "crop"} label="Activate Crop" onClick={() => onToolSelect("crop")} />
        {/* <p className="text-xs text-slate-500">Cursor becomes a plus. Drag a rectangle to cut that region into a new image and remove it from the original.</p> */}
      </section>

      <section className="space-y-3 border-t border-white/10 pt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <PenTool size={14} />
          Draw
        </div>
        <ToolModeButton active={activeTool === "draw"} label="Activate Draw" onClick={() => onToolSelect("draw")} />
        {/* <p className="text-xs text-slate-500">Cursor becomes a pen. Draw a freehand shape to duplicate that portion without changing the source image.</p> */}

        <div>
          <label className="mb-2 block text-xs text-slate-400">Brush Size</label>
          <input
            type="range"
            min="1"
            max="48"
            value={toolSettings.draw.size}
            onChange={(event) => onToolSettingsChange("draw", { size: Number(event.target.value) })}
            className="w-full accent-teal-500"
          />
          <div className="mt-1 text-xs text-slate-500">{toolSettings.draw.size}px</div>
        </div>

        <div>
          <label className="mb-2 block text-xs text-slate-400">Brush Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={toolSettings.draw.color}
              onChange={(event) => onToolSettingsChange("draw", { color: event.target.value })}
              className="h-9 w-10 rounded border border-slate-600 bg-slate-700"
            />
            <input
              type="text"
              value={toolSettings.draw.color}
              onChange={(event) => onToolSettingsChange("draw", { color: event.target.value })}
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-white/10 pt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Eraser size={14} />
          Erase
        </div>
        <ToolModeButton
          active={activeTool === "eraser"}
          disabled={!eraserSupported}
          label={eraserSupported ? "Activate Eraser" : "Eraser Unavailable"}
          onClick={() => onToolSelect("eraser")}
        />
        {/* <p className="text-xs text-slate-500">Cursor becomes a circle. Erasing changes pixels on the image itself and does not create objects.</p> */}

        <div>
          <label className="mb-2 block text-xs text-slate-400">Brush Size</label>
          <input
            type="range"
            min="4"
            max="72"
            value={toolSettings.eraser.size}
            onChange={(event) => onToolSettingsChange("eraser", { size: Number(event.target.value) })}
            className="w-full accent-teal-500"
          />
          <div className="mt-1 text-xs text-slate-500">{toolSettings.eraser.size}px</div>
        </div>

        <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
          <span>Restore Mode</span>
          <input
            type="checkbox"
            checked={toolSettings.eraser.inverted}
            onChange={(event) => onToolSettingsChange("eraser", { inverted: event.target.checked })}
            className="h-4 w-4 accent-teal-500"
          />
        </label>

        {!eraserSupported ? (
          <p className="text-xs text-amber-300">This Fabric build does not expose `EraserBrush`. Use the custom build with erasing support from `fabric5.fabricjs.com`.</p>
        ) : null}
      </section>

      {toolMessage ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          {toolMessage}
        </div>
      ) : null}
    </div>
  );

  const renderTextPanel = () => (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Text</h2>
        <p className="mt-1 text-xs text-slate-400">Add a text box with the current style settings.</p>
      </div>

      <button
        type="button"
        onClick={() => onAddText({ 
          fontSize, 
          color: textColor,
          fontFamily,
          fontWeight: isBold ? 'bold' : 'normal',
          fontStyle: isItalic ? 'italic' : 'normal',
          underline: isUnderline,
          textAlign
        })}
        className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-500"
      >
        Add Text
      </button>

      <div>
        <label className="mb-2 block text-xs text-slate-400">Font Family</label>
        <select
          value={fontFamily}
          onChange={(event) => {
            setFontFamily(event.target.value);
            onUpdateTextProperties?.({ fontFamily: event.target.value });
          }}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200"
        >
          <option value="Arial">Arial</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
          <option value="Courier New">Courier New</option>
          <option value="Impact">Impact</option>
          <option value="Comic Sans MS">Comic Sans MS</option>
          <option value="Trebuchet MS">Trebuchet MS</option>
          <option value="Arial Black">Arial Black</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs text-slate-400">Font Size</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="8"
            max="200"
            value={fontSize}
            onChange={(event) => {
              const newSize = Number(event.target.value);
              setFontSize(newSize);
              onUpdateTextProperties?.({ fontSize: newSize });
            }}
            className="flex-1 accent-teal-500"
          />
          <input
            type="number"
            min="8"
            max="200"
            value={fontSize}
            onChange={(event) => {
              const newSize = Number(event.target.value);
              setFontSize(newSize);
              onUpdateTextProperties?.({ fontSize: newSize });
            }}
            className="w-16 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center text-sm text-slate-200"
          />
        </div>
        <div className="mt-1 text-xs text-slate-500">{fontSize}px</div>
      </div>

      <div>
        <label className="mb-2 block text-xs text-slate-400">Text Style</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const newBold = !isBold;
              setIsBold(newBold);
              onUpdateTextProperties?.({ fontWeight: newBold ? 'bold' : 'normal' });
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition ${
              isBold 
                ? 'border-teal-500 bg-teal-500/20 text-teal-400' 
                : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
            }`}
          >
            B
          </button>
          <button
            type="button"
            onClick={() => {
              const newItalic = !isItalic;
              setIsItalic(newItalic);
              onUpdateTextProperties?.({ fontStyle: newItalic ? 'italic' : 'normal' });
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm italic transition ${
              isItalic 
                ? 'border-teal-500 bg-teal-500/20 text-teal-400' 
                : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
            }`}
          >
            I
          </button>
          <button
            type="button"
            onClick={() => {
              const newUnderline = !isUnderline;
              setIsUnderline(newUnderline);
              onUpdateTextProperties?.({ underline: newUnderline });
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm underline transition ${
              isUnderline 
                ? 'border-teal-500 bg-teal-500/20 text-teal-400' 
                : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
            }`}
          >
            U
          </button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs text-slate-400">Text Alignment</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setTextAlign("left");
              onUpdateTextProperties?.({ textAlign: "left" });
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
              textAlign === "left" 
                ? 'border-teal-500 bg-teal-500/20 text-teal-400' 
                : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
            }`}
          >
            <AlignLeft size={16} className="mx-auto" />
          </button>
          <button
            type="button"
            onClick={() => {
              setTextAlign("center");
              onUpdateTextProperties?.({ textAlign: "center" });
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
              textAlign === "center" 
                ? 'border-teal-500 bg-teal-500/20 text-teal-400' 
                : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
            }`}
          >
            <AlignCenter size={16} className="mx-auto" />
          </button>
          <button
            type="button"
            onClick={() => {
              setTextAlign("right");
              onUpdateTextProperties?.({ textAlign: "right" });
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
              textAlign === "right" 
                ? 'border-teal-500 bg-teal-500/20 text-teal-400' 
                : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
            }`}
          >
            <AlignRight size={16} className="mx-auto" />
          </button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs text-slate-400">Text Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={textColor}
            onChange={(event) => {
              setTextColor(event.target.value);
              onUpdateTextProperties?.({ fill: event.target.value });
            }}
            className="h-9 w-10 rounded border border-slate-600 bg-slate-700"
          />
          <input
            type="text"
            value={textColor}
            onChange={(event) => {
              setTextColor(event.target.value);
              onUpdateTextProperties?.({ fill: event.target.value });
            }}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200"
          />
        </div>
      </div>
    </div>
  );

  const renderShapesPanel = () => (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Shapes</h2>
        <p className="mt-1 text-xs text-slate-400">Insert a starter shape, then refine it from the properties panel.</p>
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => onAddShape("rect")}
          className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
        >
          <Square size={16} />
          Rectangle
        </button>
        <button
          type="button"
          onClick={() => onAddShape("circle")}
          className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
        >
          <Circle size={16} />
          Circle
        </button>
        <button
          type="button"
          onClick={() => onAddShape("triangle")}
          className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
        >
          <Triangle size={16} />
          Triangle
        </button>
      </div>
    </div>
  );

  const renderPanel = () => {
    if (openPanel === "tools") {
      return renderToolsPanel();
    }

    if (openPanel === "text") {
      return renderTextPanel();
    }

    if (openPanel === "shapes") {
      return renderShapesPanel();
    }

    return null;
  };

  return (
    <div ref={sidebarRef} className="relative flex">
      <aside className="z-20 flex w-[72px] flex-col items-center border-r border-slate-700 bg-[#0f172a] py-6">
        <div className="space-y-2">
          <RailButton
            active={activeTool === "select"}
            icon={MousePointer2}
            label="Select"
            onClick={() => handleRailAction("select")}
          />
          <RailButton
            active={openPanel === "tools" || toolIds.has(activeTool)}
            icon={Settings2}
            label="Tools"
            onClick={() => handleRailAction("tools")}
          />
          <RailButton active={openPanel === "text"} icon={Type} label="Text" onClick={() => handleRailAction("text")} />
          <RailButton active={openPanel === "shapes"} icon={Square} label="Shapes" onClick={() => handleRailAction("shapes")} />
          <RailButton active={false} icon={Plus} label="Upload" onClick={() => handleRailAction("upload")} />
          <RailButton
            active={false}
            disabled={!hasSelection}
            icon={Copy}
            label="Duplicate"
            onClick={() => handleRailAction("duplicate")}
          />
          <RailButton
            active={false}
            disabled={!hasSelection}
            icon={Trash2}
            label="Delete"
            onClick={() => handleRailAction("delete")}
          />
        </div>
      </aside>

      <div
        className={`absolute left-[72px] top-0 z-10 h-full border-r border-slate-700 bg-[#111827] transition-all duration-200 ${
          openPanel ? "w-[280px] opacity-100" : "w-0 overflow-hidden opacity-0"
        }`}
      >
        {openPanel ? <div className="h-full overflow-y-auto">{renderPanel()}</div> : null}
      </div>
    </div>
  );
}
