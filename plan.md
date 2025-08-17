# MS Flight Logger - Plan

Track progress. We will check off items as we complete them.

## Requirements / Decisions
- [x] No backend; client-side only; works locally or on GitHub Pages.
- [x] Use Leaflet with OSM tiles.
- [x] Start with simple great-circle route dep→arr.
- [x] Airport list: exhaustive target (load/cached full DB), sample bundled for boot.
- [x] Free-text for gates, taxiways, runways, notes.
- [x] Enter times manually, UTC, exact minutes.
- [x] Tailwind color palette (muted modern), dark mode.
- [x] Desktop and mobile web.

- [x] Runway suggestions via dataset (sample bundled; full DB cached when loaded)

## Tasks
- [x] Scaffold vanilla project (`index.html`, Tailwind CDN, Leaflet CDN)
- [x] Create `script.js` with core app logic
- [x] Add sample airports dataset `data/airports.sample.json`
- [x] Airport autocomplete (ICAO/IATA/Name) and validation
- [x] Great-circle route render and distance calc
- [x] Flight log form fields and validation
- [x] Time inputs and airborne time calculation
- [x] CRUD (create, list, edit, delete) with localStorage persistence
- [x] Sorting (date, duration)
- [x] Export/Import logs (JSON)
- [x] Design polish (responsive, clean UI)
- [x] Optional: button to fetch/cache full global airport DB

- [x] Add sample runways dataset `data/runways.sample.json`
- [x] Runway suggestions autocomplete based on selected airport
- [x] Optional: load/cache full global runways DB and unified clear-cache controls
- [x] Expected Avg Speed (Mach) input and auto-calc landing from route distance
- [ ] Testing/QA pass

### Modal & UX Enhancements
- [x] Flight log details modal with blurred background and embedded map
- [x] In-place editing within the modal
- [x] Delete action with confirmation modal
- [x] Replace airport-selection alert with inline notice in banner
- [x] Homepage layout: airports notice + logs list + Add Flight + map below
- [x] Add Flight opens modal in edit mode for new entry
- [x] Map plots all logged flights and updates after CRUD
- [x] Modal close UX: overlay/close button/Escape with cleanup
- [ ] Improve modal accessibility (focus trap, ARIA, keyboard navigation)

### Data Loading UX
- [x] Auto-load full airports and runways on page load (no manual button)
- [x] Replace banner/buttons with toast notification (auto-dismiss in 5s or on click)

## Notes
- Full airport DB: we attempt to load from `mwgg/Airports` JSON and cache in `localStorage` for offline use.
- If caching is cleared, the app falls back to small bundled sample list.
- Logs stored in `localStorage` under `msfl_logs`.

- Runways DB: loaded from `mwgg/Airports/runways.json` when requested; cached under `msfl_runways_full`. Fallback to `data/runways.sample.json`.
