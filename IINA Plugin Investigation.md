# IINA Plugin for Bilingual Audio - Investigation

## Overview

IINA is a macOS video player based on mpv. It has a plugin system that allows extending functionality with JavaScript. This document investigates creating a plugin for bilingual audio output.

## IINA Plugin Architecture

### Plugin Structure

```
BilingualAudio.iinaplugin/
├── Info.json          # Plugin metadata
├── main.js            # Main entry (per-player)
├── global.js          # Global entry (optional)
├── preferences.html   # Settings UI (optional)
├── sidebar.html       # Sidebar panel (optional)
└── overlay.html       # Video overlay (optional)
```

### Info.json Structure

```json
{
  "name": "Bilingual Audio Mixer",
  "identifier": "com.biling-streaming.iina-plugin",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "entry": "main.js",
  "description": "Mix multiple audio tracks for bilingual playback",
  "sidebarTab": {
    "name": "Audio Mixer"
  },
  "preferencesPage": "preferences.html",
  "permissions": [
    "show-osd",
    "network-request"
  ],
  "allowedDomains": ["*"],
  "ghRepo": "username/biling-audio-iina",
  "ghVersion": 1
}
```

## Key APIs for Audio Control

### 1. Audio Track Management (`iina.core.audio`)

```javascript
const { core } = iina;

// Get available audio tracks
const tracks = core.audio.tracks;
// [{ id: 1, title: "English", lang: "en" }, { id: 2, title: "Spanish", lang: "es" }]

// Switch audio track
core.audio.id = trackId;

// Load external audio track
core.audio.loadTrack("/path/to/audio.m4a");

// Control volume
core.audio.volume = 100;  // 0-100 (or higher if volume-max allows)

// Audio delay (for sync)
core.audio.delay = 0.5;  // seconds

// Mute/unmute
core.audio.muted = true;
```

### 2. MPV Commands (`iina.mpv`)

IINA uses mpv under the hood, so we can access mpv's powerful audio filter capabilities:

```javascript
const { mpv } = iina;

// Get mpv property
const audioParams = mpv.getProperty('audio-params');

// Set mpv property
mpv.setProperty('volume', 100);

// Run mpv command
mpv.command('af', 'add', 'loudnorm');
mpv.command('af', 'add', 'pan=stereo|c0=0.5*c0+0.5*c1');
```

### 3. Events (`iina.event`)

```javascript
const { event } = iina;

// File loaded
event.on('mpv.file-loaded', () => {
  console.log('File loaded, checking audio tracks...');
  const tracks = core.audio.tracks;
  updateUI(tracks);
});

// Track changed
event.on('mpv.track-list-change', () => {
  // Audio track list changed
});

// Playback state
event.on('mpv.pause', () => { });
event.on('mpv-unpause', () => { });
```

### 4. Sidebar UI (`iina.sidebar`)

For user controls, display in sidebar:

```javascript
const { sidebar } = iina;

sidebar.loadFile('sidebar.html');
sidebar.show();

// Communication between plugin and sidebar
sidebar.onMessage('set-volume', (data) => {
  core.audio.volume = data.volume;
});

sidebar.postMessage('track-update', { tracks: core.audio.tracks });
```

### 5. Video Overlay (`iina.overlay`)

For on-screen display during playback:

```javascript
const { overlay } = iina;

// Simple mode for basic content
overlay.simpleMode();
overlay.setContent('<div class="bilingual-info">🇺🇸 English | 🇪🇸 Spanish</div>');
overlay.setStyle('.bilingual-info { color: white; font-size: 16px; }');
overlay.show();
```

## MPV Audio Filters (Key for Bilingual)

MPV supports FFmpeg audio filters via `--af` option. These can be applied dynamically:

### Common Audio Filters

