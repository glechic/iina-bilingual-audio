const { core, mpv, event, sidebar } = iina;

core.osd('Plugin loaded');

event.on('mpv.file-loaded', () => {
  core.osd('File loaded');
  
  setTimeout(() => {
    let audioTracks = core.audio?.tracks || [];
    
    if (audioTracks.length === 0) {
      const trackList = mpv.getProperty('track-list');
      if (trackList) {
        audioTracks = trackList.filter(t => t.type === 'audio');
      }
    }
    
    if (audioTracks.length > 1) {
      core.osd('Loading sidebar, tracks: ' + audioTracks.length);
      sidebar.loadFile('sidebar.html');
      
      sidebar.onMessage('test-message', () => {
        core.osd('TEST RECEIVED!');
        sidebar.postMessage('mix-result', {
          success: true,
          message: 'Test received!'
        });
      });

      sidebar.onMessage('apply-mix', (data) => {
        core.osd('APPLY RECEIVED: ' + data.mode);
        
        let filter = '';
        
        if (data.mode === 'stereo') {
          filter = '[aid' + data.track1Id + ']pan=stereo|c0=' + data.vol1 + '*c0|c1=0[left];' +
                   '[aid' + data.track2Id + ']pan=stereo|c0=0|c1=' + data.vol2 + '*c0[right];' +
                   '[left][right]amix=inputs=2[ao]';
        } else if (data.mode === 'mixed') {
          filter = '[aid' + data.track1Id + ']volume=' + data.vol1 + '[a1];' +
                   '[aid' + data.track2Id + ']volume=' + data.vol2 + '[a2];' +
                   '[a1][a2]amix=inputs=2:duration=longest[ao]';
        }
        
        if (filter) {
          core.osd('SETTING FILTER');
          mpv.setProperty('lavfi-complex', filter);
        }
        
        sidebar.postMessage('mix-result', {
          success: true,
          message: 'Applied: ' + data.mode
        });
      });
      
      setTimeout(() => {
        sidebar.postMessage('tracks-loaded', {
          tracks: audioTracks,
          mode: 'single',
          vol1: 1.0,
          vol2: 1.0
        });
        sidebar.show();
      }, 500);
    } else {
      core.osd('Only ' + audioTracks.length + ' audio track(s)');
    }
  }, 1000);
});

event.on('mpv.file-loaded', () => {
  setTimeout(() => {
    let audioTracks = core.audio?.tracks || [];
    
    if (audioTracks.length === 0) {
      const trackList = mpv.getProperty('track-list');
      if (trackList) {
        audioTracks = trackList.filter(t => t.type === 'audio');
      }
    }
    
    currentAudioTracks = audioTracks;
    
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
