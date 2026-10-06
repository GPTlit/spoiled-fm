/**
 * SPOILED — Native Android MediaStore Audio Bridge
 *
 * Direct bridge to Android's native MediaStore.Audio content provider.
 * Automatically queries songs stored on the device without copying or uploading files.
 * Uses Android content URIs resolved through Capacitor's protocol handler for playback.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Track } from "./player";

export interface NativeAudioTrack {
  id: string;
  mediaStoreId: number;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  mimeType: string;
  contentUri: string;
  albumArtUri?: string;
}

export interface MediaStoreAudioPluginInterface {
  checkAudioPermissions(): Promise<{
    granted: boolean;
    sdkVersion?: number;
    requiredPermission?: string;
  }>;
  requestAudioPermissions(): Promise<{
    granted: boolean;
  }>;
  queryAudio(): Promise<{
    success: boolean;
    count: number;
    tracks: NativeAudioTrack[];
    error?: string;
    message?: string;
  }>;
}

const MediaStoreAudio = registerPlugin<MediaStoreAudioPluginInterface>("MediaStoreAudio");

/**
 * Returns true if the native MediaStore plugin is available (Android Capacitor).
 */
export function isMediaStoreAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/**
 * Check if audio reading permission is granted.
 */
export async function checkDeviceAudioPermission(): Promise<boolean> {
  if (!isMediaStoreAvailable()) return false;
  try {
    const res = await MediaStoreAudio.checkAudioPermissions();
    return Boolean(res.granted);
  } catch (err) {
    console.warn("Could not check native audio permission:", err);
    return false;
  }
}

/**
 * Request runtime audio permission (READ_MEDIA_AUDIO on Android 13+, READ_EXTERNAL_STORAGE on older).
 */
export async function requestDeviceAudioPermission(): Promise<boolean> {
  if (!isMediaStoreAvailable()) return false;
  try {
    const res = await MediaStoreAudio.requestAudioPermissions();
    return Boolean(res.granted);
  } catch (err) {
    console.warn("Could not request native audio permission:", err);
    return false;
  }
}

/**
 * Queries Android MediaStore for music tracks on the device.
 */
export async function queryDeviceAudioFiles(): Promise<{
  success: boolean;
  tracks: NativeAudioTrack[];
  error?: string;
}> {
  if (!isMediaStoreAvailable()) {
    return { success: false, tracks: [], error: "NOT_ANDROID" };
  }

  try {
    const res = await MediaStoreAudio.queryAudio();
    if (res.error) {
      return { success: false, tracks: [], error: res.error };
    }
    return {
      success: true,
      tracks: res.tracks || [],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("MediaStoreAudio.queryAudio failed:", msg);
    return { success: false, tracks: [], error: msg };
  }
}

/**
 * Converts a native MediaStore track record into a SPOILED player Track object.
 * Uses Capacitor.convertFileSrc to map content:// URI to the internal WebView protocol.
 */
export function nativeTrackToPlayerTrack(nat: NativeAudioTrack): Track {
  const playUrl = Capacitor.convertFileSrc(nat.contentUri);
  return {
    id: nat.id,
    title: nat.title,
    artist: nat.artist,
    album: nat.album,
    duration: nat.duration,
    url: playUrl,
    contentUri: nat.contentUri,
    pictureUrl: nat.albumArtUri ? Capacitor.convertFileSrc(nat.albumArtUri) : undefined,
    hasEmbeddedPicture: Boolean(nat.albumArtUri),
    hue: Math.floor(Math.random() * 60) + 20,
    liked: false,
    isNativeMediaStore: true,
  };
}
