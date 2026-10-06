import { describe, it, expect } from "vitest";
import {
  isMediaStoreAvailable,
  queryDeviceAudioFiles,
  nativeTrackToPlayerTrack,
  type NativeAudioTrack,
} from "../lib/native-mediastore";

describe("Native MediaStore Audio Bridge", () => {
  it("detects that non-native / web environment does not have MediaStore available", () => {
    expect(isMediaStoreAvailable()).toBe(false);
  });

  it("returns safe NOT_ANDROID result when queryDeviceAudioFiles is called on web", async () => {
    const result = await queryDeviceAudioFiles();
    expect(result.success).toBe(false);
    expect(result.error).toBe("NOT_ANDROID");
    expect(result.tracks).toEqual([]);
  });

  it("correctly converts a NativeAudioTrack to a Player Track with content URI", () => {
    const nativeTrack: NativeAudioTrack = {
      id: "mediastore-42",
      mediaStoreId: 42,
      title: "Midnight City",
      artist: "M83",
      album: "Hurry Up, We're Dreaming",
      duration: 243.5,
      mimeType: "audio/mpeg",
      contentUri: "content://media/external/audio/media/42",
      albumArtUri: "content://media/external/audio/albumart/10",
    };

    const playerTrack = nativeTrackToPlayerTrack(nativeTrack);
    expect(playerTrack.id).toBe("mediastore-42");
    expect(playerTrack.title).toBe("Midnight City");
    expect(playerTrack.artist).toBe("M83");
    expect(playerTrack.album).toBe("Hurry Up, We're Dreaming");
    expect(playerTrack.duration).toBe(243.5);
    expect(playerTrack.contentUri).toBe("content://media/external/audio/media/42");
    expect(playerTrack.isNativeMediaStore).toBe(true);
    expect(playerTrack.hasEmbeddedPicture).toBe(true);
  });
});
