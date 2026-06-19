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

### Changing audio track occasionally jumps playback forward 2-10 seconds

After changing an audio track (via sidebar dropdown or menu), playback sometimes jumps forward by 2-10 seconds. Happens roughly 50% of the time. Likely caused by mpv reinitializing the audio chain when `lavfi-complex` is applied — the decoder seeks to the nearest keyframe or the audio buffer drains/refills asymmetrically.

**Investigated:**
- Root cause: `enableBilingual` set `aid=no` *before* `lavfi-complex`, leaving mpv briefly with no audio source mid-playback, triggering a seek to resync
- Fix applied: reversed the ordering — set `lavfi-complex` first, then `aid=no`, so mpv switches directly from the old audio chain to the new filter graph without a gap
- Verify: change tracks multiple times while playing, confirm no forward jump

## Features

### OSD notifications

Show brief on-screen messages when bilingual mode is toggled or tracks change, so the user gets feedback even without looking at the sidebar.

- Use `core.osd('Bilingual on')` / `core.osd('Bilingual off')` on toggle
- Show track names in the message (e.g. "Left: English, Right: Russian")
- Notify on swap ("Swapped: Left↔Right")
- Keep messages short — IINA OSD auto-dismisses
- Gate behind a preference (`show_notifications` checkbox in `preferences.html`)

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