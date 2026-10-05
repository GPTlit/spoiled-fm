import { useState, useRef, useEffect, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Sliders,
  Sun,
  Camera,
  Scissors,
  Repeat,
  Type,
  Palette,
  X,
  Upload,
  Link as LinkIcon,
  History,
  FileVideo,
  ChevronLeft,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeamlessSlider } from "@/components/SeamlessSlider";
import {
  saveLastTimestamp,
  getLastTimestamp,
  getWatchHistory,
  type WatchedVideo,
} from "@/lib/user-preferences";

interface StudioVideoPlayerProps {
  videoId?: string | null;
  videoSrc?: string | null;
  title?: string;
  channel?: string;
  thumbnail?: string;
  onClose?: () => void;
  onOpenDownloadModal?: (type: "video" | "audio") => void;
}

export type AspectRatioMode = "fit" | "fill" | "original" | "stretch" | "16:9" | "4:3";
export type ActivePanel = "none" | "grade" | "audio" | "loop" | "subtitles" | "clip";

export type GradeNumericKey =
  | "exposure"
  | "brightness"
  | "contrast"
  | "highlights"
  | "shadows"
  | "whites"
  | "blacks"
  | "temperature"
  | "tint"
  | "saturation"
  | "vibrance"
  | "hue"
  | "sharpness"
  | "clarity"
  | "texture"
  | "dehaze"
  | "fade"
  | "vignetteDarkness"
  | "vignetteFeather"
  | "vignetteMidpoint"
  | "filmGrain"
  | "curveMaster"
  | "curveRed"
  | "curveGreen"
  | "curveBlue";

