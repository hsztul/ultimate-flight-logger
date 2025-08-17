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
let RUNWAYS_BY_ICAO = {};
// If user edits landing time manually, avoid auto-overwriting it
let LANDING_MANUAL = false;

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
        announceAirportsStatus('Loaded full airports/runways from cache');
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
    announceAirportsStatus('Loaded full airports/runways database. Cached for offline use.');
  } catch (e) {
    console.warn('Failed to cache runways', e);
    announceAirportsStatus('Loaded full airports/runways database. Cache failed; will reload next time.');
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
      announceAirportsStatus('Loaded full airport database from cache');
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
    announceAirportsStatus('Loaded sample airports. You can load the full database.');
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
  const form = document.getElementById('logForm');
  if (!form) return;
  const notice = document.createElement('div');
  notice.id = 'airportsNotice';
  notice.className = 'sm:col-span-2 -mt-2 mb-1';
  notice.innerHTML = `
    <div class="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs">
      <div id="airportsNoticeText" class="text-gray-700 dark:text-gray-300"></div>
      <div class="flex items-center gap-2">
        <button id="loadFullAirportsBtn" class="px-2 py-1 rounded bg-brand-600 text-white hover:bg-brand-700">Load Full DB</button>
        <button id="clearAirportsCacheBtn" class="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">Clear Cache</button>
      </div>
    </div>`;
  form.prepend(notice);
  document.getElementById('loadFullAirportsBtn')?.addEventListener('click', async () => {
    await loadFullAirports();
    await loadFullRunways();
  });
  document.getElementById('clearAirportsCacheBtn')?.addEventListener('click', () => {
    localStorage.removeItem(LS_KEYS.AIRPORTS_FULL);
    localStorage.removeItem(LS_KEYS.RUNWAYS_FULL);
    SAMPLE_MODE = true;
    announceAirportsStatus('Cleared caches. Using sample data.');
  });
}

function announceAirportsStatus(text) {
  const el = document.getElementById('airportsNoticeText');
  if (el) el.textContent = text;
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
    announceAirportsStatus(`Loaded full database (${AIRPORTS.length.toLocaleString()} airports). Cached for offline use.`);
  } catch (e) {
    console.warn('Failed to cache airports', e);
    announceAirportsStatus(`Loaded full database (${AIRPORTS.length.toLocaleString()} airports). Cache failed; will reload next time.`);
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

function updateMap() {
  if (!MAP) return;
  // Clear previous route
  if (MAP_ROUTE) {
    MAP.removeLayer(MAP_ROUTE);
    MAP_ROUTE = null;
  }
  // Clear markers
  if (MAP_MARKERS.dep) { MAP.removeLayer(MAP_MARKERS.dep); MAP_MARKERS.dep = null; }
  if (MAP_MARKERS.arr) { MAP.removeLayer(MAP_MARKERS.arr); MAP_MARKERS.arr = null; }

  const distanceEl = document.getElementById('routeDistance');
  if (depAirportSel) {
    MAP_MARKERS.dep = L.marker([depAirportSel.lat, depAirportSel.lon]).addTo(MAP).bindPopup(`Dep: ${airportDisplay(depAirportSel)}`);
  }
  if (arrAirportSel) {
    MAP_MARKERS.arr = L.marker([arrAirportSel.lat, arrAirportSel.lon]).addTo(MAP).bindPopup(`Arr: ${airportDisplay(arrAirportSel)}`);
  }

  if (depAirportSel && arrAirportSel) {
    const pts = interpolateGreatCircle(depAirportSel.lat, depAirportSel.lon, arrAirportSel.lat, arrAirportSel.lon, 96);
    MAP_ROUTE = L.polyline(pts, { color: '#2563eb', weight: 3 }).addTo(MAP);
    const distNm = haversineNM(depAirportSel.lat, depAirportSel.lon, arrAirportSel.lat, arrAirportSel.lon);
    if (distanceEl) distanceEl.textContent = `${distNm.toFixed(0)} NM`;
    const bounds = L.latLngBounds(pts);
    MAP.fitBounds(bounds, { padding: [30, 30] });
  } else {
    if (distanceEl) distanceEl.textContent = '-- NM';
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
  const t = parseUTCFromLocalInput(document.getElementById('takeoffUtc').value);
  const l = parseUTCFromLocalInput(document.getElementById('landingUtc').value);
  const mins = t && l ? minutesDiffUTC(t, l) : null;
  document.getElementById('airborneTime').textContent = fmtHM(mins);
}

// Convert Mach to approximate knots (speed of sound ~ 574 kts at cruise alt)
function machToKnots(mach) {
  const M = Math.max(0, Number(mach) || 0);
  return M * 574; // TAS approximation
}

function autoCalcLandingFromMach() {
  try {
    const takeoffStr = document.getElementById('takeoffUtc').value;
    const machStr = document.getElementById('expectedMach')?.value || '';
    if (!takeoffStr || !depAirportSel || !arrAirportSel) return;
    if (LANDING_MANUAL && document.getElementById('landingUtc').value) return;
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
    document.getElementById('landingUtc').value = dateToDatetimeLocalUTC(landing);
    // Do not mark as manual; allow dynamic updates until user edits landing directly
    refreshAirborneTime();
    announceAirportsStatus('Landing auto-calculated from Mach and distance');
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
  tbody.querySelectorAll('.deleteBtn').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-id');
    if (!confirm('Delete this log?')) return;
    const arr = loadLogs().filter(l => l.id !== id);
    saveLogs(arr);
    renderLogs();
  }));

  tbody.querySelectorAll('.editBtn').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-id');
    startEditLog(id);
  }));
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
}

// Boot
window.addEventListener('DOMContentLoaded', async () => {
  initMap();
  bindToolbar();
  await loadAirports();
  await loadRunways();
  bindForm();
  renderLogs();
  refreshAirborneTime();
  updateMap();
});
