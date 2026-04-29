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
    try {
      // Get audio tracks - try multiple approaches
      let audioTracks = null;
      
      // Approach 1: Direct property access
      if (core.audio && core.audio.tracks) {
        audioTracks = core.audio.tracks;
        console.log('Bilingual Audio: Got tracks via core.audio.tracks');
      }
      
      // Approach 2: Try getting via mpv property
      if (!audioTracks || audioTracks.length === 0) {
        const trackList = mpv.getProperty('track-list');
        if (trackList && Array.isArray(trackList)) {
          audioTracks = trackList.filter(t => t.type === 'audio');
          console.log('Bilingual Audio: Got tracks via mpv.getProperty, audio count:', audioTracks.length);
        }
      }
      
      this.tracks = audioTracks || [];
      console.log('Bilingual Audio: Final tracks array:', JSON.stringify(this.tracks, null, 2));
      
      if (this.tracks.length > 1) {
        // Use the actual track IDs from mpv
        this.track1Id = this.tracks[0].id !== undefined ? this.tracks[0].id : 1;
        this.track2Id = this.tracks[1].id !== undefined ? this.tracks[1].id : 2;
        console.log('Bilingual Audio: Track IDs:', this.track1Id, this.track2Id);
        this.showSidebar();
      } else {
        console.log('Bilingual Audio: Only', this.tracks.length, 'audio track(s) found, hiding sidebar');
        sidebar.hide();
      }
    } catch (e) {
      console.error('Bilingual Audio: Error detecting tracks:', e);
      this.tracks = [];
      sidebar.hide();
    }
  }

  showSidebar() {
    console.log('Bilingual Audio: Loading sidebar.html...');
    sidebar.loadFile('sidebar.html');
    
    // Small delay to ensure sidebar is loaded before posting message
    setTimeout(() => {
      // Transform tracks to ensure they have the expected structure
      const trackData = this.tracks.map((t, i) => ({
        id: t.id !== undefined ? t.id : (i + 1),
        title: t.title || t.name || '',
        lang: t.lang || t.language || ''
      }));
      
      console.log('Bilingual Audio: Transformed track data:', JSON.stringify(trackData));
      
      const message = {
        tracks: trackData,
        mode: this.defaultMode,
        vol1: this.defaultVol1,
        vol2: this.defaultVol2
      };
      console.log('Bilingual Audio: Posting tracks-loaded message:', JSON.stringify(message));
      
      try {
        sidebar.postMessage('tracks-loaded', message);
        console.log('Bilingual Audio: postMessage succeeded');
      } catch (e) {
        console.error('Bilingual Audio: postMessage failed:', e);
      }
      
      sidebar.show();
      console.log('Bilingual Audio: Sidebar shown');
    }, 100);
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