```bash
# Volume control
--af=volume=2.0

# Normalization
--af=loudnorm=I=-16:LRA=11:TP=-1.5

# Channel mixing (stereo to mono, etc.)
--af=pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1

# Audio delay
--af=adelay=500ms  # delay by 500ms

# Speed change (for pitch adjustment)
--af=atempo=0.9  # slow down to 90%
```

### For Bilingual Audio

MPV doesn't natively support mixing multiple audio tracks, but we can use workarounds:

**Approach 1: External Track + Filter**
```javascript
// Load secondary audio track
await core.audio.loadTrack('/path/to/second_audio.m4a');

// Switch between tracks (not mixing)
core.audio.id = primaryTrackId;
```

**Approach 2: Pre-process with FFmpeg**
Since MPV/FFmpeg can only play one audio stream at a time within a single player, we need to use external tracks and switching.

## Implementation Options

### Option A: Track Switching Plugin

Simple approach - switch between audio tracks:

```javascript
// main.js
const { core, event, sidebar, console } = iina;

let audioTracks = [];
let currentTrack = 0;

event.on('mpv.file-loaded', () => {
  audioTracks = core.audio.tracks;
  if (audioTracks.length > 1) {
    sidebar.loadFile('sidebar.html');
    sidebar.postMessage('tracks-loaded', { tracks: audioTracks });
    sidebar.show();
  }
});

sidebar.onMessage('switch-track', (data) => {
  core.audio.id = data.trackId;
  core.osd(`Switched to ${data.trackName}`);
});
```

**Pros:** Simple, fast, works with existing files
**Cons:** Can't mix/blend tracks simultaneously

### Option B: External Audio Mixing

Load external audio file and sync with video:

```javascript
// main.js
const { core, event, sidebar, console, mpv } = iina;

let externalAudio = null;
let mixedVolume = { primary: 1.0, secondary: 0.3 };

event.on('mpv.file-loaded', async () => {
  // User can load external audio file
  // We'll keep track of it and sync
});

function loadExternalAudio(path) {
  // MPV can load external audio files
  // They will be synchronized with video automatically
  core.audio.loadTrack(path);
  externalAudio = path;
  
  // Use af filter to adjust volume
  mpv.command('af', 'add', `volume=${mixedVolume.secondary}`);
}
```

**Pros:** Can have multiple audio sources
**Cons:** Limited mixing control within mpv

### Option C: Dual Track Mixing via lavfi

Use FFmpeg's lavfi filter to mix tracks:

```javascript
// Advanced: Use mpv's ability to add audio filters
// This requires understanding mpv's filter chain

// The --lavfi-complex option allows mixing multiple audio streams
// But this needs to be set before playback starts

// In practice, this approach requires preprocessing or using
// mpv's script-binding features with custom audio routing
```

### Option D: Sidecar Player Approach (Recommended)

Use IINA's plugin to control an external audio mixer:

