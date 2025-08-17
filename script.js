'use strict';

// Tailwind dark mode toggle
(function initTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem('msfl_theme');
  if (saved === 'dark') root.classList.add('dark');
  const toggle = document.getElementById('darkToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      root.classList.toggle('dark');
      localStorage.setItem('msfl_theme', root.classList.contains('dark') ? 'dark' : 'light');
    });
  }
})();

// -----------------------------
// Modal: Confirm
// -----------------------------
function showConfirmModal(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const msgEl = document.getElementById('confirmMessage');
    const yes = document.getElementById('confirmYes');
    const no = document.getElementById('confirmNo');
    msgEl.textContent = message || 'Are you sure?';
    modal.classList.remove('hidden');

    function cleanup() {
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
      overlay.removeEventListener('click', onNo);
    }
    function onYes() { cleanup(); modal.classList.add('hidden'); resolve(true); }
    function onNo() { cleanup(); modal.classList.add('hidden'); resolve(false); }

    const overlay = modal.querySelector('.absolute.inset-0');
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
    overlay.addEventListener('click', onNo);
  });
}

// -----------------------------
// Modal: Flight Details/Edit
// -----------------------------
function openLogModal(id, { mode = 'view' } = {}) {
  const logs = loadLogs();
  const log = logs.find(l => l.id === id);
  if (!log) return;
  MODAL_CURRENT_ID = id;
  const modal = document.getElementById('logModal');
  const content = document.getElementById('logModalContent');
  modal.classList.remove('hidden');
  if (mode === 'edit') renderLogModalEdit(log); else renderLogModalView(log);

  // Bind close interactions (overlay, close button, Escape)
  const overlay = modal.querySelector('.absolute.inset-0');
  const closeBtn = document.getElementById('logModalClose');
  const onClose = (e) => { e?.preventDefault?.(); closeLogModal(); };
  const onEsc = (e) => { if (e.key === 'Escape') closeLogModal(); };

  // Cleanup existing listeners if any before re-binding
  if (LOG_MODAL_CLEANUP) { try { LOG_MODAL_CLEANUP(); } catch (_) {} LOG_MODAL_CLEANUP = null; }
  overlay?.addEventListener('click', onClose);
  closeBtn?.addEventListener('click', onClose);
  window.addEventListener('keydown', onEsc);
  LOG_MODAL_CLEANUP = () => {
    overlay?.removeEventListener('click', onClose);
    closeBtn?.removeEventListener('click', onClose);
    window.removeEventListener('keydown', onEsc);
  };
}

// New: Open a fresh modal to create a new flight log (not yet persisted)
function openNewLogModal() {
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60000);
  const log = {
    id: uid(),
    createdAt: new Date().toISOString(),
    takeoffUtc: now.toISOString(),
    landingUtc: later.toISOString(),
    airborneMinutes: 60,
    distanceNm: null,
    dep: null,
    arr: null,
    depGate: '',
    arrGate: '',
    taxiways: '',
    depRunway: '',
    arrRunway: '',
    expectedMach: null,
    notes: '',
  };
  MODAL_CURRENT_ID = log.id;
  const modal = document.getElementById('logModal');
  modal.classList.remove('hidden');
  renderLogModalEdit(log);

  // Bind close interactions (overlay, close button, Escape)
  const overlay = modal.querySelector('.absolute.inset-0');
  const closeBtn = document.getElementById('logModalClose');
  const onClose = (e) => { e?.preventDefault?.(); closeLogModal(); };
  const onEsc = (e) => { if (e.key === 'Escape') closeLogModal(); };
  if (LOG_MODAL_CLEANUP) { try { LOG_MODAL_CLEANUP(); } catch (_) {} LOG_MODAL_CLEANUP = null; }
  overlay?.addEventListener('click', onClose);
  closeBtn?.addEventListener('click', onClose);
  window.addEventListener('keydown', onEsc);
  LOG_MODAL_CLEANUP = () => {
    overlay?.removeEventListener('click', onClose);
    closeBtn?.removeEventListener('click', onClose);
    window.removeEventListener('keydown', onEsc);
  };
}

function closeLogModal() {
  const modal = document.getElementById('logModal');
  modal.classList.add('hidden');
  destroyModalMap();
  MODAL_CURRENT_ID = null;
  if (LOG_MODAL_CLEANUP) { try { LOG_MODAL_CLEANUP(); } catch (_) {} LOG_MODAL_CLEANUP = null; }
}

