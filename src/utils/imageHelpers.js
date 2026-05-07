// ✅ KEEP THIS FIRST
export function ensureImageFile(source, fallbackName = "upload.png") {
  if (source instanceof File) {
    return source;
  }

  if (source instanceof Blob) {
    return new File([source], fallbackName, {
      type: source.type || "image/png",
    });
  }

  throw new Error("Expected an image File or Blob before uploading.");
}


// ✅ THEN THIS
export async function removeBackground(originalFile) {
  const imageFile = ensureImageFile(originalFile);

  const formData = new FormData();
  formData.append("image_file", imageFile, imageFile.name || "upload.png");
  formData.append("size", "auto");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: {
      "X-Api-Key": import.meta.env.VITE_REMOVE_BG_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    let message = "Background removal failed.";

    try {
      const errorText = await response.text();
      message = errorText || message;
    } catch {
      message = `Background removal failed with status ${response.status}`;
    }

    throw new Error(message);
  }

  return response.blob();
}