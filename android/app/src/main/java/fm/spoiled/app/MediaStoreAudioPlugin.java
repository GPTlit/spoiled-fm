package fm.spoiled.app;

import android.content.ContentUris;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "MediaStoreAudio",
    permissions = {
        @Permission(
            alias = "audioMedia",
            strings = { "android.permission.READ_MEDIA_AUDIO" }
        ),
        @Permission(
            alias = "storageMedia",
            strings = { "android.permission.READ_EXTERNAL_STORAGE" }
        )
    }
)
public class MediaStoreAudioPlugin extends Plugin {

    private boolean isAudioPermissionGranted() {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= 33) {
            return ContextCompat.checkSelfPermission(context, "android.permission.READ_MEDIA_AUDIO") == PackageManager.PERMISSION_GRANTED;
        } else {
            return ContextCompat.checkSelfPermission(context, "android.permission.READ_EXTERNAL_STORAGE") == PackageManager.PERMISSION_GRANTED;
        }
    }

    @PluginMethod
    public void checkAudioPermissions(PluginCall call) {
        boolean granted = isAudioPermissionGranted();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("sdkVersion", Build.VERSION.SDK_INT);
        ret.put("requiredPermission", Build.VERSION.SDK_INT >= 33 ? "READ_MEDIA_AUDIO" : "READ_EXTERNAL_STORAGE");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestAudioPermissions(PluginCall call) {
        if (isAudioPermissionGranted()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        String alias = (Build.VERSION.SDK_INT >= 33) ? "audioMedia" : "storageMedia";
        requestPermissionForAlias(alias, call, "audioPermissionCallback");
    }

    @PermissionCallback
    private void audioPermissionCallback(PluginCall call) {
        boolean granted = isAudioPermissionGranted();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void queryAudio(PluginCall call) {
        if (!isAudioPermissionGranted()) {
            JSObject err = new JSObject();
            err.put("error", "PERMISSION_DENIED");
            err.put("message", "Permission to read device audio was not granted.");
            err.put("tracks", new JSArray());
            call.resolve(err);
            return;
        }

        JSArray tracksArray = new JSArray();

        try {
            Context context = getContext();
            Uri collection;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
            } else {
                collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            }

            String[] projection = new String[] {
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.MIME_TYPE,
                MediaStore.Audio.Media.ALBUM_ID
            };

            // Query music tracks longer than 1 second to avoid notification chimes
            String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0 AND " + MediaStore.Audio.Media.DURATION + " >= 1000";
            String sortOrder = MediaStore.Audio.Media.TITLE + " COLLATE NOCASE ASC";

            try (Cursor cursor = context.getContentResolver().query(collection, projection, selection, null, sortOrder)) {
                if (cursor != null) {
                    int idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                    int titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                    int artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                    int albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
                    int durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                    int mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE);
                    int albumIdCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID);

                    while (cursor.moveToNext()) {
                        long id = cursor.getLong(idCol);
                        String title = cursor.getString(titleCol);
                        String artist = cursor.getString(artistCol);
                        String album = cursor.getString(albumCol);
                        long durationMs = cursor.getLong(durationCol);
                        String mimeType = cursor.getString(mimeCol);
                        long albumId = cursor.getLong(albumIdCol);

                        if (title == null || title.trim().isEmpty()) {
                            title = "Unknown Title";
                        }
                        if (artist == null || artist.trim().isEmpty() || "<unknown>".equalsIgnoreCase(artist)) {
                            artist = "Unknown Artist";
                        }
                        if (album == null || album.trim().isEmpty() || "<unknown>".equalsIgnoreCase(album)) {
                            album = "Unknown Album";
                        }
                        if (mimeType == null) {
                            mimeType = "audio/mpeg";
                        }

                        Uri contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
                        Uri albumArtUri = ContentUris.withAppendedId(Uri.parse("content://media/external/audio/albumart"), albumId);

                        JSObject track = new JSObject();
                        track.put("id", "mediastore-" + id);
                        track.put("mediaStoreId", id);
                        track.put("title", title);
                        track.put("artist", artist);
                        track.put("album", album);
                        track.put("duration", durationMs / 1000.0);
                        track.put("mimeType", mimeType);
                        track.put("contentUri", contentUri.toString());
                        track.put("albumArtUri", albumArtUri.toString());

                        tracksArray.put(track);
                    }
                }
            }

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("count", tracksArray.length());
            res.put("tracks", tracksArray);
            call.resolve(res);
        } catch (Exception e) {
            Logger.error("MediaStoreAudioPlugin: queryAudio failed", e);
            call.reject("Failed to query device audio: " + e.getMessage(), e);
        }
    }
}
