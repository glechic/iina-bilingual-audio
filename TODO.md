# TODO - Future Enhancements

This document tracks proposed features and improvements for future versions.

## High Priority

### 1. Keyboard Shortcuts
**Status:** Proposed  
**Description:** Add customizable keyboard shortcuts for quick mode switching  
**Implementation:**
- `Cmd+Shift+1` - Single track mode
- `Cmd+Shift+2` - Stereo mode
- `Cmd+Shift+3` - Mixed mode
- `Cmd+Shift+A` - Toggle Audio Mixer sidebar
- Allow users to customize shortcuts in preferences

```javascript
// Proposed implementation in main.js
iina.mpv.command('script-binding', 'bilingual-audio/single-track');
iina.mpv.command('script-binding', 'bilingual-audio/stereo-mode');
iina.mpv.command('script-binding', 'bilingual-audio/mixed-mode');
```

### 2. Track Auto-detection
**Status:** Proposed  
**Description:** Auto-detect primary language from track metadata  
**Implementation:**
- Parse track `lang` property (e.g., "en", "es", "zh")
- Use track `title` property as fallback
- Allow user to set preferred languages in preferences
- Auto-select tracks based on preference order

```javascript
// Proposed implementation
event.on('mpv.file-loaded', () => {
  const tracks = core.audio.tracks;
  const primaryLang = preferences.get('primaryLang') || 'en';
  const secondaryLang = preferences.get('secondaryLang') || 'es';
  
  const primaryTrack = tracks.find(t => t.lang === primaryLang);
  const secondaryTrack = tracks.find(t => t.lang === secondaryLang);
  
  if (primaryTrack && secondaryTrack) {
    track1Id = primaryTrack.id;
    track2Id = secondaryTrack.id;
  }
});
```

### 3. External Audio File Support
**Status:** Proposed  
**Description:** Allow loading external audio files (e.g., separate `.m4a` or `.aac` files)  
**Implementation:**
- Use mpv's `--audio-file` option to load external tracks
- Provide UI button to "Load External Audio"
- Sync with video playback position
- Support common audio formats (MP3, AAC, M4A, FLAC)

```javascript
// Proposed implementation
function loadExternalAudio(path) {
  // Use --audio-file option
  mpv.setProperty('audio-file', path);
  
  // Or use mpv.command to load at runtime
  mpv.command('audio-add', path);
  
  // Track added as additional audio track
  const tracks = core.audio.tracks;
  // Update UI to show new track
}
```

## Medium Priority

### 4. Preset Manager
**Status:** Proposed  
**Description:** Save and load mixing presets for different content types  
**Implementation:**
- Create preset structure:
  ```javascript
  {
    name: "Language Learning",
    mode: "stereo",
    vol1: 0.8,
    vol2: 0.6,
    description: "Primary language louder for learning"
  }
  ```
- Add "Presets" dropdown in sidebar
- Allow creating custom presets in preferences
- Store presets in localStorage or preferences

### 5. Visual Audio Waveform
**Status:** Proposed  
**Description:** Show waveform preview for each track  
**Implementation:**
- Use Web Audio API to generate waveforms
- Display in sidebar or video overlay
- Help users identify which track is which
- Could use FFmpeg to extract waveform data

### 6. Audio Sync Adjustment
**Status:** Proposed  
**Description:** Fine-tune sync between tracks for external audio files  
**Implementation:**
- Add delay slider (in milliseconds)
- Use mpv's `--audio-delay` option
- Positive values delay audio, negative values advance it

```javascript
// Proposed implementation
function setAudioDelay(trackId, delayMs) {
  // Delay in seconds
  const delay = delayMs / 1000;
  
  // Apply to specific track in lavfi-complex
  // This requires modifying filter chain
}
```

## Low Priority

### 7. Drag-and-Drop External Audio
**Status:** Proposed  
**Description:** Support drag-and-drop of audio files into IINA window  
**Implementation:**
- Listen for drag events in sidebar
- Validate file type (audio formats)
- Automatically add as secondary track
- Show confirmation dialog

### 8. Batch Processing with FFmpeg
**Status:** Proposed  
**Description:** Create standalone script to pre-mix video files  
**Implementation:**
- Create `scripts/batch-mix.sh`
- Accept input video + two audio tracks
- Output pre-mixed video file
- Useful for:
  - Mobile devices
  - Players without plugin support
  - Permanent mixed files

```bash
#!/bin/bash
# scripts/batch-mix.sh
# Usage: ./batch-mix.sh input.mkv track1.aac track2.aac output.mkv

ffmpeg -i "$1" -i "$2" -i "$3" \
  -filter_complex "[0:a:0]volume=1.0[a1];[1:a]volume=0.8[a2];[2:a]volume=0.6[a3];[a1][a2][a3]amix=inputs=3:duration=longest[aout]" \
  -map 0:v -map "[aout]" -c:v copy "$4"
```

### 9. Multi-Track Support (>2 audio tracks)
**Status:** Proposed  
**Description:** Support mixing more than 2 audio tracks  
**Implementation:**
- Extend UI to show 3+ tracks
- Allow selecting which tracks to mix
- Use `amix=inputs=N` for N tracks
- Potential UI: Track checkboxes + volume per track

```javascript
// Proposed implementation
function buildMultiTrackFilter(trackIds, volumes) {
  // Build filter for N tracks
  let filter = '';
  const labels = [];
  
  trackIds.forEach((id, i) => {
    filter += `[aid${id}]volume=${volumes[i]}[a${i}];`;
    labels.push(`[a${i}]`);
  });
  
  filter += `${labels.join('')}amix=inputs=${trackIds.length}:duration=longest[ao]`;
  return filter;
}
```

### 10. Audio Effect Presets
**Status:** Proposed  
**Description:** Pre-defined audio processing effects  
**Examples:**
- "Karaoke Mode": Remove vocals (center channel removal)
- "Vocal Boost": Enhance dialogue clarity
- "Surround Simulation": Virtual surround from stereo
- "Bass Boost": Enhance low frequencies

### 11. Playlist Support
**Status:** Proposed  
**Description:** Apply same audio settings across playlist  
**Implementation:**
- Remember track order from first file
- Apply same mixing mode to subsequent files
- Handle files with different track counts gracefully

### 12. Export Current Configuration
**Status:** Proposed  
**Description:** Export current mix settings to file  
**Use cases:**
- Share settings between devices
- Create standard configurations
- Backup preferences

---

## Completed Features

### ✅ Version 1.0 (Initial Release)
- [x] Plugin structure with Info.json
- [x] Auto-detection of multi-track videos
- [x] Single Track mode
- [x] Stereo (Left/Right) mode with volume control
- [x] Mixed mode with independent volume controls
- [x] Sidebar UI with track selection
- [x] Preferences panel for defaults
- [x] OSD feedback for mode changes
- [x] Git repository initialization

---

## Development Notes

### For Contributors

When implementing any of these features, please:
1. Create a new branch: `git checkout -b feature/feature-name`
2. Follow existing code style
3. Test with multiple video files
4. Update README.md if adding user-facing features
5. Move completed items to "Completed Features" section in this file

### Technical Debt

None currently. Future considerations:
- Error handling for unsupported audio formats
- Edge case: videos with no audio tracks
- Performance: optimize lavfi-complex filter construction
- Accessibility: add ARIA labels to UI elements

---

## Version History

- **v1.0.0** - Initial release with core functionality
  - Single, Stereo, and Mixed modes
  - Volume control per track
  - Auto-show sidebar
  - Preferences support