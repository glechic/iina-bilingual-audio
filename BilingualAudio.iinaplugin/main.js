const { core, mpv, sidebar, menu, event, preferences, file } = iina;

console.log('Audio Mixer plugin loaded');

menu.addItem(
  menu.item('Show Audio Mixer', () => sidebar.show())
);

const SELECTIONS_FILE = '@data/selections.json';

function readSelections() {
  try {
    if (!file.exists(SELECTIONS_FILE)) return {};
    return JSON.parse(file.read(SELECTIONS_FILE) || '{}');
  } catch (e) {
    console.log('Failed reading selections:', e);
    return {};
  }
}

function writeSelections(map) {
  try {
    file.write(SELECTIONS_FILE, JSON.stringify(map));
  } catch (e) {
    console.log('Failed writing selections:', e);
  }
}

function saveSelection(path, state) {
  if (!path) return;
  const map = readSelections();
  map[path] = state;
  writeSelections(map);
}

function loadSelection(path) {
  if (!path) return null;
  const map = readSelections();
  return map[path] || null;
}

function buildBilingualFilter(t1, t2, vol1, vol2) {
  const v1 = vol1;
  const v2 = vol2;
  const volL = '[mono1]volume=' + v1 + '[mono1v];';
  const volR = '[mono2]volume=' + v2 + '[mono2v];';
  if (t1 === t2) {
    return '[aid' + t1 + ']asplit[a][b];' +
           '[a]aformat=channel_layouts=mono[mono1];' +
           '[b]aformat=channel_layouts=mono[mono2];' +
           volL + volR +
           '[mono1v][mono2v]amerge=inputs=2[ao]';
  }
  return '[aid' + t1 + ']aformat=channel_layouts=mono[mono1];' +
         '[aid' + t2 + ']aformat=channel_layouts=mono[mono2];' +
         volL + volR +
         '[mono1v][mono2v]amerge=inputs=2[ao]';
}

let savedAid = null;

function disableBilingual() {
  mpv.set('lavfi-complex', '');
  if (savedAid !== null) {
    mpv.set('aid', savedAid);
    savedAid = null;
  }
}

function enableBilingual(t1, t2, vol1, vol2) {
  if (savedAid === null) {
    savedAid = mpv.getString('aid');
  }
  mpv.set('aid', 'no');
  mpv.set('lavfi-complex', buildBilingualFilter(t1, t2, vol1, vol2));
}

event.on('iina.window-loaded', () => {
  sidebar.loadFile('sidebar.html');

  sidebar.onMessage('apply-mix', (data) => {
    try {
      if (data.enabled) {
        const vol1 = data.vol1 !== undefined ? data.vol1 : 1;
        const vol2 = data.vol2 !== undefined ? data.vol2 : 1;
        enableBilingual(data.track1Id, data.track2Id, vol1, vol2);
        saveSelection(mpv.getString('path'), {
          enabled: true,
          leftId: data.track1Id,
          rightId: data.track2Id,
          vol1: vol1,
          vol2: vol2,
          savedAid: savedAid
        });
        sidebar.postMessage('mix-result', { success: true, message: 'Bilingual on' });
      } else {
        disableBilingual();
        saveSelection(mpv.getString('path'), { enabled: false });
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
      const saved = loadSelection(mpv.getString('path'));
      if (saved) {
        sidebar.postMessage('selection-restored', saved);
        if (saved.enabled) {
          if (saved.savedAid !== undefined) {
            savedAid = saved.savedAid;
          }
          enableBilingual(
            saved.leftId,
            saved.rightId,
            saved.vol1 !== undefined ? saved.vol1 : 1,
            saved.vol2 !== undefined ? saved.vol2 : 1
          );
        }
      }
      if (preferences.get('auto_show')) {
        sidebar.show();
      }
    }
  }, 1000);
});