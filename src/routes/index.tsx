import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, Plus, FolderOpen, Search, ListMusic, Library, Home, Volume2, X, ChevronUp, ChevronDown, Sparkles } from "lucide-react";
import { PlayerProvider, usePlayer, fmt, type Track } from "@/lib/player";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SPOILED — Your personal music, beautifully played" },
      { name: "description", content: "A premium liquid-glass music player for your own library, with seamless crossfades and a powerful queue." },
      { property: "og:title", content: "SPOILED — Your personal music, beautifully played" },
      { property: "og:description", content: "Premium local music player with seamless transitions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (<PlayerProvider><App /></PlayerProvider>),
});

type View = "home" | "library" | "search" | "liked";

function Art({ t, size = "w-12 h-12", big }: { t?: Track; size?: string; big?: boolean }) {
  const h = t?.hue ?? 30;
  return (
    <div className={`${size} shrink-0 rounded-2xl grid place-items-center font-display text-foreground/70 shadow-[var(--shadow-soft)]`}
      style={{ background: `radial-gradient(circle at 30% 25%, oklch(0.97 0.03 ${h}), oklch(0.82 0.06 ${h + 20}) 60%, oklch(0.4 0.03 ${h}))` }}>
      <span className={big ? "text-7xl" : "text-lg"}>{t?.title?.[0] ?? "S"}</span>
    </div>
  );
}

