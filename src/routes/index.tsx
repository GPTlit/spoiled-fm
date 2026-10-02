import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Compass,
  Disc3,
  FolderPlus,
  Heart,
  Home,
  Library,
  ListMusic,
  Mic,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat2,
  Search,
  Settings2,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { PlayerProvider, usePlayer, fmt, type Track } from "@/lib/player";
import logo from "@/assets/spoiled-logo.png.asset.json";
import featured from "@/assets/better-days.jpg";
import afterHours from "@/assets/after-hours.jpg";
import dawn from "@/assets/dawn-fm.jpg";
import tranquility from "@/assets/tranquility.jpg";
import ocean from "@/assets/ocean.jpg";
import night from "@/assets/night.jpg";
import sunflower from "@/assets/sunflower.jpg";

type Screen =
  | "home"
  | "library"
  | "explore"
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
const nav: { screen: Screen; label: string; icon: typeof Home }[] = [
  { screen: "home", label: "Home", icon: Home },
  { screen: "library", label: "Library", icon: Library },
  { screen: "explore", label: "Explore", icon: Compass },
  { screen: "ai", label: "AI", icon: Sparkles },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SPOILED — Your music, your world" },
      {
        name: "description",
        content: "SPOILED is a personal music player for your own local music collection.",
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
  return (
    <div className={`art ${className}`}>
      <img
        src={track ? coverFor(track.album) : logo.url}
        alt={track ? `${track.album} artwork illustration` : "SPOILED"}
      />
    </div>
  );
}

function MusicApp() {
  const p = usePlayer();
  const queryClient = useQueryClient();
  const [account, setAccount] = useState<User | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountBusy, setAccountBusy] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [tab, setTab] = useState<Tab>("Songs");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("Recently Added");
  const [selectedAlbum, setSelectedAlbum] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [playlists, setPlaylists] = useState<{ name: string; ids: string[] }[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [theme, setTheme] = useState("Cream");
  const [message, setMessage] = useState("");
  const files = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  const [previous, setPrevious] = useState<Screen>("home");
  const [lyrics, setLyrics] = useState<Record<string, string>>({});
  const [lyricDraft, setLyricDraft] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [savedReady, setSavedReady] = useState(false);
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
    "Your account";
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
  useEffect(() => {
    try {
      const savedPlaylists = JSON.parse(localStorage.getItem("spoiled-playlists") || "[]");
      const savedLyrics = JSON.parse(localStorage.getItem("spoiled-lyrics") || "{}");
      if (Array.isArray(savedPlaylists)) setPlaylists(savedPlaylists);
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
      setMessage(`Created ${name}`);
    }
  };
  const addToPlaylist = (id: string, name: string) => {
    setPlaylists((v) =>
      v.map((x) => (x.name === name ? { ...x, ids: [...new Set([...x.ids, id])] } : x)),
    );
    setMenu(null);
    setMessage(`Added to ${name}`);
  };
  const rows = (tracks: Track[]) =>
    tracks.length ? (
      <div className="track-list">
        {tracks.map((t, i) => (
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
                <small>{t.artist}</small>
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
                  Play
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    p.enqueue(t.id);
                    setMenu(null);
                    setMessage("Added to play next");
                  }}
                >
                  Play next
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    p.enqueue(t.id);
                    setMenu(null);
                    setMessage("Added to queue");
                  }}
                >
                  Add to queue
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    p.toggleLike(t.id);
                    setMenu(null);
                  }}
                >
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
  return (
    <div className={`app-shell ${theme === "Dark" ? "dark" : ""}`}>
      <input
        ref={files}
        type="file"
        accept="audio/*,.flac"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) {
            p.addFiles(e.target.files);
            setMessage(
              `${e.target.files.length} file${e.target.files.length === 1 ? "" : "s"} added`,
            );
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
        onChange={(e) => {
          if (e.target.files?.length) {
            p.addFiles(e.target.files);
            setMessage(`${e.target.files.length} files selected`);
            e.target.value = "";
          }
        }}
      />
      <div className="app-layout">
        <aside className="desktop-sidebar">
          <img src={logo.url} alt="SPOILED" className="brand-logo" />
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
            <Button variant="ghost" onClick={() => go("search")}>
              <Search />
              Search
            </Button>
            <Button variant="ghost" onClick={() => go("liked")}>
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
            <Button variant="outline" onClick={() => files.current?.click()}>
              <Plus />
              Add music
            </Button>
          </div>
        </aside>
        <main className="main-screen">
          {screen === "home" && (
            <>
              <div className="topline">
                <span>SPOILED</span>
                <Button variant="ghost" size="icon" title="Settings" onClick={() => go("settings")}>
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
                  your music <span className="wave-mini">▮▮▮</span>
                </h1>
              </header>
              <Button variant="ghost" className="search-pill" onClick={() => go("search")}>
                <Search />
                Search your music…
                <Mic className="search-mic" />
              </Button>
              <div
                className="feature"
                style={{
                  backgroundImage: `linear-gradient(0deg, var(--feature-shade), transparent 65%), url(${featured})`,
                }}
              >
                <div>
                  <h2>Better Days</h2>
                  <p>A little space to discover.</p>
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  title="Explore music"
                  onClick={() => go("explore")}
                >
                  <Compass />
                </Button>
              </div>
              <div className="quick-grid">
                <Button variant="ghost" onClick={() => go("liked")}>
                  <Heart />
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
                  <Music2 />
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
                  <Disc3 />
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
          {(screen === "library" || screen === "liked" || screen === "search") && (
            <>
              <header className="page-head">
                <div>
                  <p className="eyebrow">YOUR COLLECTION</p>
                  <h1>
                    {screen === "liked"
                      ? "Loved Songs"
                      : screen === "search"
                        ? "Search"
                        : "Library"}
                  </h1>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  title="Add music"
                  onClick={() => files.current?.click()}
                >
                  <Plus />
                </Button>
              </header>
              {screen === "search" ? (
                <div className="search-pill field">
                  <Search />
                  <input
                    autoFocus
                    placeholder="Songs, artists, albums…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setQuery("")}
                      title="Clear search"
                    >
                      <X />
                    </Button>
                  )}
                </div>
              ) : (
                screen === "library" && (
                  <>
                    <div className="segmented">
                      {(["Songs", "Albums", "Artists", "Playlists"] as Tab[]).map((v) => (
                        <Button
                          variant="ghost"
                          className={tab === v ? "active" : ""}
                          key={v}
                          onClick={() => setTab(v)}
                        >
                          {v}
                        </Button>
                      ))}
                    </div>
                    <div className="library-tools">
                      <Button
                        variant="ghost"
                        onClick={() => playList(p.library, true)}
                        disabled={!p.library.length}
                      >
                        <Shuffle />
                        Shuffle all
                      </Button>
                      <select
                        aria-label="Sort library"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option>Recently Added</option>
                        <option>Title A–Z</option>
                        <option>Artist A–Z</option>
                      </select>
                    </div>
                  </>
                )
              )}
              {screen !== "library" || tab === "Songs" ? (
                rows(list)
              ) : tab === "Albums" ? (
                albumGrid(albums)
              ) : tab === "Artists" ? (
                <div className="artist-list">
                  {artists.length ? (
                    artists.map((a) => (
                      <Button
                        variant="ghost"
                        key={a}
                        onClick={() => {
                          setQuery(a);
                          go("search");
                        }}
                      >
                        <Art track={p.library.find((t) => t.artist === a)} />
                        <span>{a}</span>
                        <ChevronRight />
                      </Button>
                    ))
                  ) : (
                    <Empty onAdd={() => files.current?.click()} label="No artists yet" />
                  )}
                </div>
              ) : (
                <>
                  <div className="create-playlist">
                    <input
                      placeholder="New playlist name"
                      aria-label="New playlist name"
                      value={playlistName}
                      onChange={(e) => setPlaylistName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPlaylist()}
                    />
                    <Button onClick={addPlaylist} disabled={!playlistName.trim()}>
                      <Plus />
                      Create
                    </Button>
                  </div>
                  {playlists.length ? (
                    playlists.map((x) => (
                      <Button
                        key={x.name}
                        variant="ghost"
                        className="playlist-row"
                        onClick={() => {
                          setSelectedPlaylist(x.name);
                          go("playlist");
                        }}
                      >
                        <Music2 />
                        {x.name}
                        <small>{x.ids.length} songs</small>
                        <ChevronRight />
                      </Button>
                    ))
                  ) : (
                    <p className="muted-note">No playlists yet.</p>
                  )}
                </>
              )}
            </>
          )}
          {(screen === "album" || screen === "playlist") && (
            <>
              <header className="detail-head">
                <Button variant="ghost" size="icon" onClick={back} title="Back">
                  <ArrowLeft />
                </Button>
                <span>{screen === "album" ? "Album" : "Playlist"}</span>
              </header>
              <div className="detail-cover">
                {screen === "album" ? (
                  <img src={coverFor(selectedAlbum)} alt="Album artwork illustration" />
                ) : (
                  <Music2 />
                )}
              </div>
              <div className="detail-intro">
                <h1>{screen === "album" ? selectedAlbum : selectedPlaylist}</h1>
                <p>
                  {screen === "album"
                    ? p.library.find((t) => t.album === selectedAlbum)?.artist
                    : "Created by you"}
                </p>
                <small>{list.length} songs</small>
              </div>
              <div className="detail-actions">
                <Button onClick={() => playList(list)} disabled={!list.length}>
                  <Play />
                  Play
                </Button>
                <Button
                  variant="outline"
                  onClick={() => playList(list, true)}
                  disabled={!list.length}
                >
                  <Shuffle />
                  Shuffle
                </Button>
              </div>
              {rows(list)}
            </>
          )}
          {screen === "explore" && (
            <>
              <header className="page-head">
                <div>
                  <p className="eyebrow">BEYOND YOUR LIBRARY</p>
                  <h1>Explore</h1>
                </div>
                <Compass />
              </header>
              <div
                className="feature explore-feature"
                style={{
                  backgroundImage: `linear-gradient(0deg, var(--feature-shade), transparent 70%), url(${featured})`,
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
              <div className="service-note">
                <h3>YouTube discovery</h3>
                <p>Online discovery is not configured. No online results are shown.</p>
              </div>
            </>
          )}
          {screen === "ai" && (
            <>
              <header className="page-head">
                <div>
                  <p className="eyebrow">SPOILED</p>
                  <h1>
                    <Sparkles className="title-icon" /> Music Assistant
                  </h1>
                </div>
              </header>
              <div className="assistant-panel">
                <p className="assistant-intro">Ask about the music in your library.</p>
                {aiText && <p className="chat-user">{aiText}</p>}
                {aiReply && <p className="chat-reply">{aiReply}</p>}
              </div>
              <form
                className="ai-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!aiText.trim()) return;
                  setAiReply(
                    p.library.length
                      ? `I can see ${p.library.length} song${p.library.length === 1 ? "" : "s"} in your local library. Online AI recommendations aren't configured yet.`
                      : "Add some music to your library first. Online AI recommendations aren't configured yet.",
                  );
                }}
              >
                <input
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder="Ask about your music…"
                />
                <Button size="icon" type="submit" title="Send">
                  <ChevronRight />
                </Button>
              </form>
            </>
          )}
          {screen === "settings" && (
            <>
              <header className="page-head">
                <div>
                  <p className="eyebrow">SPOILED</p>
                  <h1>Settings</h1>
                </div>
                <Button variant="ghost" size="icon" title="Back" onClick={back}>
                  <X />
                </Button>
              </header>
              <div className="settings-brand">
                <img src={logo.url} alt="SPOILED logo" />
                <div>
                  <strong>SPOILED</strong>
                  <small>Your music. Your world.</small>
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
                    <option>Cream</option>
                    <option>Dark</option>
                  </select>
                </div>
                <div className="settings-row">
                  <Sparkles />
                  <span>AI</span>
                  <small>Not configured</small>
                </div>
                <div className="settings-row">
                  <Compass />
                  <span>YouTube</span>
                  <small>Not configured</small>
                </div>
              </div>
              <div className="settings-footer">
                <img src={logo.url} alt="" />
                <strong>SPOILED</strong>
                <small>Your Music. Your World.</small>
              </div>
            </>
          )}
          {(screen === "now" || screen === "lyrics" || screen === "queue") && (
            <div className={`player-screen ${screen === "lyrics" ? "lyrics-screen" : ""}`}>
              <div className="player-top">
                <Button variant="ghost" size="icon" title="Close player" onClick={back}>
                  <ChevronDown />
                </Button>
                <span>
                  {screen === "queue" ? "UP NEXT" : screen === "lyrics" ? "LYRICS" : "NOW PLAYING"}
                </span>
                <Button variant="ghost" size="icon" title="Queue" onClick={() => go("queue")}>
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
                      AI
                    </Button>
                  </div>
                  <div className="lyrics-body">
                    {p.current ? (
                      lyrics[p.current.id] ? (
                        <p>{lyrics[p.current.id]}</p>
                      ) : (
                        <>
                          <h2>No lyrics yet</h2>
                          <p>Add your own lyrics for {p.current.title}.</p>
                          <textarea
                            aria-label="Add lyrics"
                            value={lyricDraft}
                            onChange={(e) => setLyricDraft(e.target.value)}
                            placeholder="Paste lyrics you have permission to use…"
                          />
                          <Button
                            onClick={() => {
                              setLyrics((v) => ({ ...v, [p.current?.id ?? ""]: lyricDraft }));
                              setLyricDraft("");
                            }}
                            disabled={!lyricDraft.trim()}
                          >
                            Save lyrics
                          </Button>
                        </>
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
                      <ListMusic />
                      Queue
                    </Button>
                    <Button variant="ghost" onClick={() => go("ai")}>
                      <Sparkles />
                      AI
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
      <Music2 />
      <h3>{label}</h3>
      <p>Choose audio files from your device to get started.</p>
      <Button onClick={onAdd}>
        <Plus />
        Add music
      </Button>
    </div>
  );
}
