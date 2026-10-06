package fm.spoiled.app;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeMediaSession")
public class MediaSessionPlugin extends Plugin {

    private static final String TAG = "MediaSessionPlugin";
    private static MediaSessionPlugin sPluginInstance;

    @Override
    public void load() {
        super.load();
        sPluginInstance = this;
    }

    public static void dispatchMediaCommand(String action, Double position) {
        if (sPluginInstance != null) {
            JSObject data = new JSObject();
            data.put("action", action);
            if (position != null) {
                data.put("position", position);
            }
            sPluginInstance.notifyListeners("mediaCommand", data);
        }
    }

    @PluginMethod
    public void updatePlaybackState(PluginCall call) {
        try {
            Context context = getContext();
            String title = call.getString("title", "SPOILED FM");
            String artist = call.getString("artist", "Music");
            String album = call.getString("album", "");
            double duration = call.getDouble("duration", 0.0);
            double position = call.getDouble("position", 0.0);
            boolean isPlaying = Boolean.TRUE.equals(call.getBoolean("isPlaying", false));
            String artworkUrl = call.getString("artworkUrl", "");

            Intent intent = new Intent(context, SpoiledMediaService.class);
            intent.setAction(SpoiledMediaService.ACTION_UPDATE_STATE);
            intent.putExtra(SpoiledMediaService.EXTRA_TITLE, title);
            intent.putExtra(SpoiledMediaService.EXTRA_ARTIST, artist);
            intent.putExtra(SpoiledMediaService.EXTRA_ALBUM, album);
            intent.putExtra(SpoiledMediaService.EXTRA_DURATION, duration);
            intent.putExtra(SpoiledMediaService.EXTRA_POSITION, position);
            intent.putExtra(SpoiledMediaService.EXTRA_IS_PLAYING, isPlaying);
            intent.putExtra(SpoiledMediaService.EXTRA_ARTWORK_URL, artworkUrl);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "updatePlaybackState error", e);
            call.reject("Failed to update playback state: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent(context, SpoiledMediaService.class);
            intent.setAction(SpoiledMediaService.ACTION_STOP);
            context.startService(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "stopPlayback error", e);
            call.reject("Failed to stop playback: " + e.getMessage(), e);
        }
    }
}
