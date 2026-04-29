# IINA Bilingual Audio Mixer Plugin

A plugin for [IINA](https://iina.io/) that enables bilingual audio playback by mixing multiple audio tracks using mpv's `lavfi-complex` filter.

## Features

- **Stereo Separation Mode**: Send Track 1 to left speaker and Track 2 to right speaker
- **Mixed Mode**: Play both audio tracks simultaneously with independent volume control
- **Single Track Mode**: Default playback mode
- **Auto-detection**: Automatically shows controls when video has multiple audio tracks
- **Per-track Volume Control**: Adjust volume for each audio track independently

## Installation

### Method 1: Manual Installation

1. Clone or download this repository
2. Copy the `BilingualAudio.iinaplugin` folder to:
   ```
   ~/Library/Application Support/com.colliderli.iina/plugins/
   ```
3. Restart IINA
4. Open a video with multiple audio tracks
5. The Audio Mixer sidebar should appear automatically

### Method 2: Create Plugin Package

1. Zip the `BilingualAudio.iinaplugin` folder
2. Rename the zip file to `BilingualAudio.iinaplgz`
3. Open the `.iinaplgz` file with IINA

## Usage

### Modes

#### Single Track (Default)
- Plays only the selected primary track
- Volume controls are hidden
- This is the default IINA behavior

#### Stereo (Left/Right)
- Primary track plays through the **left speaker**
- Secondary track plays through the **right speaker**
- Use headphones for best separation
- Volume controls adjust per channel

#### Mixed (Both)
- Both tracks play simultaneously
- Each track has independent volume control
- Useful for listening to both languages at once

### Volume Controls

- **Stereo Mode**: Adjust "Left Channel" and "Right Channel" volumes
- **Mixed Mode**: Adjust "Track 1" and "Track 2" volumes
- Volume ranges from 0% (mute) to 100% (full volume)

## Technical Details

This plugin uses mpv's [`--lavfi-complex`](https://mpv.io/manual/stable/#options-lavfi-complex) option to mix multiple audio tracks. The filter graphs are:

### Stereo Separation Filter
```
[aid1]pan=stereo|c0=VOL1*c0|c1=0[left];
[aid2]pan=stereo|c0=0|c1=VOL2*c0[right];
[left][right]amix=inputs=2[ao]
```

### Mixed Filter
```
[aid1]volume=VOL1[a1];
[aid2]volume=VOL2[a2];
[a1][a2]amix=inputs=2:duration=longest[ao]
```

### Limitations

1. **Playback Reload Required**: When switching modes, the video playback position is saved and restored. You may see a brief pause.
2. **Track Selection**: The track numbers (`aid1`, `aid2`) are determined by mpv's internal track IDs, which may differ from the order shown in IINA's UI.
3. **Two Tracks Maximum**: Currently supports mixing up to 2 audio tracks simultaneously.

## Preferences

Access preferences via: **IINA → Preferences → Plugins → Bilingual Audio Mixer**

- **Default Mixing Mode**: Choose between Single, Stereo, or Mixed
- **Track 1/2 Default Volume**: Set initial volume levels (0-100%)
- **Auto-show Sidebar**: Automatically show sidebar for multi-track files

## Troubleshooting

### Audio doesn't change when applying mix

The `lavfi-complex` filter requires playback to reload. The plugin automatically seeks to your current position, but you may notice a brief pause.

### Sidebar doesn't appear

- **Check video has multiple audio tracks**: Open IINA's native audio track menu (right-click → Audio → Audio Track) to verify
- **Verify plugin installation**: Ensure `BilingualAudio.iinaplugin` folder is in `~/Library/Application Support/com.colliderli.iina/plugins/`
- **Check IINA's console**: Go to **View → Console** or press `Cmd+Shift+C` to see plugin logs
- **Look for "Bilingual Audio" logs**: You should see messages like:
  - `Bilingual Audio: File loaded, detecting tracks...`
  - `Bilingual Audio: Detected audio tracks: [...]`
  - `Bilingual Audio: Sidebar shown`
- **Restart IINA**: After installing/updating the plugin, fully quit and restart IINA

### Track selectors show "No tracks found"

- The plugin may not be detecting tracks correctly
- Check console for error messages
- Try a different video file known to have multiple audio tracks
- Verify the video file actually contains multiple audio streams (use `ffprobe` or MediaInfo)

### Audio sounds distorted in Stereo mode

Make sure your system audio is configured for stereo output. Mono or surround configurations may not provide proper left/right separation.

### Volume controls don't affect playback

Ensure you've clicked "Apply" after changing volume settings. The filter must be re-applied for changes to take effect.

## Development

### File Structure

```
BilingualAudio.iinaplugin/
├── Info.json          # Plugin metadata
├── main.js            # Core logic (track detection, lavfi-complex)
├── sidebar.html       # UI controls
└── preferences.html   # User preferences
```

### Key APIs Used

- `iina.core.audio.tracks` - Get available audio tracks
- `iina.core.osd()` - Display on-screen messages
- `iina.mpv.setProperty()` - Set lavfi-complex filter
- `iina.mpv.getProperty()` - Get current playback position
- `iina.mpv.command()` - Seek to position
- `iina.sidebar.postMessage()` / `iina.sidebar.onMessage()` - Sidebar communication
- `iina.event.on('mpv.file-loaded')` - Detect file load

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT License - see LICENSE file for details.

## Credits

- Built for [IINA](https://iina.io/) media player
- Uses mpv's powerful audio filter capabilities
- Inspired by bilingual audio needs in language learning

## Related Projects

- [IINA Plugin API Documentation](https://docs.iina.io/)
- [mpv Manual - Audio Filters](https://mpv.io/manual/master/#audio-filters)
- [FFmpeg Audio Filters](https://ffmpeg.org/ffmpeg-filters.html#Audio-Filters)