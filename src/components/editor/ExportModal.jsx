import { useState, useCallback } from "react";
import { X, Download } from "lucide-react";

export default function ExportModal({
  isOpen,
  onClose,
  onExport,
  exportType = "workspace",
  isLoading = false,
  sourceWidth = 1,
  sourceHeight = 1,
}) {
  const [format, setFormat] = useState("png");
  const [quality, setQuality] = useState(0.9);
  const [transparency, setTransparency] = useState(true);
  const [scale, setScale] = useState(2);
  const exportWidth = Math.max(1, Math.round(sourceWidth * scale));
  const exportHeight = Math.max(1, Math.round(sourceHeight * scale));
  const qualityPercent = Math.round(quality * 100);

  const handleExport = useCallback(() => {
    onExport({
      format,
      quality,
      transparency,
      scale,
    });
  }, [format, quality, transparency, scale, onExport]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-white/20 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Export Settings</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 transition hover:text-white disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-white">Format</label>
          <div className="flex gap-3">
            <button
              onClick={() => setFormat("png")}
              disabled={isLoading}
              className={`flex-1 rounded-lg border-2 px-4 py-2 font-medium transition ${
                format === "png"
                  ? "border-teal-500 bg-teal-500/20 text-teal-300"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
              } disabled:opacity-50`}
            >
              PNG
            </button>
            <button
              onClick={() => setFormat("jpg")}
              disabled={isLoading}
              className={`flex-1 rounded-lg border-2 px-4 py-2 font-medium transition ${
                format === "jpg"
                  ? "border-teal-500 bg-teal-500/20 text-teal-300"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
              } disabled:opacity-50`}
            >
              JPG
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {format === "png"
              ? "PNG supports transparency and perfect quality"
              : "JPG is smaller file size, good for web"}
          </p>
        </div>

        {format === "png" && (
          <div className="mb-6">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={transparency}
                onChange={(event) => setTransparency(event.target.checked)}
                disabled={isLoading}
                className="h-4 w-4 rounded border-white/20 accent-teal-500"
              />
              <span className="text-sm text-white">Transparent Background</span>
            </label>
            <p className="mt-1 text-xs text-slate-400">
              {transparency ? "Background will be transparent" : "Background will be dark"}
            </p>
          </div>
        )}

        <div className="mb-6">
          <label className="mb-2 flex items-center justify-between text-sm font-medium text-white">
            <span>Quality</span>
            <span className="text-teal-400">{qualityPercent}%</span>
          </label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={quality}
            onChange={(event) => setQuality(parseFloat(event.target.value))}
            disabled={isLoading}
            className="h-2 w-full appearance-none rounded-lg bg-slate-700 accent-teal-500"
          />
          <p className="mt-2 text-xs text-slate-400">Higher quality = larger file size</p>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-white">Resolution Scale</label>
          <div className="flex gap-2">
            {[1, 1.5, 2, 3].map((scaleValue) => (
              <button
                key={scaleValue}
                onClick={() => setScale(scaleValue)}
                disabled={isLoading}
                className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
                  scale === scaleValue
                    ? "border-teal-500 bg-teal-500/20 text-teal-300"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                } disabled:opacity-50`}
              >
                {scaleValue}x
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {scale}x resolution = {exportWidth} x {exportHeight} pixels
          </p>
        </div>

        <div className="mb-6 rounded-lg bg-white/5 p-4">
          <p className="text-xs text-slate-300">
            <strong>Export Type:</strong>{" "}
            {exportType === "workspace"
              ? "Current Workspace"
              : exportType === "object"
                ? "Selected Object"
                : "All Workspaces"}
          </p>
          <p className="mt-2 text-xs text-slate-300">
            <strong>Format:</strong> {format.toUpperCase()} ({qualityPercent}% quality)
          </p>
          <p className="text-xs text-slate-300">
            <strong>Resolution:</strong> {scale}x ({exportWidth} x {exportHeight}px)
          </p>
          {format === "png" && (
            <p className="text-xs text-slate-300">
              <strong>Background:</strong> {transparency ? "Transparent" : "Solid"}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 font-medium text-slate-200 transition hover:bg-white/[0.12] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-teal-500 bg-teal-500 px-4 py-2 font-medium text-white transition hover:bg-teal-600 disabled:opacity-50"
          >
            <Download size={18} />
            {isLoading ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
