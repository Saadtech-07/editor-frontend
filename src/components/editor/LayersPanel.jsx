import { Eye, EyeOff, Layers3, Trash2 } from "lucide-react";
import { useEditor } from "../../context/EditorContext.jsx";
import { removeObjectFromCanvas } from "../../utils/fabricHelpers.js";

export default function LayersPanel({ className = "" }) {
  const { canvas, objects, activeObject, selectObjectById, setActiveObject, syncObjects } = useEditor();

  const toggleVisibility = (event, layer) => {
    event.stopPropagation();
    layer.fabricObject.set({ visible: !layer.visible });
    canvas?.requestRenderAll();
    syncObjects(canvas);
  };

  const deleteLayer = (event, layer) => {
    event.stopPropagation();
    removeObjectFromCanvas(canvas, layer.fabricObject);
    setActiveObject(null);
    canvas?.requestRenderAll();
    syncObjects(canvas);
  };

  return (
    <aside className={`w-80 shrink-0 border-l border-white/10 bg-slate-950/95 p-4 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers3 size={18} className="text-teal-200" />
          <h2 className="font-semibold text-white">Layers</h2>
        </div>
        <span className="rounded-lg bg-white/[0.08] px-2 py-1 text-xs text-slate-300">{objects.length}</span>
      </div>

      <div className="space-y-2">
        {objects.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/[0.12] px-4 py-8 text-center text-sm text-slate-400">
            No canvas objects
          </p>
        ) : (
          objects.map((layer) => {
            const isActive = activeObject?.editorId === layer.id;

            return (
              <div
                key={layer.id}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                  isActive
                    ? "border-teal-200 bg-teal-300/[0.12]"
                    : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectObjectById(layer.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-800 text-xs font-bold uppercase text-teal-200">
                    {layer.type?.slice(0, 2) || "ob"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{layer.name}</span>
                    <span className="block truncate text-xs capitalize text-slate-400">{layer.type}</span>
                  </span>
                </button>
                <button
                  type="button"
                  title={layer.visible ? "Hide layer" : "Show layer"}
                  onClick={(event) => toggleVisibility(event, layer)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  {layer.visible ? <Eye size={17} /> : <EyeOff size={17} />}
                </button>
                <button
                  type="button"
                  title="Delete layer"
                  onClick={(event) => deleteLayer(event, layer)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-rose-400/[0.12] hover:text-rose-200"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
