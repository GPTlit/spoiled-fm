import { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  Crop,
  Sparkles,
  Sliders,
  Type,
  PenTool,
  Eraser,
  Download,
  Trash2,
  Plus,
  X,
  Check,
  Image as ImageIcon,
  Share2,
  RefreshCw,
  Sun,
  Eye,
  Smile,
  Layers,
  Square,
  Circle,
  Heart,
  Star,
  Maximize2,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { savePhoto, getAllPhotos, deletePhoto, type PhotoRecord } from "@/lib/photo-db";
import samplePortrait from "@/assets/images/editor_portrait_1791209251448.jpg";

type EditorTab = "crop" | "retouch" | "filters" | "creative" | "erase";
type CropRatio = "free" | "1:1" | "4:5" | "16:9" | "circle";
type CameraFilter = "normal" | "vivid" | "bw" | "cyber" | "vintage" | "warm" | "cool";

export function CameraPhotoEditor({ onClose }: { onClose?: () => void }) {
  // Main View: "gallery" | "camera" | "editor"
  const [view, setView] = useState<"gallery" | "camera" | "editor">("gallery");

  // Gallery State
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("environment");
  const [cameraFilter, setCameraFilter] = useState<CameraFilter>("normal");
  const [flashActive, setFlashActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Editor State
  const [activeTab, setActiveTab] = useState<EditorTab>("filters");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  // Crop & Transform State
  const [cropRatio, setCropRatio] = useState<CropRatio>("free");
  const [rotationDeg, setRotationDeg] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [tiltShift, setTiltShift] = useState(0);

  // Retouch Tools
  const [faceSmoothing, setFaceSmoothing] = useState(0);
  const [skinWarmth, setSkinWarmth] = useState(0);
  const [eyeBrightening, setEyeBrightening] = useState(0);
  const [teethWhitening, setTeethWhitening] = useState(0);

  // Filter Presets
  const [selectedFilter, setSelectedFilter] = useState<string>("Normal");

  // Creative Tools (Text, Brush, Stickers, Borders)
  const [overlayText, setOverlayText] = useState("");
  const [textFont, setTextFont] = useState("sans-serif");
  const [textColor, setTextColor] = useState("#ffffff");
  const [activeSticker, setActiveSticker] = useState<string | null>(null);
  const [activeBorder, setActiveBorder] = useState<string | null>(null);
  const [brushMode, setBrushMode] = useState<"draw" | "erase" | null>(null);
  const [brushColor, setBrushColor] = useState("#38bdf8");
  const [brushSize, setBrushSize] = useState(12);

  const isDrawingRef = useRef(false);

  // Load photos from IndexedDB on mount
  const loadGallery = useCallback(async () => {
    const list = await getAllPhotos();
    setPhotos(list);
  }, []);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  // Start Camera
  const startCamera = async (facing: "user" | "environment" = cameraFacing) => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      console.warn("Camera access denied or unavailable", err);
      const msg = err instanceof Error ? err.message : "Camera access permission is required";
      setCameraError(msg);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  };

  useEffect(() => {
    if (view === "camera") {
      startCamera(cameraFacing);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [view, cameraFacing]);

  // Capture Photo from Camera Viewfinder
  const capturePhoto = async () => {
    if (!videoRef.current) return;
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Apply Live Filter to snapshot
    if (cameraFilter === "bw") ctx.filter = "grayscale(100%) contrast(120%)";
    if (cameraFilter === "vivid") ctx.filter = "saturate(160%) contrast(110%)";
    if (cameraFilter === "cyber") ctx.filter = "hue-rotate(180deg) saturate(140%)";
    if (cameraFilter === "vintage") ctx.filter = "sepia(60%) contrast(110%)";
    if (cameraFilter === "warm") ctx.filter = "sepia(30%) saturate(120%)";
    if (cameraFilter === "cool") ctx.filter = "hue-rotate(-20deg) saturate(110%)";

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (blob) {
          const record = await savePhoto(blob, {
            title: `Capture ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
            filter: cameraFilter,
            width: canvas.width,
            height: canvas.height,
          });
          await loadGallery();
          openEditorWithPhoto(record);
        }
      },
      "image/jpeg",
      0.95,
    );
  };

  // Import local photo from device
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const record = await savePhoto(file, {
      title: file.name.replace(/\.[^/.]+$/, ""),
    });
    await loadGallery();
    openEditorWithPhoto(record);
  };

  // Open editor with photo
  const openEditorWithPhoto = (photo: PhotoRecord) => {
    setSelectedPhoto(photo);
    setView("editor");
    resetEditorState();

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = photo.url || samplePortrait;
    img.onload = () => {
      originalImageRef.current = img;
      renderCanvas();
    };
  };

  const resetEditorState = () => {
    setRotationDeg(0);
    setFlipH(false);
    setFlipV(false);
    setTiltShift(0);
    setFaceSmoothing(0);
    setSkinWarmth(0);
    setEyeBrightening(0);
    setTeethWhitening(0);
    setSelectedFilter("Normal");
    setOverlayText("");
    setActiveSticker(null);
    setActiveBorder(null);
    setBrushMode(null);
  };

  // Render Canvas with all filters, transformations, retouches, and overlays
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const img = originalImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle Rotation dimensions
    const isRotated90 = rotationDeg % 180 !== 0;
    canvas.width = isRotated90 ? img.height : img.width;
    canvas.height = isRotated90 ? img.width : img.height;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Transforms
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // Compute Filter String
    const filters: string[] = [];
    if (selectedFilter === "B&W") filters.push("grayscale(100%) contrast(120%)");
    if (selectedFilter === "Vintage") filters.push("sepia(70%) contrast(110%) saturate(80%)");
    if (selectedFilter === "Cyber")
      filters.push("hue-rotate(180deg) saturate(180%) contrast(120%)");
    if (selectedFilter === "Sepia") filters.push("sepia(100%)");
    if (selectedFilter === "Posterize") filters.push("contrast(180%) saturate(140%)");
    if (selectedFilter === "Invert") filters.push("invert(100%)");
    if (selectedFilter === "Duo-tone") filters.push("sepia(50%) hue-rotate(240deg) saturate(200%)");
    if (selectedFilter === "Bloom") filters.push("brightness(115%) contrast(90%)");
    if (selectedFilter === "Halation") filters.push("contrast(110%) saturate(140%)");

    // Retouch adjustments
    if (faceSmoothing > 0) filters.push(`blur(${faceSmoothing * 0.04}px)`);
    if (skinWarmth !== 0) filters.push(`sepia(${Math.max(0, skinWarmth)}%)`);
    if (eyeBrightening > 0) filters.push(`brightness(${1 + eyeBrightening * 0.003})`);

    ctx.filter = filters.length > 0 ? filters.join(" ") : "none";

    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    // Border Overlays
    if (activeBorder === "polaroid") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 24;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
    } else if (activeBorder === "film") {
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 16;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
    } else if (activeBorder === "liquid") {
      ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    }

    // Text Overlays
    if (overlayText.trim()) {
      ctx.save();
      ctx.font = `bold 32px ${textFont}`;
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 8;
      ctx.fillText(overlayText, canvas.width / 2, canvas.height - 50);
      ctx.restore();
    }

    // Sticker Overlay
    if (activeSticker) {
      ctx.save();
      ctx.font = "48px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(activeSticker, canvas.width / 2, canvas.height / 3);
      ctx.restore();
    }
  };

  // Re-render when tools change
  useEffect(() => {
    if (view === "editor") {
      renderCanvas();
    }
  }, [
    rotationDeg,
    flipH,
    flipV,
    selectedFilter,
    faceSmoothing,
    skinWarmth,
    eyeBrightening,
    teethWhitening,
    overlayText,
    activeSticker,
    activeBorder,
    view,
  ]);

  // Brush / Touch Erase Handler
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!brushMode) return;
    isDrawingRef.current = true;
    drawOnCanvas(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !brushMode) return;
    drawOnCanvas(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const handleCanvasMouseUp = () => {
    isDrawingRef.current = false;
  };

  const drawOnCanvas = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    if (brushMode === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, brushSize, 0, Math.PI * 2);
      ctx.fill();
    } else if (brushMode === "draw") {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = brushColor;
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  // Save Edited Image back to Gallery
  const handleSaveEditedImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      async (blob) => {
        if (blob) {
          const record = await savePhoto(blob, {
            title: `Edited ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
            filter: selectedFilter,
            width: canvas.width,
            height: canvas.height,
          });
          await loadGallery();
          setSelectedPhoto(record);
          setView("gallery");
        }
      },
      "image/jpeg",
      0.95,
    );
  };

  // Download directly to Device
  const handleDownloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `SPOILED_Edit_${Date.now()}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  };

  // WhatsApp Sticker Export (512x512 transparent WebP standard)
  const handleExportWhatsAppSticker = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stickerCanvas = document.createElement("canvas");
    stickerCanvas.width = 512;
    stickerCanvas.height = 512;
    const sCtx = stickerCanvas.getContext("2d");
    if (sCtx) {
      sCtx.drawImage(canvas, 0, 0, 512, 512);
      const link = document.createElement("a");
      link.download = `SPOILED_Sticker_${Date.now()}.webp`;
      link.href = stickerCanvas.toDataURL("image/webp", 0.9);
      link.click();
    }
  };

  return (
    <div className="camera-photo-editor-suite flex flex-col w-full max-w-full overflow-hidden rounded-3xl border border-white/20 bg-slate-950 text-white shadow-2xl backdrop-blur-2xl">
      {/* Top Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-white/10 bg-black/40">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
            {view === "camera" ? <Camera className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              {view === "gallery"
                ? "IndexedDB Photo Gallery"
                : view === "camera"
                  ? "Live Camera Viewfinder"
                  : "Studio Image Editor"}
            </h2>
            <p className="text-[11px] text-slate-400">
              {view === "gallery"
                ? `${photos.length} photos in browser storage`
                : view === "camera"
                  ? "Real-time filters & high-res capture"
                  : selectedPhoto?.title || "Editing"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {view !== "gallery" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("gallery")}
              className="text-xs text-slate-300 hover:text-white"
            >
              Gallery
            </Button>
          )}

          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-300 hover:text-white"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* VIEW 1: Photo Gallery Grid */}
      {view === "gallery" && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => setView("camera")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 px-4 rounded-2xl text-xs gap-2"
            >
              <Camera className="h-4 w-4" /> Open In-App Camera
            </Button>

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 px-4 rounded-2xl text-xs border-white/20 gap-2"
            >
              <Plus className="h-4 w-4" /> Import Photo
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>

          {/* Sample Starter Portrait */}
          <div className="rounded-2xl p-3 bg-white/5 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={samplePortrait}
                alt="Editorial Portrait Starter"
                className="w-12 h-14 object-cover rounded-xl border border-white/20"
              />
              <div>
                <strong className="text-xs text-white block">Studio Sample Model</strong>
                <span className="text-[11px] text-slate-400">
                  High-fashion 3:4 portrait starter
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                openEditorWithPhoto({
                  id: "sample-starter",
                  blob: new Blob(),
                  url: samplePortrait,
                  title: "Editorial Fashion Model",
                  date: Date.now(),
                })
              }
              className="text-xs h-8"
            >
              Edit Sample
            </Button>
          </div>

          {/* Gallery Grid */}
          <div className="grid grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto no-scrollbar pt-1">
            {photos.map((item) => (
              <div
                key={item.id}
                onClick={() => openEditorWithPhoto(item)}
                className="group relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black/40 cursor-pointer shadow-md"
              >
                <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePhoto(item.id).then(loadGallery);
                    }}
                    className="p-1.5 rounded-full bg-red-600/80 text-white hover:bg-red-600"
                    title="Delete photo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {photos.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              <p>No captured photos yet in IndexedDB.</p>
              <p className="mt-1">Tap "Open In-App Camera" or "Import Photo" to start editing.</p>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Real-time In-App Camera */}
      {view === "camera" && (
        <div className="relative flex flex-col items-center bg-black p-4">
          {cameraError ? (
            <div className="p-8 text-center space-y-3">
              <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
              <p className="text-xs text-slate-300">{cameraError}</p>
              <Button
                size="sm"
                onClick={() => startCamera(cameraFacing)}
                className="text-xs bg-emerald-600"
              >
                Retry Camera Access
              </Button>
            </div>
          ) : (
            <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden bg-black border border-white/20 shadow-2xl flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`w-full h-full object-cover ${
                  cameraFilter === "bw"
                    ? "grayscale contrast-125"
                    : cameraFilter === "vivid"
                      ? "saturate-150 contrast-110"
                      : cameraFilter === "cyber"
                        ? "hue-rotate-180 saturate-150"
                        : cameraFilter === "vintage"
                          ? "sepia-[.6] contrast-110"
                          : cameraFilter === "warm"
                            ? "sepia-[.3] saturate-125"
                            : cameraFilter === "cool"
                              ? "hue-rotate-[-20deg]"
                              : ""
                }`}
              />

              {/* Shutter Flash Animation */}
              {flashActive && <div className="absolute inset-0 bg-white animate-fade-out" />}

              {/* Live Camera Filter Chips */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar">
                {(["normal", "vivid", "bw", "cyber", "vintage", "warm", "cool"] as const).map(
                  (f) => (
                    <button
                      key={f}
                      onClick={() => setCameraFilter(f)}
                      className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider backdrop-blur-md transition-all ${
                        cameraFilter === f
                          ? "bg-emerald-500 text-black shadow-md"
                          : "bg-black/50 text-white/80 hover:bg-black/70"
                      }`}
                    >
                      {f}
                    </button>
                  ),
                )}
              </div>

              {/* Bottom Camera Trigger Controls */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <button
                  onClick={() => setCameraFacing((f) => (f === "user" ? "environment" : "user"))}
                  className="h-10 w-10 rounded-full bg-black/60 text-white backdrop-blur-md flex items-center justify-center hover:bg-black/80"
                  title="Flip front/rear camera"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>

                <button
                  onClick={capturePhoto}
                  className="h-16 w-16 rounded-full border-4 border-white bg-red-600 active:scale-95 transition-transform flex items-center justify-center shadow-xl shadow-red-500/40"
                  title="Capture Photo"
                >
                  <div className="h-12 w-12 rounded-full bg-white" />
                </button>

                <div className="w-10" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: Comprehensive Image Editor */}
      {view === "editor" && (
        <div className="flex flex-col space-y-3 p-3">
          {/* Main Editing Canvas */}
          <div className="relative w-full max-h-[320px] aspect-[4/3] bg-black/80 rounded-2xl overflow-hidden flex items-center justify-center border border-white/10 shadow-inner">
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              className="max-h-[300px] max-w-full object-contain cursor-crosshair"
            />
          </div>

          {/* Editor Action Buttons (Save, Download, WhatsApp Sticker) */}
          <div className="flex items-center justify-between gap-1.5 pt-1">
            <Button
              size="sm"
              onClick={handleSaveEditedImage}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9 rounded-xl flex-1 font-bold gap-1"
            >
              <Check className="h-3.5 w-3.5" /> Save to Gallery
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadImage}
              className="text-xs h-9 rounded-xl border-white/20 gap-1"
            >
              <Download className="h-3.5 w-3.5" /> JPG
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportWhatsAppSticker}
              className="text-xs h-9 rounded-xl border-emerald-500/40 text-emerald-400 gap-1"
              title="Export 512x512 transparent WebP for WhatsApp"
            >
              <Sparkles className="h-3.5 w-3.5" /> Sticker
            </Button>
          </div>

          {/* Sub-tools Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-t border-white/10 pt-2">
            {(
              [
                { key: "filters", label: "Filters & Looks", icon: Sparkles },
                { key: "crop", label: "Crop & Rotate", icon: Crop },
                { key: "retouch", label: "Retouch & Face", icon: Smile },
                { key: "creative", label: "Text & Stickers", icon: Type },
                { key: "erase", label: "Cutout / Erase", icon: Eraser },
              ] as { key: EditorTab; label: string; icon: typeof Sparkles }[]
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === key
                    ? "bg-white text-black"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: Filters */}
          {activeTab === "filters" && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              {[
                "Normal",
                "B&W",
                "Vintage",
                "Cyber",
                "Sepia",
                "Posterize",
                "Invert",
                "Duo-tone",
                "Bloom",
                "Halation",
              ].map((filterName) => (
                <button
                  key={filterName}
                  onClick={() => setSelectedFilter(filterName)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                    selectedFilter === filterName
                      ? "bg-emerald-500 text-black font-bold"
                      : "bg-white/10 text-slate-300 hover:bg-white/15"
                  }`}
                >
                  {filterName}
                </button>
              ))}
            </div>
          )}

          {/* TAB 2: Crop & Transform */}
          {activeTab === "crop" && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Aspect Ratio:</span>
                <div className="flex items-center gap-1">
                  {(["free", "1:1", "4:5", "16:9", "circle"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setCropRatio(r)}
                      className={`px-2 py-0.5 rounded capitalize ${
                        cropRatio === r ? "bg-white text-black font-bold" : "bg-white/10"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Transforms:</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRotationDeg((d) => (d + 90) % 360)}
                    className="h-8 text-xs border-white/20 gap-1"
                  >
                    <RotateCw className="h-3 w-3" /> 90°
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFlipH((h) => !h)}
                    className="h-8 text-xs border-white/20 gap-1"
                  >
                    <FlipHorizontal className="h-3 w-3" /> Flip H
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFlipV((v) => !v)}
                    className="h-8 text-xs border-white/20 gap-1"
                  >
                    <FlipVertical className="h-3 w-3" /> Flip V
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Retouch Tools */}
          {activeTab === "retouch" && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <span>Face Smoothing</span>
                  <span className="font-mono text-emerald-400">{faceSmoothing}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={faceSmoothing}
                  onChange={(e) => setFaceSmoothing(parseInt(e.target.value))}
                  className="w-full accent-emerald-400 h-1 rounded-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <span>Skin Tone Warmth</span>
                  <span className="font-mono text-amber-400">{skinWarmth}%</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={skinWarmth}
                  onChange={(e) => setSkinWarmth(parseInt(e.target.value))}
                  className="w-full accent-amber-400 h-1 rounded-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <span>Eye Brightening</span>
                  <span className="font-mono text-cyan-400">{eyeBrightening}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={eyeBrightening}
                  onChange={(e) => setEyeBrightening(parseInt(e.target.value))}
                  className="w-full accent-cyan-400 h-1 rounded-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <span>Teeth Whitening</span>
                  <span className="font-mono text-white">{teethWhitening}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={teethWhitening}
                  onChange={(e) => setTeethWhitening(parseInt(e.target.value))}
                  className="w-full accent-white h-1 rounded-full cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 4: Creative Tools (Text, Stickers, Borders) */}
          {activeTab === "creative" && (
            <div className="space-y-3 text-xs">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Overlay text label…"
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  className="flex-1 h-8 px-2.5 rounded-lg bg-white/10 border border-white/20 text-xs focus:outline-none"
                />
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-white/20"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Stickers:</span>
                <div className="flex items-center gap-2 text-lg">
                  {["🎵", "✨", "🔥", "🎧", "💎", "⭐", "❤️"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setActiveSticker(activeSticker === s ? null : s)}
                      className={`p-1 rounded-lg ${
                        activeSticker === s ? "bg-white/20 scale-125" : ""
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Borders:</span>
                <div className="flex items-center gap-1.5">
                  {[
                    { key: null, label: "None" },
                    { key: "polaroid", label: "Polaroid" },
                    { key: "film", label: "Film 35mm" },
                    { key: "liquid", label: "Liquid Blue" },
                  ].map(({ key, label }) => (
                    <button
                      key={label}
                      onClick={() => setActiveBorder(key)}
                      className={`px-2 py-0.5 rounded text-[11px] ${
                        activeBorder === key ? "bg-white text-black font-bold" : "bg-white/10"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Cutout / Erase Tool */}
          {activeTab === "erase" && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold">Touch & Swipe Cutout Brush</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBrushMode(brushMode === "erase" ? null : "erase")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      brushMode === "erase" ? "bg-red-500 text-white" : "bg-white/10"
                    }`}
                  >
                    Eraser Brush
                  </button>
                  <button
                    onClick={() => setBrushMode(brushMode === "draw" ? null : "draw")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      brushMode === "draw" ? "bg-cyan-500 text-black" : "bg-white/10"
                    }`}
                  >
                    Color Paint
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Brush Radius:</span>
                <input
                  type="range"
                  min="4"
                  max="40"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-32 accent-white h-1 rounded-full cursor-pointer"
                />
                <span className="font-mono text-slate-400">{brushSize}px</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
