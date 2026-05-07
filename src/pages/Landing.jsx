import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Upload,
  ImagePlus,
  WandSparkles,
  Scissors,
  Palette,
  Brush,
  Layers,
  Server,
  Bot,
  CheckCircle,
  Zap,
  Shield,
  Mail,
  Phone,
  MapPin,
  Github,
  Twitter,
  Linkedin,
  Instagram,
  ChevronRight,
} from "lucide-react";
import heroImage from "../assets/hero.png";
const features = [
  {
    icon: Upload,
    title: "Upload Image",
    text: "Simply upload your image and let our AI handle the rest",
  },
  {
    icon: WandSparkles,
    title: "Remove Background",
    text: "AI-powered background removal with transparent PNG output",
  },
  {
    icon: Palette,
    title: "Edit in Canvas",
    text: "Professional Canva-like editor with layers and tools",
  },
];

const stack = [
  { icon: Brush, label: "React", color: "text-blue-500" },
  { icon: Layers, label: "Fabric.js", color: "text-purple-500" },
  { icon: Server, label: "Node.js", color: "text-green-500" },
  { icon: Bot, label: "remove.bg API", color: "text-orange-500" },
];

export default function Landing({ onUpload }) {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const handleFile = (file) => {
    try {
      onUpload(file);
      setError("");
      navigate("/home");
    } catch (uploadError) {
      setError(uploadError.message);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-blue-50">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="#top" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <ImagePlus size={18} className="text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">PixelForge AI</span>
            </a>

            {/* Links */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <a href="#stack" className="text-gray-600 hover:text-gray-900 transition-colors">Stack</a>
              <a href="#about" className="text-gray-600 hover:text-gray-900 transition-colors">About</a>
            </div>

            {/* Upload Button */}
            <button
              onClick={() => inputRef.current?.click()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Upload size={16} />
              Upload
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="top" className="relative min-h-screen flex items-center overflow-hidden">
      
        {/* Background Decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse animation-delay-4000"></div>
        </div>

        <div className="relative w-full px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                <Zap size={16} />
                AI-Powered Design Tools
              </div>

              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Create Stunning Designs with AI
              </h1>

              <p className="text-xl text-gray-600 leading-relaxed">
                Remove backgrounds, edit images, and design like Canva with our professional AI-powered editor
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => inputRef.current?.click()}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <ImagePlus size={20} />
                  Upload Image
                  <ArrowRight size={18} />
                </button>
                <button
                  onClick={() => alert("Video creation is coming soon!")}
                  className="border border-gray-300 hover:border-gray-400 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  Create Video
                </button>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Trust Indicators */}
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>No signup required</span>
                </div>
                <div className="flex items-center gap-1">
                  <Shield size={16} className="text-blue-500" />
                  <span>Secure processing</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap size={16} className="text-purple-500" />
                  <span>Instant results</span>
                </div>
              </div>
            </div>

            {/* Right Content - Hero Image */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
                <img 
                  src={heroImage} 
                  alt="PixelForge AI Editor" 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gradient-to-br from-white via-gray-50 to-blue-50 relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 right-10 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        </div>
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 max-w-7xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Create
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Simple three-step process to transform your images
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Icon size={24} className="text-white" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <h3 className="text-xl font-semibold text-gray-900">{feature.title}</h3>
                      <span className="bg-blue-100 text-blue-600 text-xs font-medium px-2 py-1 rounded-full">
                        Step {index + 1}
                      </span>
                    </div>
                    <p className="text-gray-600">{feature.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section id="stack" className="py-20 bg-gradient-to-br from-white via-gray-50 to-blue-50 relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-3000"></div>
        </div>
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 max-w-7xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Built with Modern Technology
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Production-ready stack for reliable performance
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stack.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                  <Icon className={`${item.color} mb-4`} size={32} />
                  <p className="font-semibold text-gray-900">{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 right-10 w-72 h-72 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
          <div className="absolute bottom-10 left-10 w-72 h-72 bg-purple-100 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse animation-delay-2000"></div>
        </div>
        
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 max-w-4xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Get started in minutes with our simple 3-step process
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto">
                <Upload size={24} className="text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-gray-900">Upload</h3>
                <p className="text-gray-600">Upload your image in any format</p>
              </div>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto">
                <WandSparkles size={24} className="text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-gray-900">Process</h3>
                <p className="text-gray-600">AI removes background instantly</p>
              </div>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto">
                <Palette size={24} className="text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-gray-900">Design</h3>
                <p className="text-gray-600">Edit in our professional canvas</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-br from-white via-gray-50 to-blue-50 relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-3000"></div>
        </div>
        
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 max-w-4xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Why Choose PixelForge AI
            </h2>
            <p className="text-xl text-gray-600">
              Professional tools with AI-powered simplicity
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center mb-4">
                <Zap size={20} className="text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Lightning Fast</h3>
              <p className="text-gray-600">Process images in seconds with our optimized AI algorithms</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <Shield size={20} className="text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure & Private</h3>
              <p className="text-gray-600">Your images are processed securely and never stored</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center mb-4">
                <CheckCircle size={20} className="text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Professional Quality</h3>
              <p className="text-gray-600">Get studio-quality results every time</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center mb-4">
                <Layers size={20} className="text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Advanced Editing</h3>
              <p className="text-gray-600">Professional tools like layers, masks, and effects</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-green-600 rounded-lg flex items-center justify-center mb-4">
                <Bot size={20} className="text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered</h3>
              <p className="text-gray-600">Smart automation for complex editing tasks</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                <ImagePlus size={20} className="text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Formats</h3>
              <p className="text-gray-600">Support for JPG, PNG, WebP, and more</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-10 w-72 h-72 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-100 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse animation-delay-2000"></div>
        </div>
        
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Ready to Transform Your Images?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Join thousands of creators using PixelForge AI for professional image editing
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => inputRef.current?.click()}
                className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-medium transition-all transform hover:scale-105 flex items-center justify-center gap-2"
              >
                <ImagePlus size={20} />
                Start Editing Now
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => navigate("/home")}
                className="border border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-3 rounded-lg font-medium transition-colors"
              >
                Learn More
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mt-4">
                {error}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="about" className="bg-gray-900 text-white">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="w-full">
            {/* Main Footer Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {/* Company Info - Wider Column */}
              <div className="space-y-3 lg:col-span-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <ImagePlus size={18} className="text-white" />
                  </div>
                  <span className="text-xl font-bold">PixelForge AI</span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed max-w-md">
                  Professional AI-powered image editing platform. Remove backgrounds, edit images, and create stunning designs with our Canva-like editor.
                </p>
                <div className="flex space-x-4">
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    <Twitter size={20} />
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    <Github size={20} />
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    <Linkedin size={20} />
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    <Instagram size={20} />
                  </a>
                </div>
                <div className="pt-2">
                  <div className="bg-gray-800 rounded-lg p-3">
                    <h4 className="font-semibold mb-2 text-sm">Subscribe to our newsletter</h4>
                    <p className="text-gray-400 text-sm mb-3">Get updates on new features and releases</p>
                    <div className="flex gap-2">
                      <input 
                        type="email" 
                        placeholder="Enter your email" 
                        className="flex-1 bg-gray-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
                        Subscribe
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Links */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Product</h3>
                <ul className="space-y-2">
                  <li>
                    <a href="#features" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      <ChevronRight size={16} />
                      Features
                    </a>
                  </li>
                  <li>
                    <a href="#stack" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      <ChevronRight size={16} />
                      Technology
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      <ChevronRight size={16} />
                      Pricing
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      <ChevronRight size={16} />
                      API Documentation
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      <ChevronRight size={16} />
                      Integrations
                    </a>
                  </li>
                </ul>
              </div>

              {/* Company Links */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Company</h3>
                <ul className="space-y-2">
                  <li>
                    <a href="#about" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      <ChevronRight size={16} />
                      About Us
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      <ChevronRight size={16} />
                      Blog
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      <ChevronRight size={16} />
                      Careers
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      <ChevronRight size={16} />
                      Press
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      <ChevronRight size={16} />
                      Partners
                    </a>
                  </li>
                </ul>
              </div>

              {/* Support & Contact */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Support</h3>
                <ul className="space-y-2">
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      <ChevronRight size={16} />
                      Help Center
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      <ChevronRight size={16} />
                      Documentation
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      <ChevronRight size={16} />
                      Community
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      <ChevronRight size={16} />
                      Status
                    </a>
                  </li>
                </ul>
                <div className="pt-2 space-y-2">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Mail size={16} />
                    <span className="text-sm">daas&co@gmail.com</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Phone size={16} />
                    <span className="text-sm">+91 9876543210</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <MapPin size={16} />
                    <span className="text-sm">Chennai, India</span>
                  </div>
                </div>
                <div className="pt-2">
                  <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors w-full text-sm">
                    Get Started
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
