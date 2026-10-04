import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Compass,
  Disc3,
  Download,
  FolderPlus,
  Heart,
  Home,
  Library,
  ListMusic,
  Mic,
  MoreHorizontal,
  Music,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat2,
  Search,
  Send,
  Settings2,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Tv,
  Upload,
  User,
  UserCheck,
  Volume2,
  VolumeX,
  X,
  Youtube,
  Maximize2,
  Minimize2,
  Film,
  Check,
  Loader2,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import {
  PlayerProvider,
  usePlayer,
  fmt,
  type Track,
  EQ_FREQUENCIES,
  EQ_PRESETS,
  type EqPreset,
} from "@/lib/player";
import spoiledLiquidLogo from "@/assets/images/spoiled_liquid_icon_1790935677985.jpg";
import auroraBanner from "@/assets/images/aurora_glass_banner_1790935692854.jpg";
import featured from "@/assets/better-days.jpg";
import afterHours from "@/assets/after-hours.jpg";
import dawn from "@/assets/dawn-fm.jpg";
import tranquility from "@/assets/tranquility.jpg";
import ocean from "@/assets/ocean.jpg";
import night from "@/assets/night.jpg";
import sunflower from "@/assets/sunflower.jpg";
import Threads from "@/components/Threads";
import { parseLrc, findCurrentLrcIndex, type LrcLine } from "@/lib/lyrics";

type Screen =
  | "home"
  | "library"
  | "explore"
  | "profile"
  | "ai"
  | "settings"
  | "search"
  | "liked"
  | "now"
  | "lyrics"
  | "queue"
  | "album"
  | "playlist"
  | "watch"
  | "downloads";

type Tab = "Songs" | "Albums" | "Artists" | "Playlists";

const covers = [afterHours, dawn, tranquility, ocean, night, sunflower];
const coverFor = (name: string) =>
  covers[Math.abs([...name].reduce((n, c) => n + c.charCodeAt(0), 0)) % covers.length];

// 4 Primary navigation tabs with Profile in place of AI
const nav: { screen: Screen; label: string; icon: typeof Home }[] = [
  { screen: "home", label: "Home", icon: Home },
  { screen: "library", label: "Library", icon: Library },
  { screen: "explore", label: "Explore", icon: Compass },
  { screen: "profile", label: "Profile", icon: UserCheck },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SPOILED — Your music, your world" },
      {
        name: "description",
        content:
          "SPOILED is a personal music player for your own local music collection with liquid glass aesthetics.",
      },
      { property: "og:title", content: "SPOILED — Your music, your world" },
      {
        property: "og:description",
        content: "A personal music player for your own local music collection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PlayerProvider>
      <MusicApp />
    </PlayerProvider>
  ),
});

function Art({ track, className = "" }: { track?: Track | undefined; className?: string }) {
  const imgSrc = track?.pictureUrl || (track ? coverFor(track.album) : spoiledLiquidLogo);
  return (
    <div className={`art ${className}`}>
      <img src={imgSrc} alt={track ? `${track.album} artwork` : "SPOILED"} />
    </div>
  );
}

