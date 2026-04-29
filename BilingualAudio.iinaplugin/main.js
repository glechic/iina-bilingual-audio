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
      let audioTracks = null;
      let source = '';
      
      // Try core.audio.tracks first
      if (core.audio && core.audio.tracks) {
        audioTracks = core.audio.tracks;
        source = 'core.audio.tracks';
      }
      
      // Fallback to mpv.track-list
      if (!audioTracks || audioTracks.length === 0) {
        const trackList = mpv.getProperty('track-list');
        if (trackList && Array.isArray(trackList)) {
          audioTracks = trackList.filter(t => t.type === 'audio');
          source = 'mpv.track-list';
        }
      }
      
      this.tracks = audioTracks || [];
      
      // Show OSD with track count
      const count = this.tracks.length;
      core.osd(`Audio Tracks: ${count}\nSource: ${source}`);
      
      console.log('Bilingual Audio: Got', count, 'tracks via', source);
      console.log('Bilingual Audio: Tracks:', JSON.stringify(this.tracks));
      
      if (count > 1) {
        this.track1Id = this.tracks[0].id !== undefined ? this.tracks[0].id : 1;
        this.track2Id = this.tracks[1].id !== undefined ? this.tracks[1].id : 2;
        console.log('Bilingual Audio: Track IDs:', this.track1Id, this.track2Id);
        this.showSidebar();
      } else {
        console.log('Bilingual Audio: Only', count, 'track(s), hiding sidebar');
        sidebar.hide();
      }
    } catch (e) {
      console.error('Bilingual Audio: Error:', e);
      core.osd('Audio Plugin Error\nCheck console');
      this.tracks = [];
      sidebar.hide();
    }
  }
      
      // Approach 2: Try getting via mpv property
      if (!audioTracks || audioTracks.length === 0) {
        const trackList = mpv.getProperty('track-list');
        if (trackList && Array.isArray(trackList)) {
          audioTracks = trackList.filter(t => t.type === 'audio');
          source = 'mpv.track-list';
        }
      }
      
      this.tracks = audioTracks || [];
      
      // Show OSD with track info
      const count = this.tracks.length;
      core.osd(`Audio Tracks: ${count}\nSource: ${source}`);
      
      console.log('Bilingual Audio: Got', count, 'tracks via', source);
      console.log('Bilingual Audio: Tracks:', JSON.stringify(this.tracks));
      
      if (count > 1) {
        this.track1Id = this.tracks[0].id !== undefined ? this.tracks[0].id : 1;
        this.track2Id = this.tracks[1].id !== undefined ? this.tracks[1].id : 2;
        console.log('Bilingual Audio: Track IDs:', this.track1Id, this.track2Id);
        this.showSidebar();
      } else {
        console.log('Bilingual Audio: Only', count, 'track(s), hiding sidebar');
        sidebar.hide();
      }
    } catch (e) {
      console.error('Bilingual Audio: Error:', e);
      core.osd('Audio Plugin Error\nCheck console');
      this.tracks = [];
      sidebar.hide();
    }
  }

  showSidebar() {
    sidebar.loadFile('sidebar.html');
    
    // Transform tracks to ensure they have the expected structure
    const trackData = this.tracks.map((t, i) => ({
      id: t.id !== undefined ? t.id : (i + 1),
      title: t.title || t.name || '',
      lang: t.lang || t.language || ''
    }));
    
    const message = {
      tracks: trackData,
      mode: this.defaultMode,
      vol1: this.defaultVol1,
      vol2: this.defaultVol2
    };
    
    // Show OSD with track count
    core.osd(`Sending ${trackData.length} tracks to sidebar`);
    
    // Wait for sidebar to load
    setTimeout(() => {
      sidebar.postMessage('tracks-loaded', message);
      sidebar.show();
    }, 200);
  }

  applyMix(mode, track1Id, track2Id, vol1, vol2) {
    // Show OSD that we received the request
    core.osd(`Applying: ${mode}\nT1: ${track1Id}, T2: ${track2Id}\nV1: ${Math.round(vol1*100)}%, V2: ${Math.round(vol2*100)}%`);
    
    this.mode = mode;
    this.track1Id = track1Id;
    this.track2Id = track2Id;
    this.vol1 = vol1;
    this.vol2 = vol2;

    const pos = mpv.getProperty('time-pos');

    let filter = '';

    if (mode === 'stereo') {
      filter = this.buildStereoFilter(track1Id, track2Id, vol1, vol2);
    } else if (mode === 'mixed') {
      filter = this.buildMixedFilter(track1Id, track2Id, vol1, vol2);
    } else {
      // Single track mode
      core.audio.id = track1Id;
      core.osd(`Single Track Mode\nPlaying Track ${track1Id}`);
    }

    if (filter) {
      // Show the filter being applied
      core.osd(`Filter:\n${filter.substring(0, 50)}...`);
      const result = mpv.setProperty('lavfi-complex', filter);
      core.osd(`Filter applied\nReloading playback...`);
    } else {
      mpv.setProperty('lavfi-complex', '');
    }

    if (pos !== undefined && pos !== null) {
      mpv.command('seek', pos, 'absolute');
      core.osd(`Position restored: ${Math.round(pos)}s`);
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
  core.osd('File loaded, detecting tracks...');
  setTimeout(() => plugin.detectTracks(), 500);
});

// Also listen for track list changes
event.on('mpv.track-list-change', () => {
  core.osd('Track list changed, refreshing...');
  setTimeout(() => plugin.detectTracks(), 300);
});

// Test if sidebar message handler works
sidebar.onMessage('test-message', (data) => {
  core.osd('TEST MESSAGE RECEIVED\nData: ' + JSON.stringify(data));
});

sidebar.onMessage('apply-mix', (data) => {
  core.osd('RECEIVED apply-mix');
  plugin.applyMix(data.mode, data.track1Id, data.track2Id, data.vol1, data.vol2);
});

sidebar.onMessage('reset-mix', () => {
  plugin.resetMix();
  sidebar.postMessage('mix-reset', {
    mode: plugin.mode,
    track1Id: plugin.track1Id,
    track2Id: plugin.track2Id,
    vol1: plugin.vol1,
    vol2: plugin.vol2
  });
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