```javascript
// main.js - Controls playback and UI
// The plugin acts as controller, actual mixing happens via Web Audio API
// in a separate webview

const { core, event, overlay, sidebar, preferences } = iina;

class BilingualAudioPlugin {
  constructor() {
    this.mode = 'primary'; // 'primary', 'secondary', 'mixed'
    this.volumePrimary = 1.0;
    this.volumeSecondary = 0.5;
  }
  
  async loadFile(path) {
    // Load video
    await core.open(path);
    
    // Get audio track info
    const tracks = core.audio.tracks;
    
    // If multiple audio tracks, offer mixing options
    if (tracks.length > 1) {
      this.showAudioMixerUI(tracks);
    }
  }
  
  showAudioMixerUI(tracks) {
    // Show overlay with controls
    overlay.simpleMode();
    overlay.setStyle(`
      .audio-controller {
        position: absolute;
        bottom: 60px;
        right: 20px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 15px;
        border-radius: 8px;
        font-family: system-ui;
      }
      .track-btn { margin: 5px; padding: 8px 16px; cursor: pointer; }
      .track-btn.active { background: #007aff; }
    `);
    
    this.updateOverlayContent();
    overlay.setClickable(true);
    overlay.show();
  }
  
  updateOverlayContent() {
    overlay.setContent(`
      <div class="audio-controller" data-clickable>
        <h3 style="margin: 0 0 10px 0;">Bilingual Audio</h3>
        <div data-clickable>
          <button class="track-btn ${this.mode === 'primary' ? 'active' : ''}" 
                  onclick="iina.postMessage('set-mode', 'primary')">
            🇺🇸 Primary
          </button>
          <button class="track-btn ${this.mode === 'secondary' ? 'active' : ''}"
                  onclick="iina.postMessage('set-mode', 'secondary')">
            🇪🇸 Secondary
          </button>
          <button class="track-btn ${this.mode === 'mixed' ? 'active' : ''}"
                  onclick="iina.postMessage('set-mode', 'mixed')">
            🎧 Mixed
          </button>
        </div>
        ${this.mode === 'mixed' ? `
          <div style="margin-top: 10px;">
            <label>Primary: ${Math.round(this.volumePrimary * 100)}%</label>
            <input type="range" min="0" max="100" value="${this.volumePrimary * 100}"
                   onchange="iina.postMessage('set-volume', { track: 'primary', value: this.value / 100 })"
                   data-clickable>
            <label>Secondary: ${Math.round(this.volumeSecondary * 100)}%</label>
            <input type="range" min="0" max="100" value="${this.volumeSecondary * 100}"
                   onchange="iina.postMessage('set-volume', { track: 'secondary', value: this.value / 100 })"
                   data-clickable>
          </div>
        ` : ''}
      </div>
    `);
  }
}

const plugin = new BilingualAudioPlugin();

// Handle messages from overlay
overlay.onMessage('set-mode', (data) => {
  plugin.mode = data;
  plugin.updateOverlayContent();
  
  if (data === 'primary') {
    core.audio.id = core.audio.tracks[0].id;
  } else if (data === 'secondary' && core.audio.tracks.length > 1) {
    core.audio.id = core.audio.tracks[1].id;
  }
  // 'mixed' mode would require external audio processing
});

overlay.onMessage('set-volume', (data) => {
  if (data.track === 'primary') {
    plugin.volumePrimary = data.value;
  } else {
    plugin.volumeSecondary = data.value;
  }
});

// Initialize when file loads
event.on('mpv.file-loaded', () => {
  const tracks = core.audio.tracks;
  console.log('Audio tracks:', tracks);
  
  if (tracks.length > 1) {
    plugin.mode = 'primary';
    plugin.showAudioMixerUI(tracks);
  }
});
```

## Plugin Implementation Plan

### Phase 1: Basic Track Switching
1. Create plugin structure with `Info.json`
2. Implement audio track detection
3. Add sidebar UI for track selection
4. Add keyboard shortcuts for quick switching

### Phase 2: Volume Control per Track
1. Store volume preferences per track
2. Add per-track volume sliders
3. Smooth transitions when switching

### Phase 3: Mixed Mode (Advanced)
1. Detect when video has multiple audio tracks
2. Allow loading external audio file
3. Attempt sync with secondary track
4. Simple volume mixing between tracks

### Phase 4: Preferences & Presets
1. Add preferences UI
2. Save user's preferred language
3. Auto-select language based on video filename/metadata
4. Create presets for different content types

## Limitations

1. **MPV Architecture**: MPV can only play one audio stream at a time internally
2. **Real Mixing**: True real-time audio mixing (like Web Audio API) is not possible
3. **External Audio**: Loading external audio requires files to be properly synced
4. **Performance**: Audio filter chains can add latency

## Recommended Approach

For a practical IINA plugin:

1. **Track Switching** (Easy) - Switch between available audio tracks
2. **Track Loading** (Medium) - Load external audio files
3. **OSD/Sidebar UI** (Easy) - Show controls for track selection
4. **Preferences** (Easy) - Remember user's preferred track for language

For true bilingual mixing, the best approach is:
- Pre-process files using FFmpeg (as documented in other files)
- Use the IINA plugin for easy track switching and preference management

## Example Plugin Code

```javascript
// main.js - Bilingual Audio Plugin for IINA

const { core, event, overlay, sidebar, preferences, console, utils } = iina;

class BilingualAudio {
  constructor() {
    this.tracks = [];
    this.primaryLang = preferences.get('primaryLang') || 'en';
    this.secondaryLang = preferences.get('secondaryLang') || 'es';
    this.osdTimeout = null;
  }
  
  showTrackSelector() {
    if (this.tracks.length <= 1) {
      core.osd('Only one audio track available');
      return;
    }
    
    overlay.simpleMode();
    overlay.setStyle(`
      .container {
        position: absolute;
        bottom: 80px;
        right: 20px;
        background: rgba(0,0,0,0.85);
        color: white;
        padding: 15px;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
      }
      .title { font-weight: 600; margin-bottom: 10px; }
      .track { 
        padding: 8px 12px;
        margin: 4px 0;
        background: rgba(255,255,255,0.1);
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
      }
      .track:hover { background: rgba(255,255,255,0.2); }
      .track.active { background: #007aff; }
      .lang { opacity: 0.7; font-size: 12px; }
    `);
    
    let content = '<div class="container" data-clickable><div class="title">Audio Tracks</div>';
    
    this.tracks.forEach(track => {
      const active = track.id === core.audio.id ? 'active' : '';
      content += `
        <div class="track ${active}" data-clickable 
             onclick="iina.postMessage('select-track', ${track.id})">
          <span>${track.title || 'Track ' + track.id}</span>
          <span class="lang">${track.lang || ''}</span>
        </div>
      `;
    });
    
    content += '</div>';
    overlay.setContent(content);
    overlay.setClickable(true);
    overlay.show();
    
    // Auto-hide after 5 seconds
    if (this.osdTimeout) clearTimeout(this.osdTimeout);
    this.osdTimeout = setTimeout(() => overlay.hide(), 5000);
  }
  
  selectTrack(trackId) {
    core.audio.id = trackId;
    const track = this.tracks.find(t => t.id === trackId);
    core.osd(`Audio: ${track?.title || 'Track ' + trackId}`);
    overlay.hide();
  }
}

const bilingual = new BilingualAudio();

// Event handlers
event.on('mpv.file-loaded', () => {
  bilingual.tracks = core.audio.tracks;
  console.log('File loaded, audio tracks:', bilingual.tracks);
});

overlay.onMessage('select-track', (trackId) => {
  bilingual.selectTrack(trackId);
});

// Keyboard shortcut
iina.mpv.command('script-binding', 'bilingual-audio/show-selector');

// Add menu item
iina.menu.addItem({
  title: 'Audio Tracks',
  action: () => bilingual.showTrackSelector()
});
```

## Files Structure for Plugin

```
BilingualAudio.iinaplugin/
├── Info.json
├── main.js
├── preferences.html
└── assets/
    └── icons/
        ├── en.svg
        └── es.svg
```

## Installation

Users can install the plugin by:
1. Opening the `.iinaplgz` file with IINA
2. Installing from GitHub repository URL
3. Manually placing `.iinaplugin` folder in `~/Library/Application Support/com.colliderli.iina/plugins/`

## Resources

- [IINA Plugin API Documentation](https://docs.iina.io/)
- [MPV Manual - Audio Filters](https://mpv.io/manual/master/#audio-filters)
- [FFmpeg Audio Filters Documentation](https://ffmpeg.org/ffmpeg-filters.html#Audio-Filters)

## Related Files

- [[Bilingual Audio Mixer for Local MKV Files]] - Pre-processing approach
- [[Bilingual Audio Streaming with Web Audio API]] - Web implementation
- [[Project Summary and Implementation Notes]] - Overall project summary