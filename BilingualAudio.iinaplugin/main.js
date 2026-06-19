const { core, mpv, sidebar, menu, event, preferences, file } = iina;

// ─── State ──────────────────────────────────────────────────────────────────

const state = {
  tracks: [],
  leftId: null,
  rightId: null,
  vol1: 1,
  vol2: 1,
  enabled: false,
  savedAid: null,
  reloading: false,
  pendingSeek: null,
};

// ─── Persistence ────────────────────────────────────────────────────────────

const SELECTIONS_FILE = '@data/selections.json';

function loadAll() {
  try {
    return file.exists(SELECTIONS_FILE) ? JSON.parse(file.read(SELECTIONS_FILE) || '{}') : {};
  } catch (e) {
    console.log('Failed reading selections:', e);
    return {};
  }
}

function saveSelection(path, selection) {
  if (!path) return;
  const all = loadAll();
  all[path] = selection;
  try { file.write(SELECTIONS_FILE, JSON.stringify(all)); }
  catch (e) { console.log('Failed writing selections:', e); }
}

function loadSelection(path) {
  return path ? loadAll()[path] || null : null;
}

function persistCurrent() {
  saveSelection(mpv.getString('path'), {
    enabled: state.enabled,
    leftId: state.leftId,
    rightId: state.rightId,
    vol1: state.vol1,
    vol2: state.vol2,
    savedAid: state.savedAid,
  });
}

// ─── Filter ─────────────────────────────────────────────────────────────────

function buildFilter(t1, t2, vol1, vol2) {
  const volL = '[mono1]volume=' + vol1 + '[mono1v];';
  const volR = '[mono2]volume=' + vol2 + '[mono2v];';
  const merge = '[mono1v][mono2v]amerge=inputs=2[ao]';
  if (t1 === t2) {
    return '[aid' + t1 + ']asplit[a][b];' +
           '[a]aformat=channel_layouts=mono[mono1];' +
           '[b]aformat=channel_layouts=mono[mono2];' + volL + volR + merge;
  }
  return '[aid' + t1 + ']aformat=channel_layouts=mono[mono1];' +
         '[aid' + t2 + ']aformat=channel_layouts=mono[mono2];' + volL + volR + merge;
}

function applyFilter() {
  mpv.set('lavfi-complex', buildFilter(state.leftId, state.rightId, state.vol1, state.vol2));
  mpv.set('aid', 'no');
}

function clearFilter() {
  mpv.set('lavfi-complex', '');
  if (state.savedAid !== null) {
    mpv.set('aid', state.savedAid);
    state.savedAid = null;
  }
}

// ─── Bilingual on/off ───────────────────────────────────────────────────────

function enableBilingual(t1, t2, vol1, vol2) {
  if (state.savedAid === null) state.savedAid = mpv.getString('aid');

  state.leftId = t1;
  state.rightId = t2;
  state.vol1 = vol1;
  state.vol2 = vol2;
  state.enabled = true;

  // Mid-playback: reload so the on_load hook applies the filter before audio
  // starts, avoiding the audio decoder resync jump.
  const pos = mpv.getNumber('time-pos');
  const path = mpv.getString('path');
  if (Number.isFinite(pos) && pos > 0 && path && !state.reloading) {
    state.reloading = true;
    state.pendingSeek = pos;
    mpv.command('loadfile', [path, 'replace']);
  } else {
    applyFilter();
  }
  refreshMenu();
}

function disableBilingual() {
  clearFilter();
  state.enabled = false;
  refreshMenu();
}

function toggleBilingual() {
  if (state.tracks.length < 2) return;
  if (state.enabled) {
    disableBilingual();
    saveSelection(mpv.getString('path'), { enabled: false });
    notifySidebar();
  } else {
    if (state.leftId === null) state.leftId = state.tracks[0].id;
    if (state.rightId === null) state.rightId = state.tracks[1].id;
    enableBilingual(state.leftId, state.rightId, state.vol1, state.vol2);
    persistCurrent();
    notifySidebar();
  }
}

function swapChannels() {
  if (!state.enabled) return;
  [state.leftId, state.rightId] = [state.rightId, state.leftId];
  enableBilingual(state.leftId, state.rightId, state.vol1, state.vol2);
  persistCurrent();
  notifySidebar();
}

// ─── Sidebar sync ───────────────────────────────────────────────────────────

function notifySidebar() {
  sidebar.postMessage('selection-restored', {
    enabled: state.enabled,
    leftId: state.leftId,
    rightId: state.rightId,
    vol1: state.vol1,
    vol2: state.vol2,
  });
}

