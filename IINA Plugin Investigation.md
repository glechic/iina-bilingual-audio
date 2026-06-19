# IINA Bilingual Audio Plugin — Investigation Notes

Notes from investigating the IINA plugin API while building the Bilingual Audio Mixer. Kept as a reference for the API details discovered, including the parts that differed from initial assumptions.

## Plugin structure

```
BilingualAudio.iinaplugin/
├── Info.json          # Plugin metadata
├── main.js            # Main entry (per-player, has access to mpv/sidebar/etc.)
├── preferences.html   # Settings UI (uses data-pref-key attributes)
└── sidebar.html       # Sidebar panel
```

`global.js` (global entry) exists for plugins that need cross-player state. We don't use it — sidebar message handlers belong in `main.js` because `sidebar` is only available there.

### Info.json (current)

```json
{
  "name": "Bilingual Audio Mixer",
  "identifier": "com.bilingual-audio.iina-plugin",
  "version": "1.0.0",
  "author": { "name": "Your Name", "email": "you@example.com" },
  "entry": "main.js",
  "description": "Mix bilingual audio tracks with left/right channel separation",
  "sidebarTab": { "name": "Audio Mixer" },
  "preferencesPage": "preferences.html",
  "permissions": ["show-osd"],
  "allowedDomains": []
}
```

## IINA Plugin API — what actually works

### `iina.mpv`

The mpv module is the bridge to mpv's property and command system. The real method names (verified against the [official docs](https://docs.iina.io/interfaces/IINA.API.MPV.html)):

| Method | Purpose |
|---|---|
| `mpv.set(name, value)` | Set a property (replaces the imagined `mpv.setProperty`) |
| `mpv.getString(name)` | Read a property as string |
| `mpv.getNumber(name)` | Read a property as number |
| `mpv.getFlag(name)` | Read a boolean property |
| `mpv.getNative(name)` | Read a property as a native JS object (lists, dicts) |
| `mpv.command(name, [args])` | Run an mpv command (args is an **array**, not rest args) |
| `mpv.addHook(name, priority, cb)` | Register an mpv hook |

**Important:** `mpv.setProperty` / `mpv.getProperty` do **not** exist — early versions of this plugin used them and they silently failed. Use `mpv.set` / `mpv.getString` / `mpv.getNative` / `mpv.getNumber`.

`mpv` is **only available in the main entry** (`main.js`), not in `global.js`.

### `iina.core`

High-level player state:

- `core.audio.tracks` — array of `{ id, title, lang, ... }` for available audio tracks
- `core.audio.id = N` — switch to audio track N

In practice `core.audio.tracks` can sometimes be empty on `mpv.file-loaded`; fall back to `mpv.getNative('track-list')` and filter for `type === 'audio'`.

### `iina.sidebar`

- `sidebar.loadFile('sidebar.html')` — load the sidebar content
- `sidebar.show()` — reveal the sidebar tab
- `sidebar.postMessage(name, data)` — send a message to the sidebar's JS
- `sidebar.onMessage(name, cb)` — receive a message from the sidebar's JS

Inside the sidebar's HTML, the global `iina` object exposes the inverse:
- `iina.postMessage(name, data)` — send to plugin
- `iina.onMessage(name, cb)` — receive from plugin

Register `sidebar.onMessage` handlers **once** (e.g. on `iina.window-loaded`), not every time `file-loaded` fires — otherwise you stack duplicate handlers.

### `iina.event`

- `event.on('iina.window-loaded', cb)` — good place to load the sidebar and register message handlers
- `event.on('mpv.file-loaded', cb)` — fires when a new file is loaded; use to enumerate tracks and notify the sidebar

### `iina.preferences`

- `preferences.get('key')` — read a stored preference
- Preferences are bound to HTML inputs via `data-pref-key="name"` and `data-type="bool"` for checkboxes. IINA persists them automatically — no manual save handler needed.

### `iina.menu`

- `menu.addItem(menu.item('Label', callback))` — add a menu item

## The `lavfi-complex` approach (what actually worked)

mpv's [`--lavfi-complex`](https://mpv.io/manual/stable/#options-lavfi-complex) option lets a single filter graph take input from multiple audio/video tracks. The key facts learned from the mpv manual:

- A label of the form `aidN` selects audio track N as input
- A label named `ao` is connected to the audio output
- Referencing `[aid1]` and `[aid2]` in the graph forces mpv to select and decode both tracks simultaneously — no extra flag is needed
- It's set as a runtime property via `mpv.set('lavfi-complex', filter)`

### What didn't work

Several filter graphs were tried before finding one that produced clean output:

| Attempt | Filter | Result |
|---|---|---|
| pan to stereo + amix | `[aid1]pan=stereo\|c0=c0\|c1=0[left];[aid2]pan=stereo\|c0=0\|c1=c0[right];[left][right]amix=inputs=2:normalize=0[ao]` | Sound thin / "background" — amix downmixes stereo inputs |
| pan to mono + amerge | `[aid1]pan=mono\|c0=c0[left];[aid2]pan=mono\|c0=c0[right];[left][right]amerge=inputs=2[ao]` | Same thin-sound issue |
| **aformat=mono + amerge** ✅ | `[aid1]aformat=channel_layouts=mono[mono1];[aid2]aformat=channel_layouts=mono[mono2];[mono1][mono2]amerge=inputs=2[ao]` | Clean stereo, track1→left, track2→right |

The winning trick: force each track to mono with `aformat=channel_layouts=mono` *before* `amerge`. Without this, `amerge` interleaves the input channels of two stereo streams into a 4-channel layout that gets downmixed, causing the volume loss.

### Track selection interaction

- Setting `lavfi-complex` while a normal `aid` is selected causes mpv to rewrite the graph (e.g. `[aid1]` may silently become `[aid2]`) — the filter labels and `aid` fight for control.
- Fix: set `mpv.set('aid', 'no')` before applying the filter, so `lavfi-complex` owns track selection entirely.
- When turning bilingual off: clear the filter with `mpv.set('lavfi-complex', '')` and restore `mpv.set('aid', trackId)`.

### Runtime vs at-load

Setting `lavfi-complex` at runtime works without reloading the file or seeking — the new filter graph takes effect immediately. (Earlier versions tried `loadfile`, `seek` to current position, and pause/resume cycles — all unnecessary and some crashed IINA.)

## Sidebar UI conventions (from the official opensub plugin)

The IINA-bundled opensub plugin (`iina/plugin-opensub`) is the best reference for sidebar styling:

- `color-scheme: light dark` on `:root` for native dark mode
- `body { background: none; }` so IINA's window background shows through
- System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...`
- CSS variables (`--highlight-color`, `--text-secondary`, `--input-border`) with `@media (prefers-color-scheme: dark)` overrides
- 13px base font size

For preferences pages, the `iina/plugin-online-media` `pref.html` is the reference:
- Inputs use `data-pref-key="name"` for string values
- Checkboxes add `data-type="bool"`
- No styles, no save button — IINA persists automatically

## Resources

- [IINA Plugin API Documentation](https://docs.iina.io/)
- [mpv Manual — lavfi-complex](https://mpv.io/manual/stable/#options-lavfi-complex)
- [FFmpeg Audio Filters](https://ffmpeg.org/ffmpeg-filters.html#Audio-Filters)
- [IINA opensub plugin source](https://github.com/iina/plugin-opensub)
- [IINA online-media plugin source](https://github.com/iina/plugin-online-media)