function getYoutubeEmbedUrl(id: string): string {
  if (!id) return "";
  if (id.startsWith("search_query=")) {
    const q = id.replace("search_query=", "");
    return `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(decodeURIComponent(q))}&autoplay=1`;
  }
  if (id.length === 11 && !id.includes(" ")) {
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&enablejsapi=1&playsinline=1&rel=0`;
  }
  return `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(id)}&autoplay=1`;
}

interface AiRecommendation {
  title: string;
  artist: string;
  vibe: string;
  reason: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  recommendations?: AiRecommendation[];
}

function MusicApp() {
  const p = usePlayer();
  const queryClient = useQueryClient();
  const [account, setAccount] = useState<SupabaseUser | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountBusy, setAccountBusy] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [tab, setTab] = useState<Tab>("Songs");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("Recently Added");
  const [selectedAlbum, setSelectedAlbum] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [playlists, setPlaylists] = useState<{ name: string; ids: string[] }[]>([
    { name: "Chill Vibes", ids: [] },
  ]);
  const [selectedPlaylist, setSelectedPlaylist] = useState("Chill Vibes");
  const [menu, setMenu] = useState<string | null>(null);
  const [theme, setTheme] = useState("Liquid Glass (Light)");
  const [message, setMessage] = useState("");
  const files = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const lrcInput = useRef<HTMLInputElement>(null);
  const [previous, setPrevious] = useState<Screen>("home");
  const [lyrics, setLyrics] = useState<Record<string, string>>({});
  const [lyricDraft, setLyricDraft] = useState("");

  // AI Curator State
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Welcome to SPOILED. I am your music curator. Ask me for artist deep-dives, recommendations matching your taste, or vibe curation.",
      recommendations: [
        {
          title: "Midnight City",
          artist: "M83",
          vibe: "Euphoric Synthwave",
          reason: "Rich atmospheric layers and soaring saxophone climax for late-night immersion.",
        },
        {
          title: "White Ferrari",
          artist: "Frank Ocean",
          vibe: "Intimate Ambient Soul",
          reason: "Minimal acoustic framing and haunting vocal harmonics.",
        },
      ],
    },
  ]);

  // VidMate-style Online Video & YouTube State
  interface OnlineVideo {
    id: string;
    title: string;
    channel: string;
    duration?: string;
    thumbnail: string;
    views?: string;
  }

  interface DownloadTask {
    id: string;
    videoId: string;
    title: string;
    channel: string;
    thumbnail: string;
    type: "audio" | "video";
    quality: string;
    status: "downloading" | "saving" | "completed" | "error";
    progress: number;
    error?: string;
  }

  const [searchScope, setSearchScope] = useState<"all" | "online" | "local">("all");
  const [onlineVideos, setOnlineVideos] = useState<OnlineVideo[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [activeWatchVideo, setActiveWatchVideo] = useState<OnlineVideo | null>(null);
  const [isPipMode, setIsPipMode] = useState(false);
  const [youtubeQuery, setYoutubeQuery] = useState("");
  const [relatedVideos, setRelatedVideos] = useState<OnlineVideo[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadModalVideo, setDownloadModalVideo] = useState<OnlineVideo | null>(null);
  const [downloadType, setDownloadType] = useState<"video" | "audio">("audio");
  const [selectedQuality, setSelectedQuality] = useState<string>("320");
  const [downloadInProgress, setDownloadInProgress] = useState(false);
  const [downloadProgressText, setDownloadProgressText] = useState("");
  const [downloadQueue, setDownloadQueue] = useState<DownloadTask[]>([]);
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [directDownloadOpen, setDirectDownloadOpen] = useState(false);
  const [directDownloadQuery, setDirectDownloadQuery] = useState("");
  const [directDownloadLoading, setDirectDownloadLoading] = useState(false);
  const [permissionsState, setPermissionsState] = useState<Record<string, boolean>>({
    storage: true,
    audio: true,
    notifications: false,
    camera: false,
  });
  const [downloads, setDownloads] = useState<{ id: string; title: string; status: string }[]>([]);

  // Track editing & thumbnail state
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editInfoDraft, setEditInfoDraft] = useState({ title: "", artist: "", album: "" });
  const [editArtworkPreview, setEditArtworkPreview] = useState<string | null>(null);
  const [editArtworkBlob, setEditArtworkBlob] = useState<Blob | null>(null);
  const editArtworkInputRef = useRef<HTMLInputElement>(null);
  const [deletingTrack, setDeletingTrack] = useState<Track | null>(null);

  // Download History Persistence (for full page Downloads view)
  interface DownloadHistoryItem {
    id: string;
    videoId: string;
    title: string;
    channel: string;
    thumbnail: string;
    quality: string;
    type: "audio" | "video";
    downloadedAt: string;
    trackId?: string;
    fallbackUrl?: string;
  }

  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>(() => {
    try {
      const raw =
        typeof window !== "undefined" ? localStorage.getItem("spoiled-download-history") : null;
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("spoiled-download-history", JSON.stringify(downloadHistory));
      }
    } catch {
      // ignore
    }
  }, [downloadHistory]);

  const [savedReady, setSavedReady] = useState(false);
  const pendingArtwork = useRef<{ previousIds: Set<string>; thumbnail: string } | null>(null);
  useEffect(() => {
    const pending = pendingArtwork.current;
    if (!pending) return;
    const track = p.library.find((item) => !pending.previousIds.has(item.id));
    if (!track) return;
    pendingArtwork.current = null;
    void fetch(`/api/proxy-image?url=${encodeURIComponent(pending.thumbnail)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Artwork unavailable");
        return response.blob();
      })
      .then((blob) => p.setTrackArtwork(track.id, blob))
      .catch(() => {});
  }, [p.library]);

  // Synchronized Lyrics
  const currentLyricText = p.current ? lyrics[p.current.id] || "" : "";
  const parsedLrc = useMemo(() => parseLrc(currentLyricText), [currentLyricText]);
  const activeLrcIndex = useMemo(() => findCurrentLrcIndex(parsedLrc, p.time), [parsedLrc, p.time]);
  const lrcContainerRef = useRef<HTMLDivElement>(null);

  // Auto-fetch synced lyrics from open synced lyrics database if not available locally
  useEffect(() => {
    if (!p.current) return;
    const trackId = p.current.id;
    if (lyrics[trackId]) return;

    let cancelled = false;
    const cleanTitle = p.current.title.replace(/\(.*?\)|\[.*?\]/g, "").trim();
    const cleanArtist = p.current.artist.replace(/\(.*?\)|\[.*?\]/g, "").trim();
    const dur = Math.round(p.current.duration || 0);

    fetch(
      `/api/lyrics?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}&duration=${dur}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error("Lyrics unavailable");
        return res.json();
      })
      .then((data: { syncedLyrics?: string; plainLyrics?: string }) => {
        if (!cancelled) {
          const lrc = data.syncedLyrics || data.plainLyrics;
          if (lrc) {
            setLyrics((prev) => ({ ...prev, [trackId]: lrc }));
          }
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [p.current?.id, p.current?.title, p.current?.artist]);

  useEffect(() => {
    if (activeLrcIndex >= 0 && lrcContainerRef.current) {
      const activeEl = lrcContainerRef.current.children[activeLrcIndex] as HTMLElement;
      if (activeEl) {
        const container = lrcContainerRef.current;
        container.scrollTo({
          top:
            activeEl.offsetTop -
            container.offsetTop -
            container.clientHeight / 2 +
            activeEl.clientHeight / 2,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
      }
    }
  }, [activeLrcIndex]);

  // Supabase Auth listener
  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (mounted) {
          setAccount(data.user);
          setAccountLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setAccountLoading(false);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setAccount(session?.user ?? null);
        setAccountLoading(false);
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async () => {
    setAccountBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error)
        setMessage(result.error.message || "Google sign-in could not be completed.");
    } catch {
      setMessage("Google sign-in could not be completed. Please try again.");
    } finally {
      setAccountBusy(false);
    }
  };

  const signOut = async () => {
    setAccountBusy(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setAccount(null);
      setMessage("Signed out. Your music stays on this device.");
    } catch {
      setMessage("Could not sign out. Please try again.");
    } finally {
      setAccountBusy(false);
    }
  };

  const accountName =
    account?.user_metadata?.["full_name"] ||
    account?.user_metadata?.["name"] ||
    account?.email ||
    "Salem";

  const accountControl = accountLoading ? (
    <div className="account-status">Checking account…</div>
  ) : account ? (
    <div className="account-controls">
      <div className="account-identity">
        {typeof account.user_metadata?.["avatar_url"] === "string" && (
          <img src={account.user_metadata["avatar_url"]} alt="" referrerPolicy="no-referrer" />
        )}
        <span>
          <strong>{accountName}</strong>
          <small>{account.email}</small>
        </span>
      </div>
      <Button variant="outline" onClick={signOut} disabled={accountBusy}>
        Sign out
      </Button>
    </div>
  ) : (
    <Button variant="outline" onClick={signIn} disabled={accountBusy}>
      Sign in with Google
    </Button>
  );

  // Local storage persistence for playlists & lyrics
  useEffect(() => {
    try {
      const savedPlaylists = JSON.parse(localStorage.getItem("spoiled-playlists") || "[]");
      const savedLyrics = JSON.parse(localStorage.getItem("spoiled-lyrics") || "{}");
      if (Array.isArray(savedPlaylists) && savedPlaylists.length) setPlaylists(savedPlaylists);
      if (savedLyrics && typeof savedLyrics === "object" && !Array.isArray(savedLyrics))
        setLyrics(savedLyrics);
    } catch {
      /* Ignore invalid previous browser data. */
    }
    setSavedReady(true);
  }, []);

  useEffect(() => {
    if (savedReady) localStorage.setItem("spoiled-playlists", JSON.stringify(playlists));
  }, [playlists, savedReady]);

  useEffect(() => {
    if (savedReady) localStorage.setItem("spoiled-lyrics", JSON.stringify(lyrics));
  }, [lyrics, savedReady]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if (e.code === "Space") {
        e.preventDefault();
        p.toggle();
      } else if (e.code === "ArrowRight") {
        if (e.shiftKey) {
          e.preventDefault();
          p.next();
        } else {
          e.preventDefault();
          p.seek(Math.min(p.duration, p.time + 5));
        }
      } else if (e.code === "ArrowLeft") {
        if (e.shiftKey) {
          e.preventDefault();
          p.prev();
        } else {
          e.preventDefault();
          p.seek(Math.max(0, p.time - 5));
        }
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        p.setVolume(p.volume > 0 ? 0 : 0.85);
        setMessage(p.volume > 0 ? "Muted" : "Unmuted");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [p]);

  const playerOrigin = useRef<Screen>("home");
  const go = (next: Screen) => {
    if (["now", "lyrics", "queue"].includes(next) && !["now", "lyrics", "queue"].includes(screen))
      playerOrigin.current = screen;
    setPrevious(screen);
    setScreen(next);
    setMenu(null);
  };

  const back = () => {
    setScreen(previous === screen ? "home" : previous);
    setMenu(null);
  };

  const list = useMemo(() => {
    let tracks = [...p.library];
    if (screen === "liked") tracks = tracks.filter((t) => t.liked);
    if (screen === "search" && query.trim())
      tracks = tracks.filter((t) =>
        `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(query.toLowerCase()),
      );
    if (screen === "album") tracks = tracks.filter((t) => t.album === selectedAlbum);
    if (screen === "playlist")
      tracks = tracks.filter((t) =>
        playlists.find((x) => x.name === selectedPlaylist)?.ids.includes(t.id),
      );
    if (sort === "Title A–Z") tracks.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "Artist A–Z") tracks.sort((a, b) => a.artist.localeCompare(b.artist));
    return tracks;
  }, [p.library, screen, query, selectedAlbum, selectedPlaylist, playlists, sort]);

  const albums = useMemo(() => [...new Set(p.library.map((t) => t.album))], [p.library]);
  const artists = useMemo(() => [...new Set(p.library.map((t) => t.artist))], [p.library]);

  const playList = (tracks: Track[], shuffle = false) => {
    if (!tracks.length) return;
    const ids = tracks.map((t) => t.id);
    if (shuffle) ids.sort(() => Math.random() - 0.5);
    const first = ids[0];
    if (first) p.playTrack(first, ids);
  };

  const addPlaylist = () => {
    const name = playlistName.trim();
    if (name && !playlists.some((x) => x.name === name)) {
      setPlaylists((v) => [...v, { name, ids: [] }]);
      setPlaylistName("");
      setMessage(`Created playlist "${name}"`);
    }
  };

  const addToPlaylist = (id: string, name: string) => {
    setPlaylists((v) =>
      v.map((x) => (x.name === name ? { ...x, ids: [...new Set([...x.ids, id])] } : x)),
    );
    setMenu(null);
    setMessage(`Added to ${name}`);
  };

  // VidMate-Style Online Video Search & Playback
  const searchOnlineVideos = useCallback(async (q: string) => {
    const queryStr = q.trim();
    if (!queryStr) {
      setOnlineVideos([]);
      return;
    }
    setOnlineLoading(true);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(queryStr)}`);
      const data = (await res.json()) as { videos?: OnlineVideo[] };
      setOnlineVideos(data.videos || []);
    } catch (e) {
      console.error("Online video search error", e);
      setOnlineVideos([]);
    } finally {
      setOnlineLoading(false);
    }
  }, []);

  useEffect(() => {
    void searchOnlineVideos("music");
  }, [searchOnlineVideos]);

  const playOnlineTrack = (video: OnlineVideo) => {
    const trackId = `stream_${video.id}`;
    const streamUrl = `/api/audio/stream?id=${encodeURIComponent(video.id)}&title=${encodeURIComponent(video.title)}&artist=${encodeURIComponent(video.channel)}`;

    const existingTrack = p.library.find((t) => t.id === trackId || t.id === video.id);
    if (existingTrack) {
      p.playTrack(existingTrack.id);
    } else {
      const streamTrack: Track = {
        id: trackId,
        title: video.title,
        artist: video.channel,
        album: "Online Stream",
        url: streamUrl,
        pictureUrl: video.thumbnail,
        hue: 190,
      };
      p.playTrack(streamTrack.id, [streamTrack.id, ...p.queue]);
    }
    setMessage(`Playing "${video.title}" in SPOILED player`);
  };

  const watchVideo = (video: OnlineVideo, pip = false) => {
    if (p.playing) p.toggle(); // Gracefully pause local audio when watching video
    setActiveWatchVideo(video);
    setIsPipMode(pip);
    if (!pip) {
      go("watch");
    }
  };

  // Fetch related songs whenever activeWatchVideo changes
  useEffect(() => {
    if (!activeWatchVideo) return;
    let cancelled = false;
    setRelatedLoading(true);

    const artist = activeWatchVideo.channel || "";
    const cleanTitle = activeWatchVideo.title
      .replace(/\(.*?\)|\[.*?\]/g, "")
      .replace(/ft\..*|feat\..*/i, "")
      .trim();
    const q = `${artist} ${cleanTitle} songs`.trim() || activeWatchVideo.title;

    fetch(
      `/api/video/related?q=${encodeURIComponent(q)}&id=${encodeURIComponent(activeWatchVideo.id)}`,
    )
      .then((res) => res.json())
      .then((data: { videos?: OnlineVideo[] }) => {
        if (!cancelled) {
          setRelatedVideos(data.videos || []);
          setRelatedLoading(false);
        }
      })
      .catch((err) => {
        console.error("Related songs error:", err);
        if (!cancelled) {
          setRelatedVideos([]);
          setRelatedLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeWatchVideo]);

  const requestPermission = async (key: string) => {
    if (key === "notifications" && typeof Notification !== "undefined") {
      try {
        const res = await Notification.requestPermission();
        setPermissionsState((prev) => ({ ...prev, notifications: res === "granted" }));
        setMessage(
          res === "granted" ? "Notifications enabled for audio playback" : "Notifications declined",
        );
      } catch {
        setMessage("Notification permission prompt closed");
      }
      return;
    }
    if (key === "camera" && typeof navigator !== "undefined" && navigator.mediaDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((track) => track.stop());
        setPermissionsState((prev) => ({ ...prev, camera: true }));
        setMessage("Camera & Photo access active");
      } catch {
        setMessage("Camera permission was dismissed");
      }
      return;
    }
    setPermissionsState((prev) => ({ ...prev, [key]: true }));
    setMessage("Permission active");
  };

  const startDownloadTask = async (
    video: OnlineVideo,
    type: "audio" | "video" = "audio",
    quality: string = type === "audio" ? "320" : "720",
    exportFile: boolean = false,
  ) => {
    const taskId = crypto.randomUUID();
    const newTask: DownloadTask = {
      id: taskId,
      videoId: video.id,
      title: video.title,
      channel: video.channel,
      thumbnail: video.thumbnail,
      type,
      quality,
      status: "downloading",
      progress: 15,
    };

    setDownloadQueue((prev) => [newTask, ...prev.filter((t) => t.videoId !== video.id)]);
    setMessage(`Downloading "${video.title}" directly...`);

    const interval = setInterval(() => {
      setDownloadQueue((prev) =>
        prev.map((t) =>
          t.id === taskId && t.status === "downloading"
            ? { ...t, progress: Math.min(88, t.progress + 12) }
            : t,
        ),
      );
    }, 700);

    try {
      const url = `/api/video/download?id=${encodeURIComponent(video.id)}&type=${type}&quality=${encodeURIComponent(quality)}&title=${encodeURIComponent(video.title)}&artist=${encodeURIComponent(video.channel)}`;
      const res = await fetch(url);
      clearInterval(interval);

      if (!res.ok) {
        throw new Error(`Download failed with status ${res.status}`);
      }

      setDownloadQueue((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "saving", progress: 92 } : t)),
      );

      const blob = await res.blob();
      const ext = type === "audio" ? (quality === "128" ? "m4a" : "mp3") : "mp4";
      const sanitized = video.title.replace(/[^\w\s.-]/gi, "").trim() || "spoiled-media";

      let addedTrackId = "";

      if (type === "audio") {
        let pictureBlob: Blob | undefined;
        try {
          const imgRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(video.thumbnail)}`);
          if (imgRes.ok) {
            pictureBlob = await imgRes.blob();
          }
        } catch {
          try {
            const direct = await fetch(video.thumbnail);
            if (direct.ok) pictureBlob = await direct.blob();
          } catch {
            /* ignore */
          }
        }

        const file = new File([blob], `${sanitized}.${ext}`, {
          type: ext === "mp3" ? "audio/mpeg" : "audio/mp4",
        });

        const createdTrack = await p.addTrackWithArtwork(file, pictureBlob, {
          title: video.title,
          artist: video.channel,
          album: "SPOILED Downloads",
        });
        addedTrackId = createdTrack.id;

        if (exportFile) {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `${sanitized}.${ext}`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(link.href), 10000);
        }

        setDownloadQueue((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "completed", progress: 100 } : t)),
        );
        setMessage(`Saved "${video.title}" directly to your library!`);
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${sanitized}.mp4`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 10000);

        setDownloadQueue((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "completed", progress: 100 } : t)),
        );
        setMessage(`Video "${video.title}" saved to device!`);
      }

      // Add to persistent download history
      setDownloadHistory((prev) => [
        {
          id: taskId,
          videoId: video.id,
          title: video.title,
          channel: video.channel,
          thumbnail: video.thumbnail,
          quality: type === "audio" ? `${quality} kbps ${ext.toUpperCase()}` : `${quality}p MP4`,
          type,
          downloadedAt: new Date().toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          trackId: addedTrackId,
        },
        ...prev.filter((h) => h.videoId !== video.id),
      ]);
    } catch (err: unknown) {
      clearInterval(interval);
      console.error("Direct download error:", err);

      setDownloadQueue((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "error", progress: 0 } : t)),
      );
      setMessage(`Could not download "${video.title}". Please try again.`);
    }
  };

  const openDownloadModal = (video: OnlineVideo, defaultType: "video" | "audio" = "audio") => {
    setDownloadModalVideo(video);
    setDownloadType(defaultType);
    setSelectedQuality(defaultType === "audio" ? "320" : "720");
    setDownloadProgressText("");
    setDownloadInProgress(false);
    setDownloadModalOpen(true);
  };

  const handleDownloadFile = async () => {
    if (!downloadModalVideo) return;
    const vid = downloadModalVideo;
    const t = downloadType;
    const q = selectedQuality;
    setDownloadModalOpen(false);
    void startDownloadTask(vid, t, q, t === "audio");
  };

  const handleSaveToLocalLibrary = async () => {
    if (!downloadModalVideo) return;
    const vid = downloadModalVideo;
    const q = selectedQuality || "320";
    setDownloadModalOpen(false);
    void startDownloadTask(vid, "audio", q, false);
  };

  const playYoutube = (target: string) => {
    watchVideo({
      id: target.includes(" ") ? `search_query=${encodeURIComponent(target)}` : target,
      title: target,
      channel: "YouTube",
      thumbnail:
        "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop",
    });
  };

  useEffect(() => {
    if (screen !== "search") return;
    const q = query.trim();
    if (!q) {
      setOnlineVideos([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchOnlineVideos(q);
    }, 450);
    return () => clearTimeout(timer);
  }, [query, screen, searchOnlineVideos]);

  const handleAiSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = aiText.trim();
    if (!prompt || aiLoading) return;
    setAiText("");
    setAiHistory((prev) => [...prev, { role: "user", text: prompt }]);
    setAiLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          library: p.library.map((t) => ({ title: t.title, artist: t.artist, album: t.album })),
        }),
      });
      const data = await res.json();
      setAiHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply || "Here are personalized selections tailored for you.",
          recommendations: data.recommendations,
        },
      ]);
    } catch {
      setAiHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "I've picked out songs with rich atmospheric mood for you.",
          recommendations: [
            {
              title: "Weightless",
              artist: "Marconi Union",
              vibe: "Liquid Ambient",
              reason: "Gentle rhythmic ebb and harmonic drift.",
            },
          ],
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // Export JSON Backup
  const handleExportBackup = async () => {
    const jsonStr = await p.exportBackup();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spoiled-music-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Library backup exported.");
  };

  // Import JSON Backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const ok = await p.importBackup(text);
    if (ok) {
      try {
        const savedPlaylists = JSON.parse(localStorage.getItem("spoiled-playlists") || "[]");
        const savedLyrics = JSON.parse(localStorage.getItem("spoiled-lyrics") || "{}");
        if (Array.isArray(savedPlaylists)) setPlaylists(savedPlaylists);
        if (savedLyrics && typeof savedLyrics === "object") setLyrics(savedLyrics);
      } catch {
        /* Ignore */
      }
      setMessage("Library backup imported successfully.");
    } else {
      setMessage("Could not parse backup JSON file.");
    }
    e.target.value = "";
  };

  // Upload .LRC File
  const handleLrcUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !p.current) return;
    const text = await file.text();
    setLyrics((prev) => ({ ...prev, [p.current!.id]: text }));
    setMessage(`Synchronized lyrics saved for "${p.current.title}".`);
    e.target.value = "";
  };

  const rows = (tracks: Track[]) =>
    tracks.length ? (
      <div className="track-list">
        {tracks.map((t, idx) => (
          <div key={t.id} className="track-row">
            <Button
              variant="ghost"
              className="track-main"
              onClick={() =>
                p.playTrack(
                  t.id,
                  tracks.map((x) => x.id),
                )
              }
              title={`Play ${t.title}`}
            >
              <span className="text-xs font-semibold text-muted-foreground w-5 text-center shrink-0">
                {idx + 1}
              </span>
              <Art track={t} className="track-art shrink-0" />
              <div className="track-copy">
                <strong>{t.title}</strong>
                <small>
                  {t.artist} {t.album ? `· ${t.album}` : ""}
                </small>
              </div>
            </Button>
            <span className="track-duration">{t.duration ? fmt(t.duration) : ""}</span>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
              title={`Options for ${t.title}`}
              onClick={() => setMenu(menu === t.id ? null : t.id)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {menu === t.id && (
              <div className="row-menu">
                <Button
                  variant="ghost"
                  onClick={() => {
                    p.playTrack(
                      t.id,
                      tracks.map((x) => x.id),
                    );
                    setMenu(null);
                  }}
                >
                  <Play className="mr-2 h-4 w-4" /> Play
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    p.enqueue(t.id);
                    setMenu(null);
                    setMessage("Added to play next");
                  }}
                >
                  <ListMusic className="mr-2 h-4 w-4" /> Play next
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingTrack(t);
                    setEditInfoDraft({
                      title: t.title,
                      artist: t.artist,
                      album: t.album,
                    });
                    setEditArtworkPreview(t.pictureUrl || null);
                    setEditArtworkBlob(null);
                    setMenu(null);
                  }}
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4 text-emerald-500" /> Edit name &
                  thumbnail
                </Button>
                <Button
                  variant="ghost"
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  onClick={() => {
                    setDeletingTrack(t);
                    setMenu(null);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete from library
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    p.toggleLike(t.id);
                    setMenu(null);
                  }}
                >
                  <Heart className={`mr-2 h-4 w-4 ${t.liked ? "filled-heart" : ""}`} />
                  {t.liked ? "Remove from loved" : "Love song"}
                </Button>
                {playlists.map((x) => (
                  <Button key={x.name} variant="ghost" onClick={() => addToPlaylist(t.id, x.name)}>
                    Add to {x.name}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedAlbum(t.album);
                    go("album");
                  }}
                >
                  Go to album
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    ) : (
      <Empty
        onAdd={() => files.current?.click()}
        onLoadSamples={async () => {
          setMessage("Loading high-fidelity sample music...");
          const count = await p.loadSampleMusic();
          setMessage(`${count} sample songs loaded to your library!`);
        }}
        label={
          screen === "liked"
            ? "No loved songs yet"
            : screen === "search"
              ? "No songs found"
              : "Your music belongs here"
        }
      />
    );

  const albumGrid = (names: string[]) =>
    names.length ? (
      <div className="album-grid">
        {names.map((name) => (
          <Button
            key={name}
            variant="ghost"
            className="album-tile"
            onClick={() => {
              setSelectedAlbum(name);
              go("album");
            }}
          >
            <img src={coverFor(name)} alt="" />
            <strong>{name}</strong>
            <small>
              {p.library.find((t) => t.album === name)?.artist} ·{" "}
              {p.library.filter((t) => t.album === name).length} songs
            </small>
          </Button>
        ))}
      </div>
    ) : (
      <Empty onAdd={() => folder.current?.click()} label="No albums yet" />
    );

  const activeNav = (
    [
      "now",
      "lyrics",
      "queue",
      "album",
      "playlist",
      "liked",
      "search",
      "settings",
      "downloads",
    ] as Screen[]
  ).includes(screen)
    ? previous
    : screen;

  const isDark = theme.toLowerCase().includes("dark") || theme.toLowerCase().includes("obsidian");

  return (
    <div
      className={`app-shell ${isDark ? "dark" : ""} ${["now", "lyrics", "queue"].includes(screen) ? "immersive-player" : ""} ${["home", "library"].includes(screen) ? "scroll-page" : "fixed-page"}`}
    >
      <div className="ambient-liquid-orbs" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <input
        ref={files}
        type="file"
        accept="audio/*,.flac,.mp3,.wav,.m4a,.ogg,.aac"
        multiple
        hidden
        onChange={async (e) => {
          if (e.target.files?.length) {
            const count = await p.addFiles(e.target.files);
            setMessage(`${count} song${count === 1 ? "" : "s"} imported with tags`);
            e.target.value = "";
          }
        }}
      />
      <input
        ref={folder}
        type="file"
        multiple
        hidden
        {...({ webkitdirectory: "" } as object)}
        onChange={async (e) => {
          if (e.target.files?.length) {
            const count = await p.addFiles(e.target.files);
            setMessage(`${count} songs imported from folder`);
            e.target.value = "";
          }
        }}
      />
      <input ref={backupInput} type="file" accept=".json" hidden onChange={handleImportBackup} />
      <input ref={lrcInput} type="file" accept=".lrc,.txt" hidden onChange={handleLrcUpload} />

      {/* Android Dynamic Notch / Island widget */}
      {p.current && !["now", "lyrics", "queue"].includes(screen) && (
        <div
          className="android-notch-island"
          onClick={() => go("now")}
          role="button"
          tabIndex={0}
          title="Open Now Playing"
        >
          <div className="notch-thumb">
            <Art track={p.current} />
          </div>
          <div className="notch-details">
            <span className="notch-title">{p.current.title}</span>
            <span className="notch-artist">{p.current.artist}</span>
          </div>
          <div className="notch-wave-bars" aria-hidden="true">
            <span className={`notch-bar ${p.playing ? "animating" : ""}`} />
            <span className={`notch-bar ${p.playing ? "animating" : ""}`} />
            <span className={`notch-bar ${p.playing ? "animating" : ""}`} />
          </div>
          <button
            type="button"
            className="notch-action-btn"
            title={p.playing ? "Pause" : "Play"}
            onClick={(e) => {
              e.stopPropagation();
              p.toggle();
            }}
          >
            {p.playing ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
            )}
          </button>
        </div>
      )}

      <div className="app-layout">
        {!["now", "lyrics", "queue"].includes(screen) && (
          <aside className="desktop-sidebar">
            <div className="brand-badge">
              <div className="brand-icon-wrapper">
                <img src={spoiledLiquidLogo} alt="SPOILED" className="brand-logo" />
              </div>
              <div className="brand-text">
                <span className="brand-title">SPOILED</span>
                <span className="brand-tag">LIQUID GLASS AUDIO</span>
              </div>
            </div>
            <p className="sidebar-heading">YOUR MUSIC, YOUR WORLD</p>
            <div className="sidebar-nav">
              {nav.map(({ screen: s, label, icon: Icon }) => (
                <Button
                  key={s}
                  variant="ghost"
                  className={`nav-sidebar-white-btn ${activeNav === s ? "selected" : ""}`}
                  onClick={() => go(s)}
                >
                  <Icon />
                  {label}
                </Button>
              ))}
              <Button
                variant="ghost"
                className={activeNav === "search" ? "selected" : ""}
                onClick={() => go("search")}
              >
                <Search />
                Search
              </Button>
              <Button
                variant="ghost"
                className={activeNav === "liked" ? "selected" : ""}
                onClick={() => go("liked")}
              >
                <Heart />
                Loved songs
              </Button>
              <Button
                variant="ghost"
                className={`btn-liquid-glass ${screen === "downloads" ? "selected" : ""}`}
                onClick={() => go("downloads")}
              >
                <Download />
                <span>Downloads</span>
                {downloadQueue.filter((d) => d.status === "downloading" || d.status === "saving")
                  .length > 0 && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                    {
                      downloadQueue.filter(
                        (d) => d.status === "downloading" || d.status === "saving",
                      ).length
                    }
                  </span>
                )}
              </Button>
            </div>
            <div className="sidebar-bottom">
              <div className="sidebar-account">{accountControl}</div>
              <Button variant="ghost" onClick={() => go("settings")}>
                <Settings2 />
                Settings
              </Button>
              <Button className="add-music-btn" onClick={() => files.current?.click()}>
                <Plus />
                Add music
              </Button>
            </div>
          </aside>
        )}

        <main className="main-screen">
          {screen === "home" && (
            <>
              <div className="topline">
                <div className="topline-brand">
                  <img src={spoiledLiquidLogo} alt="" className="topline-icon" />
                  <span>SPOILED</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="glass-icon-btn relative shrink-0"
                    title="Downloads & offline library"
                    onClick={() => go("downloads")}
                  >
                    <Download className="h-4 w-4" />
                    {downloadQueue.filter(
                      (d) => d.status === "downloading" || d.status === "saving",
                    ).length > 0 && (
                      <span className="top-action-badge animate-pulse">
                        {
                          downloadQueue.filter(
                            (d) => d.status === "downloading" || d.status === "saving",
                          ).length
                        }
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="glass-icon-btn"
                    title="Settings"
                    onClick={() => go("settings")}
                  >
                    <Settings2 />
                  </Button>
                </div>
              </div>

              <header className="home-head">
                <p>
                  Good{" "}
                  {new Date().getHours() < 12
                    ? "morning"
                    : new Date().getHours() < 18
                      ? "afternoon"
                      : "evening"}
                  ,
                </p>
                <h1>
                  your music{" "}
                  <span className="liquid-soundwave" aria-hidden="true">
                    <span className="wave-bar bar-1" />
                    <span className="wave-bar bar-2" />
                    <span className="wave-bar bar-3" />
                    <span className="wave-bar bar-4" />
                    <span className="wave-bar bar-5" />
                  </span>
                </h1>
              </header>

              <Button variant="ghost" className="search-pill" onClick={() => go("search")}>
                <Search />
                Search your music…
                <Mic className="search-mic" />
              </Button>

              {/* Interactive Threads WebGL Component Banner */}
              <div className="threads-hero-card">
                <div className="threads-canvas-wrapper">
                  <Threads amplitude={1.25} distance={0.02} enableMouseInteraction />
                </div>
                <div className="threads-hero-content">
                  <h2>Living Soundscapes</h2>
                  <p>Move your cursor to sculpt reactive fluid sound waves over liquid glass.</p>
                </div>
              </div>

              <div className="quick-grid">
                <Button variant="ghost" onClick={() => go("liked")}>
                  <span className="quick-icon-badge">
                    <Heart className="h-4 w-4" />
                  </span>
                  <strong>Loved Songs</strong>
                  <small>{p.library.filter((t) => t.liked).length} songs</small>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setTab("Playlists");
                    go("library");
                  }}
                >
                  <span className="quick-icon-badge">
                    <Music2 className="h-4 w-4" />
                  </span>
                  <strong>Playlists</strong>
                  <small>{playlists.length} playlists</small>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setTab("Artists");
                    go("library");
                  }}
                >
                  <span className="quick-icon-badge">
                    <Disc3 className="h-4 w-4" />
                  </span>
                  <strong>Artists</strong>
                  <small>{artists.length} artists</small>
                </Button>
              </div>

              <div className="section-title">
                <h2>Recently added</h2>
                <Button variant="ghost" onClick={() => go("library")}>
                  See all <ChevronRight />
                </Button>
              </div>

              {p.library.length ? (
                <div className="recent-grid">
                  {p.library
                    .slice(-4)
                    .reverse()
                    .map((t) => (
                      <Button
                        variant="ghost"
                        className="recent-tile"
                        key={t.id}
                        onClick={() => p.playTrack(t.id)}
                      >
                        <Art track={t} />
                        <strong>{t.title}</strong>
                        <small>{t.artist}</small>
                      </Button>
                    ))}
                </div>
              ) : (
                <div className="home-empty">
                  <p>Your collection starts with a song.</p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button onClick={() => files.current?.click()}>
                      <Plus />
                      Add music
                    </Button>
                    <Button variant="outline" onClick={() => folder.current?.click()}>
                      <FolderPlus />
                      Import folder
                    </Button>
                    <Button
                      variant="outline"
                      className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 font-semibold"
                      onClick={async () => {
                        setMessage("Loading starter ambient & indie music...");
                        const count = await p.loadSampleMusic();
                        setMessage(`${count} high-fidelity songs ready to play!`);
                      }}
                    >
                      <Music className="mr-1.5 h-4 w-4 text-emerald-500" />
                      Load Sample Music
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {screen === "library" && (
            <>
              <header className="page-head">
                <div>
                  <p className="eyebrow">YOUR COLLECTION</p>
                  <h1>Library</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="glass-icon-btn relative shrink-0"
                    title="Downloads & offline library"
                    onClick={() => go("downloads")}
                  >
                    <Download className="h-4 w-4" />
                    {downloadQueue.filter(
                      (d) => d.status === "downloading" || d.status === "saving",
                    ).length > 0 && (
                      <span className="top-action-badge animate-pulse">
                        {
                          downloadQueue.filter(
                            (d) => d.status === "downloading" || d.status === "saving",
                          ).length
                        }
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="glass-icon-btn"
                    title="Add music"
                    onClick={() => files.current?.click()}
                  >
                    <Plus />
                  </Button>
                </div>
              </header>

              <div className="segmented">
                {(["Songs", "Albums", "Artists", "Playlists"] as Tab[]).map((name) => (
                  <Button
                    key={name}
                    variant="ghost"
                    className={tab === name ? "active" : ""}
                    onClick={() => setTab(name)}
                  >
                    {name}
                  </Button>
                ))}
              </div>

              {tab === "Songs" && (
                <>
                  <div className="library-tools">
                    <Button variant="ghost" onClick={() => playList(list, true)}>
                      <Shuffle className="h-4 w-4" /> Shuffle all
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-emerald-500 hover:text-emerald-400 font-semibold"
                      onClick={() => setDirectDownloadOpen(true)}
                    >
                      <Download className="h-4 w-4 mr-1" /> Download to Library
                    </Button>
                    <select
                      aria-label="Sort tracks"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option>Recently Added</option>
                      <option>Title A–Z</option>
                      <option>Artist A–Z</option>
                    </select>
                  </div>
                  {rows(list)}
                </>
              )}

              {tab === "Albums" && albumGrid(albums)}

              {tab === "Artists" && (
                <div className="artist-list">
                  {artists.length ? (
                    artists.map((artist) => (
                      <Button
                        key={artist}
                        variant="ghost"
                        onClick={() => {
                          setQuery(artist);
                          go("search");
                        }}
                      >
                        <div className="art">
                          <img src={coverFor(artist)} alt="" />
                        </div>
                        <span>
                          <strong>{artist}</strong>
                          <br />
                          <small>{p.library.filter((t) => t.artist === artist).length} songs</small>
                        </span>
                        <ChevronRight />
                      </Button>
                    ))
                  ) : (
                    <Empty onAdd={() => files.current?.click()} label="No artists yet" />
                  )}
                </div>
              )}

              {tab === "Playlists" && (
                <div>
                  <div className="create-playlist">
                    <input
                      placeholder="New playlist name…"
                      value={playlistName}
                      onChange={(e) => setPlaylistName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPlaylist()}
                    />
                    <Button onClick={addPlaylist}>Create</Button>
                  </div>
                  {playlists.map((pl) => (
                    <Button
                      key={pl.name}
                      variant="ghost"
                      className="playlist-row"
                      onClick={() => {
                        setSelectedPlaylist(pl.name);
                        go("playlist");
                      }}
                    >
                      <Music2 className="h-5 w-5" />
                      <strong>{pl.name}</strong>
                      <small>{pl.ids.length} songs</small>
                      <ChevronRight />
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}

          {screen === "explore" && (
            <>
              {/* Top Search Bar placed above everything */}
              <div className="explore-search-header">
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      aria-label="Search online audio"
                      className="w-full h-11 pl-10 pr-10 rounded-full bg-white/50 dark:bg-white/10 border border-white/60 dark:border-white/15 backdrop-blur-md text-sm outline-none placeholder:text-muted-foreground focus:border-emerald-500"
                      placeholder="Search songs, artists, or audio..."
                      value={youtubeQuery}
                      onChange={(e) => setYoutubeQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void searchOnlineVideos(youtubeQuery);
                      }}
                    />
                    {youtubeQuery && (
                      <button
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setYoutubeQuery("");
                          void searchOnlineVideos("Top Hits 2026");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    className="rounded-full px-5 h-11"
                    onClick={() => void searchOnlineVideos(youtubeQuery)}
                    disabled={onlineLoading}
                  >
                    {onlineLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="glass-icon-btn relative shrink-0"
                    title="Downloads & offline library"
                    onClick={() => go("downloads")}
                  >
                    <Download className="h-4 w-4" />
                    {downloadQueue.filter(
                      (d) => d.status === "downloading" || d.status === "saving",
                    ).length > 0 && (
                      <span className="top-action-badge animate-pulse">
                        {
                          downloadQueue.filter(
                            (d) => d.status === "downloading" || d.status === "saving",
                          ).length
                        }
                      </span>
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
                  <span>
                    {youtubeQuery ? `Results for "${youtubeQuery}"` : "Suggested & Popular Tracks"}
                  </span>
                  <span>{onlineVideos.length} songs available</span>
                </div>
              </div>

              {onlineLoading && (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                  <p className="text-xs">Finding songs & audio streams...</p>
                </div>
              )}

              {!onlineLoading && onlineVideos.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm font-semibold">No tracks found</p>
                  <p className="text-xs mt-1">Try another artist or song query.</p>
                </div>
              )}

              {/* Compact VidMate / YouTube Mobile Search Style Rows */}
              <div className="explore-compact-list">
                {onlineVideos.map((vid) => (
                  <div
                    key={vid.id}
                    className="explore-compact-row cursor-pointer"
                    onClick={() => playOnlineTrack(vid)}
                    title="Click to play in SPOILED player"
                  >
                    <div className="explore-thumb-wrap">
                      <img src={vid.thumbnail} alt={vid.title} loading="lazy" />
                      {vid.duration && (
                        <span className="explore-duration-pill">{vid.duration}</span>
                      )}
                    </div>
                    <div className="explore-compact-info">
                      <span className="explore-compact-title" title={vid.title}>
                        {vid.title}
                      </span>
                      <span className="explore-compact-channel">
                        {vid.channel} {vid.views ? `· ${vid.views}` : ""}
                      </span>
                    </div>
                    <div className="explore-compact-actions">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                        title="Play in SPOILED player"
                        onClick={(e) => {
                          e.stopPropagation();
                          playOnlineTrack(vid);
                        }}
                      >
                        <Play className="h-4 w-4 fill-current ml-0.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-emerald-500"
                        title="Choose quality & download"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDownloadModal(vid, "audio");
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        title="Watch video on YouTube"
                        onClick={(e) => {
                          e.stopPropagation();
                          watchVideo(vid);
                        }}
                      >
                        <Film className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* New Profile Section (Replaces AI in main navigation) */}
          {screen === "profile" && (
            <div className="profile-screen">
              <header className="page-head">
                <div>
                  <p className="eyebrow">LISTENER PROFILE</p>
                  <h1>Profile & Sound</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="glass-icon-btn relative shrink-0"
                    title="Downloads & offline library"
                    onClick={() => go("downloads")}
                  >
                    <Download className="h-4 w-4" />
                    {downloadQueue.filter(
                      (d) => d.status === "downloading" || d.status === "saving",
                    ).length > 0 && (
                      <span className="top-action-badge animate-pulse">
                        {
                          downloadQueue.filter(
                            (d) => d.status === "downloading" || d.status === "saving",
                          ).length
                        }
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="glass-icon-btn"
                    title="Settings"
                    onClick={() => go("settings")}
                  >
                    <Settings2 />
                  </Button>
                </div>
              </header>

              <div className="profile-card">
                <div className="profile-avatar-frame">
                  {typeof account?.user_metadata?.["avatar_url"] === "string" ? (
                    <img
                      src={account.user_metadata["avatar_url"]}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="h-8 w-8 text-foreground" />
                  )}
                </div>
                <div className="profile-info">
                  <h2>{accountName}</h2>
                  <p>{account?.email || "Local Offline Guest Listener"}</p>
                  <span className="profile-badge">
                    <UserCheck className="h-3.5 w-3.5" />
                    {account ? "Google Account Connected" : "Local Device Profile"}
                  </span>
                </div>
                {account ? (
                  <Button variant="outline" onClick={signOut} disabled={accountBusy}>
                    Sign out
                  </Button>
                ) : (
                  <Button onClick={signIn} disabled={accountBusy}>
                    Sign in with Google
                  </Button>
                )}
              </div>

              {/* Live Download Manager & Queue */}
              <div className="settings-group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-base font-bold">Downloads & Offline Queue</h3>
                  </div>
                  {downloadQueue.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => go("downloads")}
                    >
                      View downloads ({downloadHistory.length + downloadQueue.length})
                    </Button>
                  )}
                </div>

                {downloadQueue.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No active downloads. Songs queued from Explore will appear here with progress
                    tracking.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {downloadQueue.slice(0, 3).map((item) => (
                      <div key={item.id} className="queue-item-card">
                        <img src={item.thumbnail} alt="" className="queue-item-thumb" />
                        <div className="queue-item-info">
                          <strong className="queue-item-title">{item.title}</strong>
                          <div className="queue-item-status">
                            {item.status === "downloading" && (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                                <span>Downloading ({item.progress}%)</span>
                              </>
                            )}
                            {item.status === "saving" && (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                <span>Embedding artwork & saving to library...</span>
                              </>
                            )}
                            {item.status === "completed" && (
                              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                                <Check className="h-3 w-3" /> Saved in Library
                              </span>
                            )}
                            {item.status === "error" && (
                              <span className="text-red-500 text-xs">{item.error || "Failed"}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {downloadQueue.length > 3 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs mt-1"
                        onClick={() => go("downloads")}
                      >
                        See all downloads & queue ({downloadHistory.length + downloadQueue.length})
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* App & Device Permissions */}
              <div className="settings-group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <div>
                      <h3 className="text-base font-bold">App & Device Permissions</h3>
                      <p className="text-xs text-muted-foreground">
                        Space storage, sound, notifications, camera
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setPermissionsModalOpen(true)}
                  >
                    Manage
                  </Button>
                </div>
              </div>

              {/* Listening Statistics */}
              <div className="stats-grid">
                <div className="stat-tile">
                  <strong>{p.library.length}</strong>
                  <span>Tracks</span>
                </div>
                <div className="stat-tile">
                  <strong>{p.library.filter((t) => t.liked).length}</strong>
                  <span>Loved</span>
                </div>
                <div className="stat-tile">
                  <strong>{playlists.length}</strong>
                  <span>Playlists</span>
                </div>
                <div className="stat-tile">
                  <strong>
                    {Math.round(p.library.reduce((acc, t) => acc + (t.duration || 180), 0) / 60)}m
                  </strong>
                  <span>Playtime</span>
                </div>
              </div>

              {/* 10-Band Graphic Equalizer */}
              <div className="eq-panel">
                <div className="eq-header">
                  <div>
                    <h3 className="text-base font-bold">10-Band Graphic Equalizer</h3>
                    <p className="text-xs text-muted-foreground">Web Audio BiquadFilter Chain</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-secondary">
                    {p.eqPreset}
                  </span>
                </div>

                <div className="eq-presets-bar">
                  {(
                    ["Flat", "Bass Boost", "Vocal", "Acoustic", "Rock", "Electronic"] as EqPreset[]
                  ).map((preset) => (
                    <button
                      key={preset}
                      className={`eq-preset-btn ${p.eqPreset === preset ? "active" : ""}`}
                      onClick={() => p.setEqPreset(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="eq-sliders-row">
                  {EQ_FREQUENCIES.map((freq, idx) => (
                    <div key={freq} className="eq-slider-col">
                      <span className="eq-gain-label">
                        {p.eqGains[idx] && p.eqGains[idx]! > 0
                          ? `+${p.eqGains[idx]}`
                          : p.eqGains[idx] || 0}
                      </span>
                      <input
                        type="range"
                        aria-label={`${freq} Hertz gain`}
                        min="-12"
                        max="12"
                        step="0.5"
                        value={p.eqGains[idx] || 0}
                        onChange={(e) => p.setEqGain(idx, +e.target.value)}
                      />
                      <span className="eq-freq-label">
                        {freq >= 1000 ? `${freq / 1000}k` : freq}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data & Backup Management */}
              <div className="settings-group">
                <h3 className="text-base font-bold mb-3">Library Backup & Data</h3>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={handleExportBackup}>
                    <Download className="mr-2 h-4 w-4" /> Export Backup (JSON)
                  </Button>
                  <Button variant="outline" onClick={() => backupInput.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" /> Restore Backup (JSON)
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (
                        confirm(
                          "Are you sure you want to clear your local music library from this browser?",
                        )
                      ) {
                        void p.clearLibrary();
                        setMessage("Local library cleared.");
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Clear Library
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* AI Music Assistant Screen */}
          {screen === "ai" && (
            <>
              <header className="page-head">
                <div>
                  <p className="eyebrow">SPOILED CURATOR</p>
                  <h1>
                    <Sparkles className="title-icon" /> AI Music Assistant
                  </h1>
                </div>
                <Button variant="ghost" size="icon" className="glass-icon-btn" onClick={back}>
                  <X />
                </Button>
              </header>

              <div className="assistant-panel">
                {aiHistory.map((msg, i) => (
                  <div key={i} className={msg.role === "user" ? "chat-user" : "chat-reply"}>
                    <p>{msg.text}</p>
                    {msg.recommendations && msg.recommendations.length > 0 && (
                      <div className="rec-grid">
                        {msg.recommendations.map((rec, rIdx) => (
                          <div key={rIdx} className="recommendation-card">
                            <div className="rec-header">
                              <div>
                                <strong>{rec.title}</strong>
                                <p className="text-xs text-muted-foreground">{rec.artist}</p>
                              </div>
                              <span className="rec-vibe">{rec.vibe}</span>
                            </div>
                            <p className="rec-reason">{rec.reason}</p>
                            <div className="rec-actions">
                              <button
                                className="rec-action-btn"
                                onClick={() => {
                                  setQuery(rec.title);
                                  go("search");
                                }}
                              >
                                <Search className="h-3 w-3" /> Search Library
                              </button>
                              <button
                                className="rec-action-btn"
                                onClick={() => playYoutube(`${rec.artist} - ${rec.title}`)}
                              >
                                <Youtube className="h-3 w-3 text-red-500" /> Preview YouTube
                              </button>
                              <button
                                className="rec-action-btn"
                                onClick={() => {
                                  const match = p.library.find((t) =>
                                    t.title.toLowerCase().includes(rec.title.toLowerCase()),
                                  );
                                  if (match) {
                                    addToPlaylist(match.id, selectedPlaylist);
                                  } else {
                                    setMessage(`"${rec.title}" saved to ${selectedPlaylist}`);
                                  }
                                }}
                              >
                                <Plus className="h-3 w-3" /> Add to {selectedPlaylist}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {aiLoading && (
                  <div className="chat-reply">Curating bespoke selections for your collection…</div>
                )}
              </div>

              <form className="ai-input" onSubmit={handleAiSend}>
                <input
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder="Ask about your library, recommend tracks for a rainy night…"
                />
                <Button
                  size="icon"
                  type="submit"
                  title="Send"
                  disabled={aiLoading || !aiText.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}

          {screen === "search" && (
            <>
              <header className="page-head">
                <div>
                  <p className="eyebrow">VIDMATE & LOCAL DISCOVERY</p>
                  <h1>Search Anything</h1>
                </div>
                <Button variant="ghost" size="icon" className="glass-icon-btn" onClick={back}>
                  <X />
                </Button>
              </header>

              <div className="video-search-bar">
                <div className="video-search-input-wrap">
                  <input
                    autoFocus
                    placeholder="Search any song, artist, YouTube video…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && query.trim()) {
                        void searchOnlineVideos(query.trim());
                      }
                    }}
                  />
                  {query && (
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setQuery("");
                        setOnlineVideos([]);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  className="video-search-btn"
                  onClick={() => query.trim() && void searchOnlineVideos(query.trim())}
                  disabled={onlineLoading}
                >
                  <Search className="h-4 w-4" /> Search
                </Button>
              </div>

              {/* Segmented Filter Scope */}
              <div className="segmented mb-6">
                <Button
                  variant="ghost"
                  className={searchScope === "all" ? "active" : ""}
                  onClick={() => setSearchScope("all")}
                >
                  All ({onlineVideos.length + list.length})
                </Button>
                <Button
                  variant="ghost"
                  className={searchScope === "online" ? "active" : ""}
                  onClick={() => setSearchScope("online")}
                >
                  <Youtube className="mr-1 h-3.5 w-3.5 text-red-500 inline" /> Online Videos (
                  {onlineVideos.length})
                </Button>
                <Button
                  variant="ghost"
                  className={searchScope === "local" ? "active" : ""}
                  onClick={() => setSearchScope("local")}
                >
                  <Music2 className="mr-1 h-3.5 w-3.5 inline" /> Local Songs ({list.length})
                </Button>
              </div>

              {/* Online Videos (VidMate style) */}
              {searchScope !== "local" && (
                <div className="mb-8">
                  <div className="section-title">
                    <h2 className="flex items-center gap-2">
                      <Youtube className="text-red-500 h-6 w-6" /> Online Videos (YouTube)
                    </h2>
                    {onlineLoading && (
                      <span className="text-xs text-muted-foreground animate-pulse">
                        Searching YouTube & internet…
                      </span>
                    )}
                  </div>

                  {onlineVideos.length > 0 ? (
                    <div className="video-grid">
                      {onlineVideos.map((vid) => (
                        <div
                          key={vid.id}
                          className="video-card cursor-pointer"
                          onClick={() => playOnlineTrack(vid)}
                          title="Click to play in SPOILED player"
                        >
                          <div className="video-thumb-wrap">
                            <img src={vid.thumbnail} alt={vid.title} />
                            <div className="video-play-overlay">
                              <div className="video-play-circle" title="Play track">
                                <Play className="h-6 w-6 text-white fill-current ml-0.5" />
                              </div>
                            </div>
                            {vid.duration && (
                              <span className="video-duration-pill">{vid.duration}</span>
                            )}
                          </div>
                          <div className="video-details">
                            <strong title={vid.title}>{vid.title}</strong>
                            <span className="video-channel">
                              <Youtube className="h-3.5 w-3.5 text-red-500" />
                              {vid.channel} {vid.views ? `· ${vid.views}` : ""}
                            </span>
                            <div className="video-card-actions">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playOnlineTrack(vid);
                                }}
                                title="Play in SPOILED player"
                              >
                                <Play className="h-3.5 w-3.5 mr-1 fill-current" /> Play
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-muted-foreground hover:text-emerald-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDownloadModal(vid, "audio");
                                }}
                                title="Download audio to library"
                              >
                                <Download className="h-3.5 w-3.5 mr-1" /> Download
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  watchVideo(vid);
                                }}
                                title="Watch YouTube video"
                              >
                                <Film className="h-3.5 w-3.5 mr-1" /> Watch
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : query.trim() ? (
                    !onlineLoading && (
                      <div className="p-8 text-center text-muted-foreground bg-white/20 rounded-2xl border border-white/40">
                        <Youtube className="h-8 w-8 mx-auto mb-2 text-red-400 opacity-60" />
                        <p className="text-sm">No internet videos found for "{query}".</p>
                      </div>
                    )
                  ) : (
                    <div className="p-8 text-center text-muted-foreground bg-white/20 rounded-2xl border border-white/40">
                      <p className="text-sm">
                        Search any song title, artist or video — watch instantly like VidMate.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Local Songs Section */}
              {searchScope !== "online" && (
                <div>
                  <div className="section-title">
                    <h2>Local Library Songs ({list.length})</h2>
                  </div>
                  {rows(list)}
                </div>
              )}
            </>
          )}

          {screen === "watch" && (
            <div className="watch-screen">
              {activeWatchVideo ? (
                <>
                  <header className="page-head">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="glass-icon-btn h-9 px-3 gap-1.5"
                        onClick={() => {
                          if (previous && previous !== "watch") {
                            go(previous);
                          } else {
                            go("explore");
                          }
                        }}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back</span>
                      </Button>
                      <div className="min-w-0">
                        <p className="eyebrow">NOW PLAYING</p>
                        <h1 className="truncate max-w-[450px] text-lg font-bold">
                          {activeWatchVideo.title}
                        </h1>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        className="download-cta-btn h-9 px-4 text-xs font-semibold"
                        onClick={() => void startDownloadTask(activeWatchVideo, "audio", "320")}
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" /> Download Song
                      </Button>
                    </div>
                  </header>

                  <div className="watch-screen-grid">
                    {/* Main Video & Meta Column */}
                    <div className="watch-main-column">
                      <div className="watch-video-wrapper">
                        <iframe
                          src={getYoutubeEmbedUrl(activeWatchVideo.id)}
                          title={activeWatchVideo.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>

                      <div className="watch-meta-card">
                        <div className="watch-title-row">
                          <h1>{activeWatchVideo.title}</h1>
                          <div className="watch-subinfo">
                            <span className="font-semibold text-foreground">
                              {activeWatchVideo.channel}
                            </span>
                            {activeWatchVideo.duration && (
                              <span>· {activeWatchVideo.duration}</span>
                            )}
                            {activeWatchVideo.views && <span>· {activeWatchVideo.views}</span>}
                          </div>
                        </div>

                        <div className="watch-actions-bar">
                          <Button
                            className="download-cta-btn"
                            onClick={() => void startDownloadTask(activeWatchVideo, "audio", "320")}
                          >
                            <Download className="h-4 w-4 mr-1.5" /> Download Song to Library
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDownloadModal(activeWatchVideo, "video")}
                          >
                            <Film className="mr-1.5 h-4 w-4" /> Download Video
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsPipMode(true);
                              go(previous === "watch" ? "explore" : previous);
                              setMessage("Now playing in Mini Player");
                            }}
                            title="Keep watching while exploring other screens"
                          >
                            <Minimize2 className="mr-1.5 h-4 w-4" /> Mini Player
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMessage(
                                `"${activeWatchVideo.title}" saved to ${selectedPlaylist}`,
                              );
                            }}
                          >
                            <Plus className="mr-1.5 h-4 w-4" /> Add to {selectedPlaylist}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Share video link"
                            onClick={() => {
                              if (typeof navigator !== "undefined" && navigator.clipboard) {
                                void navigator.clipboard.writeText(
                                  `https://www.youtube.com/watch?v=${activeWatchVideo.id}`,
                                );
                                setMessage("Video link copied to clipboard");
                              }
                            }}
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Other Related Songs */}
                    <div className="watch-sidebar-column">
                      <div className="related-songs-card">
                        <div className="related-songs-header">
                          <h3>
                            <Music2 className="h-4 w-4 text-emerald-500" /> Other Related Songs
                          </h3>
                          {relatedLoading && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                            </span>
                          )}
                        </div>

                        {relatedLoading && relatedVideos.length === 0 ? (
                          <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                            <p className="text-xs">Finding related tracks & recommendations…</p>
                          </div>
                        ) : relatedVideos.length > 0 ? (
                          <div className="related-list">
                            {relatedVideos.map((item) => (
                              <div
                                key={item.id}
                                className={`related-track-row ${
                                  item.id === activeWatchVideo.id ? "active" : ""
                                }`}
                                onClick={() => watchVideo(item)}
                              >
                                <div className="related-thumb-wrap">
                                  <img src={item.thumbnail} alt={item.title} />
                                  {item.duration && (
                                    <span className="related-duration">{item.duration}</span>
                                  )}
                                </div>
                                <div className="related-info">
                                  <strong title={item.title}>{item.title}</strong>
                                  <span title={item.channel}>{item.channel}</span>
                                </div>
                                <div className="related-actions">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-emerald-500"
                                    title="Download this song"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDownloadModal(item, "audio");
                                    }}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    title="Watch this song"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      watchVideo(item);
                                    }}
                                  >
                                    <Play className="h-3.5 w-3.5 fill-current" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center text-muted-foreground text-xs">
                            <p>No extra related songs found for this video.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-search-prompt mt-10">
                  <Youtube className="h-10 w-10 mx-auto mb-2 text-red-500 opacity-60" />
                  <p className="text-sm font-semibold mb-3">No video currently selected</p>
                  <Button onClick={() => go("explore")}>Explore Online Videos</Button>
                </div>
              )}
            </div>
          )}

          {screen === "downloads" && (
            <div className="downloads-page">
              <header className="page-head">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="glass-icon-btn"
                    onClick={back}
                    title="Back"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div>
                    <p className="eyebrow">OFFLINE AUDIO & MEDIA</p>
                    <h1 className="flex items-center gap-2">
                      Downloads
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                        {downloadHistory.length} saved
                      </span>
                    </h1>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {downloadHistory.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-red-500"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Clear download history list? (Songs remain in your library)",
                          )
                        ) {
                          setDownloadHistory([]);
                          setMessage("Download history cleared");
                        }
                      }}
                    >
                      Clear history
                    </Button>
                  )}
                  <Button
                    className="rounded-full h-9 px-4 text-xs font-semibold"
                    onClick={() => go("explore")}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Find More
                  </Button>
                </div>
              </header>

              {/* Active / In-Progress Downloads */}
              {downloadQueue.filter((d) => d.status === "downloading" || d.status === "saving")
                .length > 0 && (
                <div className="mb-6 p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/25">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> In Progress
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {
                        downloadQueue.filter(
                          (d) => d.status === "downloading" || d.status === "saving",
                        ).length
                      }{" "}
                      active
                    </span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {downloadQueue
                      .filter((d) => d.status === "downloading" || d.status === "saving")
                      .map((task) => (
                        <div key={task.id} className="queue-item-card">
                          <img src={task.thumbnail} alt="" className="queue-item-thumb" />
                          <div className="queue-item-info">
                            <strong className="queue-item-title">{task.title}</strong>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                              <span>
                                {task.channel} · {task.quality}
                                {task.type === "video" ? "p MP4" : "kbps MP3"}
                              </span>
                              <span className="text-emerald-500 font-bold">{task.progress}%</span>
                            </div>
                            <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
                              <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Downloaded Songs & Media List */}
              {downloadHistory.length === 0 && downloadQueue.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon-wrapper">
                    <Download className="h-12 w-12 text-emerald-500/70" />
                  </div>
                  <h3>No downloaded songs yet</h3>
                  <p>
                    Explore online music and download songs with high fidelity directly to your
                    device.
                  </p>
                  <Button onClick={() => go("explore")}>
                    <Compass className="mr-1.5 h-4 w-4" />
                    Explore Songs to Download
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold">Downloaded Audio & Video</h2>
                      <span className="text-xs text-muted-foreground">
                        ({downloadHistory.length})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => go("explore")}
                    >
                      <Search className="h-3.5 w-3.5 mr-1" /> Search new songs
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {downloadHistory.map((item) => {
                      const libraryTrack = p.library.find(
                        (t) =>
                          t.id === item.trackId ||
                          t.title.toLowerCase().trim() === item.title.toLowerCase().trim(),
                      );
                      return (
                        <div
                          key={item.id}
                          className="download-full-card cursor-pointer"
                          onClick={() => {
                            if (libraryTrack) {
                              p.playTrack(libraryTrack.id);
                              setMessage(`Playing "${libraryTrack.title}"`);
                            }
                          }}
                        >
                          <div className="download-full-thumb">
                            <img src={libraryTrack?.pictureUrl || item.thumbnail} alt="" />
                          </div>
                          <div className="download-full-info">
                            <strong className="download-full-title">
                              {libraryTrack?.title || item.title}
                            </strong>
                            <span className="download-full-channel">
                              {libraryTrack?.artist || item.channel}
                            </span>
                            <div className="download-full-meta">
                              <span className="download-quality-pill">{item.quality}</span>
                              <span className="download-date">{item.downloadedAt}</span>
                              {libraryTrack && (
                                <span className="download-status-badge">
                                  <Check className="h-3 w-3 inline mr-0.5" /> In Library
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="download-full-actions">
                            {libraryTrack && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15"
                                title="Play song"
                                onClick={() => p.playTrack(libraryTrack.id)}
                              >
                                <Play className="h-4 w-4 fill-current ml-0.5" />
                              </Button>
                            )}
                            {libraryTrack && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                title="Edit song name and thumbnail"
                                onClick={() => {
                                  setEditingTrack(libraryTrack);
                                  setEditInfoDraft({
                                    title: libraryTrack.title,
                                    artist: libraryTrack.artist,
                                    album: libraryTrack.album,
                                  });
                                  setEditArtworkPreview(libraryTrack.pictureUrl || null);
                                  setEditArtworkBlob(null);
                                }}
                              >
                                <SlidersHorizontal className="h-4 w-4" />
                              </Button>
                            )}
                            {!libraryTrack && item.type === "audio" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                                title="Download and add directly to SPOILED library"
                                onClick={() => {
                                  void startDownloadTask(
                                    {
                                      id: item.videoId,
                                      title: item.title,
                                      channel: item.channel,
                                      thumbnail: item.thumbnail,
                                    },
                                    "audio",
                                    "320",
                                  );
                                }}
                              >
                                <FolderPlus className="h-4 w-4 text-emerald-500" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                              title="Delete song"
                              onClick={() => {
                                if (libraryTrack) {
                                  setDeletingTrack(libraryTrack);
                                } else {
                                  setDownloadHistory((prev) =>
                                    prev.filter((h) => h.id !== item.id),
                                  );
                                  setMessage(`Removed "${item.title}" from downloads`);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {screen === "liked" && (
            <>
              <header className="page-head">
                <div>
                  <p className="eyebrow">FAVORITES</p>
                  <h1>Loved Songs</h1>
                </div>
                <Button variant="ghost" size="icon" className="glass-icon-btn" onClick={back}>
                  <X />
                </Button>
              </header>
              <div className="detail-actions">
                <Button onClick={() => playList(list)} disabled={!list.length}>
                  <Play /> Play all
                </Button>
                <Button
                  variant="outline"
                  onClick={() => playList(list, true)}
                  disabled={!list.length}
                >
                  <Shuffle /> Shuffle
                </Button>
              </div>
              {rows(list)}
            </>
          )}

          {screen === "album" && (
            <>
              <header className="page-head">
                <Button variant="ghost" size="icon" className="glass-icon-btn" onClick={back}>
                  <ArrowLeft />
                </Button>
                <span className="eyebrow">ALBUM</span>
                <div style={{ width: 44 }} />
              </header>
              <div className="detail-cover">
                <img src={coverFor(selectedAlbum)} alt="" />
              </div>
              <div className="detail-intro">
                <h1>{selectedAlbum}</h1>
                <p>{p.library.find((t) => t.album === selectedAlbum)?.artist}</p>
                <small>{list.length} songs</small>
              </div>
              <div className="detail-actions">
                <Button onClick={() => playList(list)} disabled={!list.length}>
                  <Play /> Play
                </Button>
                <Button
                  variant="outline"
                  onClick={() => playList(list, true)}
                  disabled={!list.length}
                >
                  <Shuffle /> Shuffle
                </Button>
              </div>
              {rows(list)}
            </>
          )}

          {screen === "playlist" && (
            <>
              <header className="page-head">
                <Button variant="ghost" size="icon" className="glass-icon-btn" onClick={back}>
                  <ArrowLeft />
                </Button>
                <span className="eyebrow">PLAYLIST</span>
                <div style={{ width: 44 }} />
              </header>
              <div className="detail-cover">
                <Music2 className="h-16 w-16" />
              </div>
              <div className="detail-intro">
                <h1>{selectedPlaylist}</h1>
                <small>{list.length} songs</small>
              </div>
              <div className="detail-actions">
                <Button onClick={() => playList(list)} disabled={!list.length}>
                  <Play /> Play
                </Button>
                <Button
                  variant="outline"
                  onClick={() => playList(list, true)}
                  disabled={!list.length}
                >
                  <Shuffle /> Shuffle
                </Button>
              </div>
              {rows(list)}
            </>
          )}

          {screen === "settings" && (
            <>
              <header className="page-head">
                <div>
                  <p className="eyebrow">SPOILED</p>
                  <h1>Settings</h1>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="glass-icon-btn"
                  title="Back"
                  onClick={back}
                >
                  <X />
                </Button>
              </header>
              <div className="settings-brand">
                <div className="liquid-icon-frame">
                  <img src={spoiledLiquidLogo} alt="SPOILED" />
                </div>
                <div>
                  <strong>SPOILED</strong>
                  <small>Fluid Glass Personal Audio</small>
                </div>
                <ChevronRight />
              </div>
              <div className="settings-group settings-account">
                <div className="settings-row">
                  <span>Account</span>
                </div>
                {accountControl}
                <small>Your music stays on this device when you sign out.</small>
              </div>
              <div className="settings-group">
                <div className="settings-row">
                  <Music2 />
                  <span>Local music</span>
                  <strong>{p.library.length} songs</strong>
                </div>
                <Button
                  variant="ghost"
                  className="settings-row"
                  onClick={() => folder.current?.click()}
                >
                  <FolderPlus />
                  <span>Import folder</span>
                  <ChevronRight />
                </Button>
                <div className="settings-row">
                  <SlidersHorizontal />
                  <span>Crossfade</span>
                  <label>
                    {p.crossfade}s{" "}
                    <input
                      aria-label="Crossfade seconds"
                      type="range"
                      min="0"
                      max="12"
                      value={p.crossfade}
                      onChange={(e) => p.setCrossfade(+e.target.value)}
                    />
                  </label>
                </div>
                <div className="settings-row">
                  <SlidersHorizontal />
                  <span>Transitions</span>
                  <select
                    aria-label="Transition mode"
                    value={p.mixMode}
                    onChange={(e) => p.setMixMode(e.target.value as "crossfade" | "automix")}
                  >
                    <option value="crossfade">Crossfade</option>
                    <option value="automix">AutoMix</option>
                  </select>
                </div>
                <div className="settings-row">
                  <Volume2 />
                  <span>Volume</span>
                  <input
                    aria-label="Volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={p.volume}
                    onChange={(e) => p.setVolume(+e.target.value)}
                  />
                </div>
              </div>
              <div className="settings-group">
                <div className="settings-row">
                  <Settings2 />
                  <span>Appearance</span>
                  <select
                    aria-label="Appearance"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  >
                    <option>Liquid Glass (Light)</option>
                    <option>Liquid Obsidian (Dark)</option>
                  </select>
                </div>
              </div>
              <div className="settings-footer">
                <div className="liquid-icon-frame">
                  <img src={spoiledLiquidLogo} alt="SPOILED" />
                </div>
                <strong>SPOILED</strong>
                <small>Your Music. Your World. Liquid Glass.</small>
              </div>
            </>
          )}

          {(screen === "now" || screen === "lyrics" || screen === "queue") && (
            <div
              className={`player-screen ${screen === "lyrics" ? "lyrics-screen" : ""} ${screen === "queue" ? "queue-screen" : ""}`}
            >
              <div className="player-top">
                <Button
                  variant="ghost"
                  size="icon"
                  className="glass-icon-btn"
                  title="Close player"
                  onClick={() => {
                    setScreen(playerOrigin.current);
                    setMenu(null);
                  }}
                >
                  <ChevronDown />
                </Button>
                <span>
                  {screen === "queue"
                    ? "UP NEXT"
                    : screen === "lyrics"
                      ? "SYNCHRONIZED LYRICS"
                      : "NOW PLAYING"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="glass-icon-btn"
                  title="Queue"
                  onClick={() => go("queue")}
                >
                  <ListMusic />
                </Button>
              </div>

              {screen === "queue" ? (
                <>
                  <div className="queue-intro">
                    <h1>Up next</h1>
                    <p>{p.queue.length} tracks in queue</p>
                  </div>
                  {p.queue.length ? (
                    p.queue.map((id, i) => {
                      const t = p.library.find((x) => x.id === id);
                      return t ? (
                        <div className="queue-row" key={`${id}-${i}`}>
                          <Art track={t} />
                          <span>
                            <strong>{t.title}</strong>
                            <small>
                              {t.artist}
                              {i === p.index ? " · Playing" : ""}
                            </small>
                          </span>
                          <div className="flex items-center gap-1">
                            {i > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => p.moveInQueue(i, i - 1)}
                                title="Move up"
                              >
                                ↑
                              </Button>
                            )}
                            {i < p.queue.length - 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => p.moveInQueue(i, i + 1)}
                                title="Move down"
                              >
                                ↓
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Remove from queue"
                              onClick={() => p.removeFromQueue(i)}
                              disabled={i === p.index}
                            >
                              <X />
                            </Button>
                          </div>
                        </div>
                      ) : null;
                    })
                  ) : (
                    <p className="muted-note">Your queue is empty.</p>
                  )}
                </>
              ) : screen === "lyrics" ? (
                <>
                  <div className="lyrics-body">
                    {p.current ? (
                      parsedLrc.length > 0 ? (
                        <div className="lrc-container" ref={lrcContainerRef}>
                          {parsedLrc.map((line, idx) => (
                            <div
                              key={`${line.time}-${idx}`}
                              className={`lrc-line ${idx === activeLrcIndex ? "active-line" : ""} ${
                                Math.abs(idx - activeLrcIndex) > 3 ? "dim-line" : ""
                              }`}
                              onClick={() => p.seek(line.time)}
                            >
                              {line.text || "♪"}
                            </div>
                          ))}
                        </div>
                      ) : lyrics[p.current.id] ? (
                        <p>{lyrics[p.current.id]}</p>
                      ) : (
                        <div>
                          <h2>No synchronized lyrics yet</h2>
                          <p>Upload a .LRC file or paste lyrics for {p.current.title}.</p>
                          <div className="flex gap-2 my-3">
                            <Button onClick={() => lrcInput.current?.click()}>
                              <Upload className="mr-2 h-4 w-4" /> Upload .LRC File
                            </Button>
                          </div>
                          <textarea
                            aria-label="Add lyrics"
                            value={lyricDraft}
                            onChange={(e) => setLyricDraft(e.target.value)}
                            placeholder="[00:12.30] Paste timestamps or lyric verses here…"
                          />
                          <Button
                            onClick={() => {
                              setLyrics((v) => ({ ...v, [p.current?.id ?? ""]: lyricDraft }));
                              setLyricDraft("");
                              setMessage("Lyrics saved.");
                            }}
                            disabled={!lyricDraft.trim()}
                          >
                            Save lyrics
                          </Button>
                        </div>
                      )
                    ) : (
                      <p>Choose a song to see lyrics.</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="cover-stage">
                    <div
                      className={`sound-aura ${p.playing ? "sound-aura-playing" : ""}`}
                      aria-hidden="true"
                    >
                      <div className="aura-ring ring-1" />
                      <div className="aura-ring ring-2" />
                      <div className="aura-ring ring-3" />
                      <div className="aura-glow" />
                    </div>
                    <div className="large-cover">
                      <Art track={p.current} />
                    </div>
                  </div>
                  <div className="song-heading">
                    <div>
                      <h1>{p.current?.title ?? "Nothing playing"}</h1>
                      <p>{p.current?.artist ?? "Add music to begin"}</p>
                    </div>
                    {p.current && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="glass-icon-btn"
                        title="Love song"
                        onClick={() => p.toggleLike(p.current?.id ?? "")}
                      >
                        <Heart className={p.current.liked ? "filled-heart" : ""} />
                      </Button>
                    )}
                  </div>
                </>
              )}

              {screen !== "queue" && (
                <>
                  <div className="seek-block">
                    <input
                      aria-label="Seek"
                      type="range"
                      min="0"
                      max={p.duration || 1}
                      step="0.1"
                      value={p.time}
                      onChange={(e) => p.seek(+e.target.value)}
                    />
                    <div>
                      <span>{fmt(p.time)}</span>
                      <span>-{fmt(Math.max(0, p.duration - p.time))}</span>
                    </div>
                  </div>

                  <div className="player-controls">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Shuffle"
                      onClick={() => p.setShuffle(!p.shuffle)}
                      className={p.shuffle ? "control-active" : ""}
                    >
                      <Shuffle />
                    </Button>
                    <Button variant="ghost" size="icon" title="Previous" onClick={p.prev}>
                      <SkipBack />
                    </Button>
                    <Button
                      className="big-play"
                      size="icon"
                      title={p.playing ? "Pause" : "Play"}
                      onClick={p.toggle}
                    >
                      {p.playing ? <Pause /> : <Play />}
                    </Button>
                    <Button variant="ghost" size="icon" title="Next" onClick={p.next}>
                      <SkipForward />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Repeat"
                      onClick={() => p.setRepeat(!p.repeat)}
                      className={p.repeat ? "control-active" : ""}
                    >
                      <Repeat2 />
                    </Button>
                  </div>

                  <div className="player-bottom">
                    <Button variant="ghost" onClick={() => go("lyrics")}>
                      Lyrics
                    </Button>
                    <Button variant="ghost" onClick={() => go("queue")}>
                      <ListMusic className="mr-1 h-4 w-4" /> Queue
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (!p.current) return;
                        setEditingTrack(p.current);
                        setEditInfoDraft({
                          title: p.current.title,
                          artist: p.current.artist,
                          album: p.current.album,
                        });
                        setEditArtworkPreview(p.current.pictureUrl || null);
                        setEditArtworkBlob(null);
                      }}
                      disabled={!p.current}
                    >
                      <SlidersHorizontal className="mr-1 h-4 w-4" /> Info & Artwork
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {message && (
        <div className="toast" role="status" onClick={() => setMessage("")}>
          {message}
          <Button variant="ghost" size="icon" title="Dismiss" onClick={() => setMessage("")}>
            <X />
          </Button>
        </div>
      )}

      {p.current && !["now", "lyrics", "queue"].includes(screen) && (
        <div className="mini-player">
          <Button variant="ghost" className="mini-song" onClick={() => go("now")}>
            <Art track={p.current} />
            <span>
              <strong>{p.current.title}</strong>
              <small>{p.current.artist}</small>
            </span>
          </Button>
          <Button variant="ghost" size="icon" title="Previous" onClick={p.prev}>
            <SkipBack />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={p.playing ? "Pause" : "Play"}
            onClick={p.toggle}
          >
            {p.playing ? <Pause /> : <Play />}
          </Button>
          <Button variant="ghost" size="icon" title="Next" onClick={p.next}>
            <SkipForward />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Open player"
            onClick={() => go("now")}
            className="mini-open"
          >
            <ChevronRight />
          </Button>
          <div
            className="mini-progress"
            style={{ width: `${p.duration ? (p.time / p.duration) * 100 : 0}%` }}
          />
        </div>
      )}

      {editingTrack && (
        <div className="download-sheet-backdrop" onClick={() => setEditingTrack(null)}>
          <form
            className="download-sheet info-sheet"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editingTrack) return;
              const newTitle = editInfoDraft.title.trim() || editingTrack.title;
              const newArtist = editInfoDraft.artist.trim() || editingTrack.artist;
              const newAlbum = editInfoDraft.album.trim() || editingTrack.album;

              await p.updateTrackInfo(editingTrack.id, {
                title: newTitle,
                artist: newArtist,
                album: newAlbum,
              });

              if (editArtworkBlob) {
                await p.setTrackArtwork(editingTrack.id, editArtworkBlob);
              }

              // Update in downloadHistory if present
              setDownloadHistory((prev) =>
                prev.map((h) =>
                  h.trackId === editingTrack.id
                    ? {
                        ...h,
                        title: newTitle,
                        channel: newArtist,
                        thumbnail: editArtworkPreview || h.thumbnail,
                      }
                    : h,
                ),
              );

              setEditingTrack(null);
              setEditArtworkBlob(null);
              setEditArtworkPreview(null);
              setMessage(`Updated "${newTitle}"`);
            }}
          >
            <div className="download-sheet-header">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="text-emerald-500 h-5 w-5" />
                <h3 className="text-base font-bold">Edit Song & Thumbnail</h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setEditingTrack(null)}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="info-fields">
              {/* Thumbnail Preview and Upload Button */}
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 mb-2">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-md shrink-0 bg-muted">
                  <img
                    src={editArtworkPreview || coverFor(editingTrack.album)}
                    alt="Artwork preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <strong className="block text-sm font-semibold truncate mb-0.5">
                    Song Thumbnail
                  </strong>
                  <p className="text-xs text-muted-foreground mb-2">Upload a custom cover image</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold"
                    onClick={() => editArtworkInputRef.current?.click()}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" /> Change Thumbnail
                  </Button>
                  <input
                    ref={editArtworkInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setEditArtworkBlob(file);
                        setEditArtworkPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </div>
              </div>

              <label>
                Title
                <input
                  value={editInfoDraft.title}
                  onChange={(e) => setEditInfoDraft({ ...editInfoDraft, title: e.target.value })}
                  placeholder="Song Title"
                  required
                />
              </label>
              <label>
                Artist
                <input
                  value={editInfoDraft.artist}
                  onChange={(e) => setEditInfoDraft({ ...editInfoDraft, artist: e.target.value })}
                  placeholder="Artist"
                  required
                />
              </label>
              <label>
                Album
                <input
                  value={editInfoDraft.album}
                  onChange={(e) => setEditInfoDraft({ ...editInfoDraft, album: e.target.value })}
                  placeholder="Album"
                />
              </label>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={() => setEditingTrack(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="download-cta-btn flex-1 h-11 font-semibold">
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Delete Song Confirmation Modal */}
      {deletingTrack && (
        <div className="download-sheet-backdrop" onClick={() => setDeletingTrack(null)}>
          <div className="download-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="download-sheet-header">
              <div className="flex items-center gap-2 text-red-500">
                <Trash2 className="h-5 w-5" />
                <h3 className="text-base font-bold">Delete from Library</h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDeletingTrack(null)}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="download-sheet-body">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                  <Art track={deletingTrack} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm truncate">{deletingTrack.title}</strong>
                  <span className="text-xs text-muted-foreground truncate block">
                    {deletingTrack.artist}
                  </span>
                </div>
              </div>

              <p className="text-sm text-foreground mb-1 font-semibold">
                Delete "{deletingTrack.title}" from your library?
              </p>
              <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                This will permanently remove the song and its audio data from your device storage.
              </p>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={() => setDeletingTrack(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-semibold"
                  onClick={async () => {
                    const trackId = deletingTrack.id;
                    const songTitle = deletingTrack.title;
                    await p.removeTrack(trackId);
                    setDownloadHistory((prev) => prev.filter((h) => h.trackId !== trackId));
                    setDeletingTrack(null);
                    setMessage(`Deleted "${songTitle}" from library`);
                  }}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Delete Song
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Download Quality Selector Modal */}
      {downloadModalOpen && downloadModalVideo && (
        <div
          className="download-sheet-backdrop"
          onClick={() => !downloadInProgress && setDownloadModalOpen(false)}
        >
          <div className="download-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="download-sheet-header">
              <h3>
                <Download className="text-emerald-500 h-5 w-5" />
                <span>Download Media</span>
              </h3>
              <Button
                variant="ghost"
                size="icon"
                disabled={downloadInProgress}
                onClick={() => setDownloadModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="download-sheet-body">
              {/* Media Preview Card */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10">
                <img
                  src={downloadModalVideo.thumbnail}
                  alt={downloadModalVideo.title}
                  className="w-16 h-12 object-cover rounded-xl shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <strong className="block text-sm truncate">{downloadModalVideo.title}</strong>
                  <span className="text-xs text-muted-foreground truncate block">
                    {downloadModalVideo.channel}{" "}
                    {downloadModalVideo.duration ? `· ${downloadModalVideo.duration}` : ""}
                  </span>
                </div>
              </div>

              {/* Format Switcher Tabs */}
              <div className="download-tabs">
                <button
                  type="button"
                  className={`download-tab-btn ${downloadType === "video" ? "active" : ""}`}
                  onClick={() => {
                    if (downloadInProgress) return;
                    setDownloadType("video");
                    setSelectedQuality("720");
                  }}
                >
                  <Film className="inline mr-1.5 h-3.5 w-3.5" /> Video (.MP4)
                </button>
                <button
                  type="button"
                  className={`download-tab-btn ${downloadType === "audio" ? "active" : ""}`}
                  onClick={() => {
                    if (downloadInProgress) return;
                    setDownloadType("audio");
                    setSelectedQuality("320");
                  }}
                >
                  <Music className="inline mr-1.5 h-3.5 w-3.5" /> Audio (.MP3 / .M4A)
                </button>
              </div>

              {/* Quality Options List */}
              <div className="quality-list">
                {downloadType === "video" ? (
                  <>
                    {[
                      {
                        q: "1080",
                        label: "1080p Full HD",
                        badge: "Highest video resolution",
                        ext: "MP4",
                      },
                      {
                        q: "720",
                        label: "720p HD",
                        badge: "Balanced quality & fast download (Recommended)",
                        ext: "MP4",
                      },
                      {
                        q: "480",
                        label: "480p Standard",
                        badge: "Standard definition",
                        ext: "MP4",
                      },
                      {
                        q: "360",
                        label: "360p Compact",
                        badge: "Fastest download, small file size",
                        ext: "MP4",
                      },
                    ].map((opt) => (
                      <div
                        key={opt.q}
                        className={`quality-card ${selectedQuality === opt.q ? "selected" : ""}`}
                        onClick={() => !downloadInProgress && setSelectedQuality(opt.q)}
                      >
                        <div className="quality-info">
                          <div className="flex items-center gap-2">
                            <span className="quality-title">{opt.label}</span>
                            {selectedQuality === opt.q && (
                              <Check className="h-4 w-4 text-emerald-500" />
                            )}
                          </div>
                          <span className="quality-badge">{opt.badge}</span>
                        </div>
                        <span className="quality-size">{opt.ext}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {[
                      {
                        q: "320",
                        label: "320 kbps MP3",
                        badge: "Studio Quality (Highest Audio Fidelity)",
                        ext: "MP3",
                      },
                      {
                        q: "256",
                        label: "256 kbps MP3",
                        badge: "High Bitrate (Ultra Clean Audio)",
                        ext: "MP3",
                      },
                      {
                        q: "192",
                        label: "192 kbps MP3",
                        badge: "Standard Quality (Clear & Crisp)",
                        ext: "MP3",
                      },
                      {
                        q: "128",
                        label: "128 kbps M4A",
                        badge: "High Efficiency AAC Audio",
                        ext: "M4A",
                      },
                    ].map((opt) => (
                      <div
                        key={opt.q}
                        className={`quality-card ${selectedQuality === opt.q ? "selected" : ""}`}
                        onClick={() => !downloadInProgress && setSelectedQuality(opt.q)}
                      >
                        <div className="quality-info">
                          <div className="flex items-center gap-2">
                            <span className="quality-title">{opt.label}</span>
                            {selectedQuality === opt.q && (
                              <Check className="h-4 w-4 text-emerald-500" />
                            )}
                          </div>
                          <span className="quality-badge">{opt.badge}</span>
                        </div>
                        <span className="quality-size">{opt.ext}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Progress State */}
              {downloadInProgress && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{downloadProgressText || "Processing media with yt-dlp..."}</span>
                  </div>
                  <div className="download-progress-bar">
                    <div className="download-progress-fill animate-pulse w-3/4" />
                  </div>
                </div>
              )}

              {/* Download Buttons */}
              <div className="flex flex-col gap-2.5 pt-2">
                {downloadType === "audio" ? (
                  <>
                    <Button
                      className="download-cta-btn w-full justify-center text-sm h-11"
                      disabled={downloadInProgress}
                      onClick={handleSaveToLocalLibrary}
                    >
                      {downloadInProgress ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Directly to
                          Library…
                        </>
                      ) : (
                        <>
                          <FolderPlus className="mr-2 h-4 w-4 text-emerald-400" /> Save Track
                          Directly to SPOILED Library ({selectedQuality}kbps)
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-center text-xs h-10 border-white/60 dark:border-white/20"
                      disabled={downloadInProgress}
                      onClick={handleDownloadFile}
                    >
                      <Download className="mr-2 h-4 w-4 text-muted-foreground" />
                      Save & Export MP3 File to Device
                    </Button>
                  </>
                ) : (
                  <Button
                    className="download-cta-btn w-full justify-center text-sm h-11"
                    disabled={downloadInProgress}
                    onClick={handleDownloadFile}
                  >
                    {downloadInProgress ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing Video…
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" /> Download {selectedQuality}p Video
                        (.mp4)
                      </>
                    )}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-xs h-9 text-muted-foreground hover:text-foreground"
                  disabled={downloadInProgress}
                  onClick={() => {
                    setDownloadModalOpen(false);
                    watchVideo(downloadModalVideo);
                  }}
                >
                  <Play className="mr-1.5 h-3.5 w-3.5" /> Watch on In-App Video Player
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VidMate Picture-in-Picture Floating Mini Player */}
      {activeWatchVideo && isPipMode && (
        <div className="vidmate-pip-dock">
          <div className="vidmate-pip-bar">
            <span className="truncate max-w-[200px]">{activeWatchVideo.title}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsPipMode(false);
                  go("watch");
                }}
                title="Open in Watch Screen"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setActiveWatchVideo(null)} title="Close">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="vidmate-pip-video">
            <iframe
              src={getYoutubeEmbedUrl(activeWatchVideo.id)}
              title={activeWatchVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Download Queue Drawer Modal */}
      {queueDrawerOpen && (
        <div className="download-sheet-backdrop" onClick={() => setQueueDrawerOpen(false)}>
          <div
            className="download-sheet download-queue-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="download-sheet-header">
              <div className="flex items-center gap-2">
                <Download className="text-emerald-500 h-5 w-5" />
                <h3 className="text-base font-bold">Download Queue</h3>
                {downloadQueue.length > 0 && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                    {downloadQueue.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {downloadQueue.some((d) => d.status === "completed" || d.status === "error") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setDownloadQueue((prev) =>
                        prev.filter((d) => d.status === "downloading" || d.status === "saving"),
                      )
                    }
                  >
                    Clear finished
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQueueDrawerOpen(false)}
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="download-sheet-body max-h-[60vh] overflow-y-auto">
              {downloadQueue.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Download className="h-10 w-10 mx-auto mb-2 opacity-40 text-emerald-500" />
                  <p className="font-semibold text-sm">No downloads in queue</p>
                  <p className="text-xs mt-1">Explore songs and tap Download to queue them here.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {downloadQueue.map((task) => (
                    <div key={task.id} className="queue-item-card">
                      <img src={task.thumbnail} alt="" className="queue-item-thumb" />
                      <div className="queue-item-info">
                        <strong className="queue-item-title">{task.title}</strong>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                          <span>
                            {task.channel} · {task.quality}
                            {task.type === "video" ? "p MP4" : "kbps MP3"}
                          </span>
                          {task.status === "downloading" && (
                            <span className="text-emerald-500 font-semibold">{task.progress}%</span>
                          )}
                        </div>
                        {task.status === "downloading" && (
                          <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        )}
                        {task.status === "saving" && (
                          <div className="flex items-center gap-1.5 text-xs text-blue-500 mt-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Embedding artwork & saving to library...</span>
                          </div>
                        )}
                        {task.status === "completed" && (
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                              <Check className="h-3 w-3" /> Saved to Library
                            </span>
                          </div>
                        )}
                        {task.status === "error" && (
                          <span className="text-xs text-red-500 mt-1 block">
                            {task.error || "Download failed"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* App & Device Permissions Modal */}
      {permissionsModalOpen && (
        <div className="download-sheet-backdrop" onClick={() => setPermissionsModalOpen(false)}>
          <div className="download-sheet permissions-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="download-sheet-header">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-500 h-5 w-5" />
                <h3 className="text-base font-bold">App & Device Permissions</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPermissionsModalOpen(false)}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="download-sheet-body">
              <p className="text-xs text-muted-foreground mb-3">
                Configure Capacitor and device permissions for offline music storage, dynamic
                soundscapes, and notifications.
              </p>

              <div className="flex flex-col gap-2.5">
                {/* Storage & Space Permission */}
                <div className="p-3.5 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <FolderPlus className="h-5 w-5" />
                    </div>
                    <div>
                      <strong className="block text-sm">Storage & Space</strong>
                      <span className="text-xs text-muted-foreground">
                        IndexedDB offline library & audio caching
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                    Granted
                  </span>
                </div>

                {/* Sound & Audio Permission */}
                <div className="p-3.5 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Volume2 className="h-5 w-5" />
                    </div>
                    <div>
                      <strong className="block text-sm">Sound & Equalizer</strong>
                      <span className="text-xs text-muted-foreground">
                        Web Audio API engine & crossfade automix
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                    Granted
                  </span>
                </div>

                {/* Notifications Permission */}
                <div className="p-3.5 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-600 dark:text-purple-400">
                      <Tv className="h-5 w-5" />
                    </div>
                    <div>
                      <strong className="block text-sm">Notifications & Media Bar</strong>
                      <span className="text-xs text-muted-foreground">
                        Lock screen notch & playback alerts
                      </span>
                    </div>
                  </div>
                  {permissionsState.notifications ? (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                      Granted
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      className="h-7 text-xs px-3"
                      onClick={() => requestPermission("notifications")}
                    >
                      Grant
                    </Button>
                  )}
                </div>

                {/* Camera & Artwork Permission */}
                <div className="p-3.5 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <strong className="block text-sm">Camera & Custom Covers</strong>
                      <span className="text-xs text-muted-foreground">
                        Photo capture for album artwork
                      </span>
                    </div>
                  </div>
                  {permissionsState.camera ? (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                      Granted
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-3"
                      onClick={() => requestPermission("camera")}
                    >
                      Request
                    </Button>
                  )}
                </div>
              </div>

              <Button
                className="w-full mt-4 h-10 text-xs font-semibold justify-center"
                onClick={() => setPermissionsModalOpen(false)}
              >
                Save & Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Direct Download to Library Modal */}
      {directDownloadOpen && (
        <div className="download-sheet-backdrop" onClick={() => setDirectDownloadOpen(false)}>
          <div className="download-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="download-sheet-header">
              <div className="flex items-center gap-2">
                <Download className="text-emerald-500 h-5 w-5" />
                <h3 className="text-base font-bold">Download Inside Library</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDirectDownloadOpen(false)}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="download-sheet-body">
              <p className="text-xs text-muted-foreground mb-3">
                Download any song directly into your SPOILED library with high-fidelity audio and
                embedded album artwork.
              </p>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const q = directDownloadQuery.trim();
                  if (!q || directDownloadLoading) return;
                  setDirectDownloadLoading(true);
                  try {
                    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(q)}`);
                    const data = await res.json();
                    const topMatch = data.videos?.[0];
                    if (topMatch) {
                      setDirectDownloadOpen(false);
                      setDirectDownloadQuery("");
                      void startDownloadTask(topMatch, "audio", "320", false);
                    } else {
                      setMessage("No matches found for that song query");
                    }
                  } catch {
                    setMessage("Could not start download");
                  } finally {
                    setDirectDownloadLoading(false);
                  }
                }}
                className="flex flex-col gap-3"
              >
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    autoFocus
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 text-sm outline-none placeholder:text-muted-foreground focus:border-emerald-500"
                    placeholder="Enter song name, artist, or audio search…"
                    value={directDownloadQuery}
                    onChange={(e) => setDirectDownloadQuery(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  className="download-cta-btn justify-center h-11 text-sm font-semibold"
                  disabled={directDownloadLoading || !directDownloadQuery.trim()}
                >
                  {directDownloadLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finding & Downloading…
                    </>
                  ) : (
                    <>
                      <FolderPlus className="mr-2 h-4 w-4" /> Download Directly to Library
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-4 pt-3 border-t border-white/40 dark:border-white/10">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                  Quick One-Click Downloads
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Billie Eilish Birds of a Feather",
                    "The Weeknd Blinding Lights",
                    "Kendrick Lamar Not Like Us",
                    "Marconi Union Weightless",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/50 dark:bg-white/10 border border-white/50 dark:border-white/15 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
                      onClick={async () => {
                        setDirectDownloadOpen(false);
                        try {
                          const res = await fetch(
                            `/api/youtube/search?q=${encodeURIComponent(preset)}`,
                          );
                          const data = await res.json();
                          if (data.videos?.[0]) {
                            void startDownloadTask(data.videos[0], "audio", "320", false);
                          }
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Active Download Queue Indicator */}
      {downloadQueue.filter((d) => d.status === "downloading" || d.status === "saving").length >
        0 &&
        !["now", "lyrics", "queue", "downloads"].includes(screen) && (
          <div
            className="fixed bottom-[84px] left-1/2 -translate-x-1/2 z-50 cursor-pointer flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-600 text-white shadow-xl border border-emerald-400/40 text-xs font-semibold hover:bg-emerald-700 transition-all"
            onClick={() => go("downloads")}
            title="Open full downloads page"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="truncate max-w-[200px]">
              Downloading:{" "}
              {
                downloadQueue.find((d) => d.status === "downloading" || d.status === "saving")
                  ?.title
              }
            </span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] shrink-0 font-bold">
              {
                downloadQueue.find((d) => d.status === "downloading" || d.status === "saving")
                  ?.progress
              }
              % · View Queue
            </span>
          </div>
        )}

      {/* Mobile Bottom Navigation (Home, Library, Explore, Profile) */}
      {!["now", "lyrics", "queue"].includes(screen) && (
        <nav className="bottom-nav" aria-label="Main navigation">
          {nav.map(({ screen: s, label, icon: Icon }) => (
            <Button
              variant="ghost"
              key={s}
              onClick={() => go(s)}
              className={`nav-white-btn ${activeNav === s ? "active" : ""}`}
            >
              <Icon />
              <span>{label}</span>
            </Button>
          ))}
        </nav>
      )}
    </div>
  );
}

function Empty({
  label,
  onAdd,
  onLoadSamples,
}: {
  label: string;
  onAdd: () => void;
  onLoadSamples?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon-wrapper">
        <img src={spoiledLiquidLogo} alt="SPOILED" className="empty-liquid-icon" />
      </div>
      <h3>{label}</h3>
      <p>Choose audio files from your device or load sample tracks to get started.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onAdd}>
          <Plus />
          Add music
        </Button>
        {onLoadSamples && (
          <Button
            variant="outline"
            className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 font-semibold"
            onClick={onLoadSamples}
          >
            <Music className="mr-1.5 h-4 w-4" />
            Load Sample Music
          </Button>
        )}
      </div>
    </div>
  );
}