function renderLogModalView(log) {
  const content = document.getElementById('logModalContent');
  const dep = log.dep?.icao || log.depCode || '?';
  const arr = log.arr?.icao || log.arrCode || '?';
  const dt = new Date(log.takeoffUtc);
  const lt = new Date(log.landingUtc);
  const dateStr = isNaN(dt.getTime()) ? '-' : dt.toISOString().replace('T', ' ').slice(0, 16) + 'Z';
  const duration = fmtHM(log.airborneMinutes);
  const distance = (log.distanceNm != null) ? `${log.distanceNm} NM` : '-- NM';
  const mach = (log.expectedMach != null) ? String(log.expectedMach) : '';

  content.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">Date (UTC)</div>
        <div class="font-medium mb-3">${dateStr}</div>

        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">Route</div>
        <div class="font-medium mb-3">${dep} → ${arr}</div>

        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">Duration / Distance</div>
        <div class="font-medium mb-3">${duration} • ${distance}</div>

        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">Runways</div>
        <div class="font-medium mb-3">${log.depRunway || ''} / ${log.arrRunway || ''}</div>

        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">Gates</div>
        <div class="font-medium mb-3">${log.depGate || ''} / ${log.arrGate || ''}</div>

        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">Taxiways</div>
        <div class="font-medium mb-3">${log.taxiways || ''}</div>

        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">Expected Avg Speed (Mach)</div>
        <div class="font-medium mb-3">${mach}</div>

        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">Notes</div>
        <div class="font-medium whitespace-pre-wrap">${(log.notes || '').replace(/</g,'&lt;')}</div>
      </div>
      <div class="min-h-[300px]">
        <div id="logModalMap" class="h-72 sm:h-80 rounded-md border border-gray-200 dark:border-gray-800"></div>
      </div>
    </div>
    <div class="mt-4 flex justify-end gap-2">
      <button id="modalEditBtn" class="px-3 py-2 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm">Edit</button>
      <button id="modalDeleteBtn" class="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm">Delete</button>
    </div>
  `;

  // Buttons
  document.getElementById('modalEditBtn').addEventListener('click', () => openLogModal(log.id, { mode: 'edit' }));
  document.getElementById('modalDeleteBtn').addEventListener('click', async () => {
    const ok = await showConfirmModal('Delete this log?');
    if (!ok) return;
    const arr = loadLogs().filter(l => l.id !== log.id);
    saveLogs(arr);
    renderLogs();
    closeLogModal();
  });

  // Map
  setTimeout(() => initModalMap(log), 0);
}

function renderLogModalEdit(log) {
  const content = document.getElementById('logModalContent');
  content.innerHTML = `
    <form id="modalEditForm" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="lg:order-1 order-2">
        <div class="mb-3">
          <label class="block text-sm font-medium mb-1" for="modalDep">Departure Airport</label>
          <div class="relative">
            <input id="modalDep" type="text" autocomplete="off" class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
            <div id="modalDepList" class="absolute z-20 mt-1 w-full hidden rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 max-h-60 overflow-auto shadow-lg"></div>
          </div>
        </div>
        <div class="mb-3">
          <label class="block text-sm font-medium mb-1" for="modalArr">Arrival Airport</label>
          <div class="relative">
            <input id="modalArr" type="text" autocomplete="off" class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
            <div id="modalArrList" class="absolute z-20 mt-1 w-full hidden rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 max-h-60 overflow-auto shadow-lg"></div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-sm font-medium mb-1" for="modalDepGate">Depart Gate</label>
            <input id="modalDepGate" type="text" class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1" for="modalArrGate">Arrive Gate</label>
            <input id="modalArrGate" type="text" class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
          </div>
        </div>

        <div class="mb-3">
          <label class="block text-sm font-medium mb-1" for="modalTaxiways">Taxiways</label>
          <input id="modalTaxiways" type="text" class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
        </div>

        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-sm font-medium mb-1" for="modalDepRunway">Depart Runway</label>
            <div class="relative">
              <input id="modalDepRunway" type="text" class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
              <div id="modalDepRunwayList" class="absolute z-20 mt-1 w-full hidden rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 max-h-60 overflow-auto shadow-lg"></div>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1" for="modalArrRunway">Landing Runway</label>
            <div class="relative">
              <input id="modalArrRunway" type="text" class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
              <div id="modalArrRunwayList" class="absolute z-20 mt-1 w-full hidden rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 max-h-60 overflow-auto shadow-lg"></div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-sm font-medium mb-1" for="modalTakeoff">Takeoff (UTC)</label>
            <input id="modalTakeoff" type="datetime-local" class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1" for="modalMach">Avg Speed (Mach)</label>
            <input id="modalMach" type="number" step="0.01" min="0.20" max="1.00" class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1" for="modalLanding">Landing (UTC)</label>
            <input id="modalLanding" type="datetime-local" class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Airborne</label>
            <div id="modalAirborneTime" class="px-3 py-2 text-sm border border-transparent">--:--</div>
          </div>
        </div>

        <div class="mb-3">
          <label class="block text-sm font-medium mb-1" for="modalNotes">Notes</label>
          <textarea id="modalNotes" rows="4" class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm"></textarea>
        </div>

        <div class="mt-2 flex justify-end gap-2">
          <button type="button" id="modalCancelEdit" class="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sm">Cancel</button>
          <button type="submit" class="px-3 py-2 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm">Save</button>
        </div>
      </div>
      <div class="lg:order-2 order-1">
        <div id="logModalMap" class="h-72 sm:h-80 rounded-md border border-gray-200 dark:border-gray-800"></div>
      </div>
    </form>
  `;

  // Prefill
  const depAp = log.dep; const arrAp = log.arr;
  const depInput = document.getElementById('modalDep');
  const arrInput = document.getElementById('modalArr');
  depInput.value = depAp ? `${depAp.icao || ''}${depAp.iata ? '/' + depAp.iata : ''} — ${depAp.name || ''}` : '';
  arrInput.value = arrAp ? `${arrAp.icao || ''}${arrAp.iata ? '/' + arrAp.iata : ''} — ${arrAp.name || ''}` : '';
  depInput.dataset.icao = depAp?.icao || '';
  arrInput.dataset.icao = arrAp?.icao || '';

  document.getElementById('modalDepGate').value = log.depGate || '';
  document.getElementById('modalArrGate').value = log.arrGate || '';
  document.getElementById('modalTaxiways').value = log.taxiways || '';
  document.getElementById('modalDepRunway').value = log.depRunway || '';
  document.getElementById('modalArrRunway').value = log.arrRunway || '';
  document.getElementById('modalMach').value = (log.expectedMach != null) ? String(log.expectedMach) : '';
  document.getElementById('modalNotes').value = log.notes || '';
  document.getElementById('modalTakeoff').value = dateToDatetimeLocalUTC(new Date(log.takeoffUtc));
  document.getElementById('modalLanding').value = dateToDatetimeLocalUTC(new Date(log.landingUtc));
  updateModalAirborne();

  // Bind autocomplete and runway autocomplete
  attachAutocomplete('modalDep', 'modalDepList', (a) => {
    // Update local copies
    log.dep = { icao: a.icao, iata: a.iata, name: a.name, lat: a.lat, lon: a.lon };
    document.getElementById('modalDepRunway').value = '';
    initModalMap(log);
    updateModalAirborne();
  });
  attachAutocomplete('modalArr', 'modalArrList', (a) => {
    log.arr = { icao: a.icao, iata: a.iata, name: a.name, lat: a.lat, lon: a.lon };
    document.getElementById('modalArrRunway').value = '';
    initModalMap(log);
    updateModalAirborne();
  });
  attachRunwayAutocomplete('modalDepRunway', 'modalDepRunwayList', () => log.dep);
  attachRunwayAutocomplete('modalArrRunway', 'modalArrRunwayList', () => log.arr);

  // Bind fields
  document.getElementById('modalTakeoff').addEventListener('input', () => { updateModalAirborne(); autoCalcModalLandingFromMach(log); });
  document.getElementById('modalLanding').addEventListener('input', updateModalAirborne);
  document.getElementById('modalMach').addEventListener('input', () => { autoCalcModalLandingFromMach(log); });

  document.getElementById('modalCancelEdit').addEventListener('click', () => {
    const exists = loadLogs().some(l => l.id === log.id);
    if (exists) openLogModal(log.id, { mode: 'view' }); else closeLogModal();
  });

  document.getElementById('modalEditForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = parseUTCFromLocalInput(document.getElementById('modalTakeoff').value);
    const l = parseUTCFromLocalInput(document.getElementById('modalLanding').value);
    if (!log.dep || !log.arr) { announceAirportsStatus('Please select both departure and arrival airports from the list.'); return; }
    if (!t || !l) { announceAirportsStatus('Please enter takeoff and landing times (UTC).'); return; }
    if (l < t) { announceAirportsStatus('Landing time must be after takeoff time.'); return; }

    const mins = minutesDiffUTC(t, l);
    const distNm = haversineNM(log.dep.lat, log.dep.lon, log.arr.lat, log.arr.lon);

    const updated = {
      ...log,
      createdAt: log.createdAt || new Date().toISOString(),
      takeoffUtc: t.toISOString(),
      landingUtc: l.toISOString(),
      airborneMinutes: mins,
      distanceNm: Math.round(distNm),
      depGate: document.getElementById('modalDepGate').value.trim(),
      arrGate: document.getElementById('modalArrGate').value.trim(),
      taxiways: document.getElementById('modalTaxiways').value.trim(),
      depRunway: document.getElementById('modalDepRunway').value.trim(),
      arrRunway: document.getElementById('modalArrRunway').value.trim(),
      expectedMach: (function(){ const v = parseFloat(document.getElementById('modalMach').value); return isFinite(v) ? v : null; })(),
      notes: document.getElementById('modalNotes').value.trim(),
    };

    const logs = loadLogs();
    const idx = logs.findIndex(l2 => l2.id === log.id);
    if (idx !== -1) logs[idx] = updated; else logs.unshift(updated);
    saveLogs(logs);
    renderLogs();
    openLogModal(log.id, { mode: 'view' });
  });

  // Map
  setTimeout(() => initModalMap(log), 0);
}

function updateModalAirborne() {
  const t = parseUTCFromLocalInput(document.getElementById('modalTakeoff').value);
  const l = parseUTCFromLocalInput(document.getElementById('modalLanding').value);
  const mins = t && l ? minutesDiffUTC(t, l) : null;
  const el = document.getElementById('modalAirborneTime');
  if (el) el.textContent = fmtHM(mins);
}

function autoCalcModalLandingFromMach(log) {
  try {
    const takeoffStr = document.getElementById('modalTakeoff').value;
    const machStr = document.getElementById('modalMach')?.value || '';
    if (!takeoffStr || !log.dep || !log.arr) return;
    const mach = parseFloat(machStr);
    if (!mach || mach <= 0) return;
    const distNm = haversineNM(log.dep.lat, log.dep.lon, log.arr.lat, log.arr.lon);
    if (!isFinite(distNm) || distNm <= 0) return;
    const kts = machToKnots(mach);
    if (kts <= 0) return;
    const minutes = Math.round((distNm / kts) * 60);
    const t0 = parseUTCFromLocalInput(takeoffStr);
    if (!t0) return;
    const landing = new Date(t0.getTime() + minutes * 60000);
    document.getElementById('modalLanding').value = dateToDatetimeLocalUTC(landing);
    updateModalAirborne();
  } catch (_) {}
}

function initModalMap(log) {
  const mapEl = document.getElementById('logModalMap');
  if (!mapEl) return;
  destroyModalMap();
  MODAL_MAP = L.map('logModalMap', { worldCopyJump: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(MODAL_MAP);

  // Fit/markers/route
  if (log.dep) MODAL_MAP_MARKERS.dep = L.marker([log.dep.lat, log.dep.lon]).addTo(MODAL_MAP).bindPopup(`Dep: ${log.dep.icao}`);
  if (log.arr) MODAL_MAP_MARKERS.arr = L.marker([log.arr.lat, log.arr.lon]).addTo(MODAL_MAP).bindPopup(`Arr: ${log.arr.icao}`);
  if (log.dep && log.arr) {
    const pts = interpolateGreatCircle(log.dep.lat, log.dep.lon, log.arr.lat, log.arr.lon, 96);
    MODAL_MAP_ROUTE = L.polyline(pts, { color: '#2563eb', weight: 3 }).addTo(MODAL_MAP);
    const bounds = L.latLngBounds(pts);
    MODAL_MAP.fitBounds(bounds, { padding: [20, 20] });
  } else {
    MODAL_MAP.setView([20, 0], 2);
  }

  setTimeout(() => MODAL_MAP.invalidateSize(), 0);
}

function destroyModalMap() {
  if (MODAL_MAP) {
    MODAL_MAP.remove();
    MODAL_MAP = null;
  }
  MODAL_MAP_MARKERS = { dep: null, arr: null };
  MODAL_MAP_ROUTE = null;
}

// LocalStorage keys
const LS_KEYS = {
  LOGS: 'msfl_logs',
  AIRPORTS_FULL: 'msfl_airports_full',
  RUNWAYS_FULL: 'msfl_runways_full',
};

// State
let AIRPORTS = [];
let SAMPLE_MODE = true; // flips false if full DB is loaded
let depAirportSel = null;
let arrAirportSel = null;
let editId = null; // if editing an existing log
let MAP = null;
let MAP_MARKERS = { dep: null, arr: null };
let MAP_ROUTE = null;
// Runways, keyed by ICAO -> array of runway identifiers (ends like "22R")
// New: maintain multi-flight overlays
let MAP_MARKERS_ALL = [];
let MAP_ROUTES_ALL = [];
let RUNWAYS_BY_ICAO = {};
// If user edits landing time manually, avoid auto-overwriting it
let LANDING_MANUAL = false;
// Modal state
let MODAL_MAP = null;
let MODAL_MAP_MARKERS = { dep: null, arr: null };
let MODAL_MAP_ROUTE = null;
let MODAL_CURRENT_ID = null;
let LOG_MODAL_CLEANUP = null;
// Prevent duplicate ready toasts
let READY_TOAST_SHOWN = false;

// Utilities
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

function haversineNM(lat1, lon1, lat2, lon2) {
  const R_km = 6371.0088; // mean Earth radius
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = R_km * c;
  const nm = km * 0.539957; // kilometers to nautical miles
  return nm;
}

// Runways loading
async function loadRunways() {
  // 1) Try cached full
  try {
    const cached = localStorage.getItem(LS_KEYS.RUNWAYS_FULL);
    if (cached) {
      RUNWAYS_BY_ICAO = JSON.parse(cached) || {};
      if (Object.keys(RUNWAYS_BY_ICAO).length) {
        return;
      }
    }
  } catch (e) {
    console.warn('Failed to read cached runways', e);
  }

  // 2) Fallback to bundled sample
  try {
    const res = await fetch('./data/runways.sample.json');
    if (!res.ok) throw new Error('runways.sample.json fetch failed');
    RUNWAYS_BY_ICAO = await res.json();
  } catch (e) {
    console.warn('Failed to load sample runways', e);
    RUNWAYS_BY_ICAO = {};
  }
}

// Simple CSV -> objects parser (handles quotes and escaped quotes)
function csvToObjects(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const headers = parseCSVLine(lines[0]);
  const objs = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols.length) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      obj[key] = cols[j] ?? '';
    }
    objs.push(obj);
  }
  return objs;
}

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"') { inQuotes = true; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

async function loadFullRunways() {
  // Prefer authoritative OurAirports CSV; keep JSON path as secondary if available later.
  const sources = [
    // Local optional copy (drop OurAirports runways.csv here to avoid CORS)
    { type: 'csv', url: './data/runways.csv' },
    // Direct (may fail due to CORS)
    { type: 'csv', url: 'https://ourairports.com/data/runways.csv' },
    // CORS-friendly proxies
    { type: 'csv', url: 'https://cors.isomorphic-git.org/https://ourairports.com/data/runways.csv' },
    { type: 'csv', url: 'https://r.jina.ai/http://ourairports.com/data/runways.csv' },
    { type: 'csv', url: 'https://cdn.jsdelivr.net/gh/davidmegginson/ourairports-data/runways.csv' },
    // Legacy JSON (currently 404, kept as placeholder)
    { type: 'json', url: 'https://raw.githubusercontent.com/mwgg/Airports/master/runways.json' },
  ];
  let map = null;
  for (const src of sources) {
    const url = src.url;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const ct = (res.headers.get('content-type') || '').toLowerCase();

      if (src.type === 'csv' && (ct.includes('text/csv') || ct.includes('text/plain') || url.endsWith('.csv'))) {
        const text = await res.text();
        const rows = csvToObjects(text);
        map = normalizeExternalRunways(rows);
        if (map && Object.keys(map).length) break;
      }

      if (src.type === 'json' && (ct.includes('application/json') || url.endsWith('.json'))) {
        const raw = await res.json();
        map = normalizeExternalRunways(raw);
        if (map && Object.keys(map).length) break;
      }
    } catch (e) {
      console.warn('Runways fetch failed from', url, e);
    }
  }
  if (!map || !Object.keys(map).length) {
    announceAirportsStatus('Full runways DB unavailable; still using sample.');
    return;
  }
  RUNWAYS_BY_ICAO = map;
  try {
    localStorage.setItem(LS_KEYS.RUNWAYS_FULL, JSON.stringify(RUNWAYS_BY_ICAO));
  } catch (e) {
    console.warn('Failed to cache runways', e);
  }
}

function normalizeExternalRunways(raw) {
  // Try to produce { ICAO: ["04L","22R", ...] }
  const map = {};
  if (!raw) return map;

  // Case A: OurAirports-like array of objects with airport_ident/le_ident/he_ident
  if (Array.isArray(raw)) {
    for (const r of raw) {
      const icao = r.airport_ident || r.airport_icao || r.icao || r.ident || null;
      if (!icao) continue;
      const ends = [];
      if (r.le_ident) ends.push(String(r.le_ident).toUpperCase());
      if (r.he_ident) ends.push(String(r.he_ident).toUpperCase());
      if (!map[icao]) map[icao] = [];
      for (const e of ends) if (!map[icao].includes(e)) map[icao].push(e);
    }
    return map;
  }

  // Case B: Object keyed by ICAO
  if (typeof raw === 'object') {
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      if (Array.isArray(v)) {
        // array of identifiers or objects
        const arr = [];
        for (const item of v) {
          if (typeof item === 'string') arr.push(item.toUpperCase());
          else if (item && typeof item === 'object') {
            if (item.ident) arr.push(String(item.ident).toUpperCase());
            if (item.le_ident) arr.push(String(item.le_ident).toUpperCase());
            if (item.he_ident) arr.push(String(item.he_ident).toUpperCase());
          }
        }
        if (arr.length) map[k] = Array.from(new Set(arr));
      } else if (v && typeof v === 'object') {
        // maybe an object with properties including arrays
        const arr = [];
        for (const key2 of Object.keys(v)) {
          const vv = v[key2];
          if (typeof vv === 'string') arr.push(vv.toUpperCase());
          if (Array.isArray(vv)) for (const s of vv) if (typeof s === 'string') arr.push(s.toUpperCase());
        }
        if (arr.length) map[k] = Array.from(new Set(arr));
      }
    }
    return map;
  }
  return map;
}

function interpolateGreatCircle(lat1, lon1, lat2, lon2, segments = 64) {
  // Convert to radians
  const φ1 = toRad(lat1), λ1 = toRad(lon1);
  const φ2 = toRad(lat2), λ2 = toRad(lon2);
  const Δσ = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (Δσ === 0) return [[lat1, lon1], [lat2, lon2]];
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * Δσ) / Math.sin(Δσ);
    const B = Math.sin(f * Δσ) / Math.sin(Δσ);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    const φi = Math.atan2(z, Math.sqrt(x * x + y * y));
    const λi = Math.atan2(y, x);
    points.push([toDeg(φi), toDeg(λi)]);
  }
  return points;
}

function parseUTCFromLocalInput(value) {
  // value like '2025-08-16T21:30' (no timezone). Treat as UTC explicitly.
  if (!value) return null;
  const [date, time] = value.split('T');
  if (!date || !time) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const ms = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  return new Date(ms);
}

function dateToDatetimeLocalUTC(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function minutesDiffUTC(start, end) {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / 60000));
}

function fmtHM(mins) {
  if (mins == null) return '--:--';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function uid() {
  return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadLogs() {
  try {
    const raw = localStorage.getItem(LS_KEYS.LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse logs from storage', e);
    return [];
  }
}

function saveLogs(logs) {
  localStorage.setItem(LS_KEYS.LOGS, JSON.stringify(logs));
}

// Airports loading
async function loadAirports() {
  // 1) Try cached full DB
  try {
    const cached = localStorage.getItem(LS_KEYS.AIRPORTS_FULL);
    if (cached) {
      AIRPORTS = JSON.parse(cached);
      SAMPLE_MODE = false;
      return;
    }
  } catch (e) {
    console.warn('Failed to read cached airports', e);
  }

  // 2) Fallback to sample bundled file
  try {
    const res = await fetch('./data/airports.sample.json');
    if (!res.ok) throw new Error('airports.sample.json fetch failed');
    AIRPORTS = await res.json();
    SAMPLE_MODE = true;
  } catch (e) {
    console.error('Failed to load sample airports', e);
    AIRPORTS = [];
    SAMPLE_MODE = true;
    announceAirportsStatus('No airports loaded');
  }
}

function airportDisplay(a) {
  const icao = a.icao || '';
  const iata = a.iata ? `/${a.iata}` : '';
  return `${icao}${iata} — ${a.name || ''}`;
}

function insertAirportsNotice() {
  // No-op: buttons removed per design; we surface status via toast notifications instead.
}

function announceAirportsStatus(text) {
  // Backwards-compatible status hook: show as toast if needed.
  showToast(String(text || ''), 'info');
}

// Toast notifications (auto-dismiss in 5s or on click)
function showToast(message, type = 'success') {
  try {
    const body = document.body;
    if (!body) return;
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'fixed top-4 right-4 z-[10000] space-y-2 pointer-events-none';
      body.appendChild(container);
    }
    const toast = document.createElement('div');
    const base = 'pointer-events-auto rounded-md shadow-lg px-3 py-2 text-sm transition-opacity duration-200';
    const color = type === 'error' ? 'bg-red-600 text-white' : (type === 'info' ? 'bg-gray-900 text-white' : 'bg-green-600 text-white');
    toast.className = `${base} ${color}`;
    toast.textContent = message || '';
    const remove = () => { if (toast.parentNode) toast.parentNode.removeChild(toast); };
    toast.addEventListener('click', remove);
    container.appendChild(toast);
    setTimeout(remove, 5000);
  } catch (_) {}
}

async function loadFullAirports() {
  // OurAirports data source. We'll fetch a prebuilt JSON mirror for simplicity.
  // Fallback approach: try multiple URLs.
  const urls = [
    // A maintained mirror would be ideal. Placeholder below; you can replace in the repo later.
    'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat', // not JSON; we will skip
    'https://raw.githubusercontent.com/mwgg/Airports/master/airports.json', // community JSON (large)
  ];
  let data = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json') || url.endsWith('.json')) {
        const raw = await res.json();
        // Normalize to {icao, iata, name, lat, lon}
        data = normalizeExternalAirports(raw);
        break;
      }
    } catch (e) {
      console.warn('Airport fetch failed from', url, e);
    }
  }
  if (!data || data.length === 0) {
    announceAirportsStatus('Failed to load full database. Still using sample.');
    return;
  }
  AIRPORTS = data;
  SAMPLE_MODE = false;
  try {
    localStorage.setItem(LS_KEYS.AIRPORTS_FULL, JSON.stringify(AIRPORTS));
  } catch (e) {
    console.warn('Failed to cache airports', e);
  }
}

function normalizeExternalAirports(raw) {
  // Handles schema of mwgg/Airports: { "KJFK": { "name": "John F Kennedy International Airport", "city": "New York", "country": "US", "iata": "JFK", "icao": "KJFK", "lat": 40.63980103, "lon": -73.77890015 }}
  if (!raw || typeof raw !== 'object') return [];
  const arr = [];
  for (const key in raw) {
    const a = raw[key];
    const icao = a.icao || key;
    const iata = a.iata || '';
    const name = a.name || '';
    const lat = typeof a.lat === 'number' ? a.lat : (typeof a.latitude === 'number' ? a.latitude : null);
    const lon = typeof a.lon === 'number' ? a.lon : (typeof a.longitude === 'number' ? a.longitude : null);
    if (!icao || lat == null || lon == null) continue;
    arr.push({ icao, iata, name, lat, lon });
  }
  return arr;
}

// Map init
function initMap() {
  MAP = L.map('map', { worldCopyJump: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(MAP);
  MAP.setView([20, 0], 2);
}

function updateMap() { renderAllFlightsMap(); }

function clearAllFlightsMap() {
  if (!MAP) return;
  if (MAP_ROUTE) { MAP.removeLayer(MAP_ROUTE); MAP_ROUTE = null; }
  if (MAP_MARKERS.dep) { MAP.removeLayer(MAP_MARKERS.dep); MAP_MARKERS.dep = null; }
  if (MAP_MARKERS.arr) { MAP.removeLayer(MAP_MARKERS.arr); MAP_MARKERS.arr = null; }
  for (const m of MAP_MARKERS_ALL) try { MAP.removeLayer(m); } catch (_) {}
  for (const r of MAP_ROUTES_ALL) try { MAP.removeLayer(r); } catch (_) {}
  MAP_MARKERS_ALL = [];
  MAP_ROUTES_ALL = [];
}

function renderAllFlightsMap() {
  if (!MAP) return;
  clearAllFlightsMap();
  const logs = loadLogs();
  const boundsPts = [];
  for (const l of logs) {
    const dep = l?.dep; const arr = l?.arr;
    if (!dep || !arr || dep.lat == null || dep.lon == null || arr.lat == null || arr.lon == null) continue;
    const pts = interpolateGreatCircle(dep.lat, dep.lon, arr.lat, arr.lon, 96);
    const route = L.polyline(pts, { color: '#2563eb', weight: 2, opacity: 0.9 }).addTo(MAP);
    MAP_ROUTES_ALL.push(route);
    boundsPts.push(...pts);
    const m1 = L.circleMarker([dep.lat, dep.lon], { radius: 3, color: '#111827', weight: 1, fillColor: '#111827', fillOpacity: 1 }).addTo(MAP).bindPopup(`Dep: ${dep.icao}`);
    const m2 = L.circleMarker([arr.lat, arr.lon], { radius: 3, color: '#111827', weight: 1, fillColor: '#111827', fillOpacity: 1 }).addTo(MAP).bindPopup(`Arr: ${arr.icao}`);
    MAP_MARKERS_ALL.push(m1, m2);
  }
  if (boundsPts.length) {
    const bounds = L.latLngBounds(boundsPts);
    MAP.fitBounds(bounds, { padding: [30, 30] });
  } else {
    MAP.setView([20, 0], 2);
  }
}

// Autocomplete
function attachAutocomplete(inputId, listId, onSelect) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if (!input || !list) return;

  function clearList() {
    list.innerHTML = '';
    list.classList.add('hidden');
  }

  function render(items) {
    list.innerHTML = '';
    for (const a of items.slice(0, 50)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800';
      btn.textContent = airportDisplay(a);
      btn.addEventListener('click', () => {
        input.value = airportDisplay(a);
        input.dataset.icao = a.icao || '';
        input.dataset.iata = a.iata || '';
        input.dataset.lat = a.lat;
        input.dataset.lon = a.lon;
        input.dataset.name = a.name || '';
        clearList();
        onSelect(a);
      });
      list.appendChild(btn);
    }
    list.classList.toggle('hidden', list.childElementCount === 0);
  }

  let debTimer = null;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    clearTimeout(debTimer);
    if (!q) return clearList();
    debTimer = setTimeout(() => {
      const res = AIRPORTS.filter(a => {
        const icao = (a.icao || '').toLowerCase();
        const iata = (a.iata || '').toLowerCase();
        const name = (a.name || '').toLowerCase();
        return icao.includes(q) || (iata && iata.includes(q)) || name.includes(q);
      }).sort((a,b)=> (a.icao||'').localeCompare(b.icao||''));
      render(res);
    }, 100);
  });

  input.addEventListener('blur', () => setTimeout(clearList, 150));
}

function attachRunwayAutocomplete(inputId, listId, getAirport) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if (!input || !list) return;

  function clearList() {
    list.innerHTML = '';
    list.classList.add('hidden');
  }

  function render(items) {
    list.innerHTML = '';
    for (const ident of items.slice(0, 40)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800';
      btn.textContent = ident;
      btn.addEventListener('click', () => {
        input.value = ident;
        clearList();
      });
      list.appendChild(btn);
    }
    list.classList.toggle('hidden', list.childElementCount === 0);
  }

  function refresh() {
    const ap = getAirport();
    if (!ap || !ap.icao) { clearList(); return; }
    const all = RUNWAYS_BY_ICAO[ap.icao] || [];
    const q = input.value.trim().toUpperCase();
    const items = q ? all.filter(r => r.startsWith(q)) : all;
    render(items);
  }

  input.addEventListener('input', refresh);
  input.addEventListener('focus', refresh);
  input.addEventListener('blur', () => setTimeout(clearList, 150));
}

function refreshAirborneTime() {
  const tEl = document.getElementById('takeoffUtc');
  const lEl = document.getElementById('landingUtc');
  const out = document.getElementById('airborneTime');
  if (!tEl || !lEl || !out) return;
  const t = parseUTCFromLocalInput(tEl.value);
  const l = parseUTCFromLocalInput(lEl.value);
  const mins = t && l ? minutesDiffUTC(t, l) : null;
  out.textContent = fmtHM(mins);
}

// Convert Mach to approximate knots (speed of sound ~ 574 kts at cruise alt)
function machToKnots(mach) {
  const M = Math.max(0, Number(mach) || 0);
  return M * 574; // TAS approximation
}

function autoCalcLandingFromMach() {
  try {
    const tEl = document.getElementById('takeoffUtc');
    const mEl = document.getElementById('expectedMach');
    const lEl = document.getElementById('landingUtc');
    if (!tEl || !mEl || !lEl) return;
    const takeoffStr = tEl.value;
    const machStr = mEl.value || '';
    if (!takeoffStr || !depAirportSel || !arrAirportSel) return;
    if (LANDING_MANUAL && lEl.value) return;
    const mach = parseFloat(machStr);
    if (!mach || mach <= 0) return;
    const distNm = haversineNM(depAirportSel.lat, depAirportSel.lon, arrAirportSel.lat, arrAirportSel.lon);
    if (!isFinite(distNm) || distNm <= 0) return;
    const kts = machToKnots(mach);
    if (kts <= 0) return;
    const minutes = Math.round((distNm / kts) * 60);
    const t0 = parseUTCFromLocalInput(takeoffStr);
    if (!t0) return;
    const landing = new Date(t0.getTime() + minutes * 60000);
    lEl.value = dateToDatetimeLocalUTC(landing);
    // Do not mark as manual; allow dynamic updates until user edits landing directly
    refreshAirborneTime();
  } catch (_) {
    // silent
  }
}

// Logs rendering
function renderLogs() {
  const logs = loadLogs();
  const sort = document.getElementById('sortSelect').value;
  logs.sort((a, b) => {
    if (sort === 'date_desc') return (b.takeoffUtc || '').localeCompare(a.takeoffUtc || '');
    if (sort === 'date_asc') return (a.takeoffUtc || '').localeCompare(b.takeoffUtc || '');
    if (sort === 'duration_desc') return (b.airborneMinutes || 0) - (a.airborneMinutes || 0);
    if (sort === 'duration_asc') return (a.airborneMinutes || 0) - (b.airborneMinutes || 0);
    return 0;
  });

  const tbody = document.getElementById('logsTableBody');
  tbody.innerHTML = '';
  for (const log of logs) {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100 dark:border-gray-800';
    tr.dataset.id = log.id;

    const dt = new Date(log.takeoffUtc);
    const dateStr = isNaN(dt.getTime()) ? '-' : dt.toISOString().replace('T', ' ').slice(0, 16) + 'Z';

    tr.innerHTML = `
      <td class="py-2 pr-3">${dateStr}</td>
      <td class="py-2 pr-3">${(log.dep?.icao || log.depCode || '?')} → ${(log.arr?.icao || log.arrCode || '?')}</td>
      <td class="py-2 pr-3">${fmtHM(log.airborneMinutes)}</td>
      <td class="py-2 pr-3">${(log.depRunway || '')} / ${(log.arrRunway || '')}</td>
      <td class="py-2 pr-3">${(log.depGate || '')} / ${(log.arrGate || '')}</td>
      <td class="py-2 pr-3">
        <button data-id="${log.id}" class="editBtn text-brand-700 hover:underline mr-2">Edit</button>
        <button data-id="${log.id}" class="deleteBtn text-red-600 hover:underline">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  }

  // Bind actions
  tbody.querySelectorAll('.deleteBtn').forEach(btn => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const id = btn.getAttribute('data-id');
    const ok = await showConfirmModal('Delete this log?');
    if (!ok) return;
    const arr = loadLogs().filter(l => l.id !== id);
    saveLogs(arr);
    renderLogs();
    closeLogModal();
  }));

  tbody.querySelectorAll('.editBtn').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = btn.getAttribute('data-id');
    openLogModal(id, { mode: 'edit' });
  }));

  // Row click opens details modal
  tbody.querySelectorAll('tr').forEach(tr => tr.addEventListener('click', () => {
    const id = tr.dataset.id;
    if (id) openLogModal(id, { mode: 'view' });
  }));

  // Update map to reflect current logs
  updateMap();
}

