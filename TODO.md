# TODO — Future Enhancements

Proposed features and improvements. The current plugin is intentionally minimal (a toggle + two dropdowns); items below would add capability without bringing back the complexity that was removed (no mixed mode, no per-track volumes, no multi-mode UI).

## High priority

## Medium priority

### Improve sidebar UI

The sidebar is functional but minimal: hardcoded inline styles, no grouped sections, no feedback after toggling, and controls are stacked without hierarchy. Tighten the layout so it's easier to scan.

- Group controls into labeled sections (Toggle, Channels, Volumes) with subtle headings
- Move inline styles in `sidebar.html` to a real stylesheet block (still inline for plugin simplicity, but consistent)
- Show a small status line under the toggle ("Bilingual on / off, applied to file.mkv") using the `mix-result` message already posted by `main.js`
- Add a disabled-state hint when there are fewer than 2 audio tracks ("This file has only one audio track")
- Make the swap button visually paired with the two selects (e.g. between them, icon-only `⇄`)
- Keep the volume sliders compact (smaller labels, percent only on focus/hover) so the sidebar doesn't grow tall
- Ensure sliders/swap/selects are `disabled` (not just dimmed via `.disabled`) when bilingual is off, so they don't accumulate state on a non-bilingual file

### Keyboard shortcut to toggle bilingual

Bind a key (e.g. `Cmd+Shift+B`) to toggle bilingual mode on/off without opening the sidebar.

- Use `iina.input` to capture the key
- Call the same enable/disable path as the sidebar handler

**Done** — `Ctrl+Shift+B` bound to the "Toggle Bilingual Mode" menu item.

### External audio file as one channel

Allow loading an external audio file (e.g. a separate `.m4a`) as one of the two channels, paired with an internal track.

- Use `mpv.command('audio-add', [path, 'auto'])` to load the external track
- Reference its `aidN` in the lavfi-complex graph

### Detect external audio tracks

Surface external audio tracks (loaded via `audio-add` or demuxer attachments) in the track dropdowns alongside internal ones, so they can be picked for left/right channels.

- Filter `mpv.getNative('track-list')` by `external: true` and `type: 'audio'`
- Label them distinctly (e.g. `Track N (external): name.ext`) so users can tell them apart from embedded tracks
- Handle the external track being removed mid-session (rebuild dropdowns on `track-list` change if an event is available; otherwise on a manual refresh / menu entry)
- Validate the external track has a stable `id` before referencing it in the `lavfi-complex` graph

### System theme support (dark mode)

Sidebar currently hardcodes light colors (`rgba(0, 0, 0, 0.5)`). Adopt IINA's native theming so the sidebar matches the system appearance.

- Add `color-scheme: light dark` on `:root`
- Replace hardcoded colors with CSS variables (`--text-primary`, `--text-secondary`, `--input-border`, `--bg`)
- Provide `@media (prefers-color-scheme: dark)` overrides (see the opensub plugin reference in `IINA Plugin Investigation.md`)
- Apply the same variables to `preferences.html`

### Expand menu integration

Only a single "Show Audio Mixer" menu item exists today. Add more menu entries so common actions are reachable without opening the sidebar.

- Toggle bilingual mode on/off
- Swap left/right channels
- Reload/refresh track list
- Group items under a submenu (e.g. `Audio Mixer ▸`) via `menu.addItem` with nested `menu.item`s
- Reflect the current bilingual state with a checkmark/indicator if `menu.item` supports it

**Done** — Plugin menu now has Toggle Bilingual Mode (with checkmark + `Ctrl+Shift+B`), Show Audio Mixer, Left/Right Channel submenus with track checkmarks, and Swap Left/Right.

## Low priority

### Sync adjustment between tracks

Add a small delay slider for the right channel in case the two tracks are slightly out of sync.

- Insert `adelay` filter on one branch before `amerge`

### Batch pre-mix script

Standalone shell script using FFmpeg to bake a bilingual mix into a single file for use on players without plugin support.

```sh
ffmpeg -i input.mkv -filter_complex \
  "[0:a:0]aformat=channel_layouts=mono[m1];[0:a:1]aformat=channel_layouts=mono[m2];[m1][m2]amerge=inputs=2[aout]" \
  -map 0:v -map "[aout]" -c:v copy output.mkv
```


## Bugs

### setTimeout on file-loaded delays restored bilingual audio by 1s

`mpv.file-loaded` used `setTimeout(..., 1000)` before reading tracks and applying a saved bilingual selection, causing a 1-second silence gap at the start of every reopened file.

**Fixed** — the saved selection is now applied via an `mpv.addHook('on_load', ...)` hook, which runs after the file is probed (tracks are known) but before audio output starts. The `mpv.file-loaded` handler now only updates the sidebar/menu; no timeout needed.

## Publishing

### Package the plugin for distribution

The current artifact is a checked-in `BilingualAudio.iinaplugin/` folder that users copy by hand to `~/Library/Application Support/com.colliderli.iina/plugins/`. Add a real packaging/release flow.

- Add a build script (npm `prepare` / `prepack` is fine since `package.json` already exists) that zips the contents of `BilingualAudio.iinaplugin/` into `BilingualAudio.iinaplugin-VERSION.zip` (the layout IINA expects)
- Bump `Info.json`'s `version` field per release and keep a `CHANGELOG.md`
- Add a `scripts/pack.js` (or `scripts/pack.sh`) so the zip can also be produced outside npm (`node scripts/pack.js`)
- Document install steps in `README.md`: download the zip, extract into the IINA plugins folder, restart IINA
- Note IINA does not have a central plugin registry today, so distribution is via GitHub Releases — attach the zip as a release asset and link from the README
- Optional: a GitHub Actions workflow that on tag push builds the zip and attaches it to the GitHub Release

## Completed

### v1.0 — Working prototype
- [x] Plugin structure with `Info.json`
- [x] Audio track detection via `core.audio.tracks` + `mpv.getNative('track-list')` fallback
- [x] Bilingual toggle in sidebar with two dropdowns (left/right channel)
- [x] `lavfi-complex` filter using `aformat=mono` + `amerge` for clean stereo output
- [x] `aid=no` while filter active; restored on toggle off
- [x] Preferences page with `auto_show` checkbox using `data-pref-key`
- [x] IINA native sidebar styling (`color-scheme`, `prefers-color-scheme`, CSS variables)
- [x] Menu item to show the sidebar

## Development notes

- The plugin is plain JS, no build step
- Test by copying to `~/Library/Application Support/com.colliderli.iina/plugins/` and restarting IINA
- The `IINA Plugin Investigation.md` file documents the API pitfalls discovered (especially the `mpv.set` vs `mpv.setProperty` issue and the working filter graph)