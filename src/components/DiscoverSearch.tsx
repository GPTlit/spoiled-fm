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
  POPULAR_MUSIC_HITS,
  DEFAULT_FEATURED_VIDEO,
  POPULAR_ARTIST_NAMES,
  type ArtistProfile,
  type ArtistVideo,
} from "@/lib/artist-catalog";

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

const TOPIC_PILLS = [
  "All",
  "Popular",
  "Music",
  "Hip-Hop",
  "Pop",
  "R&B",
  "Rock",
  "Electronic",
  "Jazz",
  "Acoustic",
  "Lo-Fi",
  "Live",
  "New Hits",
];

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
  const [results, setResults] = useState<VideoResult[]>(POPULAR_MUSIC_HITS);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [frequentTerms, setFrequentTerms] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [directLinkInput, setDirectLinkInput] = useState("");
  const [activeChannel, setActiveChannel] = useState<string | null>(externalArtist);
  const [isPopularMusicMode, setIsPopularMusicMode] = useState(true);

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

  // The active video is ALWAYS displayed directly on the screen in a normal box
  const currentVideo: VideoResult = activeVideo || internalVideo || DEFAULT_FEATURED_VIDEO;

  // Sync external artist selection from props
  useEffect(() => {
    if (externalArtist) {
      setActiveChannel(externalArtist);
      setIsPopularMusicMode(false);
    }
  }, [externalArtist]);

  useEffect(() => {
    setFrequentTerms(getFrequentSearchTerms());
  }, []);

  useEffect(() => {
    if (initialQuery.trim()) {
      setQuery(initialQuery);
      void triggerSearch(initialQuery);
    }
  }, [initialQuery]);

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

  const loadPopularMusic = async () => {
    setLoading(true);
    setIsPopularMusicMode(true);
    setActiveTopic("All");
    setActiveChannel(null);
    onSelectArtist?.(null);

    try {
      const res = await fetch("/api/youtube/search?q=popular+music+hits");
      if (res.ok) {
        const data = (await res.json()) as { results?: VideoResult[] };
        if (data.results && data.results.length > 0) {
          setResults(data.results);
          return;
        }
      }
    } catch {
      // Fallback to offline hits
    } finally {
      setLoading(false);
    }
    setResults(POPULAR_MUSIC_HITS);
  };

  const triggerSearch = async (term: string) => {
    const clean = term.trim();
    if (!clean) {
      void loadPopularMusic();
      return;
    }

    setLoading(true);
    setIsPopularMusicMode(false);
    recordSearchTerm(clean);
    setFrequentTerms(getFrequentSearchTerms());

    // Check if the query matches an artist name directly
    const matchedArtist = POPULAR_ARTIST_NAMES.find((a) => a.toLowerCase() === clean.toLowerCase());
    if (matchedArtist) {
      openArtistProfile(matchedArtist);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = (await res.json()) as { results?: VideoResult[] };
        if (data.results && data.results.length > 0) {
          setResults(data.results);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fallback
    }

    const filtered = POPULAR_MUSIC_HITS.filter(
      (item) =>
        item.title.toLowerCase().includes(clean.toLowerCase()) ||
        item.channel.toLowerCase().includes(clean.toLowerCase()),
    );
    setResults(filtered.length > 0 ? filtered : POPULAR_MUSIC_HITS);
    setLoading(false);
  };

  const handlePlayVideo = (vid: VideoResult) => {
    setInternalVideo(vid);
    recordWatchedVideo(vid);
    onSelectVideo(vid);
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
  };

  const openArtistProfile = (artistName: string) => {
    setActiveChannel(artistName);
    onSelectArtist?.(artistName);
    setIsPopularMusicMode(false);

    // If opening an artist, automatically set their top video into the player box if wanted
    const profile = ARTIST_PROFILES[artistName];
    if (profile && profile.featuredVideos.length > 0) {
      const topSong = profile.featuredVideos[0];
      handlePlayVideo(topSong);
    }
  };

  const closeArtistProfile = () => {
    setActiveChannel(null);
    onSelectArtist?.(null);
    void loadPopularMusic();
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

  const activeArtistProfile: ArtistProfile | null = activeChannel
    ? ARTIST_PROFILES[activeChannel] || null
    : null;

  return (
    <div className="explore-white-screen">
      {/* 1. NORMAL VIDEO BOX ALWAYS DIRECTLY ON THE SCREEN (No blinking buttons, clean normal white container) */}
      <div className="explore-normal-video-box">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-inner">
          <iframe
            key={currentVideo.id}
            src={`https://www.youtube-nocookie.com/embed/${currentVideo.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
            title={currentVideo.title}
            className="w-full h-full object-contain max-w-full block border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        {/* Video Information & Simple Clean Controls */}
        <div className="pt-3 pb-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
              {currentVideo.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
              <button
                onClick={() => openArtistProfile(currentVideo.channel)}
                className="font-semibold text-slate-900 hover:text-emerald-600 hover:underline flex items-center gap-1.5"
                title="View artist channel"
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
            {ARTIST_PROFILES[currentVideo.channel] && activeChannel !== currentVideo.channel && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openArtistProfile(currentVideo.channel)}
                className="h-8 px-3 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300"
              >
                <User className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Channel
              </Button>
            )}

            {onOpenDownloadModal && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenDownloadModal(currentVideo, "audio")}
                  className="h-8 px-3 text-xs font-semibold rounded-xl border-slate-300 hover:bg-slate-50 text-slate-700"
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

      {/* 2. Clean Search Input Bar */}
      <div className="relative flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search songs, artists, or paste YouTube link…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && triggerSearch(query)}
            className="w-full h-11 pl-10 pr-20 rounded-2xl bg-slate-50 hover:bg-white border border-slate-300 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors shadow-xs"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                void loadPopularMusic();
              }}
              className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {voiceSupported && (
            <button
              onClick={handleVoiceToggle}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${
                isListening ? "bg-red-500 text-white" : "text-slate-400 hover:text-slate-700"
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
          className={`h-11 w-11 rounded-2xl shrink-0 border border-slate-300 ${
            filtersOpen
              ? "bg-emerald-50 text-emerald-600 border-emerald-500"
              : "hover:bg-slate-50 text-slate-700"
          }`}
          title="Search filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Voice Recognition Feedback HUD */}
      {isListening && (
        <div className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600 mb-4">
          <span className="h-2 w-2 rounded-full bg-red-600" />
          <span>Listening… speak your search terms now</span>
        </div>
      )}

      {/* Search Filters Drawer Panel */}
      {filtersOpen && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm mb-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-sm font-bold flex items-center gap-1.5 text-slate-900">
              <SlidersHorizontal className="h-4 w-4 text-emerald-600" />
              <span>Search Filters</span>
            </h3>
            <button
              onClick={() => setFiltersOpen(false)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="block font-semibold mb-1.5 text-slate-500">Duration</span>
              <div className="space-y-1">
                {(["all", "short", "medium", "long"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setFilterDuration(d)}
                    className={`w-full text-left px-2.5 py-1 rounded-lg capitalize ${
                      filterDuration === d
                        ? "bg-emerald-600 text-white font-semibold"
                        : "text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {d === "short" ? "Short (< 4 min)" : d === "long" ? "Long (> 20 min)" : d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block font-semibold mb-1.5 text-slate-500">Upload Date</span>
              <div className="space-y-1">
                {(["any", "today", "week", "month", "year"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => setFilterUploadDate(u)}
                    className={`w-full text-left px-2.5 py-1 rounded-lg capitalize ${
                      filterUploadDate === u
                        ? "bg-emerald-600 text-white font-semibold"
                        : "text-slate-700 hover:bg-slate-200"
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

      {/* 3. Dynamic Topic Pills (Top gray scrollbar removed, only green slide indicator below) */}
      <div className="mb-4">
        <SeamlessSlideTrack showArrows={true}>
          {TOPIC_PILLS.map((topic) => {
            const isActive = activeTopic === topic;
            return (
              <button
                key={topic}
                onClick={() => {
                  setActiveTopic(topic);
                  if (topic === "All" || topic === "Popular") {
                    setQuery("");
                    void loadPopularMusic();
                  } else {
                    setQuery(topic);
                    void triggerSearch(topic);
                  }
                }}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-colors border cursor-pointer select-none shadow-xs ${
                  isActive
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
                }`}
              >
                {topic}
              </button>
            );
          })}
        </SeamlessSlideTrack>
      </div>

      {/* 4. REAL ARTIST CHANNELS QUICK SELECTOR (Official Channel Avatars) */}
      <div className="mb-5 pt-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-emerald-600" />
            <span>Popular Official Artist Channels</span>
          </span>
          {activeChannel && (
            <button
              onClick={closeArtistProfile}
              className="text-xs text-emerald-600 hover:underline font-semibold"
            >
              Show all popular hits
            </button>
          )}
        </div>

        <SeamlessSlideTrack showArrows={true}>
          {POPULAR_ARTIST_NAMES.map((name) => {
            const isSelected = activeChannel === name;
            const profile = ARTIST_PROFILES[name];
            return (
              <button
                key={name}
                onClick={() => openArtistProfile(name)}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-600 font-bold shadow-sm"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 font-semibold"
                }`}
              >
                {profile?.cover && (
                  <img
                    src={profile.cover}
                    alt={name}
                    className="w-5 h-5 rounded-full object-cover shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      if (profile.fallbackCover) {
                        e.currentTarget.src = profile.fallbackCover;
                      }
                    }}
                  />
                )}
                <span className="text-xs">{name}</span>
                {isSelected && <BadgeCheck className="h-3.5 w-3.5 text-white ml-0.5" />}
              </button>
            );
          })}
        </SeamlessSlideTrack>
      </div>

      {/* 5. REAL YOUTUBE CHANNEL PROFILE SCREEN (e.g. Billie Eilish with real avatar, verified badge, bio, and catalog) */}
      {activeArtistProfile ? (
        <div className="artist-profile-suite space-y-4 mb-4">
          {/* Authentic Artist Channel Header Banner */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-4 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <Button
                size="sm"
                variant="outline"
                onClick={closeArtistProfile}
                className="text-xs font-semibold gap-1.5 rounded-xl border-slate-300 hover:bg-white text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" /> Back to All Videos
              </Button>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> Official Artist Channel
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4">
              {/* Real Official Artist Avatar */}
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
                  <h2 className="text-xl font-bold text-slate-900">{activeArtistProfile.name}</h2>
                  <BadgeCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {activeArtistProfile.handle} · {activeArtistProfile.subscribers} ·{" "}
                  {activeArtistProfile.videosCount}
                </p>
                <p className="text-xs text-slate-600 mt-2 max-w-xl">{activeArtistProfile.bio}</p>

                <div className="flex items-center justify-center sm:justify-start gap-2.5 mt-4">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (activeArtistProfile.featuredVideos.length > 0) {
                        const first = activeArtistProfile.featuredVideos[0];
                        handlePlayVideo(first);
                      }
                    }}
                    className="h-9 px-4 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5 fill-current" /> Play Top Video
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const random =
                        activeArtistProfile.featuredVideos[
                          Math.floor(Math.random() * activeArtistProfile.featuredVideos.length)
                        ];
                      if (random) {
                        handlePlayVideo(random);
                      }
                    }}
                    className="h-9 px-4 text-xs font-semibold rounded-xl border-slate-300 hover:bg-white text-slate-700"
                  >
                    <Shuffle className="h-3.5 w-3.5 mr-1.5" /> Shuffle Songs
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Artist's Real YouTube Videos Catalog */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Film className="h-3.5 w-3.5 text-emerald-600" />
                <span>Official Videos by {activeArtistProfile.name}</span>
              </h3>
              <span className="text-xs font-mono text-slate-500">
                {activeArtistProfile.featuredVideos.length} Official Tracks
              </span>
            </div>

            <div className="space-y-2">
              {activeArtistProfile.featuredVideos.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handlePlayVideo(item)}
                  className="group flex items-center justify-between p-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 transition-all cursor-pointer shadow-xs"
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
                      <span className="absolute bottom-0.5 right-1 px-1 py-0.2 rounded bg-black/80 font-mono text-[9px] text-white">
                        {item.duration}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 pr-2">
                      <strong className="block text-xs font-bold text-slate-900 truncate group-hover:text-emerald-600 transition-colors">
                        {item.title}
                      </strong>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate mt-0.5">
                        <span>{item.channel}</span>
                        {item.views && (
                          <>
                            <span>·</span>
                            <span>{item.views}</span>
                          </>
                        )}
                        {item.date && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-700 font-mono">{item.date}</span>
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
                      className="h-8 w-8 rounded-full bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white flex items-center justify-center transition-colors"
                      title="Play video in screen"
                    >
                      <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                    </button>

                    {onOpenDownloadModal && (
                      <button
                        onClick={() => onOpenDownloadModal(item, "audio")}
                        className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-emerald-600 flex items-center justify-center transition-colors"
                        title="Download options"
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
      ) : (
        /* 6. Popular Music / Search Results List on Clean White Screen */
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between pt-1 px-1">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              {isPopularMusicMode ? (
                <>
                  <Flame className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span>Popular YouTube Music Hits</span>
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Search Results for "{query}"</span>
                </>
              )}
            </span>
            <span className="text-xs font-mono text-slate-500">
              {loading ? "Searching media…" : `${filteredResults.length} Videos`}
            </span>
          </div>

          <div className="space-y-2">
            {filteredResults.map((item) => (
              <div
                key={item.id}
                onClick={() => handlePlayVideo(item)}
                className="group flex items-center justify-between p-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 transition-all cursor-pointer shadow-xs"
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
                    <strong className="block text-xs font-bold text-slate-900 truncate group-hover:text-emerald-600 transition-colors">
                      {item.title}
                    </strong>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate mt-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openArtistProfile(item.channel);
                        }}
                        className="hover:underline hover:text-slate-900 font-semibold truncate"
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
                    className="h-8 w-8 rounded-full bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white flex items-center justify-center transition-colors"
                    title="Play video on screen"
                  >
                    <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                  </button>

                  {onOpenDownloadModal && (
                    <button
                      onClick={() => onOpenDownloadModal(item, "audio")}
                      className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-emerald-600 flex items-center justify-center transition-colors"
                      title="Download options"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {!loading && filteredResults.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="font-semibold text-slate-800">
                  No media results found for "{query}".
                </p>
                <p className="mt-1">
                  Tap one of the topic pills above or tap an artist to view their songs.
                </p>
                <Button
                  size="sm"
                  onClick={loadPopularMusic}
                  className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                >
                  Reload Popular Music
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Direct Link Stream Box */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs mt-4">
        <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-slate-900">
          <LinkIcon className="h-3.5 w-3.5 text-emerald-600" />
          <span>Play Any Direct Video / YouTube URL</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paste YouTube link, video ID, or media URL…"
            value={directLinkInput}
            onChange={(e) => setDirectLinkInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePlayDirectLink()}
            className="flex-1 h-9 px-3 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <Button
            size="sm"
            onClick={handlePlayDirectLink}
            disabled={!directLinkInput.trim()}
            className="h-9 px-4 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Play className="h-3 w-3 mr-1 fill-current" /> Play
          </Button>
        </div>
      </div>
    </div>
  );
}
