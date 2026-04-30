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
      
      sidebar.onMessage('test-message', () => {
        core.osd('Test message received');
        sidebar.postMessage('mix-result', {
          success: true,
          message: 'Test received! main.js working.'
        });
      });

      sidebar.onMessage('apply-mix', (data) => {
        core.osd('Apply received: ' + data.mode);
        
        sidebar.postMessage('mix-result', {
          success: true,
          message: 'Applying: ' + data.mode + ' (t1=' + data.track1Id + ', t2=' + data.track2Id + ')'
        });
        
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
        
        core.osd('Filter: ' + (filter || 'empty'));
        
        if (filter) {
          core.osd('Setting filter');
          mpv.setProperty('lavfi-complex', filter);
          sidebar.postMessage('mix-result', {
            success: true,
            message: 'Filter applied: ' + data.mode
          });
        } else {
          mpv.setProperty('lavfi-complex', '');
          core.audio.id = data.track1Id;
          sidebar.postMessage('mix-result', { success: true, message: 'Single track mode' });
        }
        
        const pos = mpv.getProperty('time-pos');
        if (pos !== null && pos !== undefined) {
          mpv.command('seek', pos, 'absolute');
        }
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
    }
  }, 1000);
});
