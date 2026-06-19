const { core, mpv, sidebar, menu, event } = iina;

console.log('Audio Mixer plugin loaded');

menu.addItem(
  menu.item('Show Audio Mixer', () => {
    sidebar.show();
  })
);

event.on('iina.window-loaded', () => {
  console.log('Window loaded, loading sidebar');
  sidebar.loadFile('sidebar.html');
  
  sidebar.onMessage('apply-mix', (data) => {
    console.log('APPLY RECEIVED:', data);

    try {
      if (!data.enabled) {
        mpv.set('lavfi-complex', '');
        mpv.set('aid', data.track1Id);
        sidebar.postMessage('mix-result', { success: true, message: 'Bilingual off' });
        return;
      }

      mpv.set('aid', 'no');

      const t1 = data.track1Id;
      const t2 = data.track2Id;
      const filter = '[aid' + t1 + ']aformat=channel_layouts=mono[mono1];' +
                     '[aid' + t2 + ']aformat=channel_layouts=mono[mono2];' +
                     '[mono1][mono2]amerge=inputs=2[ao]';
      console.log('Filter:', filter);

      mpv.set('lavfi-complex', filter);

      const readback = mpv.getString('lavfi-complex');
      const aid = mpv.getString('aid');
      console.log('Readback:', readback, 'aid:', aid);
      sidebar.postMessage('mix-result', { success: true, message: 'On (aid=' + aid + '): ' + (readback || '').slice(0, 40) });
    } catch (e) {
      sidebar.postMessage('mix-result', { success: false, message: 'Error: ' + e });
    }
  });
});

event.on('mpv.file-loaded', () => {
  console.log('File loaded');
  
  setTimeout(() => {
    let audioTracks = core.audio?.tracks || [];
    
    if (audioTracks.length === 0) {
      const trackList = mpv.getNative('track-list');
      if (trackList) {
        audioTracks = trackList.filter(t => t.type === 'audio');
      }
    }
    
    console.log('Audio tracks:', audioTracks.length);
    
    if (audioTracks.length > 1) {
      console.log('Sending tracks-loaded');
      sidebar.postMessage('tracks-loaded', {
        tracks: audioTracks,
        mode: 'single',
        vol1: 1.0,
        vol2: 1.0
      });
    }
  }, 1000);
});


