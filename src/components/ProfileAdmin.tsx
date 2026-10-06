import { useState, useEffect, useRef } from "react";
import {
  User,
  Settings,
  Sparkles,
  ShieldCheck,
  Bell,
  HardDrive,
  Camera,
  Volume2,
  Tv,
  Image,
  Layers,
  History,
  Trash2,
  Download,
  Share2,
  Check,
  AlertCircle,
  ExternalLink,
  Sliders,
  Play,
  Monitor,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAppTitle,
  setAppTitle,
  getAppLogo,
  setAppLogo,
  setFavicon,
  getWatchHistory,
  clearWatchHistory,
  type WatchedVideo,
  BUILTIN_LOGOS,
  getActiveLogoUrl,
  getActiveLogoId,
  selectBuiltinLogo,
  resetToDefaultLogo,
  getDesignSystem,
  setDesignSystem,
  getColorPalette,
  setColorPalette,
  type DesignSystem,
  type ColorPalette,
} from "@/lib/user-preferences";
import type { Track } from "@/lib/player";

interface ProfileAdminProps {
  tracks: Track[];
  onSetTrackArtwork: (trackId: string, blob: Blob) => Promise<void>;
  onPlayTrack?: (trackId: string) => void;
  onOpenVideo?: (video: WatchedVideo) => void;
}

