# SPOILED: next big update (in phases)

This request is too large to ship well in one pass, so the work is split into phases. Each phase ends with a working app. The download system stays exactly as it is. Phase 1 adds a fallback around it.

## Phase 1: Fixes and core music (do first)
- Downloads: keep the current system untouched. Add a fallback step that runs after it. It retries with other sources and never shows the "audio is not available" message. Downloads behave the same signed in or signed out. The real limit: some videos can't be fetched at all. In that case the app says so clearly and queues the download again.
- Sign-in: keep Google and add email + password. Add account switching in Profile.
- Remove the "Fluid soundscapes / Better Days" banner.
- Library sorting: date added, name, and play count. Play counts are tracked on this device.
- Shuffle button cycles through loop playlist, loop one song, and shuffle.
- Bottom navigation becomes solid. While a song plays, the mini player stays see-through and blurs whatever is behind it.
- The settings button at the top becomes a three-line menu that holds every setting.
- A third look: a deep dark theme with rich colors that's easy on the eyes.
- Player styles: Default, Modern vinyl, Classic vinyl, CD, and Cassette. Each song can use its own picture or one you pick from your gallery.

## Phase 2: Home feed and Explore
- Home feed as you scroll: random songs and artists, Explore your genre, Discover jazz, New releases, Popular artists, albums and singles, and Popular radio.
- A 3D globe: tap a place to hear a live radio station from there and see what's playing. This uses a free public radio directory.
- Explore results become compact one-line rows. Adds search filters (type, length, upload date, features like 4K, HD, CC, Live, 360 and HDR) and voice search with the mic.
- Topic buttons under the search bar (All, Music, Gaming, Podcasts, and so on). Topics you search often become your own buttons.
- Channel pages, and playing a video from a pasted link.
- Watch history in Profile that clears itself every month. Recently watched playlists also show there.

## Phase 3: Video player
- The video fills the phone screen properly. Also adds landscape, speed from 0.25x to 4x, an adjustable double-tap skip length, A-to-B loop, resume where you stopped, subtitle styling, sleep timer, picture-in-picture, and screenshot and clip saving.
- An adjustment panel: Light, Color, Detail, Look, and Advanced (curves, HSL, color wheels). It covers the adjustments that can run live in a browser. Pro-tool items like 3D LUT matching, shot matching and face retouching on video come later or are left out, and the app will say which.

## Phase 4: Camera, Gallery and Photo editor
- Camera with live filters, plus a gallery of photos you grant access to.
- Editor: crop, rotate, adjustments, effects, text, stickers (including WhatsApp export), drawing, shapes, frames and basic retouch.

## Phase 5: Admin and Android
- Admin panel in Profile for changing the app name, logo and favicon.
- Android-only pieces need native code built and tested on a real device: home-screen widgets, lock-screen and notification controls, a quick-settings recording tile, auto-scanning phone storage, and permissions. These come last and can't be tested here. Inside the web app, I won't claim they work.

## Technical notes
- Keep the single-route screen-state architecture, IndexedDB for media, and localStorage for preferences.
- Email auth goes through Cloud auth (email confirmation on). Account switching keeps a list of recent accounts.
- Radio uses the Radio Browser public API. The globe uses three.js loaded only in the browser.
- Video adjustments use CSS filters plus a WebGL shader pass. YouTube embeds can't be filtered, so the adjustments apply to local and direct videos only.