function startEditLog(id) {
  const logs = loadLogs();
  const log = logs.find(l => l.id === id);
  if (!log) return;
  editId = id;
  const form = document.getElementById('logForm');

  // Airports: attempt to resolve from current AIRPORTS list
  function resolveAirport(pref) {
    if (!pref) return null;
    const byIcao = AIRPORTS.find(a => a.icao === (pref.icao || pref));
    return byIcao || pref;
  }
  depAirportSel = resolveAirport(log.dep) || null;
  arrAirportSel = resolveAirport(log.arr) || null;

  const depInput = document.getElementById('depAirport');
  const arrInput = document.getElementById('arrAirport');
  if (depAirportSel) depInput.value = airportDisplay(depAirportSel);
  if (arrAirportSel) arrInput.value = airportDisplay(arrAirportSel);

  document.getElementById('depGate').value = log.depGate || '';
  document.getElementById('arrGate').value = log.arrGate || '';
  document.getElementById('taxiways').value = log.taxiways || '';
  document.getElementById('depRunway').value = log.depRunway || '';
  document.getElementById('arrRunway').value = log.arrRunway || '';
  document.getElementById('expectedMach').value = (log.expectedMach != null && log.expectedMach !== '') ? String(log.expectedMach) : '';
  document.getElementById('notes').value = log.notes || '';

  // Parse UTC ISO to datetime-local value (without Z)
  document.getElementById('takeoffUtc').value = dateToDatetimeLocalUTC(new Date(log.takeoffUtc));
  document.getElementById('landingUtc').value = dateToDatetimeLocalUTC(new Date(log.landingUtc));

  refreshAirborneTime();
  updateMap();
  LANDING_MANUAL = true; // respect existing landing value on edits
}

