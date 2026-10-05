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
  const [customLogo, setCustomLogoState] = useState<string | null>(getAppLogo());
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
      setCustomLogoState(dataUrl);
      setBrandSavedStatus("Custom brand icon applied");
      setTimeout(() => setBrandSavedStatus(null), 2500);
    };
    reader.readAsDataURL(file);
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
        <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-primary/10 border-2 border-white/40 dark:border-white/15 shadow-md flex items-center justify-center">
          {customLogo ? (
            <img src={customLogo} alt="App Logo" className="w-full h-full object-cover" />
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
          <p className="text-xs text-muted-foreground">Mobile Web Applet & Native Shell Bridge</p>
        </div>
      </div>

      {/* SECTION 1: Admin Branding Customization */}
      <div className="p-4 rounded-3xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/20 dark:border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5 text-emerald-500" />
            <span>App Branding & Custom Identity</span>
          </h3>
        </div>

        {/* Change App Title */}
        <form onSubmit={handleSaveAppTitle} className="space-y-2">
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

        {/* Logo & Favicon Upload */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Custom Brand Logo
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              className="w-full text-xs h-9 rounded-xl border-white/30 dark:border-white/10 justify-center"
            >
              Upload New Logo
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => trackArtInputRef.current?.click()}
              className="w-full h-9 rounded-xl border-white/30 dark:border-white/10 text-xs font-semibold"
            >
              Choose Custom Artwork Image
            </Button>
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
