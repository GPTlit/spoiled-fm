import { useState, useEffect, useRef } from "react";
import {
  Search,
  Mic,
  MicOff,
  SlidersHorizontal,
  X,
  Play,
  Film,
  Download,
  Share2,
  Clock,
  Tv,
  ListMusic,
  ExternalLink,
  Sparkles,
  Link as LinkIcon,
  Check,
  ChevronRight,
  User,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeamlessSlideTrack } from "@/components/SeamlessSlideTrack";
import {
  recordSearchTerm,
  getFrequentSearchTerms,
  recordWatchedVideo,
} from "@/lib/user-preferences";

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
}

const TOPIC_PILLS = [
  "All",
  "Music",
  "Jazz",
  "Gaming",
  "Podcasts",
  "AI",
  "Mixes",
  "Live",
  "Sports",
  "Lo-Fi",
  "Acoustic",
  "Synthwave",
];

export function DiscoverSearch({
  onSelectVideo,
  onOpenDownloadModal,
  initialQuery = "",
}: DiscoverSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [activeTopic, setActiveTopic] = useState("All");
  const [results, setResults] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [frequentTerms, setFrequentTerms] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [directLinkInput, setDirectLinkInput] = useState("");
  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  // Filter States
  const [filterDuration, setFilterDuration] = useState<"all" | "short" | "medium" | "long">("all");
  const [filterUploadDate, setFilterUploadDate] = useState<
    "any" | "today" | "week" | "month" | "year"
  >("any");
  const [filterType, setFilterType] = useState<"all" | "video" | "playlist" | "channel">("all");
  const [filterFeatures, setFilterFeatures] = useState<{
    fourK: boolean;
    hd: boolean;
    subtitles: boolean;
    live: boolean;
    vr360: boolean;
    hdr: boolean;
  }>({
    fourK: false,
    hd: false,
    subtitles: false,
    live: false,
    vr360: false,
    hdr: false,
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

  // Initialize Speech Recognition & Frequent Terms
  useEffect(() => {
    setFrequentTerms(getFrequentSearchTerms(8));

    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setQuery(transcript);
          void triggerSearch(transcript);
        }
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    } else {
      setVoiceSupported(false);
    }
  }, []);

  // Trigger search via YouTube API endpoint
  const triggerSearch = async (searchTerm: string) => {
    const term = searchTerm.trim();
    if (!term) return;

    recordSearchTerm(term);
    setFrequentTerms(getFrequentSearchTerms(8));
    setLoading(true);
    setActiveChannel(null);

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.videos || [];
        setResults(list);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceToggle = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn("Speech recognition error", e);
      }
    }
  };

  const handlePlayDirectLink = () => {
    const raw = directLinkInput.trim();
    if (!raw) return;

    // Check if YouTube URL or ID
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

    recordWatchedVideo(directItem);
    onSelectVideo(directItem);
  };

  const openChannelCatalog = (channelName: string) => {
    setActiveChannel(channelName);
    setQuery(channelName);
    triggerSearch(`${channelName} official`);
  };

  // Filter video results locally according to active drawer settings
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

  return (
    <div className="discover-search-suite space-y-4">
      {/* Search Input Bar with Voice & Filter Trigger */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search songs, artists, channels or paste URL…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && triggerSearch(query)}
            className="w-full h-11 pl-10 pr-20 rounded-2xl bg-white/60 dark:bg-white/5 border border-white/40 dark:border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 backdrop-blur-xl shadow-sm"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {voiceSupported && (
            <button
              onClick={handleVoiceToggle}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "text-muted-foreground hover:text-foreground"
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
          className={`h-11 w-11 rounded-2xl shrink-0 border border-white/40 dark:border-white/10 ${
            filtersOpen ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/40" : ""
          }`}
          title="Search filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Voice Recognition Feedback HUD */}
      {isListening && (
        <div className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-500">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
          <span>Listening… speak your search terms now</span>
        </div>
      )}

      {/* Dynamic Topic Pills (Seamless gliding slide) */}
      <SeamlessSlideTrack showArrows={true}>
        {TOPIC_PILLS.map((topic) => (
          <button
            key={topic}
            onClick={() => {
              setActiveTopic(topic);
              if (topic !== "All") {
                setQuery(topic);
                void triggerSearch(topic);
              }
            }}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all duration-200 border ${
              activeTopic === topic
                ? "bg-white text-zinc-950 font-semibold shadow-md border-white"
                : "bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/[0.08]"
            }`}
          >
            {topic}
          </button>
        ))}
      </SeamlessSlideTrack>

      {/* Frequently Searched Dynamic Chips (Learned from localStorage) */}
      {frequentTerms.length > 0 && (
        <SeamlessSlideTrack>
          <span className="shrink-0 flex items-center gap-1.5 text-xs text-white/50 px-1 font-medium">
            <Sparkles className="h-3 w-3 text-white/70" />
            <span>Top Picks:</span>
          </span>
          {frequentTerms.map((term) => (
            <button
              key={term}
              onClick={() => {
                setQuery(term);
                void triggerSearch(term);
              }}
              className="shrink-0 px-3 py-1 rounded-full text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
            >
              {term}
            </button>
          ))}
        </SeamlessSlideTrack>
      )}

      {/* Dedicated Direct Link Player Input */}
      <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl">
        <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-white/90">
          <LinkIcon className="h-3.5 w-3.5 text-white/70" />
          <span>Direct Stream & Channel Link Player</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paste any YouTube video URL, MP4 link, or video ID…"
            value={directLinkInput}
            onChange={(e) => setDirectLinkInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePlayDirectLink()}
            className="flex-1 h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
          />
          <Button
            size="sm"
            onClick={handlePlayDirectLink}
            disabled={!directLinkInput.trim()}
            className="h-9 px-4 text-xs bg-white text-zinc-950 hover:bg-white/90 font-semibold rounded-xl"
          >
            <Play className="h-3 w-3 mr-1 fill-current" /> Play
          </Button>
        </div>
      </div>

      {/* Search Filters Drawer Panel */}
      {filtersOpen && (
        <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/90 border border-white/40 dark:border-white/10 shadow-2xl backdrop-blur-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-white/20 dark:border-white/10">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <SlidersHorizontal className="h-4 w-4 text-emerald-500" />
              <span>Search Filters & Parameters</span>
            </h3>
            <button
              onClick={() => setFiltersOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            {/* Duration Filter */}
            <div>
              <span className="block font-semibold mb-1.5 text-muted-foreground">Duration</span>
              <div className="space-y-1">
                {(["all", "short", "medium", "long"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setFilterDuration(d)}
                    className={`w-full text-left px-2.5 py-1 rounded-lg capitalize ${
                      filterDuration === d
                        ? "bg-emerald-500 text-white font-semibold"
                        : "text-foreground hover:bg-white/10"
                    }`}
                  >
                    {d === "short" ? "Short (< 4 min)" : d === "long" ? "Long (> 20 min)" : d}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Date Filter */}
            <div>
              <span className="block font-semibold mb-1.5 text-muted-foreground">Upload Date</span>
              <div className="space-y-1">
                {(["any", "today", "week", "month", "year"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => setFilterUploadDate(u)}
                    className={`w-full text-left px-2.5 py-1 rounded-lg capitalize ${
                      filterUploadDate === u
                        ? "bg-emerald-500 text-white font-semibold"
                        : "text-foreground hover:bg-white/10"
                    }`}
                  >
                    {u === "any" ? "Any time" : `This ${u}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quality & Features Toggles */}
          <div>
            <span className="block font-semibold mb-2 text-xs text-muted-foreground">
              Features & Quality
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "fourK", label: "4K Ultra HD" },
                { key: "hd", label: "HD High Res" },
                { key: "subtitles", label: "CC / Subtitles" },
                { key: "live", label: "Live Streams" },
                { key: "vr360", label: "360° / VR" },
                { key: "hdr", label: "HDR Color" },
              ].map(({ key, label }) => {
                const active = filterFeatures[key as keyof typeof filterFeatures];
                return (
                  <button
                    key={key}
                    onClick={() =>
                      setFilterFeatures({
                        ...filterFeatures,
                        [key]: !active,
                      })
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      active
                        ? "bg-emerald-500 text-white border-emerald-500 font-semibold"
                        : "border-white/30 dark:border-white/10 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Active Channel Catalog Header */}
      {activeChannel && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-500" />
            <span>
              Viewing channel catalog for <strong>{activeChannel}</strong>
            </span>
          </div>
          <button
            onClick={() => {
              setActiveChannel(null);
              triggerSearch(query);
            }}
            className="text-muted-foreground hover:text-foreground underline"
          >
            Clear channel filter
          </button>
        </div>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {loading ? "Searching media…" : `${filteredResults.length} Results`}
        </span>
      </div>

      {/* Compact Video Layout (Sleek One-Line Rows) */}
      <div className="space-y-1.5">
        {filteredResults.map((item) => (
          <div
            key={item.id}
            onClick={() => {
              recordWatchedVideo(item);
              onSelectVideo(item);
            }}
            className="group flex items-center justify-between p-2 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10 transition-all cursor-pointer shadow-sm"
          >
            {/* Left: Compact Thumbnail + Title & Channel in one tight block */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative w-16 h-11 shrink-0 rounded-xl overflow-hidden bg-black/10">
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {item.duration && (
                  <span className="absolute bottom-0.5 right-1 px-1 py-0.2 rounded bg-black/80 font-mono text-[9px] text-white">
                    {item.duration}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 pr-2">
                <strong className="block text-xs font-semibold text-foreground truncate group-hover:text-emerald-500 transition-colors">
                  {item.title}
                </strong>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate mt-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openChannelCatalog(item.channel);
                    }}
                    className="hover:underline hover:text-foreground font-medium truncate"
                  >
                    {item.channel}
                  </button>
                  {item.views && (
                    <>
                      <span>·</span>
                      <span className="shrink-0">{item.views}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Quick Action Buttons */}
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => {
                  recordWatchedVideo(item);
                  onSelectVideo(item);
                }}
                className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground flex items-center justify-center transition-colors"
                title="Play video"
              >
                <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
              </button>

              {onOpenDownloadModal && (
                <button
                  onClick={() => onOpenDownloadModal(item, "audio")}
                  className="h-8 w-8 rounded-full hover:bg-white/10 text-muted-foreground hover:text-emerald-500 flex items-center justify-center transition-colors"
                  title="Download options"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {!loading && filteredResults.length === 0 && (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <p>No video or audio results found for "{query}".</p>
            <p className="mt-1">
              Try tapping one of the topic pills above or searching for another term.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
