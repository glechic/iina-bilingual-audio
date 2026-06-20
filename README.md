# IINA Bilingual Audio Plugin

A plugin for [IINA](https://iina.io/) that lets two people watch the same movie together, each hearing it in their own language — one track plays through the left speaker, the other through the right. Each person uses one earbud, or you split a stereo pair between two listeners.

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
2. Open the **Bilingual Audio** sidebar (View menu → right sidebar, or the "Show Bilingual Audio" menu item added by the plugin)
3. Toggle **Bilingual mode** on
4. Pick which track goes to the **Left channel** and which to the **Right channel**
5. Toggle off to return to normal single-track playback

For best results use headphones so the left/right separation is clear.

## Preferences

Access via **IINA → Preferences → Plugins → Bilingual Audio**:

- **Auto-show sidebar for files with multiple audio tracks** — automatically reveal the Bilingual Audio sidebar when a file with 2+ audio tracks is opened

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