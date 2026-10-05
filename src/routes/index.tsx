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
  Repeat1,
  ImagePlus,
  Menu,
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
  | "watch";

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
  const [plays, setPlays] = useState<Record<string, number>>({});
  const [playMode, setPlayMode] = useState<"loop-all" | "loop-one" | "shuffle">("loop-all");
  const [playerStyle, setPlayerStyle] = useState("Default");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [recentAccounts, setRecentAccounts] = useState<string[]>([]);
  const customArtInput = useRef<HTMLInputElement>(null);
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
  const [downloadType, setDownloadType] = useState<"video" | "audio">("video");
  const [selectedQuality, setSelectedQuality] = useState<string>("720");
  const [downloadInProgress, setDownloadInProgress] = useState(false);
  const [downloadProgressText, setDownloadProgressText] = useState("");
  const [downloads, setDownloads] = useState<{ id: string; title: string; status: string }[]>([]);
  const [editInfo, setEditInfo] = useState(false);
  const [infoDraft, setInfoDraft] = useState({ title: "", artist: "", album: "" });

  const [savedReady, setSavedReady] = useState(false);
  const pendingArtwork = useRef<{ previousIds: Set<string>; thumbnail: string } | null>(null);
  useEffect(() => {
    const pending = pendingArtwork.current;
    if (!pending) return;
    const track = p.library.find((item) => !pending.previousIds.has(item.id));
    if (!track) return;
    pendingArtwork.current = null;
    void fetch(pending.thumbnail)
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
    <div className="account-controls">
      <Button variant="outline" onClick={signIn} disabled={accountBusy}>
        Sign in with Google
      </Button>
      <Button variant="ghost" onClick={() => setAuthOpen(true)} disabled={accountBusy}>
        Use email
      </Button>
    </div>
  );

  // Play counts, play mode, look and player style are kept on this device.
  useEffect(() => {
    try {
      setPlays(JSON.parse(localStorage.getItem("spoiled-plays") || "{}"));
      const mode = localStorage.getItem("spoiled-play-mode");
      if (mode === "loop-all" || mode === "loop-one" || mode === "shuffle") setPlayMode(mode);
      const t = localStorage.getItem("spoiled-theme");
      if (t) setTheme(t);
      const ps = localStorage.getItem("spoiled-player-style");
      if (ps) setPlayerStyle(ps);
      setRecentAccounts(JSON.parse(localStorage.getItem("spoiled-accounts") || "[]"));
    } catch {
      // ignore corrupt prefs
    }
  }, []);
  useEffect(() => {
    const id = p.current?.id;
    if (!id) return;
    setPlays((prev) => {
      const next = { ...prev, [id]: (prev[id] ?? 0) + 1 };
      localStorage.setItem("spoiled-plays", JSON.stringify(next));
      return next;
    });
  }, [p.current?.id]);
  useEffect(() => {
    p.setShuffle(playMode === "shuffle");
    p.setRepeat(playMode !== "shuffle");
    p.setRepeatOne(playMode === "loop-one");
    localStorage.setItem("spoiled-play-mode", playMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playMode]);
  useEffect(() => {
    const email = account?.email;
    if (email) {
      setRecentAccounts((prev) => {
        const next = [email, ...prev.filter((e) => e !== email)].slice(0, 5);
        localStorage.setItem("spoiled-accounts", JSON.stringify(next));
        return next;
      });
    }
  }, [account?.email]);

  const emailAuth = async () => {
    if (!authEmail.trim() || authPassword.length < 6) {
      setMessage("Enter your email and a password of at least 6 characters.");
      return;
    }
    setAccountBusy(true);
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage(
          data.session ? "Account created." : "Check your inbox to confirm your email, then sign in.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
        setMessage("Signed in.");
      }
      setAuthOpen(false);
      setAuthPassword("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setAccountBusy(false);
    }
  };

  const switchAccount = async (email?: string) => {
    await supabase.auth.signOut();
    setAccount(null);
    setAuthEmail(email ?? "");
    setAuthMode("signin");
    setAuthOpen(true);
  };

  const cyclePlayMode = () =>
    setPlayMode((m) => (m === "loop-all" ? "loop-one" : m === "loop-one" ? "shuffle" : "loop-all"));

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
    if (sort === "Recently Added") tracks.reverse();
    if (sort === "Name") tracks.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "Most Played") tracks.sort((a, b) => (plays[b.id] ?? 0) - (plays[a.id] ?? 0));
    if (sort === "Title A–Z") tracks.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "Artist A–Z") tracks.sort((a, b) => a.artist.localeCompare(b.artist));
    return tracks;
  }, [p.library, screen, query, selectedAlbum, selectedPlaylist, playlists, sort, plays]);

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

  const openDownloadModal = (video: OnlineVideo, defaultType: "video" | "audio" = "video") => {
    setDownloadModalVideo(video);
    setDownloadType(defaultType);
    setSelectedQuality(defaultType === "audio" ? "320" : "720");
    setDownloadProgressText("");
    setDownloadInProgress(false);
    setDownloadModalOpen(true);
  };

  // Fallback layer: runs the original download request first, then public mirrors, with retries.
  const fetchMediaWithFallback = async (
    id: string,
    type: "audio" | "video",
    quality: string,
    title: string,
    onStatus: (status: string) => void,
  ): Promise<Response | null> => {
    const primary = `/api/video/download?id=${encodeURIComponent(id)}&type=${type}&quality=${encodeURIComponent(quality)}&title=${encodeURIComponent(title)}`;
    try {
      const res = await fetch(primary);
      if (res.ok) return res;
    } catch {
      // continue to fallback
    }
    const waits = [0, 4000, 10000, 20000];
    for (let attempt = 0; attempt < waits.length; attempt++) {
      if (waits[attempt]) {
        onStatus(`Retrying (${attempt + 1}/${waits.length})`);
        await new Promise((r) => setTimeout(r, waits[attempt]));
      } else onStatus("Trying another source");
      try {
        const res = await fetch(
          `/api/video/fallback?id=${encodeURIComponent(id)}&type=${type}&title=${encodeURIComponent(title)}`,
        );
        if (res.ok) return res;
      } catch {
        // next attempt
      }
    }
    return null;
  };

  const handleDownloadFile = async () => {
    if (!downloadModalVideo || downloadInProgress) return;
    setDownloadInProgress(true);
    setDownloads((items) => [
      { id: downloadModalVideo.id, title: downloadModalVideo.title, status: "Downloading" },
      ...items.filter((item) => item.id !== downloadModalVideo.id),
    ]);
    setDownloadModalOpen(false);
    setDownloadProgressText(
      downloadType === "audio"
        ? `Preparing & encoding ${selectedQuality}kbps audio...`
        : `Rendering ${selectedQuality}p MP4 video...`,
    );

    try {
      const vid = downloadModalVideo;
      const setStatus = (status: string) =>
        setDownloads((items) => items.map((item) => (item.id === vid.id ? { ...item, status } : item)));
      const res = await fetchMediaWithFallback(vid.id, downloadType, selectedQuality, vid.title, setStatus);

      if (!res) {
        setStatus("Sources busy — tap Download again");
        setMessage("All download sources are busy right now. Try again in a minute.");
        return;
      }

      setDownloadProgressText("Transferring file to your downloads...");
      const blob = await res.blob();
      const ext =
        res.headers.get("x-spoiled-ext") ||
        (downloadType === "audio" ? (selectedQuality === "128" ? "m4a" : "mp3") : "mp4");
      const sanitized =
        downloadModalVideo.title.replace(/[^\w\s.-]/gi, "").trim() || "spoiled-media";
      const filename = `${sanitized}.${ext}`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);

      setDownloads((items) =>
        items.map((item) =>
          item.id === downloadModalVideo.id ? { ...item, status: "Saved to device" } : item,
        ),
      );
      setMessage(`Downloaded "${filename}" successfully!`);
      setDownloadModalOpen(false);
    } catch (err: unknown) {
      console.error("Download error:", err);
      setDownloads((items) =>
        items.map((item) =>
          item.id === downloadModalVideo.id ? { ...item, status: "Failed" } : item,
        ),
      );
      setMessage("Download failed. Please try again later.");
    } finally {
      setDownloadInProgress(false);
      setDownloadProgressText("");
    }
  };

  const handleSaveToLocalLibrary = async () => {
    if (!downloadModalVideo || downloadInProgress) return;
    setDownloadInProgress(true);
    setDownloads((items) => [
      { id: downloadModalVideo.id, title: downloadModalVideo.title, status: "Adding to library" },
      ...items.filter((item) => item.id !== downloadModalVideo.id),
    ]);
    setDownloadModalOpen(false);
    setDownloadProgressText("Importing audio into your library...");

    try {
      const vid = downloadModalVideo;
      const setStatus = (status: string) =>
        setDownloads((items) => items.map((item) => (item.id === vid.id ? { ...item, status } : item)));
      const res = await fetchMediaWithFallback(vid.id, "audio", "320", vid.title, setStatus);
      if (!res) {
        setStatus("Sources busy — tap Add again");
        setMessage("All download sources are busy right now. Try again in a minute.");
        return;
      }

      const blob = await res.blob();
      const ext = res.headers.get("x-spoiled-ext") || "mp3";
      const mime = blob.type && blob.type.startsWith("audio") ? blob.type : ext === "mp3" ? "audio/mpeg" : `audio/${ext === "m4a" ? "mp4" : ext}`;
      const file = new File([blob], `${downloadModalVideo.title}.${ext}`, { type: mime });
      const before = new Set(p.library.map((track) => track.id));
      await p.addFiles([file]);
      // The imported track is committed on the next render.
      pendingArtwork.current = { previousIds: before, thumbnail: downloadModalVideo.thumbnail };
      setDownloads((items) =>
        items.map((item) =>
          item.id === downloadModalVideo.id ? { ...item, status: "Added to library" } : item,
        ),
      );
      setMessage(`"${downloadModalVideo.title}" added to your local library!`);
      setDownloadModalOpen(false);
    } catch (err: unknown) {
      console.error("Save to library error:", err);
      setDownloads((items) =>
        items.map((item) =>
          item.id === downloadModalVideo.id ? { ...item, status: "Failed" } : item,
        ),
      );
      setMessage("Connection dropped during the download. Try again.");
    } finally {
      setDownloadInProgress(false);
      setDownloadProgressText("");
    }
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
        {tracks.map((t) => (
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
              <Art track={t} className="track-art" />
              <span className="track-copy">
                <strong>{t.title}</strong>
                <small>
                  {t.artist} · {t.album}
                </small>
              </span>
            </Button>
            <span className="track-duration">{t.duration ? fmt(t.duration) : ""}</span>
            <Button
              variant="ghost"
              size="icon"
              title={`Options for ${t.title}`}
              onClick={() => setMenu(menu === t.id ? null : t.id)}
            >
              <MoreHorizontal />
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
    ["now", "lyrics", "queue", "album", "playlist", "liked", "search", "settings"] as Screen[]
  ).includes(screen)
    ? previous
    : screen;

  const isVelvet = theme.startsWith("Velvet");
  const isDark =
    isVelvet || theme.toLowerCase().includes("dark") || theme.toLowerCase().includes("obsidian");

  return (
    <div
      className={`app-shell ${isDark ? "dark" : ""} ${isVelvet ? "velvet" : ""} ${p.current ? "has-mini" : ""} player-style-${playerStyle.toLowerCase().replace(/\s+/g, "-")} ${["now", "lyrics", "queue"].includes(screen) ? "immersive-player" : ""} ${["home", "library"].includes(screen) ? "scroll-page" : "fixed-page"}`}
    >
      <div className="ambient-liquid-orbs" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <input
        ref={customArtInput}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f && p.current) {
            await p.setTrackArtwork(p.current.id, f);
            setMessage("Song picture updated.");
          }
          e.target.value = "";
        }}
      />
      {authOpen && (
        <div className="auth-sheet-backdrop" onClick={() => setAuthOpen(false)}>
          <form
            className="auth-sheet"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              void emailAuth();
            }}
          >
            <h2>{authMode === "signin" ? "Sign in" : "Create account"}</h2>
            <input
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              autoComplete={authMode === "signin" ? "current-password" : "new-password"}
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
            />
            <Button type="submit" disabled={accountBusy}>
              {authMode === "signin" ? "Sign in" : "Create account"}
            </Button>
            <Button type="button" variant="outline" onClick={signIn} disabled={accountBusy}>
              Continue with Google
            </Button>
            <button
              type="button"
              className="auth-switch"
              onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}
            >
              {authMode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
            </button>
          </form>
        </div>
      )}
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

      <div className="app-layout">
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
                className={activeNav === s ? "selected" : ""}
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

        <main className="main-screen">
          {screen === "home" && (
            <>
              <div className="topline">
                <div className="topline-brand">
                  <img src={spoiledLiquidLogo} alt="" className="topline-icon" />
                  <span>SPOILED</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="glass-icon-btn"
                  title="Menu"
                  onClick={() => go("settings")}
                >
                  <Menu />
                </Button>
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
                  <Button onClick={() => files.current?.click()}>
                    <Plus />
                    Add music
                  </Button>
                  <Button variant="outline" onClick={() => folder.current?.click()}>
                    <FolderPlus />
                    Import folder
                  </Button>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="glass-icon-btn"
                  title="Add music"
                  onClick={() => files.current?.click()}
                >
                  <Plus />
                </Button>
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
                    <select
                      aria-label="Sort tracks"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="Recently Added">Date added</option>
                      <option value="Name">Name</option>
                      <option value="Most Played">Most played</option>
                      <option value="Artist A–Z">Artist A–Z</option>
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
              <header className="page-head">
                <div>
                  <p className="eyebrow">BEYOND YOUR LIBRARY</p>
                  <h1>Explore</h1>
                </div>
                <Compass className="h-6 w-6 text-muted-foreground" />
              </header>

              <div className="video-search-bar">
                <div className="video-search-input-wrap">
                  <input
                    aria-label="Search videos"
                    placeholder="Search songs, artists or videos…"
                    value={youtubeQuery}
                    onChange={(e) => setYoutubeQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void searchOnlineVideos(youtubeQuery);
                    }}
                  />
                </div>
                <Button
                  className="video-search-btn"
                  onClick={() => void searchOnlineVideos(youtubeQuery)}
                  disabled={onlineLoading}
                >
                  <Search className="h-4 w-4" /> Search
                </Button>
              </div>
              <div className="section-title">
                <h2>Videos</h2>
              </div>
              {onlineLoading && <p className="muted-note">Loading videos…</p>}
              {!onlineLoading && onlineVideos.length === 0 && (
                <p className="muted-note">
                  No videos available right now. Search for something else.
                </p>
              )}
              {downloads.length > 0 && (
                <div className="download-activity">
                  <h2>Downloads</h2>
                  {downloads.map((item) => (
                    <div key={item.id}>
                      <span title={item.title}>{item.title}</span>
                      <small>{item.status}</small>
                    </div>
                  ))}
                </div>
              )}
              {
                <div>
                  {/* Online Video Grid if searched */}
                  {onlineVideos.length > 0 && (
                    <div>
                      <div className="section-title">
                        <h2 className="flex items-center gap-2">Videos ({onlineVideos.length})</h2>
                        {onlineLoading && (
                          <span className="text-xs text-muted-foreground animate-pulse">
                            Searching…
                          </span>
                        )}
                      </div>
                      <div className="video-grid">
                        {onlineVideos.map((vid) => (
                          <div key={vid.id} className="video-card" onClick={() => watchVideo(vid)}>
                            <div className="video-thumb-wrap">
                              <img src={vid.thumbnail} alt={vid.title} />
                              <div className="video-play-overlay">
                                <div className="video-play-circle">
                                  <Play className="h-6 w-6 fill-current ml-0.5" />
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
                                <button
                                  className="watch-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    watchVideo(vid);
                                  }}
                                >
                                  <Play className="h-3.5 w-3.5 fill-current" /> Watch Video
                                </button>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDownloadModal(vid, "video");
                                    }}
                                    title="Download Video or Audio"
                                  >
                                    <Download className="h-3.5 w-3.5 mr-1 text-emerald-500" />{" "}
                                    Download
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      watchVideo(vid, true);
                                    }}
                                    title="Watch in Mini Player"
                                  >
                                    <Minimize2 className="h-3.5 w-3.5 mr-1" /> PiP
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              }
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="glass-icon-btn"
                  title="Menu"
                  onClick={() => go("settings")}
                >
                  <Menu />
                </Button>
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
                  <div className="account-controls">
                    <Button variant="outline" onClick={() => switchAccount()} disabled={accountBusy}>
                      Switch account
                    </Button>
                    <Button variant="outline" onClick={signOut} disabled={accountBusy}>
                      Sign out
                    </Button>
                  </div>
                ) : (
                  <div className="account-controls">
                    <Button onClick={signIn} disabled={accountBusy}>
                      Sign in with Google
                    </Button>
                    <Button variant="outline" onClick={() => setAuthOpen(true)} disabled={accountBusy}>
                      Email & password
                    </Button>
                  </div>
                )}
                {recentAccounts.filter((e) => e !== account?.email).length > 0 && (
                  <div className="recent-accounts">
                    <small>Switch to</small>
                    {recentAccounts
                      .filter((e) => e !== account?.email)
                      .map((e) => (
                        <button key={e} onClick={() => switchAccount(e)}>
                          {e}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {downloads.length > 0 && (
                <div className="download-activity">
                  <h2>Downloads</h2>
                  {downloads.map((item) => (
                    <div key={item.id}>
                      <span title={item.title}>{item.title}</span>
                      <small>{item.status}</small>
                    </div>
                  ))}
                </div>
              )}

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
                        <div key={vid.id} className="video-card" onClick={() => watchVideo(vid)}>
                          <div className="video-thumb-wrap">
                            <img src={vid.thumbnail} alt={vid.title} />
                            <div className="video-play-overlay">
                              <div className="video-play-circle">
                                <Play className="h-6 w-6 fill-current ml-0.5" />
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
                              <button
                                className="watch-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  watchVideo(vid);
                                }}
                              >
                                <Play className="h-3.5 w-3.5 fill-current" /> Watch Video
                              </button>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDownloadModal(vid, "video");
                                  }}
                                  title="Download Video or Audio"
                                >
                                  <Download className="h-3.5 w-3.5 mr-1 text-emerald-500" />{" "}
                                  Download
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    watchVideo(vid, true);
                                  }}
                                  title="Picture-in-Picture Mini Player"
                                >
                                  <Minimize2 className="h-3.5 w-3.5 mr-1" /> PiP
                                </Button>
                              </div>
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
                        <p className="eyebrow flex items-center gap-1.5">
                          <Youtube className="h-3.5 w-3.5 text-red-500" /> ONLINE PLAYER
                        </p>
                        <h1 className="truncate max-w-[500px] text-lg font-bold">
                          {activeWatchVideo.title}
                        </h1>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="download-cta-btn"
                        onClick={() => openDownloadModal(activeWatchVideo, "video")}
                      >
                        <Download className="h-4 w-4" /> Download Media
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
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <Youtube className="h-4 w-4 text-red-500" />
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
                            onClick={() => openDownloadModal(activeWatchVideo, "video")}
                          >
                            <Download className="h-4 w-4" /> Download Video
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDownloadModal(activeWatchVideo, "audio")}
                          >
                            <Music className="mr-1.5 h-4 w-4 text-emerald-500" /> Download Audio
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
                    onChange={(e) => {
                      setTheme(e.target.value);
                      localStorage.setItem("spoiled-theme", e.target.value);
                    }}
                  >
                    <option>Liquid Glass (Light)</option>
                    <option>Liquid Obsidian (Dark)</option>
                    <option>Velvet Night (Deep)</option>
                  </select>
                </div>
                <div className="settings-row">
                  <Disc3 />
                  <span>Player style</span>
                  <select
                    aria-label="Player style"
                    value={playerStyle}
                    onChange={(e) => {
                      setPlayerStyle(e.target.value);
                      localStorage.setItem("spoiled-player-style", e.target.value);
                    }}
                  >
                    <option>Default</option>
                    <option>Modern Vinyl</option>
                    <option>Classic Vinyl</option>
                    <option>CD</option>
                    <option>Cassette</option>
                  </select>
                </div>
                <div className="settings-row">
                  <ImagePlus />
                  <span>Picture for current song</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!p.current}
                    onClick={() => customArtInput.current?.click()}
                  >
                    Choose from gallery
                  </Button>
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
                  <div className="large-cover">
                    <Art track={p.current} />
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
                      title={
                        playMode === "loop-all"
                          ? "Loop playlist"
                          : playMode === "loop-one"
                            ? "Loop one song"
                            : "Shuffle"
                      }
                      onClick={cyclePlayMode}
                      className="control-active"
                    >
                      {playMode === "loop-all" ? (
                        <Repeat2 />
                      ) : playMode === "loop-one" ? (
                        <Repeat1 />
                      ) : (
                        <Shuffle />
                      )}
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
                      title="Song picture"
                      onClick={() => customArtInput.current?.click()}
                    >
                      <ImagePlus />
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
                        setInfoDraft({
                          title: p.current?.title ?? "",
                          artist: p.current?.artist ?? "",
                          album: p.current?.album ?? "",
                        });
                        setEditInfo(true);
                      }}
                      disabled={!p.current}
                    >
                      <SlidersHorizontal className="mr-1 h-4 w-4" /> Info
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

      {editInfo && p.current && (
        <div className="download-sheet-backdrop" onClick={() => setEditInfo(false)}>
          <form
            className="download-sheet info-sheet"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!p.current) return;
              void p
                .updateTrackInfo(p.current.id, {
                  title: infoDraft.title.trim() || p.current.title,
                  artist: infoDraft.artist.trim() || p.current.artist,
                  album: infoDraft.album.trim() || p.current.album,
                })
                .then(() => {
                  setEditInfo(false);
                  setMessage("Song info saved");
                });
            }}
          >
            <div className="download-sheet-header">
              <h3>Song info</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setEditInfo(false)}
                title="Close"
              >
                <X />
              </Button>
            </div>
            <div className="info-fields">
              <label>
                Title
                <input
                  value={infoDraft.title}
                  onChange={(e) => setInfoDraft({ ...infoDraft, title: e.target.value })}
                />
              </label>
              <label>
                Artist
                <input
                  value={infoDraft.artist}
                  onChange={(e) => setInfoDraft({ ...infoDraft, artist: e.target.value })}
                />
              </label>
              <label>
                Album
                <input
                  value={infoDraft.album}
                  onChange={(e) => setInfoDraft({ ...infoDraft, album: e.target.value })}
                />
              </label>
              <Button type="submit">Save</Button>
            </div>
          </form>
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

              {/* Direct Fast Downloader Active Info */}
              {/* Download Buttons */}
              <div className="flex flex-col gap-2.5 pt-2">
                <Button
                  className="download-cta-btn w-full justify-center text-sm h-11"
                  disabled={downloadInProgress}
                  onClick={handleDownloadFile}
                >
                  {downloadInProgress ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing Download…
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" /> Download{" "}
                      {downloadType === "video"
                        ? `${selectedQuality}p Video`
                        : `${selectedQuality}kbps Audio`}
                    </>
                  )}
                </Button>

                {downloadType === "audio" && (
                  <Button
                    variant="outline"
                    className="w-full justify-center text-xs h-10 border-white/60 dark:border-white/20"
                    disabled={downloadInProgress}
                    onClick={handleSaveToLocalLibrary}
                  >
                    <FolderPlus className="mr-2 h-4 w-4 text-emerald-500" />
                    Save Track Directly to SPOILED Local Music Library
                  </Button>
                )}
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

      {/* Mobile Bottom Navigation (Home, Library, Explore, Profile) */}
      <nav className="bottom-nav" aria-label="Main navigation">
        {nav.map(({ screen: s, label, icon: Icon }) => (
          <Button
            variant="ghost"
            key={s}
            onClick={() => go(s)}
            className={activeNav === s ? "active" : ""}
          >
            <Icon />
            <span>{label}</span>
          </Button>
        ))}
      </nav>
    </div>
  );
}

function Empty({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon-wrapper">
        <img src={spoiledLiquidLogo} alt="SPOILED" className="empty-liquid-icon" />
      </div>
      <h3>{label}</h3>
      <p>Choose audio files from your device to get started.</p>
      <Button onClick={onAdd}>
        <Plus />
        Add music
      </Button>
    </div>
  );
}
