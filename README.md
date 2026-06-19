# IINA Bilingual Audio Mixer Plugin

A plugin for [IINA](https://iina.io/) that plays two audio tracks simultaneously with left/right channel separation — one track on the left speaker, the other on the right.

Useful for bilingual videos where two language tracks are encoded in the same file and you want both playing at once (e.g., language learning, or listening with one ear each via headphones).

## How it works

The plugin uses mpv's [`--lavfi-complex`](https://mpv.io/manual/stable/#options-lavfi-complex) option to build a filter graph that decodes two audio tracks simultaneously and merges them into a stereo stream with track 1 on the left channel and track 2 on the right:

```
[aid1]aformat=channel_layouts=mono[mono1];
[aid2]aformat=channel_layouts=mono[mono2];
[mono1][mono2]amerge=inputs=2[ao]
```

Each track is downmixed to mono first (so `amerge` produces clean 2-channel output without volume loss or channel duplication artifacts).

When bilingual mode is off, the filter is cleared and normal single-track playback resumes.

## Installation

### Method 1: Manual

1. Copy the `BilingualAudio.iinaplugin` folder to:
   ```
   ~/Library/Application Support/com.colliderli.iina/plugins/
   ```
2. Restart IINA

### Method 2: Plugin package

1. Zip the `BilingualAudio.iinaplugin` folder
2. Rename the zip to `BilingualAudio.iinaplgz`
3. Open the `.iinaplgz` file with IINA

## Usage

1. Open a video with 2+ audio tracks in IINA
2. Open the **Audio Mixer** sidebar (View menu → right sidebar, or the "Show Audio Mixer" menu item added by the plugin)
3. Toggle **Bilingual mode** on
4. Pick which track goes to the **Left channel** and which to the **Right channel**
5. Toggle off to return to normal single-track playback

For best results use headphones so the left/right separation is clear.

## Preferences

Access via **IINA → Preferences → Plugins → Bilingual Audio Mixer**:

- **Auto-show sidebar for files with multiple audio tracks** — automatically reveal the Audio Mixer sidebar when a file with 2+ audio tracks is opened

## File structure

```
BilingualAudio.iinaplugin/
├── Info.json          # Plugin metadata
├── main.js            # Core logic (track detection, lavfi-complex filter)
├── sidebar.html       # Sidebar UI (toggle + two dropdowns)
└── preferences.html   # Preferences page (auto_show checkbox)
```

## Key APIs used

- `iina.mpv.set('lavfi-complex', filter)` — set the bilingual filter graph
- `iina.mpv.set('aid', ...)` — control which audio track mpv selects (`'no'` lets lavfi-complex own track selection)
- `iina.mpv.getNative('track-list')` — read audio tracks as a fallback
- `iina.sidebar.postMessage()` / `iina.sidebar.onMessage()` — sidebar ↔ plugin communication
- `iina.event.on('mpv.file-loaded')` — detect file load and enumerate tracks
- `iina.preferences.get('auto_show')` — read user preferences

## Limitations

- Two tracks maximum (the filter graph has fixed `[aid1]`/`[aid2]` labels)
- Track IDs are mpv's internal IDs (`aid1`, `aid2`), which usually — but not always — match IINA's displayed track order
- Toggling bilingual on replaces normal audio selection; the current track selection is restored when toggled off
- Requires a video with 2+ audio tracks; single-track files get no bilingual option

## Development

The plugin is plain JavaScript — no build step. Edit the files in `BilingualAudio.iinaplugin/` and copy to the plugins directory to test:

```sh
cp -R BilingualAudio.iinaplugin ~/Library/Application\ Support/com.colliderli.iina/plugins/
```

Restart IINA after each change.

## Credits

- Built for [IINA](https://iina.io/) media player
- Uses mpv's [`lavfi-complex`](https://mpv.io/manual/stable/#options-lavfi-complex) and FFmpeg's [`amerge`](https://ffmpeg.org/ffmpeg-filters.html#amerge) / [`aformat`](https://ffmpeg.org/ffmpeg-filters.html#aformat) filters

## Related

- [IINA Plugin API Documentation](https://docs.iina.io/)
- [mpv Manual](https://mpv.io/manual/stable/)
- [FFmpeg Audio Filters](https://ffmpeg.org/ffmpeg-filters.html#Audio-Filters)