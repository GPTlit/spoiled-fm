import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Mic,
  MicOff,
  SlidersHorizontal,
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Film,
  Download,
  Share2,
  Sparkles,
  Link as LinkIcon,
  Check,
  User,
  Flame,
  BadgeCheck,
  ArrowLeft,
  Shuffle,
  Youtube,
  Radio,
  Music2,
  RefreshCw,
  ArrowDown,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeamlessSlideTrack } from "@/components/SeamlessSlideTrack";
import {
  recordSearchTerm,
  getFrequentSearchTerms,
  recordWatchedVideo,
} from "@/lib/user-preferences";
import {
  ARTIST_PROFILES,
  POPULAR_ARTIST_NAMES,
  type ArtistProfile,
  type ArtistVideo,
} from "@/lib/artist-catalog";
import {
  getFreshRecommendations,
  DISCOVERY_SEARCH_PROMPTS,
  type CuratedRecommendation,
} from "@/lib/recommendations";

export interface VideoResult {
  id: string;
  title: string;
  channel: string;
  duration?: string;
  thumbnail: string;
  views?: string;
}

interface DiscoverSearchProps {
  onSelectVideo: (video: VideoResult) => void;
  onOpenDownloadModal?: (video: VideoResult, type: "video" | "audio") => void;
  initialQuery?: string;
  activeVideo?: VideoResult | null;
  onCloseActiveVideo?: () => void;
  selectedArtist?: string | null;
  onSelectArtist?: (artist: string | null) => void;
}

const TOPIC_PILLS = ["All", "Pop", "Hip-Hop", "R&B", "Electronic", "Rock", "Acoustic", "Chill"];

