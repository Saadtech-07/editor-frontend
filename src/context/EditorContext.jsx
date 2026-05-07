import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { FABRIC_SERIALIZATION_PROPS, getLayerObjects } from "../utils/fabricHelpers.js";

const EditorContext = createContext(null);

export function EditorProvider({ children }) {
  const canvasRef = useRef(null);
  const [canvas, setCanvasState] = useState(null);
  const [objects, setObjects] = useState([]);
  const [activeObject, setActiveObject] = useState(null);
  const [hoveredLayerId, setHoveredLayerId] = useState(null);
  const [selectedLayerIds, setSelectedLayerIds] = useState([]);
  
  // Workspace state
  const [workspaces, setWorkspaces] = useState([
    {
      id: "page-1",
      name: "Main",
      canvasJSON: null,
      history: [],
      historyIndex: -1,
    },
  ]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("page-1");

  const setCanvas = useCallback((canvasInstance) => {
    canvasRef.current = canvasInstance;
    setCanvasState(canvasInstance);

    if (!canvasInstance) {
      setObjects([]);
      setActiveObject(null);
      setHoveredLayerId(null);
      setSelectedLayerIds([]);
    }
  }, []);

  const syncObjects = useCallback(
    (targetCanvas) => {
      const sourceCanvas = targetCanvas || canvasRef.current;

      if (!sourceCanvas) {
        setObjects([]);
        return;
      }

      setObjects(getLayerObjects(sourceCanvas));
    },
    [],
  );

  const selectObjectById = useCallback(
    (objectId) => {
      if (!canvas) {
        return;
      }

      const fabricObject = canvas.getObjects().find((object) => object.editorId === objectId);

      if (!fabricObject) {
        return;
      }

      canvas.setActiveObject(fabricObject);
      setActiveObject(fabricObject);
      canvas.requestRenderAll();
      syncObjects(canvas);
    },
    [canvas, syncObjects],
  );

  // Workspace management functions
  const createWorkspaceFromCurrentCanvas = useCallback(
    (canvas, name = "New") => {
      const id = `page-${Date.now()}`;
      const newWorkspace = {
        id,
        name,
        canvasJSON: null,
        history: [],
        historyIndex: -1,
      };

      setWorkspaces((prev) => {
        const savedPrev = prev.map((workspace) =>
          workspace.id === activeWorkspaceId && canvas
            ? { ...workspace, canvasJSON: canvas.toJSON(FABRIC_SERIALIZATION_PROPS) }
            : workspace,
        );

        return [...savedPrev, newWorkspace];
      });
      setActiveWorkspaceId(id);
      return newWorkspace;
    },
    [activeWorkspaceId],
  );

  const loadWorkspaceToCanvas = useCallback(
    (canvas, workspace) => {
      if (!canvas || !workspace) {
        return Promise.resolve();
      }

      canvas.clear();

      if (!workspace.canvasJSON) {
        canvas.renderAll();
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        canvas.loadFromJSON(workspace.canvasJSON, () => {
          canvas.renderAll();
          resolve();
        });
      });
    },
    [],
  );

  const switchWorkspace = useCallback(
    (workspaceId, canvasInstance = canvasRef.current) => {
      if (workspaceId === activeWorkspaceId) {
        return;
      }

      if (canvasInstance && activeWorkspaceId) {
        const canvasJSON = canvasInstance.toJSON(FABRIC_SERIALIZATION_PROPS);

        setWorkspaces((prev) =>
          prev.map((workspace) =>
            workspace.id === activeWorkspaceId ? { ...workspace, canvasJSON } : workspace,
          ),
        );
      }

      setActiveWorkspaceId(workspaceId);
    },
    [activeWorkspaceId],
  );

  const saveWorkspace = useCallback(
    (workspaceId, nextState = {}) => {
      const canvasInstance = canvasRef.current;

      setWorkspaces((prev) =>
        prev.map((workspace) => {
          if (workspace.id !== workspaceId) {
            return workspace;
          }

          return {
            ...workspace,
            canvasJSON:
              nextState.canvasJSON ??
              (canvasInstance ? canvasInstance.toJSON(FABRIC_SERIALIZATION_PROPS) : workspace.canvasJSON),
            history: nextState.history ?? workspace.history,
            historyIndex: nextState.historyIndex ?? workspace.historyIndex,
          };
        }),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({
      canvas,
      setCanvas,
      objects,
      setObjects,
      syncObjects,
      activeObject,
      setActiveObject,
      hoveredLayerId,
      setHoveredLayerId,
      selectedLayerIds,
      setSelectedLayerIds,
      selectObjectById,
      // Workspace state and functions
      workspaces,
      setWorkspaces,
      activeWorkspaceId,
      setActiveWorkspaceId,
      createWorkspaceFromCurrentCanvas,
      loadWorkspaceToCanvas,
      switchWorkspace,
      saveWorkspace,
    }),
    [activeObject, canvas, objects, selectObjectById, setCanvas, syncObjects, workspaces, activeWorkspaceId, createWorkspaceFromCurrentCanvas, loadWorkspaceToCanvas, switchWorkspace, saveWorkspace, hoveredLayerId, selectedLayerIds],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor() {
  const context = useContext(EditorContext);

  if (!context) {
    throw new Error("useEditor must be used inside EditorProvider.");
  }

  return context;
}
