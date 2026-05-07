const EDITOR_STORAGE_KEY = "pixelforge:last-editor-session";

export function loadStoredEditorSession(sourceImageUrl) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(EDITOR_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);

    if (!parsedValue?.canvas) {
      return null;
    }

    if (
      sourceImageUrl &&
      parsedValue.sourceImageUrl &&
      parsedValue.sourceImageUrl !== sourceImageUrl
    ) {
      return null;
    }

    return parsedValue;
  } catch (error) {
    console.error("Unable to read saved editor session:", error);
    return null;
  }
}

export function saveStoredEditorSession(session) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      EDITOR_STORAGE_KEY,
      JSON.stringify({
        ...session,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Unable to save editor session:", error);
  }
}

export function clearStoredEditorSession() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(EDITOR_STORAGE_KEY);
  } catch (error) {
    console.error("Unable to clear saved editor session:", error);
  }
}
