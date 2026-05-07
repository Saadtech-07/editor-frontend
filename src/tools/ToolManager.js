export default class ToolManager {
  constructor({ canvas, tools = {} }) {
    this.canvas = canvas;
    this.tools = tools;
    this.activeToolId = "select";
    this.activeTool = null;
  }

  resetCanvasState() {
    if (!this.canvas) {
      return;
    }

    this.canvas.isDrawingMode = false;
    this.canvas.selection = true;
    this.canvas.defaultCursor = "default";
    this.canvas.hoverCursor = "move";
    this.canvas.moveCursor = "move";
    this.canvas.freeDrawingCursor = "crosshair";
    this.canvas.freeDrawingBrush = null;

    if (this.canvas.upperCanvasEl) {
      this.canvas.upperCanvasEl.style.cursor = "default";
    }
  }

  deactivateAll() {
    if (this.activeTool?.deactivate) {
      this.activeTool.deactivate();
    }

    this.activeTool = null;
    this.activeToolId = "select";
    this.resetCanvasState();
    this.canvas?.requestRenderAll();
  }

  setActiveTool(toolId, options) {
    if (!this.canvas) {
      return false;
    }

    if (toolId === this.activeToolId) {
      this.activeTool?.updateOptions?.(options);
      return true;
    }

    this.deactivateAll();

    if (!toolId || toolId === "select") {
      return true;
    }

    const nextTool = this.tools[toolId];

    if (!nextTool) {
      return false;
    }

    const activated = nextTool.activate?.(options);

    if (activated === false) {
      this.deactivateAll();
      return false;
    }

    this.activeTool = nextTool;
    this.activeToolId = toolId;
    this.canvas.requestRenderAll();
    return true;
  }

  dispose() {
    this.deactivateAll();
  }
}
