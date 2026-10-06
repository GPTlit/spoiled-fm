/**
 * SPOILED — Android Native MediaSession & Foreground Service Bridge
 *
 * Synchronizes playback state, metadata, and artwork with Android's system
 * MediaSession, lock-screen controls, notification drawer, and home-screen widget.
 * Listens for system media controls (Play/Pause/Skip/Seek) and dispatches them to the player.
 */

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface NativeMediaSessionPluginInterface {
  updatePlaybackState(options: {
    title: string;
    artist: string;
    album?: string;
    duration: number;
    position: number;
    isPlaying: boolean;
    artworkUrl?: string;
  }): Promise<{ success: boolean }>;

  stopPlayback(): Promise<{ success: boolean }>;

  addListener(
    eventName: "mediaCommand",
    listenerFunc: (info: { action: "play" | "pause" | "next" | "prev" | "seek"; position?: number }) => void,
  ): Promise<PluginListenerHandle>;
}

const NativeMediaSession = registerPlugin<NativeMediaSessionPluginInterface>("NativeMediaSession");

/**
 * Returns true if running inside Android Capacitor with the native plugin available.
 */
export function isNativeMediaSessionAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/**
 * Updates Android's MediaSession, lockscreen, notification controls, and widget.
 */
export async function updateNativePlayback(data: {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  position?: number;
  isPlaying: boolean;
  artworkUrl?: string;
}): Promise<void> {
  if (!isNativeMediaSessionAvailable()) return;
  try {
    await NativeMediaSession.updatePlaybackState({
      title: data.title || "SPOILED FM",
      artist: data.artist || "Music",
      album: data.album || "",
      duration: data.duration || 0,
      position: data.position || 0,
      isPlaying: Boolean(data.isPlaying),
      artworkUrl: data.artworkUrl || "",
    });
  } catch (e) {
    console.warn("Failed to update native MediaSession:", e);
  }
}

/**
 * Stops the Android Foreground Service and clears the media notification.
 */
export async function stopNativePlayback(): Promise<void> {
  if (!isNativeMediaSessionAvailable()) return;
  try {
    await NativeMediaSession.stopPlayback();
  } catch (e) {
    console.warn("Failed to stop native playback:", e);
  }
}

/**
 * Listens to media actions triggered by Android notification, lock screen, or widget.
 */
export async function listenToNativeMediaCommands(
  callback: (info: { action: "play" | "pause" | "next" | "prev" | "seek"; position?: number }) => void,
): Promise<() => void> {
  if (!isNativeMediaSessionAvailable()) return () => {};
  try {
    const handle = await NativeMediaSession.addListener("mediaCommand", callback);
    return () => {
      void handle.remove();
    };
  } catch (e) {
    console.warn("Failed to register mediaCommand listener:", e);
    return () => {};
  }
}
