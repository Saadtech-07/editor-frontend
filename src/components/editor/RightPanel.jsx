import { useState } from "react";
import { fabric } from "fabric";
import { Eye, EyeOff, Layers3, Trash2, Sliders, Move, RotateCw, Sun, Moon, Type, Palette } from "lucide-react";
import { useEditor } from "../../context/EditorContext.jsx";
import { removeObjectFromCanvas } from "../../utils/fabricHelpers.js";

function PropertyControls({ activeObject, canvas, syncObjects }) {
  const [opacity, setOpacity] = useState(activeObject?.opacity || 1);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [rotation, setRotation] = useState(activeObject?.angle || 0);

  if (!activeObject) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-center text-sm text-slate-400">
        No object selected
      </div>
    );
  }

  const updateProperty = (property, value) => {
    if (!activeObject || !canvas) return;
    
    activeObject.set(property, value);
    canvas.requestRenderAll();
    syncObjects(canvas);
  };

  const updateFilter = (filterType, value) => {
    if (!activeObject || !canvas) return;
    
    const filters = activeObject.filters || [];
    
    if (value === 0) {
      // Remove filter
      const newFilters = filters.filter(f => f.type !== filterType);
      activeObject.set({ filters: newFilters });
    } else {
      // Add or update filter
      let filter = filters.find(f => f.type === filterType);
      
      if (!filter) {
        if (filterType === 'brightness') {
          filter = new fabric.Image.filters.Brightness({ brightness: value / 100 });
        } else if (filterType === 'contrast') {
          filter = new fabric.Image.filters.Contrast({ contrast: value / 100 });
        }
        filters.push(filter);
      } else {
        if (filterType === 'brightness') {
          filter.brightness = value / 100;
        } else if (filterType === 'contrast') {
          filter.contrast = value / 100;
        }
      }
      
      activeObject.set({ filters });
    }
    
    activeObject.applyFilters();
    canvas.requestRenderAll();
    syncObjects(canvas);
  };

  // Text properties
  if (activeObject.type === 'textbox' || activeObject.type === 'text') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Type size={16} />
          Text Properties
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Font Family</label>
          <select
            value={activeObject.fontFamily || 'Inter'}
            onChange={(e) => updateProperty('fontFamily', e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white focus:border-teal-200 focus:outline-none"
          >
            <option value="Inter">Inter</option>
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Georgia">Georgia</option>
            <option value="Courier New">Courier New</option>
            <option value="Verdana">Verdana</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Font Size</label>
          <input
            type="number"
            value={activeObject.fontSize || 36}
            onChange={(e) => updateProperty('fontSize', parseInt(e.target.value))}
            className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white focus:border-teal-200 focus:outline-none"
            min="8"
            max="200"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Color</label>
          <input
            type="color"
            value={activeObject.fill || '#ffffff'}
            onChange={(e) => updateProperty('fill', e.target.value)}
            className="w-full h-10 rounded-lg border border-white/10 bg-white/[0.06] cursor-pointer"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => updateProperty('fontWeight', activeObject.fontWeight === 'bold' ? 'normal' : 'bold')}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
              activeObject.fontWeight === 'bold'
                ? 'border-teal-200 bg-teal-300 text-slate-950'
                : 'border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.12]'
            }`}
          >
            Bold
          </button>
          <button
            onClick={() => updateProperty('fontStyle', activeObject.fontStyle === 'italic' ? 'normal' : 'italic')}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
              activeObject.fontStyle === 'italic'
                ? 'border-teal-200 bg-teal-300 text-slate-950'
                : 'border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.12]'
            }`}
          >
            Italic
          </button>
        </div>
      </div>
    );
  }

  // Shape properties
  if (activeObject.type === 'rect' || activeObject.type === 'circle' || activeObject.type === 'triangle') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Palette size={16} />
          Shape Properties
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Fill Color</label>
          <input
            type="color"
            value={activeObject.fill || '#2dd4bf'}
            onChange={(e) => updateProperty('fill', e.target.value)}
            className="w-full h-10 rounded-lg border border-white/10 bg-white/[0.06] cursor-pointer"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Stroke Color</label>
          <input
            type="color"
            value={activeObject.stroke || '#ccfbf1'}
            onChange={(e) => updateProperty('stroke', e.target.value)}
            className="w-full h-10 rounded-lg border border-white/10 bg-white/[0.06] cursor-pointer"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Stroke Width</label>
          <input
            type="range"
            min="0"
            max="10"
            value={activeObject.strokeWidth || 2}
            onChange={(e) => updateProperty('strokeWidth', parseInt(e.target.value))}
            className="w-full"
          />
          <span className="text-xs text-slate-400">{activeObject.strokeWidth || 2}px</span>
        </div>

        {activeObject.type === 'rect' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Border Radius</label>
            <input
              type="range"
              min="0"
              max="50"
              value={activeObject.rx || 0}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                updateProperty('rx', value);
                updateProperty('ry', value);
              }}
              className="w-full"
            />
            <span className="text-xs text-slate-400">{activeObject.rx || 0}px</span>
          </div>
        )}
      </div>
    );
  }

  // Image properties
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Sliders size={16} />
        Image Properties
      </div>
      
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Opacity</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={opacity}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            setOpacity(value);
            updateProperty('opacity', value);
          }}
          className="w-full"
        />
        <span className="text-xs text-slate-400">{Math.round(opacity * 100)}%</span>
      </div>

      {activeObject.type === 'image' && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Brightness</label>
            <input
              type="range"
              min="-100"
              max="100"
              value={brightness}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setBrightness(value);
                updateFilter('brightness', value);
              }}
              className="w-full"
            />
            <span className="text-xs text-slate-400">{brightness}%</span>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Contrast</label>
            <input
              type="range"
              min="-100"
              max="100"
              value={contrast}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setContrast(value);
                updateFilter('contrast', value);
              }}
              className="w-full"
            />
            <span className="text-xs text-slate-400">{contrast}%</span>
          </div>
        </>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Rotation</label>
        <input
          type="range"
          min="0"
          max="360"
          value={rotation}
          onChange={(e) => {
            const value = parseInt(e.target.value);
            setRotation(value);
            updateProperty('angle', value);
          }}
          className="w-full"
        />
        <span className="text-xs text-slate-400">{rotation}°</span>
      </div>
    </div>
  );
}