function bindForm() {
  const form = document.getElementById('logForm');
  if (!form) return;

  insertAirportsNotice();
  attachAutocomplete('depAirport', 'depAirportList', (a) => {
    depAirportSel = a; updateMap(); autoCalcLandingFromMach();
    // Clear runway on airport change
    const depRunway = document.getElementById('depRunway');
    if (depRunway) depRunway.value = '';
  });
  attachAutocomplete('arrAirport', 'arrAirportList', (a) => {
    arrAirportSel = a; updateMap(); autoCalcLandingFromMach();
    const arrRunway = document.getElementById('arrRunway');
    if (arrRunway) arrRunway.value = '';
  });

  attachRunwayAutocomplete('depRunway', 'depRunwayList', () => depAirportSel);
  attachRunwayAutocomplete('arrRunway', 'arrRunwayList', () => arrAirportSel);

  document.getElementById('takeoffUtc').addEventListener('input', () => { refreshAirborneTime(); autoCalcLandingFromMach(); });
  document.getElementById('landingUtc').addEventListener('input', () => { LANDING_MANUAL = true; refreshAirborneTime(); });
  document.getElementById('expectedMach')?.addEventListener('input', () => { autoCalcLandingFromMach(); });

  form.addEventListener('reset', () => {
    depAirportSel = null;
    arrAirportSel = null;
    editId = null;
    LANDING_MANUAL = false;
    document.getElementById('airborneTime').textContent = '--:--';
    updateMap();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = parseUTCFromLocalInput(document.getElementById('takeoffUtc').value);
    const l = parseUTCFromLocalInput(document.getElementById('landingUtc').value);

    if (!depAirportSel || !arrAirportSel) { announceAirportsStatus('Please select both departure and arrival airports from the list.'); return; }
    if (!t || !l) return alert('Please enter takeoff and landing times (UTC).');
    if (l < t) return alert('Landing time must be after takeoff time.');

    const mins = minutesDiffUTC(t, l);
    const distNm = haversineNM(depAirportSel.lat, depAirportSel.lon, arrAirportSel.lat, arrAirportSel.lon);

    const payload = {
      id: editId || uid(),
      createdAt: new Date().toISOString(),
      takeoffUtc: t.toISOString(),
      landingUtc: l.toISOString(),
      airborneMinutes: mins,
      distanceNm: Math.round(distNm),
      dep: { icao: depAirportSel.icao, iata: depAirportSel.iata, name: depAirportSel.name, lat: depAirportSel.lat, lon: depAirportSel.lon },
      arr: { icao: arrAirportSel.icao, iata: arrAirportSel.iata, name: arrAirportSel.name, lat: arrAirportSel.lat, lon: arrAirportSel.lon },
      depGate: document.getElementById('depGate').value.trim(),
      arrGate: document.getElementById('arrGate').value.trim(),
      taxiways: document.getElementById('taxiways').value.trim(),
      depRunway: document.getElementById('depRunway').value.trim(),
      arrRunway: document.getElementById('arrRunway').value.trim(),
      expectedMach: (function(){ const v = parseFloat(document.getElementById('expectedMach').value); return isFinite(v) ? v : null; })(),
      notes: document.getElementById('notes').value.trim(),
    };

    const logs = loadLogs();
    if (editId) {
      const idx = logs.findIndex(l => l.id === editId);
      if (idx !== -1) logs[idx] = payload;
    } else {
      logs.unshift(payload);
    }
    saveLogs(logs);

    // Reset form state
    form.reset();
    editId = null;
    depAirportSel = null;
    arrAirportSel = null;
    refreshAirborneTime();
    updateMap();
    renderLogs();
  });
}

