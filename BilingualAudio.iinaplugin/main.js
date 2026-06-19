const { core, mpv, sidebar, menu, event, preferences, file } = iina;

console.log('Audio Mixer plugin loaded');

let currentTracks = [];
let currentLeftId = null;
let currentRightId = null;
let currentVol1 = 1;
let currentVol2 = 1;
let bilingualOn = false;

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
  bilingualOn = false;
  refreshMenu();
}

function enableBilingual(t1, t2, vol1, vol2) {
  if (savedAid === null) {
    savedAid = mpv.getString('aid');
  }
  mpv.set('aid', 'no');
  mpv.set('lavfi-complex', buildBilingualFilter(t1, t2, vol1, vol2));
  currentLeftId = t1;
  currentRightId = t2;
  currentVol1 = vol1;
  currentVol2 = vol2;
  bilingualOn = true;
  refreshMenu();
}

// --- Menu ---

const toggleMenu = menu.item('Toggle Bilingual Mode', toggleBilingual, { keyBinding: 'Ctrl+Shift+B' });
const swapMenu = menu.item('Swap Left/Right', swapChannels, { enabled: false });
let leftMenu = menu.item('Left Channel', null, { enabled: false });
let rightMenu = menu.item('Right Channel', null, { enabled: false });

function buildMenu() {
  menu.removeAllItems();
  menu.addItem(toggleMenu);
  menu.addItem(menu.item('Show Audio Mixer', () => sidebar.show()));
  menu.addItem(menu.separator());
  leftMenu = menu.item('Left Channel', null, { enabled: currentTracks.length >= 2 });
  rightMenu = menu.item('Right Channel', null, { enabled: currentTracks.length >= 2 });
  currentTracks.forEach((t) => {
    const id = t.id;
    const title = t.title || t.lang || ('Track ' + id);
    leftMenu.addSubMenuItem(menu.item(title, () => selectLeft(id), { selected: id === currentLeftId }));
    rightMenu.addSubMenuItem(menu.item(title, () => selectRight(id), { selected: id === currentRightId }));
  });
  menu.addItem(leftMenu);
  menu.addItem(rightMenu);
  menu.addItem(swapMenu);
  menu.forceUpdate();
}

function selectLeft(id) {
  currentLeftId = id;
  if (bilingualOn) {
    enableBilingual(currentLeftId, currentRightId, currentVol1, currentVol2);
    persistCurrent();
    notifySidebar();
  } else {
    buildMenu();
  }
}

function selectRight(id) {
  currentRightId = id;
  if (bilingualOn) {
    enableBilingual(currentLeftId, currentRightId, currentVol1, currentVol2);
    persistCurrent();
    notifySidebar();
  } else {
    buildMenu();
  }
}

function toggleBilingual() {
  if (currentTracks.length < 2) return;
  if (bilingualOn) {
    disableBilingual();
    saveSelection(mpv.getString('path'), { enabled: false });
    sidebar.postMessage('selection-restored', { enabled: false });
  } else {
    if (currentLeftId === null) currentLeftId = currentTracks[0].id;
    if (currentRightId === null) currentRightId = currentTracks[1].id;
    enableBilingual(currentLeftId, currentRightId, currentVol1, currentVol2);
    persistCurrent();
    notifySidebar();
  }
}

function swapChannels() {
  if (!bilingualOn) return;
  const tmp = currentLeftId;
  currentLeftId = currentRightId;
  currentRightId = tmp;
  enableBilingual(currentLeftId, currentRightId, currentVol1, currentVol2);
  persistCurrent();
  notifySidebar();
}

function persistCurrent() {
  saveSelection(mpv.getString('path'), {
    enabled: true,
    leftId: currentLeftId,
    rightId: currentRightId,
    vol1: currentVol1,
    vol2: currentVol2,
    savedAid: savedAid
  });
}

function notifySidebar() {
  sidebar.postMessage('selection-restored', {
    enabled: bilingualOn,
    leftId: currentLeftId,
    rightId: currentRightId,
    vol1: currentVol1,
    vol2: currentVol2
  });
}

function refreshMenu() {
  toggleMenu.selected = bilingualOn;
  toggleMenu.enabled = currentTracks.length >= 2;
  swapMenu.enabled = bilingualOn;
  buildMenu();
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

  sidebar.onMessage('sidebar-ready', () => {
    if (currentTracks.length > 0) {
      sidebar.postMessage('tracks-loaded', { tracks: currentTracks });
      const saved = loadSelection(mpv.getString('path'));
      if (saved) {
        sidebar.postMessage('selection-restored', saved);
      }
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

// Apply a saved bilingual selection BEFORE playback starts, so there's no
// 1-second silence gap at the beginning of a reopened file. The on_load hook
// runs after the file is probed (tracks are known) but before audio output.
mpv.addHook('on_load', 50, (next) => {
  try {
    const path = mpv.getString('path');
    const saved = loadSelection(path);
    console.log('on_load hook: path=' + path + ' saved=' + JSON.stringify(saved));
    if (saved && saved.enabled && saved.leftId !== undefined && saved.rightId !== undefined) {
      currentLeftId = saved.leftId;
      currentRightId = saved.rightId;
      currentVol1 = saved.vol1 !== undefined ? saved.vol1 : 1;
      currentVol2 = saved.vol2 !== undefined ? saved.vol2 : 1;
      if (saved.savedAid !== undefined) {
        savedAid = saved.savedAid;
      }
      enableBilingual(currentLeftId, currentRightId, currentVol1, currentVol2);
      console.log('on_load: bilingual enabled in hook');
    }
  } catch (e) {
    console.log('on_load hook error:', e);
  }
  next();
});

event.on('mpv.file-loaded', () => {
  const audioTracks = getAudioTracks();
  currentTracks = audioTracks;
  if (audioTracks.length > 1) {
    if (currentLeftId === null) currentLeftId = audioTracks[0].id;
    if (currentRightId === null) currentRightId = audioTracks[1].id;
    sidebar.postMessage('tracks-loaded', { tracks: audioTracks });
    const saved = loadSelection(mpv.getString('path'));
    if (saved) {
      sidebar.postMessage('selection-restored', saved);
      if (saved.enabled && !bilingualOn) {
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
  refreshMenu();
});