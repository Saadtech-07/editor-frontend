import { Link } from "react-router-dom";
import { ImagePlus } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-85">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white">
            <ImagePlus size={19} />
          </span>
          <span className="text-xl font-bold text-slate-950">PixelForge AI</span>
        </Link>
      </div>
    </header>
  );
}
