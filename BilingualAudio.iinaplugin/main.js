const { core, mpv, event, sidebar, console } = iina;

class BilingualAudioPlugin {
  constructor() {
    this.tracks = [];
    this.mode = 'single';
    this.track1Id = null;
    this.track2Id = null;
    this.vol1 = 1.0;
    this.vol2 = 1.0;
    this.defaultVol1 = 1.0;
    this.defaultVol2 = 1.0;
    this.defaultMode = 'single';
  }

  detectTracks() {
    this.tracks = core.audio.tracks;
    console.log('Bilingual Audio: Detected audio tracks:', this.tracks);
    
    if (this.tracks.length > 1) {
      this.track1Id = this.tracks[0].id;
      this.track2Id = this.tracks[1].id;
      this.showSidebar();
    } else {
      console.log('Bilingual Audio: Only one audio track found, hiding sidebar');
      sidebar.hide();
    }
  }

  showSidebar() {
    sidebar.loadFile('sidebar.html');
    sidebar.postMessage('tracks-loaded', {
      tracks: this.tracks,
      mode: this.defaultMode,
      vol1: this.defaultVol1,
      vol2: this.defaultVol2
    });
    sidebar.show();
    console.log('Bilingual Audio: Sidebar shown with tracks:', this.tracks);
  }

  applyMix(mode, track1Id, track2Id, vol1, vol2) {
    this.mode = mode;
    this.track1Id = track1Id;
    this.track2Id = track2Id;
    this.vol1 = vol1;
    this.vol2 = vol2;

    const pos = mpv.getProperty('time-pos');

    let filter = '';

    if (mode === 'stereo') {
      filter = this.buildStereoFilter(track1Id, track2Id, vol1, vol2);
      this.showOSD('Stereo Mode', `Track ${track1Id} → Left`, `Track ${track2Id} → Right`);
    } else if (mode === 'mixed') {
      filter = this.buildMixedFilter(track1Id, track2Id, vol1, vol2);
      this.showOSD('Mixed Mode', `Track ${track1Id}: ${Math.round(vol1 * 100)}%`, `Track ${track2Id}: ${Math.round(vol2 * 100)}%`);
    } else {
      filter = '';
      core.audio.id = track1Id;
      this.showOSD('Single Track', `Playing Track ${track1Id}`);
    }

    if (filter) {
      mpv.setProperty('lavfi-complex', filter);
      console.log('Bilingual Audio: Applied lavfi-complex filter:', filter);
    } else {
      mpv.setProperty('lavfi-complex', '');
    }

    if (pos !== undefined && pos !== null) {
      mpv.command('seek', pos, 'absolute');
    }
  }

  buildStereoFilter(track1Id, track2Id, vol1, vol2) {
    return `[aid${track1Id}]pan=stereo|c0=${vol1}*c0|c1=0[left];` +
           `[aid${track2Id}]pan=stereo|c0=0|c1=${vol2}*c0[right];` +
           `[left][right]amix=inputs=2[ao]`;
  }

  buildMixedFilter(track1Id, track2Id, vol1, vol2) {
    return `[aid${track1Id}]volume=${vol1}[a1];` +
           `[aid${track2Id}]volume=${vol2}[a2];` +
           `[a1][a2]amix=inputs=2:duration=longest[ao]`;
  }

  resetMix() {
    this.mode = 'single';
    this.vol1 = 1.0;
    this.vol2 = 1.0;
    
    mpv.setProperty('lavfi-complex', '');
    
    if (this.tracks.length > 0) {
      core.audio.id = this.tracks[0].id;
    }
    
    this.showOSD('Reset', 'Single track mode');
    console.log('Bilingual Audio: Reset to single track mode');
  }

  showOSD(title, line1, line2 = '') {
    let message = title;
    if (line1) message += '\n' + line1;
    if (line2) message += '\n' + line2;
    core.osd(message);
  }
}

const plugin = new BilingualAudioPlugin();

event.on('mpv.file-loaded', () => {
  console.log('Bilingual Audio: File loaded, detecting tracks...');
  plugin.detectTracks();
});

sidebar.onMessage('apply-mix', (data) => {
  console.log('Bilingual Audio: Received apply-mix:', data);
  plugin.applyMix(data.mode, data.track1Id, data.track2Id, data.vol1, data.vol2);
});

sidebar.onMessage('reset-mix', () => {
  console.log('Bilingual Audio: Received reset-mix');
  plugin.resetMix();
  sidebar.postMessage('mix-reset', {
    mode: plugin.mode,
    track1Id: plugin.track1Id,
    track2Id: plugin.track2Id,
    vol1: plugin.vol1,
    vol2: plugin.vol2
  });
});