function bindToolbar() {
  const sort = document.getElementById('sortSelect');
  sort.addEventListener('change', renderLogs);

  const exportBtn = document.getElementById('exportBtn');
  exportBtn.addEventListener('click', () => {
    const logs = loadLogs();
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), logs }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `msfl-logs-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const importInput = document.getElementById('importInput');
  importInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json || !Array.isArray(json.logs)) throw new Error('Invalid file');
      const logs = loadLogs();
      const merged = [...json.logs, ...logs];
      // de-dup by id
      const seen = new Set();
      const unique = [];
      for (const l of merged) {
        if (l && l.id && !seen.has(l.id)) { seen.add(l.id); unique.push(l); }
      }
      saveLogs(unique);
      renderLogs();
      alert(`Imported ${json.logs.length} logs.`);
    } catch (err) {
      alert('Failed to import file.');
    } finally {
      importInput.value = '';
    }
  });

  // Add Flight -> open modal in edit mode for a new entry
  const addBtn = document.getElementById('addFlightBtn');
  addBtn?.addEventListener('click', () => openNewLogModal());
}

// Boot
window.addEventListener('DOMContentLoaded', async () => {
  initMap();
  bindToolbar();
  insertAirportsNotice();
  await loadAirports();
  await loadRunways();
  bindForm();
  renderLogs();
  refreshAirborneTime();
  updateMap();
  // If both datasets are already ready from cache, show success once
  try {
    if (!SAMPLE_MODE && Object.keys(RUNWAYS_BY_ICAO || {}).length && !READY_TOAST_SHOWN) {
      showToast('Airports and runways loaded successfully', 'success');
      READY_TOAST_SHOWN = true;
    }
  } catch (_) {}
  // Auto-upgrade to full DBs in the background so no button click is needed
  try {
    if (SAMPLE_MODE) {
      // Load full airports, then runways
      loadFullAirports()
        .then(() => loadFullRunways())
        .then(() => { if (!READY_TOAST_SHOWN) { showToast('Airports and runways loaded successfully', 'success'); READY_TOAST_SHOWN = true; } })
        .catch(() => {});
    } else {
      // Airports already full via cache; ensure runways full if not cached
      if (!localStorage.getItem(LS_KEYS.RUNWAYS_FULL)) {
        loadFullRunways()
          .then(() => { if (!READY_TOAST_SHOWN) { showToast('Airports and runways loaded successfully', 'success'); READY_TOAST_SHOWN = true; } })
          .catch(() => {});
      }
    }
  } catch (_) {}
});