// ─── Menu ───────────────────────────────────────────────────────────────────

const toggleMenu = menu.item('Toggle Bilingual Mode', toggleBilingual, { keyBinding: 'Ctrl+Shift+B' });
const swapMenu = menu.item('Swap Left/Right', swapChannels, { enabled: false });

function buildMenu() {
  menu.removeAllItems();
  menu.addItem(toggleMenu);
  menu.addItem(menu.item('Show Audio Mixer', () => sidebar.show()));

  const hasTracks = state.tracks.length >= 2;
  const leftMenu = menu.item('Left Channel', null, { enabled: hasTracks && state.enabled });
  const rightMenu = menu.item('Right Channel', null, { enabled: hasTracks && state.enabled });

  state.tracks.forEach((t) => {
    const id = t.id;
    const title = t.title || t.lang || String(id);
    leftMenu.addSubMenuItem(menu.item(title, () => {
      state.leftId = id;
      if (state.enabled) { enableBilingual(state.leftId, state.rightId, state.vol1, state.vol2); persistCurrent(); notifySidebar(); }
      else buildMenu();
    }, { selected: id === state.leftId }));
    rightMenu.addSubMenuItem(menu.item(title, () => {
      state.rightId = id;
      if (state.enabled) { enableBilingual(state.leftId, state.rightId, state.vol1, state.vol2); persistCurrent(); notifySidebar(); }
      else buildMenu();
    }, { selected: id === state.rightId }));
  });

  menu.addItem(leftMenu);
  menu.addItem(swapMenu);
  menu.addItem(rightMenu);
  menu.forceUpdate();
}

function refreshMenu() {
  toggleMenu.selected = state.enabled;
  toggleMenu.enabled = state.tracks.length >= 2;
  swapMenu.enabled = state.enabled;
  buildMenu();
}

// ─── Track detection ────────────────────────────────────────────────────────

function getAudioTracks() {
  let tracks = core.audio?.tracks || [];
  if (tracks.length === 0) {
    const trackList = mpv.getNative('track-list');
    if (trackList) tracks = trackList.filter(t => t.type === 'audio');
  }
  return tracks;
}

// ─── Hooks & events ─────────────────────────────────────────────────────────

// Apply saved bilingual selection before playback starts (no silence gap).
mpv.addHook('on_load', 50, (next) => {
  try {
    const saved = loadSelection(mpv.getString('path'));
    if (saved && saved.enabled && saved.leftId !== undefined && saved.rightId !== undefined) {
      state.leftId = saved.leftId;
      state.rightId = saved.rightId;
      state.vol1 = saved.vol1 !== undefined ? saved.vol1 : 1;
      state.vol2 = saved.vol2 !== undefined ? saved.vol2 : 1;
      state.savedAid = saved.savedAid !== undefined ? saved.savedAid : null;
      applyFilter();
      state.enabled = true;
    }
  } catch (e) {
    console.log('on_load hook error:', e);
  }
  state.reloading = false;
  next();
});

event.on('mpv.file-loaded', () => {
  state.reloading = false;

  if (state.pendingSeek !== null) {
    const seekTo = state.pendingSeek;
    state.pendingSeek = null;
    try { mpv.command('seek', [String(seekTo), 'absolute', 'exact']); } catch (e) {}
  }

  state.tracks = getAudioTracks();
  if (state.tracks.length > 1) {
    if (state.leftId === null) state.leftId = state.tracks[0].id;
    if (state.rightId === null) state.rightId = state.tracks[1].id;
    sidebar.postMessage('tracks-loaded', { tracks: state.tracks });
    const saved = loadSelection(mpv.getString('path'));
    if (saved) {
      sidebar.postMessage('selection-restored', saved);
      if (saved.enabled && !state.enabled) {
        state.savedAid = saved.savedAid !== undefined ? saved.savedAid : null;
        enableBilingual(saved.leftId, saved.rightId, saved.vol1 || 1, saved.vol2 || 1);
      }
    }
    if (preferences.get('auto_show')) sidebar.show();
  }
  refreshMenu();
});

event.on('iina.window-loaded', () => {
  sidebar.loadFile('sidebar.html');

  sidebar.onMessage('apply-mix', (data) => {
    try {
      if (data.enabled) {
        enableBilingual(data.track1Id, data.track2Id, data.vol1 || 1, data.vol2 || 1);
        persistCurrent();
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
    if (state.tracks.length > 0) {
      sidebar.postMessage('tracks-loaded', { tracks: state.tracks });
      const saved = loadSelection(mpv.getString('path'));
      if (saved) sidebar.postMessage('selection-restored', saved);
    }
  });
});