export default function RightPanel({ className = "" }) {
  const { canvas, objects, activeObject, selectObjectById, setActiveObject, syncObjects, hoveredLayerId, selectedLayerIds, setSelectedLayerIds } = useEditor();
  const [activeTab, setActiveTab] = useState('layers');

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

  const handleLayerClick = (event, layer) => {
    if (event.ctrlKey) {
      // Multi-selection with Ctrl+click
      setSelectedLayerIds(prev => {
        if (prev.includes(layer.id)) {
          return prev.filter(id => id !== layer.id);
        } else {
          return [...prev, layer.id];
        }
      });
    } else {
      // Single selection
      setSelectedLayerIds([layer.id]);
      selectObjectById(layer.id);
    }
  };

  return (
    <aside className={`w-80 shrink-0 border-l border-white/10 bg-slate-950/95 ${className}`}>
      {/* Tab Navigation */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('layers')}
          className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition ${
            activeTab === 'layers'
              ? 'border-b-2 border-teal-200 text-teal-200'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers3 size={16} />
          Layers
        </button>
        <button
          onClick={() => setActiveTab('properties')}
          className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition ${
            activeTab === 'properties'
              ? 'border-b-2 border-teal-200 text-teal-200'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders size={16} />
          Properties
        </button>
      </div>

      <div className="p-4">
        {activeTab === 'layers' ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers3 size={18} className="text-teal-200" />
                <h2 className="font-semibold text-white">Layers</h2>
              </div>
              <div className="flex items-center gap-2">
                {/* Group button for multi-selected layers */}
                {selectedLayerIds.length > 1 && (
                  <button
                    onClick={() => {
                      const active = canvas.getActiveObject();
                      if (active && active.type === "activeSelection") {
                        const group = active.toGroup();
                        canvas.setActiveObject(group);
                        canvas.requestRenderAll();
                        syncObjects(canvas);
                        setSelectedLayerIds([]);
                      }
                    }}
                    className="rounded-lg bg-purple-300/[0.12] border border-purple-300 px-3 py-1 text-xs font-medium text-purple-200 hover:bg-purple-300/[0.2] transition"
                    title="Group selected layers (Ctrl+G)"
                  >
                    G
                  </button>
                )}
                
                {/* UnGroup button for grouped objects */}
                {activeObject?.type === "group" && (
                  <button
                    onClick={() => {
                      const group = canvas.getActiveObject();
                      if (group && group.type === "group") {
                        const items = group._objects;

                        group._restoreObjectsState();
                        canvas.remove(group);

                        items.forEach(obj => canvas.add(obj));

                        canvas.requestRenderAll();
                        syncObjects(canvas);
                        setSelectedLayerIds([]);
                      }
                    }}
                    className="rounded-lg bg-orange-300/[0.12] border border-orange-300 px-3 py-1 text-xs font-medium text-orange-200 hover:bg-orange-300/[0.2] transition"
                    title="Ungroup selected layer (Ctrl+Shift+G)"
                  >
                    UG
                  </button>
                )}
                
                <span className="rounded-lg bg-white/[0.08] px-2 py-1 text-xs text-slate-300">{objects.length}</span>
              </div>
            </div>

            <div className="space-y-2">
              {objects.length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/[0.12] px-4 py-8 text-center text-sm text-slate-400">
                  No canvas objects
                </p>
              ) : (
                objects.map((layer) => {
                  const isActive = activeObject?.editorId === layer.id;
                  const isHovered = hoveredLayerId === layer.id;
                  const isSelected = selectedLayerIds.includes(layer.id);

                  return (
                    <div
                      key={layer.id}
                      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                        isSelected
                          ? "border-purple-300 bg-purple-300/[0.12]"
                          : isActive
                          ? "border-teal-200 bg-teal-300/[0.12]"
                          : isHovered
                          ? "border-blue-300 bg-blue-300/[0.12]"
                          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleLayerClick(e, layer)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold uppercase ${
                          isHovered ? "bg-blue-800 text-blue-200" : "bg-slate-800 text-teal-200"
                        }`}>
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
          </>
        ) : (
          <PropertyControls activeObject={activeObject} canvas={canvas} syncObjects={syncObjects} />
        )}
      </div>
    </aside>
  );
}
