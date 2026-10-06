package fm.spoiled.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Build;
import android.widget.RemoteViews;

public class SpoiledAppWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_WIDGET_PLAY_PAUSE = "fm.spoiled.app.WIDGET_PLAY_PAUSE";
    public static final String ACTION_WIDGET_PREV = "fm.spoiled.app.WIDGET_PREV";
    public static final String ACTION_WIDGET_NEXT = "fm.spoiled.app.WIDGET_NEXT";

    private static String sCurrentTitle = "No Track Playing";
    private static String sCurrentArtist = "Tap to open Spoiled";
    private static Bitmap sCurrentArt = null;
    private static boolean sIsPlaying = false;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId, sCurrentTitle, sCurrentArtist, sCurrentArt, sIsPlaying);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (action != null) {
            if (ACTION_WIDGET_PLAY_PAUSE.equals(action) || ACTION_WIDGET_PREV.equals(action) || ACTION_WIDGET_NEXT.equals(action)) {
                Intent serviceIntent = new Intent(context, SpoiledMediaService.class);
                serviceIntent.setAction(action);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            }
        }
    }

    public static void updateAllWidgets(Context context, String title, String artist, Bitmap art, boolean isPlaying) {
        sCurrentTitle = (title != null && !title.isEmpty()) ? title : "No Track Playing";
        sCurrentArtist = (artist != null && !artist.isEmpty()) ? artist : "Tap to open Spoiled";
        sCurrentArt = art;
        sIsPlaying = isPlaying;

        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName widgetComponent = new ComponentName(context, SpoiledAppWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(widgetComponent);
        if (ids != null && ids.length > 0) {
            for (int id : ids) {
                updateAppWidget(context, manager, id, sCurrentTitle, sCurrentArtist, sCurrentArt, sIsPlaying);
            }
        }
    }

    private static void updateAppWidget(
        Context context,
        AppWidgetManager appWidgetManager,
        int appWidgetId,
        String title,
        String artist,
        Bitmap art,
        boolean isPlaying
    ) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.spoiled_app_widget);

        views.setTextViewText(R.id.widget_title, title);
        views.setTextViewText(R.id.widget_artist, artist);

        if (art != null) {
            views.setImageViewBitmap(R.id.widget_art, art);
        } else {
            views.setImageViewResource(R.id.widget_art, R.mipmap.ic_launcher);
        }

        views.setImageViewResource(
            R.id.widget_btn_play_pause,
            isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play
        );

        int flag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            : PendingIntent.FLAG_UPDATE_CURRENT;

        // Click on widget opens app
        Intent openIntent = new Intent(context, MainActivity.class);
        PendingIntent openPending = PendingIntent.getActivity(context, 0, openIntent, flag);
        views.setOnClickPendingIntent(R.id.widget_root, openPending);

        // Previous
        Intent prevIntent = new Intent(context, SpoiledAppWidgetProvider.class);
        prevIntent.setAction(ACTION_WIDGET_PREV);
        views.setOnClickPendingIntent(R.id.widget_btn_prev, PendingIntent.getBroadcast(context, 1, prevIntent, flag));

        // Play / Pause
        Intent playIntent = new Intent(context, SpoiledAppWidgetProvider.class);
        playIntent.setAction(ACTION_WIDGET_PLAY_PAUSE);
        views.setOnClickPendingIntent(R.id.widget_btn_play_pause, PendingIntent.getBroadcast(context, 2, playIntent, flag));

        // Next
        Intent nextIntent = new Intent(context, SpoiledAppWidgetProvider.class);
        nextIntent.setAction(ACTION_WIDGET_NEXT);
        views.setOnClickPendingIntent(R.id.widget_btn_next, PendingIntent.getBroadcast(context, 3, nextIntent, flag));

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
