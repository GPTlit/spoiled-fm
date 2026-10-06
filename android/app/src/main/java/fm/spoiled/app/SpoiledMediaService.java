package fm.spoiled.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class SpoiledMediaService extends Service {

    private static final String TAG = "SpoiledMediaService";
    private static final String CHANNEL_ID = "spoiled_media_playback";
    private static final int NOTIFICATION_ID = 40401;

    public static final String ACTION_PLAY = "fm.spoiled.app.PLAY";
    public static final String ACTION_PAUSE = "fm.spoiled.app.PAUSE";
    public static final String ACTION_PLAY_PAUSE = "fm.spoiled.app.PLAY_PAUSE";
    public static final String ACTION_PREV = "fm.spoiled.app.PREV";
    public static final String ACTION_NEXT = "fm.spoiled.app.NEXT";
    public static final String ACTION_STOP = "fm.spoiled.app.STOP";
    public static final String ACTION_UPDATE_STATE = "fm.spoiled.app.UPDATE_STATE";

    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_ARTIST = "extra_artist";
    public static final String EXTRA_ALBUM = "extra_album";
    public static final String EXTRA_DURATION = "extra_duration";
    public static final String EXTRA_POSITION = "extra_position";
    public static final String EXTRA_IS_PLAYING = "extra_is_playing";
    public static final String EXTRA_ARTWORK_URL = "extra_artwork_url";

    private static SpoiledMediaService sInstance;

    private MediaSession mMediaSession;
    private PowerManager.WakeLock mWakeLock;
    private String mTitle = "SPOILED FM";
    private String mArtist = "Liquid Glass Audio";
    private String mAlbum = "Local Music";
    private double mDurationSec = 0;
    private double mPositionSec = 0;
    private boolean mIsPlaying = false;
    private String mArtworkUrl = "";
    private Bitmap mArtworkBitmap = null;

    public static SpoiledMediaService getInstance() {
        return sInstance;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        initWakeLock();
        createNotificationChannel();
        initMediaSession();
    }

    private void initWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                mWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Spoiled:MediaPlaybackWakeLock");
                mWakeLock.setReferenceCounted(false);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire WakeLock", e);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Spoiled Media Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows active playback controls on lock screen and notification shade");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private void initMediaSession() {
        mMediaSession = new MediaSession(this, "SpoiledMediaSession");
        mMediaSession.setFlags(
            MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS
        );

        mMediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                mIsPlaying = true;
                updatePlaybackStateSession();
                updateNotification();
                MediaSessionPlugin.dispatchMediaCommand("play", null);
            }

            @Override
            public void onPause() {
                mIsPlaying = false;
                updatePlaybackStateSession();
                updateNotification();
                MediaSessionPlugin.dispatchMediaCommand("pause", null);
            }

            @Override
            public void onSkipToNext() {
                MediaSessionPlugin.dispatchMediaCommand("next", null);
            }

            @Override
            public void onSkipToPrevious() {
                MediaSessionPlugin.dispatchMediaCommand("prev", null);
            }

            @Override
            public void onSeekTo(long pos) {
                mPositionSec = pos / 1000.0;
                updatePlaybackStateSession();
                MediaSessionPlugin.dispatchMediaCommand("seek", mPositionSec);
            }

            @Override
            public void onStop() {
                mIsPlaying = false;
                updatePlaybackStateSession();
                stopForeground(true);
                MediaSessionPlugin.dispatchMediaCommand("pause", null);
            }
        });

        mMediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_UPDATE_STATE.equals(action)) {
                mTitle = intent.getStringExtra(EXTRA_TITLE);
                if (mTitle == null) mTitle = "SPOILED FM";
                mArtist = intent.getStringExtra(EXTRA_ARTIST);
                if (mArtist == null) mArtist = "Music";
                mAlbum = intent.getStringExtra(EXTRA_ALBUM);
                if (mAlbum == null) mAlbum = "";
                mDurationSec = intent.getDoubleExtra(EXTRA_DURATION, 0);
                mPositionSec = intent.getDoubleExtra(EXTRA_POSITION, 0);
                boolean wasPlaying = mIsPlaying;
                mIsPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, false);
                String newArt = intent.getStringExtra(EXTRA_ARTWORK_URL);

                if (newArt != null && !newArt.equals(mArtworkUrl)) {
                    mArtworkUrl = newArt;
                    loadArtworkAsync(newArt);
                }

                if (mIsPlaying) {
                    acquireWakeLock();
                } else {
                    releaseWakeLock();
                }

                updateMediaMetadata();
                updatePlaybackStateSession();
                startForegroundWithNotification();
                SpoiledAppWidgetProvider.updateAllWidgets(this, mTitle, mArtist, mArtworkBitmap, mIsPlaying);

            } else if (ACTION_PLAY_PAUSE.equals(action) || SpoiledAppWidgetProvider.ACTION_WIDGET_PLAY_PAUSE.equals(action)) {
                if (mIsPlaying) {
                    mIsPlaying = false;
                    releaseWakeLock();
                    MediaSessionPlugin.dispatchMediaCommand("pause", null);
                } else {
                    mIsPlaying = true;
                    acquireWakeLock();
                    MediaSessionPlugin.dispatchMediaCommand("play", null);
                }
                updatePlaybackStateSession();
                updateNotification();
                SpoiledAppWidgetProvider.updateAllWidgets(this, mTitle, mArtist, mArtworkBitmap, mIsPlaying);

            } else if (ACTION_PREV.equals(action) || SpoiledAppWidgetProvider.ACTION_WIDGET_PREV.equals(action)) {
                MediaSessionPlugin.dispatchMediaCommand("prev", null);
            } else if (ACTION_NEXT.equals(action) || SpoiledAppWidgetProvider.ACTION_WIDGET_NEXT.equals(action)) {
                MediaSessionPlugin.dispatchMediaCommand("next", null);
            } else if (ACTION_STOP.equals(action)) {
                mIsPlaying = false;
                releaseWakeLock();
                stopForeground(true);
                stopSelf();
                SpoiledAppWidgetProvider.updateAllWidgets(this, "No Track Playing", "Tap to open Spoiled", null, false);
            }
        }
        return START_NOT_STICKY;
    }

    private void acquireWakeLock() {
        if (mWakeLock != null && !mWakeLock.isHeld()) {
            mWakeLock.acquire(12 * 60 * 60 * 1000L); // 12 hours max safety
        }
    }

    private void releaseWakeLock() {
        if (mWakeLock != null && mWakeLock.isHeld()) {
            mWakeLock.release();
        }
    }

    private void updatePlaybackStateSession() {
        if (mMediaSession == null) return;
        long actions = PlaybackState.ACTION_PLAY
            | PlaybackState.ACTION_PAUSE
            | PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_SKIP_TO_NEXT
            | PlaybackState.ACTION_SKIP_TO_PREVIOUS
            | PlaybackState.ACTION_SEEK_TO
            | PlaybackState.ACTION_STOP;

        int state = mIsPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
        long positionMs = (long) (mPositionSec * 1000);

        PlaybackState playbackState = new PlaybackState.Builder()
            .setActions(actions)
            .setState(state, positionMs, 1.0f)
            .build();

        mMediaSession.setPlaybackState(playbackState);
    }

    private void updateMediaMetadata() {
        if (mMediaSession == null) return;
        MediaMetadata.Builder builder = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, mTitle)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, mArtist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, mAlbum)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, (long) (mDurationSec * 1000));

        if (mArtworkBitmap != null) {
            builder.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, mArtworkBitmap);
            builder.putBitmap(MediaMetadata.METADATA_KEY_ART, mArtworkBitmap);
        }

        mMediaSession.setMetadata(builder.build());
    }

    private void loadArtworkAsync(final String artUrl) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                Bitmap bmp = null;
                try {
                    if (artUrl.startsWith("content://") || artUrl.startsWith("file://")) {
                        Uri uri = Uri.parse(artUrl);
                        InputStream is = getContentResolver().openInputStream(uri);
                        if (is != null) {
                            bmp = BitmapFactory.decodeStream(is);
                            is.close();
                        }
                    } else if (artUrl.startsWith("http://") || artUrl.startsWith("https://")) {
                        URL url = new URL(artUrl);
                        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                        conn.setDoInput(true);
                        conn.connect();
                        InputStream is = conn.getInputStream();
                        bmp = BitmapFactory.decodeStream(is);
                        is.close();
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Artwork decode fallback: " + e.getMessage());
                }

                mArtworkBitmap = bmp;
                updateMediaMetadata();
                updateNotification();
                SpoiledAppWidgetProvider.updateAllWidgets(
                    SpoiledMediaService.this,
                    mTitle,
                    mArtist,
                    mArtworkBitmap,
                    mIsPlaying
                );
            }
        }).start();
    }

    private Notification buildNotification() {
        int flag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            : PendingIntent.FLAG_UPDATE_CURRENT;

        Intent contentIntent = new Intent(this, MainActivity.class);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPendingIntent = PendingIntent.getActivity(this, 101, contentIntent, flag);

        // Previous
        Intent prevIntent = new Intent(this, SpoiledMediaService.class);
        prevIntent.setAction(ACTION_PREV);
        PendingIntent prevPendingIntent = PendingIntent.getService(this, 102, prevIntent, flag);
        Notification.Action prevAction = new Notification.Action.Builder(
            android.R.drawable.ic_media_previous,
            "Previous",
            prevPendingIntent
        ).build();

        // Play/Pause
        Intent playPauseIntent = new Intent(this, SpoiledMediaService.class);
        playPauseIntent.setAction(ACTION_PLAY_PAUSE);
        PendingIntent playPausePendingIntent = PendingIntent.getService(this, 103, playPauseIntent, flag);
        Notification.Action playPauseAction = new Notification.Action.Builder(
            mIsPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
            mIsPlaying ? "Pause" : "Play",
            playPausePendingIntent
        ).build();

        // Next
        Intent nextIntent = new Intent(this, SpoiledMediaService.class);
        nextIntent.setAction(ACTION_NEXT);
        PendingIntent nextPendingIntent = PendingIntent.getService(this, 104, nextIntent, flag);
        Notification.Action nextAction = new Notification.Action.Builder(
            android.R.drawable.ic_media_next,
            "Next",
            nextPendingIntent
        ).build();

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        Notification.MediaStyle mediaStyle = new Notification.MediaStyle();
        if (mMediaSession != null) {
            mediaStyle.setMediaSession(mMediaSession.getSessionToken());
        }
        mediaStyle.setShowActionsInCompactView(0, 1, 2);

        builder
            .setContentTitle(mTitle)
            .setContentText(mArtist)
            .setSubText("SPOILED FM")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(contentPendingIntent)
            .setStyle(mediaStyle)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(mIsPlaying)
            .addAction(prevAction)
            .addAction(playPauseAction)
            .addAction(nextAction);

        if (mArtworkBitmap != null) {
            builder.setLargeIcon(mArtworkBitmap);
        } else {
            Bitmap defaultIcon = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);
            if (defaultIcon != null) {
                builder.setLargeIcon(defaultIcon);
            }
        }

        return builder.build();
    }

    private void startForegroundWithNotification() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void updateNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, buildNotification());
        }
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        if (mMediaSession != null) {
            mMediaSession.setActive(false);
            mMediaSession.release();
            mMediaSession = null;
        }
        sInstance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