function App() {
  const p = usePlayer();
  const [view, setView] = useState<View>("home");
  const [q, setQ] = useState("");
  const [showQueue, setShowQueue] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    let l = p.library;
    if (view === "liked") l = l.filter((t) => t.liked);
    if (view === "search" && q) { const s = q.toLowerCase(); l = l.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(s)); }
    return l;
  }, [p.library, view, q]);

  const nav: [View, string, typeof Home][] = [["home", "Home", Home], ["library", "Library", Library], ["search", "Search", Search], ["liked", "Loved", Heart]];

  return (
    <div className="min-h-screen bg-ambient text-foreground pb-40">
      <input ref={fileRef} type="file" accept="audio/*" multiple hidden onChange={(e) => e.target.files && p.addFiles(e.target.files)} />
      <input ref={dirRef} type="file" multiple hidden {...({ webkitdirectory: "" } as object)} onChange={(e) => e.target.files && p.addFiles(e.target.files)} />

      <div className="mx-auto max-w-7xl grid md:grid-cols-[220px_1fr] gap-6 p-4 md:p-6">
        <aside className="glass rounded-[2rem] p-5 md:sticky md:top-6 h-fit">
          <h1 className="font-display text-4xl tracking-tight">Spoiled</h1>
          <p className="text-xs text-muted-foreground mt-1">your music, indulged.</p>
          <nav className="mt-6 flex md:flex-col gap-1 overflow-x-auto">
            {nav.map(([v, label, Icon]) => (
              <button key={v} onClick={() => setView(v)} className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition ${view === v ? "bg-foreground text-background" : "hover:bg-foreground/5"}`}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </nav>
          <div className="mt-6 hidden md:block space-y-2">
            <button onClick={() => fileRef.current?.click()} className="w-full flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm hover:bg-foreground/5"><Plus className="h-4 w-4" />Add songs</button>
            <button onClick={() => dirRef.current?.click()} className="w-full flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm hover:bg-foreground/5"><FolderOpen className="h-4 w-4" />Add folder</button>
          </div>
          <div className="mt-6 hidden md:block">
            <label className="text-xs text-muted-foreground">Crossfade · {p.crossfade}s</label>
            <input type="range" min={0} max={12} value={p.crossfade} onChange={(e) => p.setCrossfade(+e.target.value)} className="w-full accent-foreground" />
          </div>
        </aside>

        <main className="space-y-6 min-w-0">
          {view === "home" && (
            <section className="glass rounded-[2.5rem] p-8 md:p-12 grid md:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{p.current ? "Now playing" : "Welcome"}</p>
                <h2 className="font-display text-5xl md:text-7xl leading-[0.95] mt-3">{p.current?.title ?? "A music room built around you."}</h2>
                <p className="mt-4 text-muted-foreground">{p.current ? `${p.current.artist} — ${p.current.album}` : "Bring your own files. Everything plays locally, privately, with seamless transitions."}</p>
                {!p.library.length && (
                  <div className="mt-8 flex flex-wrap gap-3">
                    <button onClick={() => dirRef.current?.click()} className="rounded-full bg-foreground text-background px-6 py-3 text-sm">Import a music folder</button>
                    <button onClick={() => fileRef.current?.click()} className="rounded-full border border-border px-6 py-3 text-sm">Choose files</button>
                  </div>
                )}
              </div>
              <Art t={p.current} size="w-48 h-48 md:w-64 md:h-64" big />
            </section>
          )}

          {view === "search" && (
            <div className="glass rounded-full flex items-center gap-3 px-5 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Songs, artists, albums…" className="bg-transparent outline-none flex-1" />
            </div>
          )}

          <section className="glass rounded-[2rem] p-3">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="font-display text-2xl">{view === "liked" ? "Loved" : view === "search" ? "Results" : "Your library"}</h3>
              <span className="text-xs text-muted-foreground">{list.length} songs</span>
            </div>
            {list.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><Sparkles className="h-4 w-4" />{p.library.length ? "Nothing here yet." : "Import music to begin. Name files “Artist - Title” for best results."}</p>
            ) : list.map((t, i) => {
              const isCur = p.current?.id === t.id;
              return (
                <div key={t.id} onDoubleClick={() => p.playTrack(t.id, list.map((x) => x.id))} className={`group grid grid-cols-[2rem_auto_1fr_auto] md:grid-cols-[2rem_auto_1fr_1fr_auto] items-center gap-4 rounded-2xl px-4 py-2 hover:bg-foreground/5 ${isCur ? "bg-foreground/5" : ""}`}>
                  <button onClick={() => p.playTrack(t.id, list.map((x) => x.id))} className="text-xs text-muted-foreground">
                    {isCur && p.playing ? <Pause className="h-4 w-4 text-foreground" /> : <span className="group-hover:hidden">{i + 1}</span>}
                    {!(isCur && p.playing) && <Play className="h-4 w-4 hidden group-hover:block text-foreground" />}
                  </button>
                  <Art t={t} size="w-10 h-10" />
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{t.title}</p><p className="truncate text-xs text-muted-foreground">{t.artist}</p></div>
                  <p className="hidden md:block truncate text-xs text-muted-foreground">{t.album}</p>
                  <div className="flex gap-1">
                    <button onClick={() => p.enqueue(t.id)} title="Play next" className="p-2 rounded-full hover:bg-foreground/10 opacity-0 group-hover:opacity-100"><ListMusic className="h-4 w-4" /></button>
                    <button onClick={() => p.toggleLike(t.id)} className="p-2 rounded-full hover:bg-foreground/10"><Heart className={`h-4 w-4 ${t.liked ? "fill-foreground" : "text-muted-foreground"}`} /></button>
                  </div>
                </div>
              );
            })}
          </section>
        </main>
      </div>

      {showQueue && (
        <div className="fixed right-4 bottom-32 w-[min(380px,calc(100vw-2rem))] max-h-[60vh] overflow-auto glass-strong rounded-[2rem] p-4 z-40 animate-scale-in">
          <div className="flex justify-between items-center mb-2 px-2"><h4 className="font-display text-xl">Up next</h4><button onClick={() => setShowQueue(false)}><X className="h-4 w-4" /></button></div>
          {p.queue.map((id, i) => {
            const t = p.library.find((x) => x.id === id); if (!t) return null;
            return (
              <div key={id + i} className={`flex items-center gap-3 rounded-2xl px-2 py-1.5 ${i === p.index ? "bg-foreground/5" : ""} ${i < p.index ? "opacity-40" : ""}`}>
                <Art t={t} size="w-8 h-8" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm">{t.title}</p><p className="truncate text-xs text-muted-foreground">{t.artist}</p></div>
                <button onClick={() => i > 0 && p.moveInQueue(i, i - 1)}><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => i < p.queue.length - 1 && p.moveInQueue(i, i + 1)}><ChevronDown className="h-4 w-4" /></button>
                {i !== p.index && <button onClick={() => p.removeFromQueue(i)}><X className="h-4 w-4" /></button>}
              </div>
            );
          })}
          {!p.queue.length && <p className="text-sm text-muted-foreground p-2">Queue is empty.</p>}
        </div>
      )}

      <footer className="fixed bottom-4 inset-x-4 z-30 glass-strong rounded-[2rem] px-4 py-3 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_2fr_1fr] items-center gap-4">
        <div className="flex items-center gap-3 min-w-0"><Art t={p.current} /><div className="min-w-0"><p className="truncate text-sm font-medium">{p.current?.title ?? "Nothing playing"}</p><p className="truncate text-xs text-muted-foreground">{p.current?.artist ?? "Spoiled"}</p></div></div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-4">
            <button onClick={() => p.setShuffle(!p.shuffle)} className={`hidden md:block ${p.shuffle ? "" : "text-muted-foreground"}`}><Shuffle className="h-4 w-4" /></button>
            <button onClick={p.prev}><SkipBack className="h-5 w-5" /></button>
            <button onClick={p.toggle} className="h-11 w-11 grid place-items-center rounded-full bg-foreground text-background hover:scale-105 transition">{p.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}</button>
            <button onClick={p.next}><SkipForward className="h-5 w-5" /></button>
            <button onClick={() => p.setRepeat(!p.repeat)} className={`hidden md:block ${p.repeat ? "" : "text-muted-foreground"}`}><Repeat className="h-4 w-4" /></button>
          </div>
          <div className="hidden md:flex items-center gap-2 w-full text-[11px] text-muted-foreground tabular-nums">
            <span>{fmt(p.time)}</span>
            <input type="range" min={0} max={p.duration || 1} step={0.1} value={p.time} onChange={(e) => p.seek(+e.target.value)} className="flex-1 accent-foreground" />
            <span>{fmt(p.duration)}</span>
          </div>
        </div>
        <div className="hidden md:flex items-center justify-end gap-3">
          <button onClick={() => setShowQueue(!showQueue)} className={showQueue ? "" : "text-muted-foreground"}><ListMusic className="h-4 w-4" /></button>
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <input type="range" min={0} max={1} step={0.01} value={p.volume} onChange={(e) => p.setVolume(+e.target.value)} className="w-24 accent-foreground" />
        </div>
      </footer>
    </div>
  );
}
