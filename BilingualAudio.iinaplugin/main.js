const { core, mpv, event, sidebar } = iina;

event.on('mpv.file-loaded', () => {
  setTimeout(() => {
    let audioTracks = core.audio?.tracks || [];
    
    if (audioTracks.length === 0) {
      const trackList = mpv.getProperty('track-list');
      if (trackList) {
        audioTracks = trackList.filter(t => t.type === 'audio');
      }
    }
    
    if (audioTracks.length > 1) {
      sidebar.loadFile('sidebar.html');
      
      setTimeout(() => {
        sidebar.postMessage('tracks-loaded', {
          tracks: audioTracks,
          mode: 'single',
          vol1: 1.0,
          vol2: 1.0
        });
        sidebar.show();
      }, 500);
    }
  }, 1000);
});
