# TODO — Future Enhancements

Proposed features and improvements. The current plugin is intentionally minimal (a toggle + two dropdowns); items below would add capability without bringing back the complexity that was removed (no mixed mode, no per-track volumes, no multi-mode UI).

## High priority

### Auto-select tracks by language

When a file loads, auto-pick the left/right channels based on user-configured preferred languages instead of defaulting to track 1 and track 2.

- Add `primary_lang` and `secondary_lang` text preferences (e.g. `en`, `ru`)
- On `mpv.file-loaded`, match `track.lang` against the preferences
- Fall back to track order if no match

### Remember last selection per file

Persist the chosen left/right track IDs so reopening the same file restores the previous bilingual state.

- Key by file path or content hash
- Store in `iina.preferences` (only supports flat keys) or a JSON sidecar via `iina.file`

## Medium priority

### Keyboard shortcut to toggle bilingual

Bind a key (e.g. `Cmd+Shift+B`) to toggle bilingual mode on/off without opening the sidebar.

- Use `iina.input` to capture the key
- Call the same enable/disable path as the sidebar handler

### External audio file as one channel

Allow loading an external audio file (e.g. a separate `.m4a`) as one of the two channels, paired with an internal track.

- Use `mpv.command('audio-add', [path, 'auto'])` to load the external track
- Reference its `aidN` in the lavfi-complex graph

### Per-channel volume balance

Add a single balance slider (left ↔ right) rather than two independent volume controls. Keeps the UI minimal while letting users emphasize one language.

- Implement via `[mono1]volume=V1[mono1v];[mono2]volume=V2[mono2v]` before `amerge`
- Slider maps position to `V1`/`V2` with `V1 + V2 = 1`

## Low priority

### Support 3+ audio tracks

Generalize the filter to handle N tracks (e.g. for tri-lingual content). Would require a different UI (checkboxes per track instead of two dropdowns) and `amerge=inputs=N`.

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

### Bilingual toggle leaves original audio track disabled after turning off
When bilingual mode is enabled, the plugin sets `mpv.set('aid', 'no')` so `lavfi-complex` can own track selection. When toggled off, it restores `aid` to `data.track1Id` — but if the user had a *different* track selected in IINA's native audio picker before enabling bilingual, that original selection is lost. IINA's audio picker also shows as "off" while bilingual is active, which is expected, but the off-path doesn't restore the user's pre-bilingual selection.

**Fix:** capture `mpv.getString('aid')` *before* setting `aid=no`, and restore that value (not `data.track1Id`) on toggle off.

### Bilingual mode silently fails when left and right track are the same
The filter graph `[aid1]...[aid1]...` (same track on both channels) produces no audio because the `aid1` label can only be used once in a `lavfi-complex` graph. If the user picks the same track for both dropdowns, the plugin sets the filter without warning and the audio goes silent.

**Fix:** either (a) detect same-track selection and use `asplit` to fan out one input into two branches, or (b) disable the right dropdown's value matching the left dropdown, or (c) show a warning and refuse to apply. Option (a) keeps it functional:
```
[aid1]asplit[a][b];
[a]aformat=channel_layouts=mono[m1];
[b]aformat=channel_layouts=mono[m2];
[m1][m2]amerge=inputs=2[ao]
```

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