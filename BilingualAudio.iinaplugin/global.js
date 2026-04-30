const { core, mpv, iina } = this;

iina.onMessage('test-message', () => {
  iina.postMessage('mix-result', {
    success: true,
    message: 'Test received! global.js working.'
  });
});

iina.onMessage('apply-mix', (data) => {
  iina.console.log('Received apply-mix: ' + JSON.stringify(data));
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
    mpv.setProperty('lavfi-complex', filter);
    iina.console.log('Filter set: ' + filter);
    iina.postMessage('mix-result', {
      success: true,
      message: 'Filter applied: ' + data.mode
    });
  } else {
    mpv.setProperty('lavfi-complex', '');
    core.audio.id = data.track1Id;
    iina.postMessage('mix-result', { success: true, message: 'Single track mode' });
  }
  
  const pos = mpv.getProperty('time-pos');
  if (pos !== null && pos !== undefined) {
    mpv.command('seek', pos, 'absolute');
  }
});