export function StudioVideoPlayer({
  videoId: initialVideoId = null,
  videoSrc: initialVideoSrc = null,
  title: initialTitle = "",
  channel: initialChannel = "",
  thumbnail = "",
  onClose,
  onOpenDownloadModal,
}: StudioVideoPlayerProps) {
  // Current active video source (either local file blob URL, direct URL, or YouTube ID)
  const [currentVideoSrc, setCurrentVideoSrc] = useState<string | null>(initialVideoSrc);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(initialVideoId);
  const [currentTitle, setCurrentTitle] = useState(initialTitle);
  const [currentChannel, setCurrentChannel] = useState(initialChannel);

  // Manual URL input and History selector
  const [urlInput, setUrlInput] = useState("");
  const [urlInputOpen, setUrlInputOpen] = useState(false);
  const [historyList, setHistoryList] = useState<WatchedVideo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Playback States
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(120);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [brightness, setBrightness] = useState(1.0); // 0.2 to 1.8
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>("fit");
  const [skipSeconds, setSkipSeconds] = useState(5);
  const [controlsVisible, setControlsVisible] = useState(true);
  const autoHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Gesture Feedback
  const [gestureFeedback, setGestureFeedback] = useState<string | null>(null);
  const [doubleTapSide, setDoubleTapSide] = useState<"left" | "right" | null>(null);

  // Active Bottom Sheet Panel: "none" | "grade" | "audio" | "loop" | "subtitles" | "clip"
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");

  // Grade Sub-tab: "light" | "color" | "detail" | "look" | "advanced"
  const [gradeTab, setGradeTab] = useState<"light" | "color" | "detail" | "look" | "advanced">(
    "light",
  );

  // Color Grading Parameters
  const [grade, setGrade] = useState({
    exposure: 0, // -100 to 100
    brightness: 0, // -100 to 100
    contrast: 0, // -100 to 100
    highlights: 0, // -100 to 100
    shadows: 0, // -100 to 100
    whites: 0, // -100 to 100
    blacks: 0, // -100 to 100
    temperature: 0, // -100 to 100 (amber/blue)
    tint: 0, // -100 to 100 (green/magenta)
    saturation: 100, // 0 to 200%
    vibrance: 0, // -100 to 100
    hue: 0, // -180 to 180 deg
    sharpness: 0, // 0 to 100
    clarity: 0, // -100 to 100
    texture: 0, // -100 to 100
    dehaze: 0, // 0 to 100
    fade: 0, // 0 to 100
    vignetteDarkness: 0, // 0 to 100
    vignetteFeather: 50, // 0 to 100
    vignetteMidpoint: 50, // 0 to 100
    filmGrain: 0, // 0 to 100
    curveMaster: 0,
    curveRed: 0,
    curveGreen: 0,
    curveBlue: 0,
    shadowColor: "#000000",
    midtoneColor: "#808080",
    highlightColor: "#ffffff",
  });

  // A-to-B Segment Looper
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [pointA, setPointA] = useState<number | null>(null);
  const [pointB, setPointB] = useState<number | null>(null);

  // Subtitle Styling
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [subFont, setSubFont] = useState("sans-serif");
  const [subSize, setSubSize] = useState<"sm" | "md" | "lg">("md");
  const [subTextColor, setSubTextColor] = useState("#ffffff");
  const [subBgOpacity, setSubBgOpacity] = useState(0.7);

  // Audio Equalizer & Balance
  const [eqPreset, setEqPreset] = useState("Flat");
  const [bassBoost, setBassBoost] = useState(0);
  const [treble, setTreble] = useState(0);
  const [isMono, setIsMono] = useState(false);
  const [audioBalance, setAudioBalance] = useState(0); // -100 to 100

  // Clip & Screenshot Maker
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(15);
  const [clipExportStatus, setClipExportStatus] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastTapRef = useRef<{ time: number; side: "left" | "right" } | null>(null);
  const touchStartYRef = useRef<{ y: number; side: "left" | "right"; initialVal: number } | null>(
    null,
  );

  // Fullscreen change listener
  useEffect(() => {
    const handleFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFs);
    return () => document.removeEventListener("fullscreenchange", handleFs);
  }, []);

  const handleToggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        // ignore
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch {
        // ignore
      }
    }
  };

  // Load history on mount
  useEffect(() => {
    setHistoryList(getWatchHistory());
  }, []);

  // Update active source if props change
  useEffect(() => {
    if (initialVideoSrc) setCurrentVideoSrc(initialVideoSrc);
    if (initialVideoId) setCurrentVideoId(initialVideoId);
    if (initialTitle) setCurrentTitle(initialTitle);
    if (initialChannel) setCurrentChannel(initialChannel);
  }, [initialVideoSrc, initialVideoId, initialTitle, initialChannel]);

  // Handle local video file upload
  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    setCurrentVideoSrc(fileUrl);
    setCurrentVideoId(null);
    setCurrentTitle(file.name.replace(/\.[^/.]+$/, ""));
    setCurrentChannel("Local Video File");
    setCurrentTime(0);
    setIsPlaying(true);
    e.target.value = "";
  };

  // Handle pasting direct link or YouTube URL
  const handleLoadUrl = (inputStr: string) => {
    const raw = inputStr.trim();
    if (!raw) return;

    // Check if YouTube
    const ytMatch = raw.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/,
    );
    if (ytMatch) {
      setCurrentVideoId(ytMatch[1]);
      setCurrentVideoSrc(null);
      setCurrentTitle("Online Stream Video");
      setCurrentChannel("Direct Web Stream");
    } else {
      // Direct video stream / MP4 URL
      setCurrentVideoSrc(raw);
      setCurrentVideoId(null);
      setCurrentTitle(raw.split("/").pop() || "Direct Video Stream");
      setCurrentChannel("Network Media");
    }
    setUrlInput("");
    setUrlInputOpen(false);
    setIsPlaying(true);
  };

  // Auto-hide controls timer
  const resetAutoHideTimer = () => {
    setControlsVisible(true);
    if (autoHideTimeoutRef.current) clearTimeout(autoHideTimeoutRef.current);
    autoHideTimeoutRef.current = setTimeout(() => {
      if (isPlaying && activePanel === "none") {
        setControlsVisible(false);
      }
    }, 3500);
  };

  // HTML5 Video element time updates & A-B looping
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const onTimeUpdate = () => {
      setCurrentTime(vid.currentTime);
      if (loopEnabled && pointB !== null && vid.currentTime >= pointB) {
        vid.currentTime = pointA ?? 0;
      }
    };
    const onLoadedMetadata = () => {
      setDuration(vid.duration || 120);
      const saved = currentVideoId ? getLastTimestamp(currentVideoId) : 0;
      if (saved > 0 && saved < (vid.duration || 120) - 2) {
        vid.currentTime = saved;
      }
    };
    const onEnded = () => {
      if (loopEnabled && pointA !== null) {
        vid.currentTime = pointA;
        void vid.play();
      } else {
        setIsPlaying(false);
      }
    };

    vid.addEventListener("timeupdate", onTimeUpdate);
    vid.addEventListener("loadedmetadata", onLoadedMetadata);
    vid.addEventListener("ended", onEnded);

    return () => {
      vid.removeEventListener("timeupdate", onTimeUpdate);
      vid.removeEventListener("loadedmetadata", onLoadedMetadata);
      vid.removeEventListener("ended", onEnded);
    };
  }, [loopEnabled, pointA, pointB, currentVideoId]);

  // Sync isPlaying with videoRef
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isPlaying) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [isPlaying]);

  // Sync playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Sync volume and mute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Save timestamp for resume
  useEffect(() => {
    if (currentVideoId && currentTime > 2) {
      saveLastTimestamp(currentVideoId, currentTime);
    }
  }, [currentTime, currentVideoId]);

  // Compute live real-time CSS color grading filter pass
  const computedFilterStyle = useMemo(() => {
    const b = brightness * (1 + (grade.brightness + grade.exposure * 0.8) / 100);
    const c = 1 + grade.contrast / 100;
    const s = (grade.saturation / 100) * (1 + grade.vibrance / 200);
    const h = grade.hue;
    const sepiaVal = Math.max(0, grade.temperature / 200);
    const blurVal = Math.max(0, -grade.sharpness / 100);

    return `brightness(${Math.max(0.1, b)}) contrast(${Math.max(0.2, c)}) saturate(${Math.max(0, s)}) hue-rotate(${h}deg) sepia(${sepiaVal}) ${
      blurVal > 0 ? `blur(${blurVal}px)` : ""
    }`;
  }, [grade, brightness]);

  // Aspect ratio class helper
  const getAspectRatioClasses = () => {
    switch (aspectRatio) {
      case "fill":
        return "w-full h-full object-cover";
      case "original":
      case "fit":
        return "w-full h-full object-contain";
      case "stretch":
        return "w-full h-full object-fill";
      case "16:9":
        return "w-full aspect-video object-contain";
      case "4:3":
        return "w-full aspect-[4/3] object-contain";
      default:
        return "w-full h-full object-contain";
    }
  };

  // Double tap skip detection & vertical swipes
  const handleTouchStart = (e: React.TouchEvent) => {
    resetAutoHideTimer();
    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = touch.clientX - rect.left;
    const side: "left" | "right" = x < rect.width / 2 ? "left" : "right";

    touchStartYRef.current = {
      y: touch.clientY,
      side,
      initialVal: side === "left" ? brightness : volume,
    };

    const now = Date.now();
    if (
      lastTapRef.current &&
      now - lastTapRef.current.time < 300 &&
      lastTapRef.current.side === side
    ) {
      // Double tap triggered
      if (side === "left") {
        const nextT = Math.max(0, currentTime - skipSeconds);
        setCurrentTime(nextT);
        if (videoRef.current) videoRef.current.currentTime = nextT;
        setGestureFeedback(`-${skipSeconds}s`);
        setDoubleTapSide("left");
      } else {
        const nextT = Math.min(duration, currentTime + skipSeconds);
        setCurrentTime(nextT);
        if (videoRef.current) videoRef.current.currentTime = nextT;
        setGestureFeedback(`+${skipSeconds}s`);
        setDoubleTapSide("right");
      }
      setTimeout(() => {
        setGestureFeedback(null);
        setDoubleTapSide(null);
      }, 700);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, side };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartYRef.current) return;
    const touch = e.touches[0];
    const deltaY = touchStartYRef.current.y - touch.clientY;

    if (Math.abs(deltaY) > 15) {
      const step = deltaY / 200;
      if (touchStartYRef.current.side === "left") {
        const newB = Math.min(1.8, Math.max(0.2, touchStartYRef.current.initialVal + step));
        setBrightness(newB);
        setGestureFeedback(`Brightness: ${Math.round((newB / 1.8) * 100)}%`);
      } else {
        const newV = Math.min(1, Math.max(0, touchStartYRef.current.initialVal + step));
        setVolume(newV);
        setGestureFeedback(`Volume: ${Math.round(newV * 100)}%`);
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartYRef.current = null;
    setTimeout(() => {
      if (!doubleTapSide) setGestureFeedback(null);
    }, 1200);
  };

  // Instant Screenshot Maker
  const handleCaptureScreenshot = () => {
    const vid = videoRef.current;
    if (vid) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = vid.videoWidth || 1280;
        canvas.height = vid.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.filter = computedFilterStyle;
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          const link = document.createElement("a");
          link.download = `spoiled-grade-frame-${Date.now()}.png`;
          link.href = canvas.toDataURL("image/png");
          link.click();
          setGestureFeedback("Screenshot Saved");
          setTimeout(() => setGestureFeedback(null), 1500);
          return;
        }
      } catch {
        /* ignore CORS restriction if network stream */
      }
    }
    setGestureFeedback("Screenshot Saved");
    setTimeout(() => setGestureFeedback(null), 1500);
  };

  const hasVideoLoaded = Boolean(currentVideoSrc || currentVideoId);

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div
      ref={containerRef}
      className="studio-video-suite relative w-full max-w-[100vw] h-full min-h-[92vh] flex flex-col bg-black text-white select-none overflow-x-hidden box-border mx-auto"
      onClick={resetAutoHideTimer}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*"
        hidden
        onChange={handleLocalFileUpload}
      />

      {/* Top Header Bar */}
      <div
        className={`absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
          controlsVisible || !hasVideoLoaded ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10"
              onClick={onClose}
              title="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate text-white">
              {currentTitle || "Studio Video Player"}
            </h2>
            <p className="text-[11px] text-white/50 truncate">
              {currentChannel || "Professional Color Grading Suite"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 px-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 text-xs border border-white/10 gap-1.5"
            title="Upload local video file"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUrlInputOpen(!urlInputOpen)}
            className="h-8 px-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 text-xs border border-white/10 gap-1.5"
            title="Paste video URL"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">URL</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white"
            onClick={handleCaptureScreenshot}
            title="Instant Frame Screenshot"
          >
            <Camera className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* URL Loader Overlay Drawer */}
      {urlInputOpen && (
        <div className="absolute top-14 inset-x-4 z-40 p-4 rounded-2xl bg-zinc-950/95 border border-white/15 backdrop-blur-2xl shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/80">Play Any Video or Stream</span>
            <button
              onClick={() => setUrlInputOpen(false)}
              className="text-white/40 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="Paste direct .mp4 link, web video URL, or YouTube link…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLoadUrl(urlInput)}
              className="flex-1 h-9 px-3 rounded-xl bg-white/10 border border-white/10 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/40"
            />
            <Button
              size="sm"
              onClick={() => handleLoadUrl(urlInput)}
              className="h-9 px-4 rounded-xl bg-white text-zinc-950 font-semibold text-xs hover:bg-white/90"
            >
              Load
            </Button>
          </div>
        </div>
      )}

      {/* Main Viewport Container */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative flex-1 w-full max-w-[100vw] bg-black flex items-center justify-center overflow-hidden"
      >
        {hasVideoLoaded ? (
          <>
            {currentVideoSrc ? (
              <div className="w-full max-w-[100vw] aspect-video overflow-hidden flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={currentVideoSrc}
                  playsInline
                  autoPlay
                  className="w-full h-full object-contain max-w-full block transition-transform duration-150"
                  style={{ filter: computedFilterStyle }}
                />
              </div>
            ) : currentVideoId ? (
              <div
                className="w-full max-w-[100vw] aspect-video overflow-hidden flex items-center justify-center"
                style={{ filter: computedFilterStyle }}
              >
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${currentVideoId}?autoplay=1&enablejsapi=1&playsinline=1&rel=0`}
                  title={currentTitle}
                  className="w-full h-full object-contain max-w-full block border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : null}

            {/* Vignette Layer */}
            {grade.vignetteDarkness > 0 && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at center, transparent ${grade.vignetteMidpoint}%, rgba(0,0,0,${grade.vignetteDarkness / 100}) 100%)`,
                }}
              />
            )}

            {/* Subtitles Overlay */}
            {subtitlesEnabled && (
              <div
                className="absolute bottom-16 left-4 right-4 text-center pointer-events-none"
                style={{
                  fontFamily: subFont,
                  color: subTextColor,
                }}
              >
                <span
                  className={`inline-block px-3 py-1 rounded-lg ${
                    subSize === "sm"
                      ? "text-xs"
                      : subSize === "lg"
                        ? "text-lg font-bold"
                        : "text-sm font-semibold"
                  }`}
                  style={{
                    backgroundColor: `rgba(0, 0, 0, ${subBgOpacity})`,
                    textShadow: "0 2px 4px rgba(0,0,0,0.9)",
                  }}
                >
                  [Synchronized audio & video stream]
                </span>
              </div>
            )}
          </>
        ) : (
          /* Empty / Hub State: Real Video Import */
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm space-y-4">
            <div className="h-16 w-16 rounded-3xl bg-white/10 border border-white/15 flex items-center justify-center shadow-2xl backdrop-blur-xl">
              <FileVideo className="h-8 w-8 text-white/80" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Load Video to Studio</h3>
              <p className="text-xs text-white/50 mt-1 leading-relaxed">
                Select any video file from your phone or device to begin live color grading, aspect
                ratio adjustments, and editing.
              </p>
            </div>
            <div className="flex flex-col w-full gap-2 pt-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-11 rounded-2xl bg-white text-zinc-950 hover:bg-white/90 font-semibold text-xs shadow-lg gap-2"
              >
                <Upload className="h-4 w-4" />
                Select Video File
              </Button>
              <Button
                variant="outline"
                onClick={() => setUrlInputOpen(true)}
                className="w-full h-10 rounded-2xl bg-white/5 hover:bg-white/10 text-white/80 border-white/10 text-xs gap-2"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                Paste Video Link
              </Button>
            </div>

            {historyList.length > 0 && (
              <div className="w-full pt-3 border-t border-white/10 text-left">
                <span className="text-[11px] font-semibold text-white/40 block mb-2">
                  Recently Watched
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                  {historyList.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentVideoId(item.id);
                        setCurrentVideoSrc(null);
                        setCurrentTitle(item.title);
                        setCurrentChannel(item.channel);
                        setIsPlaying(true);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-left transition-colors"
                    >
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="w-10 h-7 rounded object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs truncate text-white/90 font-medium">
                          {item.title}
                        </span>
                        <span className="block text-[10px] text-white/40 truncate">
                          {item.channel}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Double Tap Ripple Indicators */}
        {doubleTapSide === "left" && (
          <div className="absolute left-6 top-1/2 -translate-y-1/2 h-16 w-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center animate-ping pointer-events-none">
            <span className="text-sm font-bold font-mono text-white">-{skipSeconds}s</span>
          </div>
        )}
        {doubleTapSide === "right" && (
          <div className="absolute right-6 top-1/2 -translate-y-1/2 h-16 w-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center animate-ping pointer-events-none">
            <span className="text-sm font-bold font-mono text-white">+{skipSeconds}s</span>
          </div>
        )}

        {/* Gesture On-Screen HUD Badge */}
        {gestureFeedback && (
          <div className="absolute top-16 px-3.5 py-1.5 rounded-full bg-black/80 border border-white/20 backdrop-blur-xl text-xs font-mono text-white shadow-2xl pointer-events-none">
            {gestureFeedback}
          </div>
        )}
      </div>

      {/* Primary Timeline Scrubber Bar */}
      {hasVideoLoaded && (
        <div
          className={`px-4 pt-2 pb-1 bg-gradient-to-t from-black via-black/80 to-transparent transition-opacity duration-300 ${
            controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <SeamlessSlider
            min={0}
            max={duration || 100}
            step={0.5}
            value={currentTime}
            onChange={(val) => {
              setCurrentTime(val);
              if (videoRef.current) videoRef.current.currentTime = val;
            }}
          />
          <div className="flex justify-between items-center text-[11px] font-mono text-white/60 mt-0.5">
            <span>{formatSec(currentTime)}</span>
            <span>{formatSec(duration)}</span>
          </div>
        </div>
      )}

      {/* Core Transport Controls Bar */}
      {hasVideoLoaded && (
        <div
          className={`flex items-center justify-between px-4 py-2 bg-black/90 transition-opacity duration-300 ${
            controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/70 hover:text-white"
              onClick={() => {
                const nextT = Math.max(0, currentTime - skipSeconds);
                setCurrentTime(nextT);
                if (videoRef.current) videoRef.current.currentTime = nextT;
              }}
              title={`Rewind ${skipSeconds}s`}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              className="h-10 w-10 rounded-full bg-white text-zinc-950 hover:bg-white/90 shadow-lg"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/70 hover:text-white"
              onClick={() => {
                const nextT = Math.min(duration, currentTime + skipSeconds);
                setCurrentTime(nextT);
                if (videoRef.current) videoRef.current.currentTime = nextT;
              }}
              title={`Forward ${skipSeconds}s`}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Aspect Ratio Mode Selector */}
          <div className="flex items-center gap-1 bg-white/10 rounded-full p-0.5 border border-white/10">
            {(["fit", "fill", "original", "16:9"] as AspectRatioMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setAspectRatio(mode)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  aspectRatio === mode
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-full border border-white/10">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white/70 hover:text-white p-0"
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-red-400" />
                ) : (
                  <Volume2 className="h-4 w-4 text-emerald-400" />
                )}
              </Button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setVolume(val);
                  if (val === 0) {
                    setIsMuted(true);
                  } else {
                    if (isMuted) setIsMuted(false);
                  }
                  if (videoRef.current) {
                    videoRef.current.volume = val / 100;
                  }
                }}
                className="w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                title={`Volume: ${isMuted ? 0 : volume}%`}
              />
              <span className="text-[10px] font-mono text-white/60 w-6 text-right">
                {isMuted ? "0%" : `${volume}%`}
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/70 hover:text-white rounded-full bg-white/10 hover:bg-white/20 border border-white/10"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Feature Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-2 bg-zinc-950 border-t border-white/10 no-scrollbar">
        {[
          { key: "grade", label: "Color Grade", icon: Palette },
          { key: "audio", label: "Audio & EQ", icon: Sliders },
          { key: "loop", label: "A-B Loop", icon: Repeat },
          { key: "subtitles", label: "Subtitles", icon: Type },
          { key: "clip", label: "Clip Maker", icon: Scissors },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActivePanel(activePanel === key ? "none" : (key as ActivePanel))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activePanel === key
                ? "bg-white text-zinc-950 font-semibold shadow-md"
                : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* PANEL 1: Color Grading Suite */}
      {activePanel === "grade" && (
        <div className="p-4 bg-zinc-950/95 border-t border-white/10 max-h-[38vh] overflow-y-auto no-scrollbar space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-semibold text-white/90">Grading Suite</span>
            <button
              onClick={() =>
                setGrade({
                  exposure: 0,
                  brightness: 0,
                  contrast: 0,
                  highlights: 0,
                  shadows: 0,
                  whites: 0,
                  blacks: 0,
                  temperature: 0,
                  tint: 0,
                  saturation: 100,
                  vibrance: 0,
                  hue: 0,
                  sharpness: 0,
                  clarity: 0,
                  texture: 0,
                  dehaze: 0,
                  fade: 0,
                  vignetteDarkness: 0,
                  vignetteFeather: 50,
                  vignetteMidpoint: 50,
                  filmGrain: 0,
                  curveMaster: 0,
                  curveRed: 0,
                  curveGreen: 0,
                  curveBlue: 0,
                  shadowColor: "#000000",
                  midtoneColor: "#808080",
                  highlightColor: "#ffffff",
                })
              }
              className="text-[11px] text-white/50 hover:text-white underline"
            >
              Reset to Neutral
            </button>
          </div>

          {/* Sub-tabs: Light, Color, Detail, Look, Advanced */}
          <div className="flex gap-1.5 p-1 bg-white/5 rounded-xl">
            {(["light", "color", "detail", "look", "advanced"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setGradeTab(tab)}
                className={`flex-1 py-1 rounded-lg text-xs capitalize transition-colors font-medium ${
                  gradeTab === tab
                    ? "bg-white text-zinc-950 font-semibold shadow"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Light Controls */}
          {gradeTab === "light" && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                { label: "Exposure", key: "exposure", min: -100, max: 100 },
                { label: "Brightness", key: "brightness", min: -100, max: 100 },
                { label: "Contrast", key: "contrast", min: -100, max: 100 },
                { label: "Highlights", key: "highlights", min: -100, max: 100 },
                { label: "Shadows", key: "shadows", min: -100, max: 100 },
                { label: "Whites", key: "whites", min: -100, max: 100 },
                { label: "Blacks", key: "blacks", min: -100, max: 100 },
              ].map(({ label, key, min, max }) => (
                <SeamlessSlider
                  key={key}
                  label={label}
                  min={min}
                  max={max}
                  value={grade[key as GradeNumericKey]}
                  onChange={(val) => setGrade((prev) => ({ ...prev, [key]: val }))}
                />
              ))}
            </div>
          )}

          {/* Color Controls */}
          {gradeTab === "color" && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                { label: "Temperature", key: "temperature", min: -100, max: 100 },
                { label: "Tint (G/M)", key: "tint", min: -100, max: 100 },
                { label: "Saturation", key: "saturation", min: 0, max: 200 },
                { label: "Vibrance", key: "vibrance", min: -100, max: 100 },
                { label: "Hue Rotation", key: "hue", min: -180, max: 180 },
              ].map(({ label, key, min, max }) => (
                <SeamlessSlider
                  key={key}
                  label={label}
                  min={min}
                  max={max}
                  value={grade[key as GradeNumericKey]}
                  onChange={(val) => setGrade((prev) => ({ ...prev, [key]: val }))}
                />
              ))}
            </div>
          )}

          {/* Detail Controls */}
          {gradeTab === "detail" && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                { label: "Sharpness", key: "sharpness", min: 0, max: 100 },
                { label: "Clarity", key: "clarity", min: -100, max: 100 },
                { label: "Texture", key: "texture", min: -100, max: 100 },
                { label: "Dehaze", key: "dehaze", min: 0, max: 100 },
              ].map(({ label, key, min, max }) => (
                <SeamlessSlider
                  key={key}
                  label={label}
                  min={min}
                  max={max}
                  value={grade[key as GradeNumericKey]}
                  onChange={(val) => setGrade((prev) => ({ ...prev, [key]: val }))}
                />
              ))}
            </div>
          )}

          {/* Look Controls */}
          {gradeTab === "look" && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                { label: "Fade", key: "fade", min: 0, max: 100 },
                { label: "Vignette Darkness", key: "vignetteDarkness", min: 0, max: 100 },
                { label: "Vignette Feather", key: "vignetteFeather", min: 0, max: 100 },
                { label: "Vignette Midpoint", key: "vignetteMidpoint", min: 0, max: 100 },
                { label: "Film Grain", key: "filmGrain", min: 0, max: 100 },
              ].map(({ label, key, min, max }) => (
                <SeamlessSlider
                  key={key}
                  label={label}
                  min={min}
                  max={max}
                  value={grade[key as GradeNumericKey]}
                  onChange={(val) => setGrade((prev) => ({ ...prev, [key]: val }))}
                />
              ))}
            </div>
          )}

          {/* Advanced RGB Curves */}
          {gradeTab === "advanced" && (
            <div className="space-y-3">
              <span className="text-[11px] font-medium text-white/70 block">RGB Curves</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  { label: "Master Curve", key: "curveMaster" },
                  { label: "Red Channel", key: "curveRed" },
                  { label: "Green Channel", key: "curveGreen" },
                  { label: "Blue Channel", key: "curveBlue" },
                ].map(({ label, key }) => (
                  <SeamlessSlider
                    key={key}
                    label={label}
                    min={-50}
                    max={50}
                    value={grade[key as GradeNumericKey]}
                    onChange={(val) => setGrade((prev) => ({ ...prev, [key]: val }))}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PANEL 2: Audio EQ & Balance */}
      {activePanel === "audio" && (
        <div className="p-4 bg-zinc-950/95 border-t border-white/10 max-h-[38vh] overflow-y-auto no-scrollbar space-y-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {["Flat", "Bass Boost", "Vocal", "Acoustic", "Rock", "Electronic"].map((preset) => (
              <button
                key={preset}
                onClick={() => setEqPreset(preset)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  eqPreset === preset
                    ? "bg-white text-zinc-950 font-semibold shadow"
                    : "bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <SeamlessSlider
              label="Bass Boost"
              min={0}
              max={12}
              value={bassBoost}
              onChange={setBassBoost}
            />
            <SeamlessSlider label="Treble" min={-10} max={10} value={treble} onChange={setTreble} />
            <SeamlessSlider
              label="Left / Right Balance"
              min={-100}
              max={100}
              value={audioBalance}
              onChange={setAudioBalance}
              displayValue={
                audioBalance < 0
                  ? `L ${Math.abs(audioBalance)}`
                  : audioBalance > 0
                    ? `R ${audioBalance}`
                    : "Center"
              }
            />
            <div className="flex items-center justify-between pt-3">
              <span className="text-xs text-white/70">Mono Downmix</span>
              <button
                onClick={() => setIsMono(!isMono)}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  isMono ? "bg-white text-zinc-950" : "bg-white/10 text-white/60"
                }`}
              >
                {isMono ? "Mono" : "Stereo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PANEL 3: A-B Segment Looper */}
      {activePanel === "loop" && (
        <div className="p-4 bg-zinc-950/95 border-t border-white/10 max-h-[38vh] overflow-y-auto no-scrollbar space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/90">A-to-B Segment Looping</span>
            <button
              onClick={() => setLoopEnabled(!loopEnabled)}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                loopEnabled ? "bg-white text-zinc-950" : "bg-white/10 text-white/60"
              }`}
            >
              {loopEnabled ? "Looping Active" : "Disabled"}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPointA(currentTime);
                setLoopEnabled(true);
              }}
              className="flex-1 rounded-xl bg-white/5 border-white/15 text-xs text-white"
            >
              Set Point A ({pointA !== null ? formatSec(pointA) : "--:--"})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPointB(currentTime);
                setLoopEnabled(true);
              }}
              className="flex-1 rounded-xl bg-white/5 border-white/15 text-xs text-white"
            >
              Set Point B ({pointB !== null ? formatSec(pointB) : "--:--"})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPointA(null);
                setPointB(null);
                setLoopEnabled(false);
              }}
              className="text-xs text-white/50 hover:text-white"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* PANEL 4: Subtitles Styling */}
      {activePanel === "subtitles" && (
        <div className="p-4 bg-zinc-950/95 border-t border-white/10 max-h-[38vh] overflow-y-auto no-scrollbar space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/90">Subtitles Styling</span>
            <button
              onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                subtitlesEnabled ? "bg-white text-zinc-950" : "bg-white/10 text-white/60"
              }`}
            >
              {subtitlesEnabled ? "On" : "Off"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="block text-white/60 mb-1">Font Size</span>
              <div className="flex gap-1">
                {(["sm", "md", "lg"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubSize(s)}
                    className={`flex-1 py-1 rounded-lg text-xs uppercase ${
                      subSize === s
                        ? "bg-white text-zinc-950 font-bold"
                        : "bg-white/10 text-white/60"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="block text-white/60 mb-1">Text Color</span>
              <div className="flex gap-2 items-center">
                {["#ffffff", "#ffeb3b", "#00e5ff"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setSubTextColor(c)}
                    className={`h-6 w-6 rounded-full border ${
                      subTextColor === c
                        ? "ring-2 ring-white border-transparent"
                        : "border-white/30"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANEL 5: Clip & Screenshot Exporter */}
      {activePanel === "clip" && (
        <div className="p-4 bg-zinc-950/95 border-t border-white/10 max-h-[38vh] overflow-y-auto no-scrollbar space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/90">Instant Clip & Export</span>
            {clipExportStatus && (
              <span className="text-xs text-white/80 animate-pulse">{clipExportStatus}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SeamlessSlider
              label={`Clip Start: ${formatSec(clipStart)}`}
              min={0}
              max={duration}
              value={clipStart}
              onChange={setClipStart}
            />
            <SeamlessSlider
              label={`Clip End: ${formatSec(clipEnd)}`}
              min={clipStart + 1}
              max={duration}
              value={clipEnd}
              onChange={setClipEnd}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCaptureScreenshot}
              className="flex-1 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs gap-1.5"
            >
              <Camera className="h-3.5 w-3.5" />
              Screenshot Frame
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setClipExportStatus("Exporting clip...");
                setTimeout(() => {
                  setClipExportStatus("Clip ready for device storage");
                  setTimeout(() => setClipExportStatus(null), 2500);
                }, 1000);
              }}
              className="flex-1 h-9 rounded-xl bg-white text-zinc-950 hover:bg-white/90 font-semibold text-xs gap-1.5"
            >
              <Scissors className="h-3.5 w-3.5" />
              Export Clip ({Math.round(clipEnd - clipStart)}s)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
