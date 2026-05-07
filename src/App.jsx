import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { EditorProvider } from "./context/EditorContext.jsx";
import Homepage from "./pages/Homepage.jsx";
import Editor from "./pages/Editor.jsx";

const initialImageState = {
  originalFile: null,
  originalUrl: "",
  processedFile: null,
  processedUrl: "",
};

function revokeObjectUrl(url) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function ImageEditorRoutes() {
  const [imageState, setImageState] = useState(initialImageState);
  const [projectToLoad, setProjectToLoad] = useState(null);
  const objectUrlsRef = useRef({ originalUrl: "", processedUrl: "" });

  const setOriginalImage = useCallback((file) => {
    if (!file || !file.type?.startsWith("image/")) {
      throw new Error("Please upload a valid image file.");
    }

    revokeObjectUrl(objectUrlsRef.current.originalUrl);
    revokeObjectUrl(objectUrlsRef.current.processedUrl);

    const originalUrl = URL.createObjectURL(file);
    objectUrlsRef.current = { originalUrl, processedUrl: "" };
    setProjectToLoad(null);

    setImageState({
      originalFile: file,
      originalUrl,
      processedFile: null,
      processedUrl: "",
    });
  }, []);

  const openProject = useCallback((project) => {
    revokeObjectUrl(objectUrlsRef.current.originalUrl);
    revokeObjectUrl(objectUrlsRef.current.processedUrl);

    objectUrlsRef.current = { originalUrl: "", processedUrl: "" };
    setImageState(initialImageState);
    setProjectToLoad(project);
  }, []);

  const clearSelectedImage = useCallback(() => {
    revokeObjectUrl(objectUrlsRef.current.originalUrl);
    revokeObjectUrl(objectUrlsRef.current.processedUrl);

    objectUrlsRef.current = { originalUrl: "", processedUrl: "" };
    setProjectToLoad(null);
    setImageState(initialImageState);
  }, []);

  const setProcessedImage = useCallback((blob) => {
    if (!blob || !(blob instanceof Blob)) {
      throw new Error("Background removal did not return an image.");
    }

    revokeObjectUrl(objectUrlsRef.current.processedUrl);

    const processedFile = new File([blob], "background-removed.png", {
      type: blob.type || "image/png",
    });
    const processedUrl = URL.createObjectURL(processedFile);

    objectUrlsRef.current = {
      ...objectUrlsRef.current,
      processedUrl,
    };

    setImageState((current) => ({
      ...current,
      processedFile,
      processedUrl,
    }));
  }, []);

  useEffect(() => {
    return () => {
      revokeObjectUrl(objectUrlsRef.current.originalUrl);
      revokeObjectUrl(objectUrlsRef.current.processedUrl);
    };
  }, []);

  return (
    <EditorProvider>
      <Routes>
        <Route
          path="/"
          element={
            <Homepage
              imageState={imageState}
              onUpload={setOriginalImage}
              onClearImage={clearSelectedImage}
              onProcessed={setProcessedImage}
              onOpenProject={openProject}
            />
          }
        />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route
          path="/editor"
          element={
            <Editor
              imageUrl={imageState.processedUrl || imageState.originalUrl}
              projectToLoad={projectToLoad}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </EditorProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ImageEditorRoutes />
    </BrowserRouter>
  );
}
