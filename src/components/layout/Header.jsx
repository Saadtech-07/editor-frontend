import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ImagePlus, Sparkles } from "lucide-react";

export default function Header({ onUpload }) {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      onUpload(file);
      setError("");
      navigate("/home");
    } catch (uploadError) {
      setError(uploadError.message);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <ImagePlus size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">PixelForge AI</span>
          </Link>

          <div className="flex items-center gap-3">
            {error ? <span className="hidden text-sm text-red-600 sm:inline">{error}</span> : null}
            <input
              ref={inputRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <ImagePlus size={16} />
              Upload
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
