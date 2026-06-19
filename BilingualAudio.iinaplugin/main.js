const { core, mpv, sidebar, menu, event, preferences } = iina;

console.log('Audio Mixer plugin loaded');

menu.addItem(
  menu.item('Show Audio Mixer', () => sidebar.show())
);

function buildBilingualFilter(t1, t2) {
  return '[aid' + t1 + ']aformat=channel_layouts=mono[mono1];' +
         '[aid' + t2 + ']aformat=channel_layouts=mono[mono2];' +
         '[mono1][mono2]amerge=inputs=2[ao]';
}

function disableBilingual(trackId) {
  mpv.set('lavfi-complex', '');
  mpv.set('aid', trackId);
}

function enableBilingual(t1, t2) {
  mpv.set('aid', 'no');
  mpv.set('lavfi-complex', buildBilingualFilter(t1, t2));
}

event.on('iina.window-loaded', () => {
  sidebar.loadFile('sidebar.html');

  sidebar.onMessage('apply-mix', (data) => {
    try {
      if (data.enabled) {
        enableBilingual(data.track1Id, data.track2Id);
        sidebar.postMessage('mix-result', { success: true, message: 'Bilingual on' });
      } else {
        disableBilingual(data.track1Id);
        sidebar.postMessage('mix-result', { success: true, message: 'Bilingual off' });
      }
    } catch (e) {
      sidebar.postMessage('mix-result', { success: false, message: 'Error: ' + e });
    }
  });
});

function getAudioTracks() {
  let tracks = core.audio?.tracks || [];
  if (tracks.length === 0) {
    const trackList = mpv.getNative('track-list');
    if (trackList) {
      tracks = trackList.filter(t => t.type === 'audio');
    }
  }
  return tracks;
}

event.on('mpv.file-loaded', () => {
  setTimeout(() => {
    const audioTracks = getAudioTracks();
    if (audioTracks.length > 1) {
      sidebar.postMessage('tracks-loaded', { tracks: audioTracks });
      if (preferences.get('auto_show')) {
        sidebar.show();
      }
    }
  }, 1000);
});