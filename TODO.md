# TODO — Future Enhancements

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

### Sync adjustment between tracks

Add a small delay slider for the right channel in case the two tracks are slightly out of sync.
- Insert `adelay` filter on one branch before `amerge`

## Publishing

### Package the plugin for distribution

The current artifact is a checked-in `BilingualAudio.iinaplugin/` folder that users copy by hand to `~/Library/Application Support/com.colliderli.iina/plugins/`. Add a real packaging/release flow.

- Add a build script (npm `prepare` / `prepack` is fine since `package.json` already exists) that zips the contents of `BilingualAudio.iinaplugin/` into `BilingualAudio.iinaplugin-VERSION.zip` (the layout IINA expects)
- Bump `Info.json`'s `version` field per release and keep a `CHANGELOG.md`
- Document install steps in `README.md`: download the zip, extract into the IINA plugins folder, restart IINA
- Optional: a GitHub Actions workflow that on tag push builds the zip and attaches it to the GitHub Release

## Development notes

- Test by copying to `~/Library/Application Support/com.colliderli.iina/plugins/` and restarting IINA