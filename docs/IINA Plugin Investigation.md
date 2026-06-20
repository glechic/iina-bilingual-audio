# IINA Bilingual Audio Plugin — Investigation Notes

Key findings from building the plugin. Focused on what works and what doesn't.

## Plugin structure

```
src/
├── Info.json          # Plugin metadata (name, identifier, permissions, etc.)
├── main.js            # Main entry — has access to mpv/sidebar/menu/event
├── preferences.html   # Settings UI (uses data-pref-key attributes)
└── sidebar.html       # Sidebar panel
```

No `global.js` — sidebar is only available in the main entry.

## IINA Plugin API

### `mpv`

| Method | Purpose |
|---|---|
| `mpv.set(name, value)` | Set a property |
| `mpv.getString(name)` | Read as string |
| `mpv.getNumber(name)` | Read as number |
| `mpv.getFlag(name)` | Read as boolean |
| `mpv.getNative(name)` | Read as JS object (lists, dicts) |
| `mpv.command(name, [args])` | Run a command (args is an **array**) |
| `mpv.addHook(name, priority, cb)` | Register an mpv hook |

**`mpv.setProperty` / `mpv.getProperty` do not exist.** Use `mpv.set` / `mpv.getString` / `mpv.getNative`.

### `core`

- `core.audio.tracks` — can be empty on `file-loaded`; fall back to `mpv.getNative('track-list')` filtered by `type === 'audio'`
- `core.audio.id = N` — switch track

### `sidebar`

- `sidebar.loadFile('sidebar.html')`, `sidebar.show()`, `sidebar.postMessage(name, data)`, `sidebar.onMessage(name, cb)`
- Inside sidebar HTML: `iina.postMessage(name, data)` / `iina.onMessage(name, cb)`
- Register `sidebar.onMessage` handlers **once** (on `iina.window-loaded`), not on every `file-loaded`

### `event`

- `event.on('iina.window-loaded', cb)` — load sidebar, register handlers
- `event.on('mpv.file-loaded', cb)` — enumerate tracks, notify sidebar

### `preferences`

- `preferences.get('key')` — read stored preference
- Bound to HTML inputs via `data-pref-key="name"` and `data-type="bool"` for checkboxes. IINA persists automatically.

## `lavfi-complex` filter

[`--lavfi-complex`](https://mpv.io/manual/stable/#options-lavfi-complex) lets one filter graph take input from multiple audio tracks. Labels `aidN` select track N, `ao` is the audio output. Referencing `[aid1]` and `[aid2]` forces mpv to decode both simultaneously.

### What works

```
[aid1]aformat=channel_layouts=mono[mono1];
[aid2]aformat=channel_layouts=mono[mono2];
[mono1][mono2]amerge=inputs=2[ao]
```

Force each track to mono with `aformat` **before** `amerge`. Without this, `amerge` interleaves two stereo streams into 4 channels that get downmixed, causing volume loss ("background sound").

### Track selection

- Setting `lavfi-complex` while a normal `aid` is active causes mpv to rewrite the graph labels. Fix: set `mpv.set('aid', 'no')` so `lavfi-complex` owns track selection.
- On disable: clear filter with `mpv.set('lavfi-complex', '')` and restore `mpv.set('aid', savedAid)`.
- For same-track selection, use `asplit` to fan out one input (each label can only be used once).

### Mid-playback changes

Setting `lavfi-complex` mid-playback causes a 2-10s forward jump (audio decoder resync). Fix: reload the file via `mpv.command('loadfile', [path, 'replace'])` — the `on_load` hook applies the filter before audio starts, eliminating the jump. Seek back to saved position after reload.

## Sidebar styling (from opensub plugin)

- `color-scheme: light dark`, `background: none`, system font, 13px
- `@media (prefers-color-scheme: dark)` for color overrides

## Resources

- [IINA Plugin API](https://docs.iina.io/)
- [mpv — lavfi-complex](https://mpv.io/manual/stable/#options-lavfi-complex)
- [IINA opensub plugin](https://github.com/iina/plugin-opensub)
- [IINA online-media plugin](https://github.com/iina/plugin-online-media)