export function DiscoverSearch({
  onSelectVideo,
  onOpenDownloadModal,
  initialQuery = "",
  activeVideo = null,
  onCloseActiveVideo,
  selectedArtist: externalArtist = null,
  onSelectArtist,
}: DiscoverSearchProps) {
  const [internalVideo, setInternalVideo] = useState<VideoResult | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [activeTopic, setActiveTopic] = useState("All");
  const [results, setResults] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [frequentTerms, setFrequentTerms] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [directLinkInput, setDirectLinkInput] = useState("");
  const [activeChannel, setActiveChannel] = useState<string | null>(externalArtist);

  // Recommendations State (before & after search)
  const [recommendations, setRecommendations] = useState<CuratedRecommendation[]>(() =>
    getFreshRecommendations("All", 8),
  );
  const [searchRecommendations, setSearchRecommendations] = useState<CuratedRecommendation[]>(() =>
    getFreshRecommendations("All", 6),
  );
  const [refreshingRecs, setRefreshingRecs] = useState(false);

  // Pull-to-refresh (hold and slide down to reload)
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const isMouseDown = useRef(false);
  const discoveryPromptIdx = useRef(0);

  // Native Video Playback Controls State
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Filter States
  const [filterDuration, setFilterDuration] = useState<"all" | "short" | "medium" | "long">("all");
  const [filterUploadDate, setFilterUploadDate] = useState<
    "any" | "today" | "week" | "month" | "year"
  >("any");
  const [filterFeatures, setFilterFeatures] = useState<{
    live: boolean;
  }>({
    live: false,
  });

  interface SpeechRecognitionResultItem {
    transcript: string;
  }
  interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResultItem[];
  }
  interface SpeechRecognitionEventLike {
    results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onstart: (() => void) | null;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
  }

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Only display a video container if a video has been selected by user!
  const currentVideo: VideoResult | null = activeVideo || internalVideo || null;

  // Sync external artist selection from props
  useEffect(() => {
    if (externalArtist) {
      setActiveChannel(externalArtist);
    }
  }, [externalArtist]);

  useEffect(() => {
    setFrequentTerms(getFrequentSearchTerms());
  }, []);

  const triggerSearch = useCallback(async (term: string) => {
    const clean = term.trim();
    if (!clean) {
      setResults([]);
      return;
    }

    setLoading(true);
    recordSearchTerm(clean);
    setFrequentTerms(getFrequentSearchTerms());

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = (await res.json()) as { videos?: VideoResult[]; results?: VideoResult[] };
        const found = data.videos || data.results;
        if (found && found.length > 0) {
          setResults(found);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore
    }

    // Fallback to artist profile if search returned nothing and it's a known artist
    const matchedArtist = POPULAR_ARTIST_NAMES.find((a) => a.toLowerCase() === clean.toLowerCase());
    if (matchedArtist) {
      openArtistProfile(matchedArtist);
      setLoading(false);
      return;
    }

    setResults([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialQuery.trim()) {
      setQuery(initialQuery);
      void triggerSearch(initialQuery);
    }
  }, [initialQuery, triggerSearch]);

  // Voice Search Setup
  useEffect(() => {
    type WindowWithSpeech = Window & {
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
      SpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const speechWindow = window as unknown as WindowWithSpeech;
    const SpeechConstructor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechConstructor) {
      setVoiceSupported(false);
      return;
    }

    try {
      const recognition = new SpeechConstructor();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setQuery(transcript);
          recordSearchTerm(transcript);
          void triggerSearch(transcript);
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    } catch {
      setVoiceSupported(false);
    }
  }, [triggerSearch]);

  // Listen to fullscreen changes on video container
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const handleVoiceToggle = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch {
        setIsListening(false);
      }
    }
  };

  const reloadRecommendations = useCallback(
    async (category?: string) => {
      setRefreshingRecs(true);
      const cat = category || activeTopic;

      try {
        const prompt =
          cat && cat !== "All"
            ? `${cat} music top hits official`
            : DISCOVERY_SEARCH_PROMPTS[
                discoveryPromptIdx.current % DISCOVERY_SEARCH_PROMPTS.length
              ];
        discoveryPromptIdx.current++;

        const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(prompt)}`);
        if (res.ok) {
          const data = (await res.json()) as { videos?: VideoResult[]; results?: VideoResult[] };
          const found = data.videos || data.results;
          if (found && found.length >= 4) {
            const shuffled = [...found].sort(() => 0.5 - Math.random());
            setRecommendations(
              shuffled.slice(0, 8).map((v) => ({
                ...v,
                category: (cat as CuratedRecommendation["category"]) || "Trending",
                tag: "Trending Now",
              })),
            );
            setSearchRecommendations(
              shuffled.slice(0, 6).map((v) => ({
                ...v,
                category: "Trending",
                tag: "Recommended",
              })),
            );
            setRefreshingRecs(false);
            return;
          }
        }
      } catch {
        // ignore
      }

      // Catalog fallback
      const fresh = getFreshRecommendations(cat, 8);
      setRecommendations(fresh);
      setSearchRecommendations(getFreshRecommendations("All", 6));
      setRefreshingRecs(false);
    },
    [activeTopic],
  );

  // Pull-to-refresh event handlers
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const scrollContainer = document.querySelector(
      ".fixed-page .main-screen",
    ) as HTMLElement | null;
    const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;

    if (currentScrollTop <= 5 && !isPullRefreshing) {
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      touchStartY.current = clientY;
      if (!("touches" in e)) isMouseDown.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (touchStartY.current === null || isPullRefreshing) return;
    if (!("touches" in e) && !isMouseDown.current) return;

    const scrollContainer = document.querySelector(
      ".fixed-page .main-screen",
    ) as HTMLElement | null;
    const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
    if (currentScrollTop > 5) {
      touchStartY.current = null;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const diff = clientY - touchStartY.current;

    if (diff > 0) {
      const distance = Math.min(diff * 0.45, 80);
      setPullDistance(distance);
      setIsPulling(true);
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleTouchEnd = async () => {
    if (touchStartY.current === null) return;
    touchStartY.current = null;
    isMouseDown.current = false;

    if (pullDistance >= 55 && !isPullRefreshing) {
      setIsPullRefreshing(true);
      setPullDistance(52);
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.([15, 30]);
        }
      } catch {
        // ignore
      }

      await reloadRecommendations();
      await new Promise((r) => setTimeout(r, 600));
    }

    setPullDistance(0);
    setIsPulling(false);
    setIsPullRefreshing(false);
  };

  // YouTube IFrame postMessage Controller
  const sendYtCommand = (func: string, args: unknown = "") => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func, args }),
          "*",
        );
      } catch {
        // ignore
      }
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      sendYtCommand("pauseVideo");
      setIsPlaying(false);
    } else {
      sendYtCommand("playVideo");
      setIsPlaying(true);
    }
  };

  const handleToggleMute = () => {
    if (isMuted) {
      sendYtCommand("unMute");
      sendYtCommand("setVolume", volume || 100);
      setIsMuted(false);
    } else {
      sendYtCommand("mute");
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (newVol === 0) {
      setIsMuted(true);
      sendYtCommand("mute");
    } else {
      if (isMuted) {
        setIsMuted(false);
        sendYtCommand("unMute");
      }
      sendYtCommand("setVolume", newVol);
    }
  };

  const handleToggleFullscreen = async () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await videoContainerRef.current.requestFullscreen();
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

  const handlePlayVideo = (vid: VideoResult) => {
    setInternalVideo(vid);
    setIsPlaying(true);
    recordWatchedVideo(vid);
    onSelectVideo(vid);
  };

  const handleCloseVideo = () => {
    setInternalVideo(null);
    onCloseActiveVideo?.();
  };

  const handlePlayDirectLink = () => {
    const raw = directLinkInput.trim();
    if (!raw) return;

    let videoId = raw;
    const ytMatch = raw.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/,
    );
    if (ytMatch) {
      videoId = ytMatch[1];
    }

    const directItem: VideoResult = {
      id: videoId,
      title: raw.includes("http")
        ? `Stream: ${new URL(raw).pathname.split("/").pop() || "Direct Video"}`
        : `Direct Stream: ${videoId}`,
      channel: "Direct Web Media",
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: "Live / Direct",
    };

    handlePlayVideo(directItem);
    setDirectLinkInput("");
  };

  const openArtistProfile = (artistName: string) => {
    setActiveChannel(artistName);
    onSelectArtist?.(artistName);
    // Do not autoplay - user clicks a video to watch it
  };

  const closeArtistProfile = () => {
    setActiveChannel(null);
    onSelectArtist?.(null);
  };

  // Filter video results locally according to active filter options
  const filteredResults = results.filter((item) => {
    if (filterDuration === "short" && item.duration) {
      const [m] = item.duration.split(":").map(Number);
      if (m >= 4) return false;
    }
    if (filterDuration === "long" && item.duration) {
      const [m] = item.duration.split(":").map(Number);
      if (m < 20) return false;
    }
    if (filterFeatures.live && !item.title.toLowerCase().includes("live")) {
      return false;
    }
    return true;
  });

  const activeArtistProfile: ArtistProfile | null = activeChannel
    ? ARTIST_PROFILES[activeChannel] || null
    : null;

  return (
    <div
      className="explore-white-screen flex flex-col w-full pb-8 select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
    >
      {/* PULL TO REFRESH BANNER (HOLD AND SLIDE DOWN TO RELOAD) */}
      {(pullDistance > 0 || isPullRefreshing) && (
        <div
          className="overflow-hidden transition-all duration-150 flex items-center justify-center -mt-1 mb-3"
          style={{ height: `${pullDistance}px` }}
        >
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-md backdrop-blur-md transition-all ${
              pullDistance >= 55 || isPullRefreshing
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-muted-foreground"
            }`}
          >
            {isPullRefreshing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                <span>Finding fresh video recommendations…</span>
              </>
            ) : pullDistance >= 55 ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-emerald-500" />
                <span>Release to show new videos! ⚡</span>
              </>
            ) : (
              <>
                <ArrowDown
                  className="h-4 w-4 transition-transform duration-100"
                  style={{ transform: `rotate(${Math.min(pullDistance * 3.5, 180)}deg)` }}
                />
                <span>Hold & slide down to reload videos</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 1. SEARCH INPUT BAR (ALWAYS AT THE VERY TOP) */}
      <div className="sticky -top-4 sm:-top-6 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md pt-3 pb-3 border-b border-slate-100 dark:border-zinc-800 -mx-4 sm:-mx-6 px-4 sm:px-6 mb-4">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search songs, artists, music videos, or paste YouTube link…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && triggerSearch(query)}
              className="w-full h-11 pl-10 pr-20 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-xs"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setResults([]);
                }}
                className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-foreground"
                title="Clear query"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {voiceSupported && (
              <button
                onClick={handleVoiceToggle}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${
                  isListening ? "bg-red-500 text-white" : "text-slate-400 hover:text-foreground"
                }`}
                title={isListening ? "Listening… click to stop" : "Voice search"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`h-11 w-11 rounded-2xl shrink-0 border ${
              filtersOpen
                ? "bg-primary/10 text-primary border-primary"
                : "border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-foreground"
            }`}
            title="Search filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Voice Recognition Feedback HUD */}
        {isListening && (
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-600 dark:text-red-400 mt-2">
            <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
            <span>Listening… speak your search terms now</span>
          </div>
        )}

        {/* Search Filters Drawer Panel */}
        {filtersOpen && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm mt-3 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span>Search Filters</span>
              </h3>
              <button
                onClick={() => setFiltersOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="block font-semibold mb-1.5 text-muted-foreground">Duration</span>
                <div className="space-y-1">
                  {(["all", "short", "medium", "long"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setFilterDuration(d)}
                      className={`w-full text-left px-2.5 py-1 rounded-lg capitalize ${
                        filterDuration === d
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-foreground hover:bg-slate-200 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {d === "short" ? "Under 4 min" : d === "long" ? "Over 20 min" : d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block font-semibold mb-1.5 text-muted-foreground">
                  Upload Date
                </span>
                <div className="space-y-1">
                  {(["any", "today", "week", "month", "year"] as const).map((u) => (
                    <button
                      key={u}
                      onClick={() => setFilterUploadDate(u)}
                      className={`w-full text-left px-2.5 py-1 rounded-lg capitalize ${
                        filterUploadDate === u
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-foreground hover:bg-slate-200 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {u === "any" ? "Any time" : `This ${u}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Topic Chips */}
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {TOPIC_PILLS.map((topic) => (
            <button
              key={topic}
              onClick={() => {
                setActiveTopic(topic);
                if (topic === "All") {
                  setResults([]);
                  setQuery("");
                  void reloadRecommendations("All");
                } else {
                  if (results.length > 0) {
                    setQuery(`${topic} music`);
                    void triggerSearch(`${topic} music`);
                  } else {
                    void reloadRecommendations(topic);
                  }
                }
              }}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeTopic === topic
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "bg-slate-100 dark:bg-zinc-800/80 text-foreground/80 hover:bg-slate-200 dark:hover:bg-zinc-700"
              }`}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {/* 2. VIDEO PLAYER CONTAINER (ONLY DISPLAYED WHEN USER CLICKS A VIDEO) */}
      {currentVideo && (
        <div
          ref={videoContainerRef}
          className="explore-normal-video-box mb-6 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-black shadow-lg"
        >
          {/* Video Display Window */}
          <div className="relative w-full aspect-video bg-black overflow-hidden flex items-center justify-center">
            <iframe
              ref={iframeRef}
              key={currentVideo.id}
              src={`https://www.youtube-nocookie.com/embed/${currentVideo.id}?enablejsapi=1&autoplay=1&playsinline=1&rel=0&modestbranding=1`}
              title={currentVideo.title}
              className="w-full h-full object-contain max-w-full block border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />

            {/* Floating Close Button Top Right */}
            <button
              onClick={handleCloseVideo}
              className="absolute top-2.5 right-2.5 z-10 h-8 w-8 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all shadow-md"
              title="Close video"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Native Video Playback Controls Bar (Play/Pause, Volume Slider, Fullscreen) */}
          <div className="bg-zinc-950 px-4 py-2.5 flex items-center justify-between gap-3 text-white border-t border-zinc-800">
            <div className="flex items-center gap-2">
              {/* Play / Pause */}
              <button
                onClick={handleTogglePlay}
                className="h-9 w-9 rounded-full bg-white text-zinc-950 hover:bg-white/90 flex items-center justify-center transition-colors shadow-sm"
                title={isPlaying ? "Pause video" : "Play video"}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4 fill-current" />
                ) : (
                  <Play className="h-4 w-4 fill-current ml-0.5" />
                )}
              </button>

              {/* Volume & Mute Controls */}
              <div className="flex items-center gap-2 bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
                <button
                  onClick={handleToggleMute}
                  className="text-white/80 hover:text-white transition-colors"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4 text-red-400" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-emerald-400" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-16 sm:w-24 h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  title={`Volume: ${isMuted ? 0 : volume}%`}
                />
                <span className="text-[10px] font-mono text-white/60 w-7 text-right">
                  {isMuted ? "0%" : `${volume}%`}
                </span>
              </div>
            </div>

            {/* Right Side: Fullscreen & Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleFullscreen}
                className="h-8 px-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center gap-1.5 text-xs transition-colors border border-white/10"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Video"}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Exit</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Fullscreen</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Video Title & Actions */}
          <div className="p-3.5 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-bold text-foreground tracking-tight truncate">
                {currentVideo.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                <button
                  onClick={() => openArtistProfile(currentVideo.channel)}
                  className="font-semibold text-foreground hover:text-primary hover:underline flex items-center gap-1.5"
                  title="View artist profile"
                >
                  <Youtube className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  <span>{currentVideo.channel}</span>
                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                </button>
                {currentVideo.duration && <span>· {currentVideo.duration}</span>}
                {currentVideo.views && <span>· {currentVideo.views}</span>}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onOpenDownloadModal && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenDownloadModal(currentVideo, "audio")}
                    className="h-8 px-3 text-xs font-semibold rounded-xl border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  >
                    <Download className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Audio
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onOpenDownloadModal(currentVideo, "video")}
                    className="h-8 px-3 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> Video
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. ARTIST CHANNEL PROFILE VIEW */}
      {activeArtistProfile && (
        <div className="artist-profile-suite space-y-4 mb-6">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 p-4 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <Button
                size="sm"
                variant="outline"
                onClick={closeArtistProfile}
                className="text-xs font-semibold gap-1.5 rounded-xl border-slate-300 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Search
              </Button>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> Verified Artist
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-white shadow-md shrink-0 bg-slate-200">
                <img
                  src={activeArtistProfile.cover}
                  alt={activeArtistProfile.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    if (activeArtistProfile.fallbackCover) {
                      e.currentTarget.src = activeArtistProfile.fallbackCover;
                    }
                  }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-center sm:justify-start gap-1.5">
                  <h2 className="text-xl font-bold text-foreground">{activeArtistProfile.name}</h2>
                  <BadgeCheck className="h-5 w-5 text-emerald-600 fill-emerald-600 text-white shrink-0" />
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                  {activeArtistProfile.handle} · {activeArtistProfile.subscribers}
                </p>
                <p className="text-xs text-foreground/80 mt-2 line-clamp-2 max-w-xl">
                  {activeArtistProfile.bio}
                </p>
              </div>
            </div>

            {/* Featured Channel Videos */}
            <div className="mt-5 space-y-2">
              <span className="text-xs font-bold text-foreground block mb-2">Popular Tracks</span>
              {activeArtistProfile.featuredVideos.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handlePlayVideo(item)}
                  className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-12 h-9 object-cover rounded-lg shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <strong className="block text-xs font-semibold truncate text-foreground">
                        {item.title}
                      </strong>
                      <span className="text-[10px] text-muted-foreground">
                        {item.duration} · {item.views}
                      </span>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handlePlayVideo(item)}
                      className="h-7 w-7 rounded-full bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white flex items-center justify-center transition-colors"
                      title="Play"
                    >
                      <Play className="h-3 w-3 fill-current ml-0.5" />
                    </button>
                    {onOpenDownloadModal && (
                      <button
                        onClick={() => onOpenDownloadModal(item, "audio")}
                        className="h-7 w-7 rounded-full hover:bg-slate-100 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                        title="Download audio"
                      >
                        <Download className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. SEARCH RESULTS LIST OR CLEAN DISCOVERY HUB */}
      {results.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between pt-1 px-1">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-primary" />
              <span>Results for "{query}"</span>
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {loading ? "Searching media…" : `${filteredResults.length} Videos`}
            </span>
          </div>

          <div className="space-y-2">
            {filteredResults.map((item) => (
              <div
                key={item.id}
                onClick={() => handlePlayVideo(item)}
                className="group flex items-center justify-between p-2.5 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 transition-all cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-16 h-11 shrink-0 rounded-xl overflow-hidden bg-black shadow-xs">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="h-4 w-4 fill-white text-white" />
                    </div>
                    {item.duration && (
                      <span className="absolute bottom-0.5 right-1 px-1 py-0.2 rounded bg-black/80 font-mono text-[9px] text-white">
                        {item.duration}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pr-2">
                    <strong className="block text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {item.title}
                    </strong>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate mt-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openArtistProfile(item.channel);
                        }}
                        className="hover:underline hover:text-foreground font-semibold truncate"
                      >
                        {item.channel}
                      </button>
                      {item.views && (
                        <>
                          <span>·</span>
                          <span className="shrink-0 font-mono">{item.views}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className="flex items-center gap-1.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handlePlayVideo(item)}
                    className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground flex items-center justify-center transition-colors"
                    title="Play video on screen"
                  >
                    <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                  </button>

                  {onOpenDownloadModal && (
                    <button
                      onClick={() => onOpenDownloadModal(item, "audio")}
                      className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                      title="Download audio"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 5. RECOMMENDATIONS AFTER SEARCH */}
          <div className="pt-6 mt-6 border-t border-slate-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold text-foreground">
                  Recommended For You · More to Discover
                </h3>
              </div>
              <button
                onClick={() => reloadRecommendations()}
                disabled={refreshingRecs || isPullRefreshing}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                title="Shuffle & reload fresh recommendations"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshingRecs ? "animate-spin" : ""}`} />
                <span>Reload</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {searchRecommendations.map((item) => (
                <div
                  key={`rec-${item.id}`}
                  onClick={() => handlePlayVideo(item)}
                  className="group flex items-center justify-between p-2 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 transition-all cursor-pointer shadow-xs hover:border-primary/50"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="relative w-16 h-11 shrink-0 rounded-xl overflow-hidden bg-black shadow-xs">
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="h-4 w-4 fill-white text-white" />
                      </div>
                      {item.duration && (
                        <span className="absolute bottom-0.5 right-1 px-1 py-0.2 rounded bg-black/80 font-mono text-[9px] text-white">
                          {item.duration}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 pr-1">
                      <strong className="block text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {item.title}
                      </strong>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate mt-0.5">
                        <span className="font-semibold truncate">{item.channel}</span>
                        {item.views && (
                          <>
                            <span>·</span>
                            <span className="font-mono">{item.views}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handlePlayVideo(item)}
                      className="h-7 w-7 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground flex items-center justify-center transition-colors"
                      title="Play"
                    >
                      <Play className="h-3 w-3 fill-current ml-0.5" />
                    </button>
                    {onOpenDownloadModal && (
                      <button
                        onClick={() => onOpenDownloadModal(item, "audio")}
                        className="h-7 w-7 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                        title="Download audio"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">Searching music video catalog…</span>
        </div>
      ) : (
        /* Discovery Hub with Rich Recommendations Before Search */
        <div className="py-2 space-y-6">
          {/* RECOMMENDATIONS BEFORE SEARCH */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-500 fill-amber-500" />
                <h3 className="text-sm font-bold text-foreground">Recommended For You</h3>
                <span className="text-[11px] font-semibold text-muted-foreground bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                  {activeTopic === "All" ? "Trending" : activeTopic}
                </span>
              </div>
              <button
                onClick={() => reloadRecommendations()}
                disabled={refreshingRecs || isPullRefreshing}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                title="Hold and slide down anywhere to reload, or click here"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshingRecs ? "animate-spin" : ""}`} />
                <span>Reload</span>
              </button>
            </div>

            {/* Grid of Recommendation Video Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {recommendations.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handlePlayVideo(item)}
                  className="group relative flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-primary/50 overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  {/* Thumbnail with duration badge & play button */}
                  <div className="relative aspect-video w-full bg-black overflow-hidden">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className="h-10 w-10 rounded-full bg-white/95 group-hover:bg-primary text-zinc-900 group-hover:text-primary-foreground flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-all">
                        <Play className="h-4 w-4 fill-current ml-0.5" />
                      </div>
                    </div>
                    {item.duration && (
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/85 font-mono text-[10px] text-white font-medium">
                        {item.duration}
                      </span>
                    )}
                  </div>

                  {/* Video Info and Actions */}
                  <div className="p-3 flex flex-col justify-between flex-1 gap-2">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                        <span className="font-semibold truncate">{item.channel}</span>
                        <BadgeCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                        {item.views && (
                          <>
                            <span>·</span>
                            <span className="font-mono">{item.views}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons: Play Now & Downloads */}
                    <div
                      className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handlePlayVideo(item)}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        <Play className="h-3 w-3 fill-current" /> Play Now
                      </button>

                      {onOpenDownloadModal && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onOpenDownloadModal(item, "audio")}
                            className="h-7 px-2 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-muted-foreground hover:text-foreground text-[11px] font-semibold flex items-center gap-1 transition-colors"
                            title="Download audio"
                          >
                            <Download className="h-3 w-3 text-emerald-500" /> Audio
                          </button>
                          <button
                            onClick={() => onOpenDownloadModal(item, "video")}
                            className="h-7 px-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                            title="Download video"
                          >
                            <Download className="h-3 w-3" /> Video
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Direct Link Pasting */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <span className="text-xs font-bold text-foreground block mb-1">
              Paste Any Video or YouTube Link
            </span>
            <p className="text-[11px] text-muted-foreground mb-3">
              Play direct web streams, MP4 videos, or YouTube links directly.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=…"
                value={directLinkInput}
                onChange={(e) => setDirectLinkInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePlayDirectLink()}
                className="flex-1 h-9 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button
                size="sm"
                onClick={handlePlayDirectLink}
                className="h-9 px-4 rounded-xl text-xs font-semibold"
              >
                Load
              </Button>
            </div>
          </div>

          {/* Popular Artists Carousel */}
          <div>
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-xs font-bold text-foreground">Featured Artist Channels</span>
            </div>
            <SeamlessSlideTrack showArrows={true}>
              {POPULAR_ARTIST_NAMES.map((name) => {
                const profile = ARTIST_PROFILES[name];
                return (
                  <button
                    key={name}
                    onClick={() => openArtistProfile(name)}
                    className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-foreground font-semibold text-xs shadow-xs transition-colors"
                  >
                    {profile?.cover && (
                      <img
                        src={profile.cover}
                        alt={name}
                        className="w-5 h-5 rounded-full object-cover shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <span>{name}</span>
                  </button>
                );
              })}
            </SeamlessSlideTrack>
          </div>

          {/* Frequent / Recent Searches */}
          {frequentTerms.length > 0 && (
            <div>
              <span className="text-xs font-bold text-foreground block mb-2 px-1">
                Recent Searches
              </span>
              <div className="flex flex-wrap gap-1.5">
                {frequentTerms.slice(0, 8).map((term) => (
                  <button
                    key={term}
                    onClick={() => {
                      setQuery(term);
                      void triggerSearch(term);
                    }}
                    className="px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-medium text-foreground transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
