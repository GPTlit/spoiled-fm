import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  | "playlist";

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
  const [exploreTab, setExploreTab] = useState<"overview" | "youtube" | "ai">("overview");
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
  const [lyricsTab, setLyricsTab] = useState<"lyrics" | "ai">("lyrics");
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

  const [savedReady, setSavedReady] = useState(false);

  // Synchronized Lyrics
  const currentLyricText = p.current ? lyrics[p.current.id] || "" : "";
  const parsedLrc = useMemo(() => parseLrc(currentLyricText), [currentLyricText]);
  const activeLrcIndex = useMemo(() => findCurrentLrcIndex(parsedLrc, p.time), [parsedLrc, p.time]);
  const lrcContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeLrcIndex >= 0 && lrcContainerRef.current) {
      const activeEl = lrcContainerRef.current.children[activeLrcIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
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

  const go = (next: Screen) => {
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
  const searchOnlineVideos = async (q: string) => {
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
  };

  const watchVideo = (video: OnlineVideo, pip = false) => {
    if (p.playing) p.toggle(); // Gracefully pause local audio when watching video
    setActiveWatchVideo(video);
    setIsPipMode(pip);
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
  }, [query, screen]);

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

  const isDark = theme.toLowerCase().includes("dark") || theme.toLowerCase().includes("obsidian");

  return (
    <div className={`app-shell ${isDark ? "dark" : ""}`}>
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
              className={activeNav === "ai" ? "selected" : ""}
              onClick={() => go("ai")}
            >
              <Sparkles />
              AI Curator
            </Button>
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
                  title="Settings"
                  onClick={() => go("settings")}
                >
                  <Settings2 />
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

              <div
                className="feature"
                style={{
                  backgroundImage: `linear-gradient(0deg, var(--feature-shade), transparent 65%), url(${auroraBanner})`,
                }}
              >
                <div className="feature-content">
                  <span className="feature-kicker">FLUID SOUNDSCAPES</span>
                  <h2>Better Days</h2>
                  <p>A crystal space to discover and immerse.</p>
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  className="feature-play-btn"
                  title="Explore music"
                  onClick={() => go("explore")}
                >
                  <Compass />
                </Button>
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
              <header className="page-head">
                <div>
                  <p className="eyebrow">BEYOND YOUR LIBRARY</p>
                  <h1>Explore</h1>
                </div>
                <Compass className="h-6 w-6 text-muted-foreground" />
              </header>

              <div className="segmented">
                <Button
                  variant="ghost"
                  className={exploreTab === "overview" ? "active" : ""}
                  onClick={() => setExploreTab("overview")}
                >
                  Featured
                </Button>
                <Button
                  variant="ghost"
                  className={exploreTab === "youtube" ? "active" : ""}
                  onClick={() => setExploreTab("youtube")}
                >
                  <Youtube className="mr-1 h-4 w-4 text-red-500 inline" /> YouTube
                </Button>
                <Button
                  variant="ghost"
                  className={exploreTab === "ai" ? "active" : ""}
                  onClick={() => setExploreTab("ai")}
                >
                  <Sparkles className="mr-1 h-4 w-4 inline" /> AI Curator
                </Button>
              </div>

              {exploreTab === "overview" && (
                <>
                  <div
                    className="feature explore-feature"
                    style={{
                      backgroundImage: `linear-gradient(0deg, var(--feature-shade), transparent 70%), url(${auroraBanner})`,
                    }}
                  >
                    <div>
                      <h2>Find your next favorite.</h2>
                      <p>Start with the music you already love.</p>
                    </div>
                  </div>
                  <div className="section-title">
                    <h2>Your albums</h2>
                  </div>
                  {albums.length ? (
                    albumGrid(albums)
                  ) : (
                    <p className="muted-note">Add your music to explore your own collection.</p>
                  )}
                </>
              )}

              {exploreTab === "youtube" && (
                <div>
                  <div className="video-search-bar">
                    <div className="video-search-input-wrap">
                      <input
                        placeholder="Search songs, artists, live concerts, or videos…"
                        value={youtubeQuery}
                        onChange={(e) => setYoutubeQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && youtubeQuery.trim()) {
                            void searchOnlineVideos(youtubeQuery.trim());
                          }
                        }}
                      />
                      {youtubeQuery && (
                        <button
                          type="button"
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setYoutubeQuery("");
                            setOnlineVideos([]);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <Button
                      className="video-search-btn"
                      onClick={() =>
                        youtubeQuery.trim() && void searchOnlineVideos(youtubeQuery.trim())
                      }
                      disabled={onlineLoading}
                    >
                      <Search className="h-4 w-4" /> Search
                    </Button>
                  </div>

                  {/* Trending Quick Search Chips */}
                  <div className="flex gap-2 flex-wrap mb-6">
                    {[
                      "Trending Now",
                      "The Weeknd",
                      "Lo-Fi Beats",
                      "Synthwave",
                      "Hip Hop",
                      "Acoustic",
                      "Frank Ocean",
                      "Daft Punk",
                    ].map((genre) => (
                      <button
                        key={genre}
                        className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/40 dark:bg-white/10 hover:bg-white/70 border border-white/60 dark:border-white/20 transition-all shadow-sm"
                        onClick={() => {
                          setYoutubeQuery(genre);
                          void searchOnlineVideos(genre);
                        }}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>

                  {/* Online Video Grid if searched */}
                  {onlineVideos.length > 0 ? (
                    <div>
                      <div className="section-title">
                        <h2 className="flex items-center gap-2">
                          <Youtube className="text-red-500 h-5 w-5" /> Video Results (
                          {onlineVideos.length})
                        </h2>
                        {onlineLoading && (
                          <span className="text-xs text-muted-foreground animate-pulse">
                            Searching YouTube…
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
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="section-title mt-4">
                        <h2>Quick Discoveries</h2>
                      </div>
                      <div className="grid gap-2">
                        {[
                          { title: "Starboy", artist: "The Weeknd" },
                          { title: "Midnight City", artist: "M83" },
                          { title: "Get Lucky", artist: "Daft Punk" },
                          { title: "Blinding Lights", artist: "The Weeknd" },
                          { title: "Weightless", artist: "Marconi Union" },
                        ].map((item) => (
                          <div key={item.title} className="track-row">
                            <div className="flex-1">
                              <strong>{item.title}</strong>
                              <p className="text-xs text-muted-foreground">{item.artist}</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const q = `${item.artist} - ${item.title}`;
                                setYoutubeQuery(q);
                                void searchOnlineVideos(q);
                              }}
                            >
                              <Search className="mr-1 h-3.5 w-3.5" /> Find Videos
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-red-600 hover:bg-red-700 text-white"
                              onClick={() =>
                                watchVideo({
                                  id: `search_query=${encodeURIComponent(`${item.artist} - ${item.title}`)}`,
                                  title: `${item.title} - ${item.artist}`,
                                  channel: item.artist,
                                  thumbnail:
                                    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop",
                                })
                              }
                            >
                              <Youtube className="mr-1 h-3.5 w-3.5" /> Watch
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {exploreTab === "ai" && (
                <div className="assistant-panel">
                  <p className="assistant-intro">
                    Ask your personal AI Curator for song ideas, artist history, or recommendations.
                  </p>
                  <Button variant="outline" className="mx-auto mb-6" onClick={() => go("ai")}>
                    <Sparkles className="mr-2 h-4 w-4" /> Open Full AI Curator Workspace
                  </Button>
                </div>
              )}
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
                  title="Settings"
                  onClick={() => go("settings")}
                >
                  <Settings2 />
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
                  <Button variant="outline" onClick={signOut} disabled={accountBusy}>
                    Sign out
                  </Button>
                ) : (
                  <Button onClick={signIn} disabled={accountBusy}>
                    Sign in with Google
                  </Button>
                )}
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
                <div className="settings-row">
                  <Sparkles />
                  <span>AI Curator</span>
                  <Button variant="ghost" size="sm" onClick={() => go("ai")}>
                    Open
                  </Button>
                </div>
                <div className="settings-row">
                  <Youtube />
                  <span>YouTube Discovery</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setExploreTab("youtube");
                      go("explore");
                    }}
                  >
                    Search
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
            <div className={`player-screen ${screen === "lyrics" ? "lyrics-screen" : ""}`}>
              <div className="player-top">
                <Button
                  variant="ghost"
                  size="icon"
                  className="glass-icon-btn"
                  title="Close player"
                  onClick={back}
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
                  <div className="segmented player-tabs">
                    <Button variant="ghost" className="active">
                      Lyrics
                    </Button>
                    <Button variant="ghost" onClick={() => go("ai")}>
                      AI Curator
                    </Button>
                  </div>

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
                    <Button variant="ghost" onClick={() => go("ai")}>
                      <Sparkles className="mr-1 h-4 w-4" /> AI Curator
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

      {/* VidMate-style Floating Video Modal */}
      {activeWatchVideo && !isPipMode && (
        <div className="vidmate-modal-backdrop" onClick={() => setActiveWatchVideo(null)}>
          <div className="vidmate-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="vidmate-modal-header">
              <h3>
                <Youtube className="text-red-500 h-5 w-5" />
                <span className="truncate">{activeWatchVideo.title}</span>
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsPipMode(true)}
                  title="Minimize to Picture-in-Picture"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setActiveWatchVideo(null)}
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="vidmate-iframe-wrap">
              <iframe
                src={getYoutubeEmbedUrl(activeWatchVideo.id)}
                title={activeWatchVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="vidmate-modal-footer">
              <div>
                <strong className="block text-sm">{activeWatchVideo.title}</strong>
                <span className="text-xs text-muted-foreground">
                  {activeWatchVideo.channel}{" "}
                  {activeWatchVideo.duration ? `· ${activeWatchVideo.duration}` : ""}{" "}
                  {activeWatchVideo.views ? `· ${activeWatchVideo.views}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsPipMode(true);
                    setMessage("Playing in Picture-in-Picture.");
                  }}
                >
                  <Minimize2 className="mr-1 h-3.5 w-3.5" /> Mini Player
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMessage(`"${activeWatchVideo.title}" saved to ${selectedPlaylist}`);
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add to {selectedPlaylist}
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
              <button onClick={() => setIsPipMode(false)} title="Maximize Full Player">
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