export function ProfileAdmin({
  tracks,
  onSetTrackArtwork,
  onPlayTrack,
  onOpenVideo,
}: ProfileAdminProps) {
  // Admin Branding Customization
  const [appTitleDraft, setAppTitleDraft] = useState(getAppTitle());
  const [activeLogoUrl, setActiveLogoUrl] = useState(getActiveLogoUrl());
  const [activeLogoId, setActiveLogoId] = useState(getActiveLogoId());
  const [designSystem, setDesignSystemState] = useState<DesignSystem>(getDesignSystem());
  const [colorPalette, setColorPaletteState] = useState<ColorPalette>(getColorPalette());
  const [brandSavedStatus, setBrandSavedStatus] = useState<string | null>(null);

  // Artwork Replacement on Tracks
  const [selectedTrackForArt, setSelectedTrackForArt] = useState<string>(tracks[0]?.id || "");
  const [artReplacementStatus, setArtReplacementStatus] = useState<string | null>(null);
  const trackArtInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // Watch History
  const [watchHistory, setWatchHistory] = useState<WatchedVideo[]>([]);

  // Native Android / Capacitor Permission States & Simulation
  const [permissions, setPermissions] = useState({
    camera: "prompt" as PermissionState | string,
    storage: "prompt" as PermissionState | string,
    audio: "prompt" as PermissionState | string,
    notifications: "prompt" as PermissionState | string,
  });

  const [notchPreviewActive, setNotchPreviewActive] = useState(false);
  const [quickSettingsTileStub, setQuickSettingsTileStub] = useState(false);

  // Load Watch History & Check Permissions
  useEffect(() => {
    setWatchHistory(getWatchHistory());

    if (typeof Notification !== "undefined") {
      setPermissions((prev) => ({ ...prev, notifications: Notification.permission }));
    }
  }, []);

  // Handle App Title Save
  const handleSaveAppTitle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appTitleDraft.trim()) return;
    setAppTitle(appTitleDraft.trim());
    setBrandSavedStatus("App title updated globally");
    setTimeout(() => setBrandSavedStatus(null), 2500);
  };

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAppLogo(dataUrl);
      setActiveLogoUrl(dataUrl);
      setActiveLogoId("custom");
      setBrandSavedStatus("Custom brand icon applied");
      setTimeout(() => setBrandSavedStatus(null), 2500);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectBuiltinLogo = (logoId: "obsidian" | "iridescent") => {
    selectBuiltinLogo(logoId);
    setActiveLogoId(logoId);
    const chosen = BUILTIN_LOGOS.find((l) => l.id === logoId);
    if (chosen) setActiveLogoUrl(chosen.url);
    setBrandSavedStatus(`Switched logo to: ${logoId === "iridescent" ? "Iridescent Pastel Glass (Second Logo)" : "Liquid Obsidian (Original Logo)"}`);
    setTimeout(() => setBrandSavedStatus(null), 2500);
  };

  const handleResetLogo = () => {
    resetToDefaultLogo();
    setActiveLogoId("obsidian");
    setActiveLogoUrl(BUILTIN_LOGOS[0].url);
    setBrandSavedStatus("Logo reset to original Liquid Obsidian");
    setTimeout(() => setBrandSavedStatus(null), 2500);
  };

  const handleSelectDesignSystem = (ds: DesignSystem) => {
    setDesignSystem(ds);
    setDesignSystemState(ds);
    setBrandSavedStatus(`Design switched to: ${ds === "cupertino" ? "Cupertino Precision (Prototype Design)" : "Liquid Glass (Original)"}`);
    setTimeout(() => setBrandSavedStatus(null), 2500);
  };

  const handleSelectColorPalette = (cp: ColorPalette) => {
    setColorPalette(cp);
    setColorPaletteState(cp);
    setBrandSavedStatus(`Color palette switched to: ${cp.toUpperCase()}`);
    setTimeout(() => setBrandSavedStatus(null), 2500);
  };

  // Handle Favicon Upload
  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setFavicon(dataUrl);
      setBrandSavedStatus("Dynamic browser favicon updated");
      setTimeout(() => setBrandSavedStatus(null), 2500);
    };
    reader.readAsDataURL(file);
  };

  // Handle Track Artwork Replacement
  const handleTrackArtworkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTrackForArt) return;
    try {
      await onSetTrackArtwork(selectedTrackForArt, file);
      setArtReplacementStatus("Cover artwork updated for selected track!");
      setTimeout(() => setArtReplacementStatus(null), 2500);
    } catch {
      setArtReplacementStatus("Failed to update artwork");
    }
  };

  // Native Permission Triggers
  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissions((p) => ({ ...p, camera: "granted" }));
    } catch {
      setPermissions((p) => ({ ...p, camera: "denied" }));
    }
  };

  const requestAudioPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissions((p) => ({ ...p, audio: "granted" }));
    } catch {
      setPermissions((p) => ({ ...p, audio: "denied" }));
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification !== "undefined") {
      const res = await Notification.requestPermission();
      setPermissions((p) => ({ ...p, notifications: res }));
    }
  };

  const requestStoragePermission = async () => {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      setPermissions((p) => ({
        ...p,
        storage: isPersisted ? "granted" : "prompt",
      }));
    } else {
      setPermissions((p) => ({ ...p, storage: "granted" }));
    }
  };

  // Screen recording bridge stub
  const triggerQuickSettingsScreenRecord = async () => {
    try {
      const navMedia = navigator.mediaDevices as unknown as {
        getDisplayMedia?: (options?: DisplayMediaStreamOptions) => Promise<MediaStream>;
      };
      if (navMedia && typeof navMedia.getDisplayMedia === "function") {
        const stream = await navMedia.getDisplayMedia({
          video: true,
        });
        setQuickSettingsTileStub(true);
        setTimeout(() => {
          stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
          setQuickSettingsTileStub(false);
        }, 3000);
      } else {
        setQuickSettingsTileStub(true);
        setTimeout(() => setQuickSettingsTileStub(false), 2500);
      }
    } catch {
      setQuickSettingsTileStub(false);
    }
  };

  return (
    <div className="profile-admin-suite space-y-6 pb-8">
      {/* External/Lock-screen Simulated Notch Preview Overlay (Strictly reserved for external states) */}
      {notchPreviewActive && (
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none flex justify-center">
          <div className="w-36 h-6 bg-black rounded-b-2xl flex items-center justify-center gap-2 px-3 border-b border-x border-white/20 shadow-2xl">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono text-white/90">External Preview</span>
            <div className="h-2.5 w-2.5 rounded-full bg-slate-800" />
          </div>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="p-4 rounded-3xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 backdrop-blur-2xl shadow-xl flex items-center gap-3.5">
        <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-primary/10 border-2 border-white/40 dark:border-white/15 shadow-md flex items-center justify-center shrink-0">
          {activeLogoUrl ? (
            <img src={activeLogoUrl} alt="App Logo" className="w-full h-full object-cover" />
          ) : (
            <User className="h-8 w-8 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-0.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Master Administrator</span>
          </div>
          <h2 className="text-base font-bold text-foreground truncate">{appTitleDraft}</h2>
          <p className="text-xs text-muted-foreground">
            {designSystem === "cupertino" ? "Cupertino Precision Glass (Prototype)" : "Liquid Glass Design"} · {colorPalette.toUpperCase()}
          </p>
        </div>
      </div>

      {/* SECTION 1: App Logos & Brand Identity */}
      <div className="p-4 rounded-3xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/20 dark:border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5 text-emerald-500" />
            <span>App Logo & Brand Mark</span>
          </h3>
          {activeLogoId !== "obsidian" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
              onClick={handleResetLogo}
            >
              Reset to Original
            </Button>
          )}
        </div>

        {/* Changeable Logos Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-muted-foreground">
            Select App Logo (Changeable Brand Icon)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BUILTIN_LOGOS.map((logo) => {
              const isSelected = activeLogoId === logo.id;
              return (
                <button
                  key={logo.id}
                  type="button"
                  onClick={() => handleSelectBuiltinLogo(logo.id as "obsidian" | "iridescent")}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                    isSelected
                      ? "bg-primary/10 border-primary shadow-md ring-2 ring-primary/30"
                      : "bg-white/30 dark:bg-white/5 border-white/20 dark:border-white/10 hover:bg-white/50 dark:hover:bg-white/10"
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/30 shadow-sm bg-black/10">
                    <img src={logo.url} alt={logo.label} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-foreground truncate">{logo.label}</span>
                      {isSelected && (
                        <span className="shrink-0 text-[10px] bg-primary text-primary-foreground font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Check className="h-2.5 w-2.5" /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{logo.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Change App Title */}
        <form onSubmit={handleSaveAppTitle} className="space-y-2 pt-2 border-t border-white/10">
          <label className="block text-xs font-semibold text-muted-foreground">
            App Name / Wordmark
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={appTitleDraft}
              onChange={(e) => setAppTitleDraft(e.target.value)}
              className="flex-1 h-9 px-3 rounded-xl bg-white/60 dark:bg-white/5 border border-white/30 dark:border-white/10 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <Button type="submit" size="sm" className="h-9 px-4 text-xs font-bold rounded-xl">
              Save Title
            </Button>
          </div>
        </form>

        {/* Custom Uploads */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Upload Custom Logo
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              className="w-full text-xs h-9 rounded-xl border-white/30 dark:border-white/10 justify-center"
            >
              Custom File
            </Button>
            <input
              type="file"
              ref={logoInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Update Favicon
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => faviconInputRef.current?.click()}
              className="w-full text-xs h-9 rounded-xl border-white/30 dark:border-white/10 justify-center"
            >
              Upload Favicon
            </Button>
            <input
              type="file"
              ref={faviconInputRef}
              accept="image/png,image/x-icon,image/svg+xml"
              className="hidden"
              onChange={handleFaviconUpload}
            />
          </div>
        </div>

        {brandSavedStatus && (
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-semibold text-center border border-emerald-500/25">
            {brandSavedStatus}
          </div>
        )}
      </div>

      {/* SECTION 1B: Design System & Color Prototype Switcher */}
      <div className="p-4 rounded-3xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/20 dark:border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-indigo-500" />
            <span>Design Style & Color Palettes</span>
          </h3>
        </div>

        {/* Design System Choice */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-muted-foreground">
            Design Prototype (Switch Between Design Layouts)
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleSelectDesignSystem("liquid")}
              className={`p-3 rounded-2xl border text-left transition-all ${
                designSystem === "liquid"
                  ? "bg-primary text-primary-foreground border-primary shadow-lg"
                  : "bg-white/30 dark:bg-white/5 border-white/20 dark:border-white/10 text-foreground hover:bg-white/50"
              }`}
            >
              <div className="font-bold text-xs mb-0.5">Liquid Glass (Original)</div>
              <div className="text-[11px] opacity-80 leading-tight">
                Organic fluid orbs, liquid soundwave & gloss docks
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleSelectDesignSystem("cupertino")}
              className={`p-3 rounded-2xl border text-left transition-all ${
                designSystem === "cupertino"
                  ? "bg-primary text-primary-foreground border-primary shadow-lg"
                  : "bg-white/30 dark:bg-white/5 border-white/20 dark:border-white/10 text-foreground hover:bg-white/50"
              }`}
            >
              <div className="font-bold text-xs mb-0.5 flex items-center justify-between">
                <span>Cupertino Precision</span>
                <span className="text-[9px] px-1 py-0.2 bg-emerald-500 text-white rounded font-mono">NEW</span>
              </div>
              <div className="text-[11px] opacity-80 leading-tight">
                Precision frosted cards, hairline borders, clean mobile layout
              </div>
            </button>
          </div>
        </div>

        {/* 3 Color Palettes for the Design */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <label className="block text-xs font-semibold text-muted-foreground">
            Color Palette (All 3 Colors Available for Current Design)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleSelectColorPalette("light")}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                colorPalette === "light"
                  ? "bg-white text-slate-900 border-white shadow-md ring-2 ring-primary"
                  : "bg-white/40 dark:bg-white/5 border-white/20 text-foreground"
              }`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => handleSelectColorPalette("dark")}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                colorPalette === "dark"
                  ? "bg-slate-900 text-white border-slate-700 shadow-md ring-2 ring-primary"
                  : "bg-white/40 dark:bg-white/5 border-white/20 text-foreground"
              }`}
            >
              Dark (Obsidian)
            </button>
            <button
              type="button"
              onClick={() => handleSelectColorPalette("deep")}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                colorPalette === "deep"
                  ? "bg-indigo-950 text-indigo-100 border-indigo-700 shadow-md ring-2 ring-primary"
                  : "bg-white/40 dark:bg-white/5 border-white/20 text-foreground"
              }`}
            >
              Deep (Midnight)
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Replace Cover Artwork on Any Library Track */}
      <div className="p-4 rounded-3xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 backdrop-blur-xl shadow-lg space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Image className="h-3.5 w-3.5 text-cyan-500" />
          <span>Replace Track Cover Artwork</span>
        </h3>

        {tracks.length > 0 ? (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-muted-foreground font-semibold mb-1">
                Target Song in Library:
              </label>
              <select
                value={selectedTrackForArt}
                onChange={(e) => setSelectedTrackForArt(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-white/60 dark:bg-white/5 border border-white/30 dark:border-white/10 text-xs focus:outline-none"
              >
                {tracks.map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                    {t.title} — {t.artist}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => trackArtInputRef.current?.click()}
                className="w-full h-9 rounded-xl border-white/30 dark:border-white/10 text-xs font-semibold"
              >
                Upload Image
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!selectedTrackForArt) return;
                  try {
                    const logoUrl = customLogo || "/favicon.png";
                    const res = await fetch(logoUrl);
                    const blob = await res.blob();
                    await onSetTrackArtwork(selectedTrackForArt, blob);
                    setArtReplacementStatus("Real SPOILED app logo applied!");
                    setTimeout(() => setArtReplacementStatus(null), 2500);
                  } catch {
                    setArtReplacementStatus("Failed to apply app logo");
                  }
                }}
                className="w-full h-9 rounded-xl border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-semibold gap-1"
              >
                <Sparkles className="h-3.5 w-3.5" /> Use App Logo
              </Button>
            </div>
            <input
              type="file"
              ref={trackArtInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleTrackArtworkFile}
            />

            {artReplacementStatus && (
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs text-center border border-emerald-500/25">
                {artReplacementStatus}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Add songs to your library first to customize their artwork.
          </p>
        )}
      </div>

      {/* SECTION 3: Native Android & Capacitor Permissions & Bridges */}
      <div className="p-4 rounded-3xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/20 dark:border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5 text-indigo-500" />
            <span>Native Android / Capacitor Shell Bridge</span>
          </h3>
          <span className="text-[10px] font-mono text-emerald-500">Capacitor v8 Ready</span>
        </div>

        {/* Permission Triggers */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Button
            variant="outline"
            size="sm"
            onClick={requestCameraPermission}
            className={`h-9 rounded-xl border-white/30 dark:border-white/10 justify-between ${
              permissions.camera === "granted" ? "border-emerald-500/40 text-emerald-500" : ""
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5" /> Camera
            </span>
            <span className="font-mono text-[10px] uppercase">{permissions.camera}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={requestAudioPermission}
            className={`h-9 rounded-xl border-white/30 dark:border-white/10 justify-between ${
              permissions.audio === "granted" ? "border-emerald-500/40 text-emerald-500" : ""
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5" /> Audio / Mic
            </span>
            <span className="font-mono text-[10px] uppercase">{permissions.audio}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={requestStoragePermission}
            className={`h-9 rounded-xl border-white/30 dark:border-white/10 justify-between ${
              permissions.storage === "granted" ? "border-emerald-500/40 text-emerald-500" : ""
            }`}
          >
            <span className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" /> Storage Persist
            </span>
            <span className="font-mono text-[10px] uppercase">{permissions.storage}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={requestNotificationPermission}
            className={`h-9 rounded-xl border-white/30 dark:border-white/10 justify-between ${
              permissions.notifications === "granted"
                ? "border-emerald-500/40 text-emerald-500"
                : ""
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5" /> Notifications
            </span>
            <span className="font-mono text-[10px] uppercase">{permissions.notifications}</span>
          </Button>
        </div>

        {/* Quick Settings Tile & Notch Controls */}
        <div className="pt-2 border-t border-white/20 dark:border-white/10 flex items-center justify-between text-xs">
          <div>
            <strong className="block font-semibold">Quick Settings Tile Bridge</strong>
            <span className="text-[11px] text-muted-foreground">Screen record & capture tile</span>
          </div>
          <Button
            size="sm"
            onClick={triggerQuickSettingsScreenRecord}
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl"
          >
            {quickSettingsTileStub ? "Tile Invoked…" : "Trigger Tile"}
          </Button>
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <div>
            <strong className="block font-semibold">Notch Simulation Mode</strong>
            <span className="text-[11px] text-muted-foreground">
              Reserved exclusively for lock-screen
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNotchPreviewActive(!notchPreviewActive)}
            className="h-8 text-xs rounded-xl border-white/30 dark:border-white/10"
          >
            {notchPreviewActive ? "Hide Notch" : "Simulate External Notch"}
          </Button>
        </div>
      </div>

      {/* SECTION 4: Monthly Auto-Clearing Watch History */}
      <div className="p-4 rounded-3xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 backdrop-blur-xl shadow-lg space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-white/20 dark:border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-amber-500" />
            <span>Monthly Auto-Clearing Watch History</span>
          </h3>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground">30-Day Cycle</span>
            {watchHistory.length > 0 && (
              <button
                onClick={() => {
                  clearWatchHistory();
                  setWatchHistory([]);
                }}
                className="text-[11px] text-red-500 hover:underline flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>

        {watchHistory.length > 0 ? (
          <div className="space-y-1.5 max-h-60 overflow-y-auto no-scrollbar">
            {watchHistory.map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenVideo?.(item)}
                className="flex items-center justify-between p-2 rounded-2xl bg-white/30 dark:bg-white/5 hover:bg-white/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-12 h-8 rounded-lg object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <strong className="block text-xs truncate">{item.title}</strong>
                    <span className="text-[10px] text-muted-foreground truncate block">
                      {item.channel} · {new Date(item.watchedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <Play className="h-3 w-3 fill-current ml-0.5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            No watch history recorded yet. Watched media automatically clears after 30 days.
          </p>
        )}
      </div>
    </div>
  );
}
