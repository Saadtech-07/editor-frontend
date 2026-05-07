import { fabric } from "fabric";

let eraserSupportPromise = null;

export function hasFabricEraserSupport() {
  return typeof fabric.EraserBrush === "function";
}

export async function ensureFabricEraserSupport() {
  if (hasFabricEraserSupport()) {
    return true;
  }

  if (!eraserSupportPromise) {
    eraserSupportPromise = (async () => {
      try {
        if (typeof window !== "undefined") {
          window.fabric = fabric;
        }

        await import("fabric/src/mixins/eraser_brush.mixin.js");
        return hasFabricEraserSupport();
      } catch (error) {
        console.error("Unable to load Fabric eraser support:", error);
        return false;
      }
    })();
  }

  return eraserSupportPromise;
}
