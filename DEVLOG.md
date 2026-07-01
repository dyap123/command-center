# DEVLOG — OpenYap Command Center

## 2026-07-01 — Map search, dashboard charts, live pour inspections
- **Map search** moved into the header (next to Sync); typing **live-filters** the map — matches stay bright, unrelated footings/embeds/pours/RFI zones dim to ~8% (`srchA`), grid kept for context. Enter/click flies to a result + selects + locate-flash.
- **Hidden archived pours**: `refreshPours` now skips CUP `archived`/`deleted` pours, so archived ones (e.g. `Zykqcftq`, `Zmk5jvs1`) stop resurrecting from stale embed-tracker zone copies.
- **Dashboard charts** (inline SVG, no deps, gradients + glow + draw-in): **Pour pipeline** cumulative area, **Pour status** donut, **Project completion** rings (pours complete / embeds set / footings assigned / inspections signed off), **Progress by sequence**, **Footings by type**, **Inspections signed off**, **Embeds by state**, **RFIs by status**. Dropped the bogus CY-based "concrete placed" (CY isn't entered — `cy:3` placeholders); metrics are count/checklist-based now. KPI row: added **Inspections done — N of M · K pours fully signed off**.
- **Pour inspections = full parity with CUP**: inspections are the per-pour embedded array at `cup-foundation/pours/<id>/checklist = [{text,done}]`, merged with the standard template `PREPOUR_DEFAULTS` via `pourChecklistItems()` (mirrors CUP). Every pour card shows the checklist (X/total, progress bar, click-to-toggle chips + "All ✓"); writes back to the same Firebase node (+`updatedAt`) so it stays in sync both ways. (`normPour` now preserves `checklist`; the top-level `A-1` `checklist` node is a separate, unused pour system.)
- **Show/hide toggle** for the inspection blocks on pour cards (`STATE.hideInsp`, header button next to "Hide complete").
- **Schedule (Gantt)**: auto-**snaps to today** on open / timeline-switch (`STATE._schedSnap` → `schedSnapToday()` sets `scrollLeft` from `data-todayx` = `(todayI0-1)·cellW`), so it opens on the current window, not past dates. Added a **"Jump to today"** button. **Status indicators** derived from dates vs today: done (past) = green ✓ + dimmed bar + greyed name, in progress (spans today) = blue pulsing dot + ring on the bar, upcoming = hollow dot; section headers show **done/total** (green when all done); legend above the timeline. Timeline mouse-wheel now defaults to **vertical** scrolling (through tasks); `H` / the toolbar button still flips to horizontal (dates).

## 2026-06-30 — Map interaction fixes (laptop/trackpad) + RFI polish
Reported: on a 16" MacBook + trackpad, map clicks landed in the wrong place, panning didn't work, and after the prior commit the map was fully unclickable.
- **Root cause of "can't click anything":** `rfiRegions()` had an accidental self-call (`rfiRegions(r).length>=3`) → infinite recursion → `RangeError`. It threw inside `hitTest` (outside the try/catch) which runs in `pointerdown` *before* the drag setup, so it killed both selection **and** drag-to-pan. Latent until the prior commit added `startCCSync()` to preview (which finally populated `DATA.rfi`). Fixed to check the legacy single `region` array.
- **Cursor "ghosting" / clicks off-target:** `pointermove` only refreshed the cached canvas rect during region-draw, and click coords weren't mapped into the draw space. Now every pointer read takes a fresh `getBoundingClientRect()` and scales `(clientX-left)` by `M.box.w/rect.width` (and Y) so clicks/hover stay accurate even if the canvas display size ≠ its draw buffer. (Rejected the tempting `/devicePixelRatio` "fix" — the buffer already uses the correct hi-DPI pattern; dividing would *break* Retina.)
- **Trackpad two-finger swipe pan** could trigger browser back/forward (blank page). Added `overscroll-behavior:none` on `html`/`body`/canvas.
- **Super role now manages RFIs:** added `super` to `CAP.rfiEdit` and removed `rfis` from `LOCKS.super` — Super sees the RFIs tab and gets add/remove (edit still requires unlocking with PIN `050103`).
- **RFI detail:** "Off map" button no longer clips — "Add location" is full-width, "Clear"/"Off map" sit on a 50/50 row.
- **RFI label toggle** (layers panel, shown when RFI layer is on): cycle **# / NAME / OFF** for the label printed inside each zone; names truncate at 28 chars so small zones don't overflow. State in `M.rfiLabel`.

## 2026-06-27 — Takeoff parity, live SuperYap, Tools PM dashboard, edit-lock
- **Takeoff now matches CUP**: TOTAL CY = Σ footing `cyv` (CUP's `getTakeoff`), not sparse pour-zone CY; FOOTINGS = live footing count.
- **Schedule: pull live from SuperYap OR import Excel** — source toggle (SuperYap ● / Imported). Ported SuperYap's working-day chain engine (`laCompute`) so chained dates resolve; crew bars use each company's real color; reads `look-ahead-schedule/{projects,meta,companies,holidays}` live.
- **Tools: PM Summary dashboard** + Inventory toggle. Summary = stat cards (on-site, total, monthly rental $, need-attention, utilization) + by-status bar + by-category cost table + needs-attention list. Inventory = searchable table.
- **Ghost-pour filter**: empty/stray zones (no name/geometry/CY/area/seq) no longer show on the map or pour list.
- **Edit lock (shortcut L)**: app is view-only by default; unlock with PIN `050103` to enable edits (toast + topbar lock pill). `can()`/`canView()` gate all edit affordances on the lock.
- **Map**: clicking empty space now also clears an isolated pour/sequence (and `Esc` clears selection).
- Login upgrade from the working tree preserved (6-digit PIN `050103`, no-flash dots, keyboard, shake).


## 2026-06-27 — Map UX iterations (from live feedback)
Two rounds of map polish after the design went live:
- **Navigation**: scroll wheel now **pans** (two-finger), pinch / ⌘-scroll **zooms**; then added Bluebeam-style tool modes — **Pan (V)** = scroll pans, **Zoom (Z)** = scroll zooms, **F** = fit — with toolbar buttons + keyboard shortcuts and an active-tool highlight.
- **Embed pins** now **scale with zoom** (small at the fit/launch view, grow as you zoom in) so ~376 pins aren't a wall of circles; knife/RFI markers only draw once a pin is large enough. Layers panel (bottom-left) toggles each layer with live counts.
- **Right info panel** (Project Takeoff / Pours / RFI tray) **show/hide** toggle in the toolbar; canvas reflows to full width when hidden.
- **Pour names hover-only**: dropped the always-on canvas labels; pour areas stay highlighted and reveal a themed glass tooltip (name · status · seq · CY) on hover.
- Real-time CUP footing sync confirmed (Firebase `.on` listeners on `cup-foundation/footingEdits`/`footingPours`/`pours`, `embed-tracker/pins`/`grid` — push-based, sub-second, no polling).


## 2026-06-27 — Claude Design front end integrated + MiniMax copilot
Rebuilt the UI to the Claude Design handoff (`~/Documents/design_handoff_openyap_command_center/`), keeping all Firebase logic + the canvas map engine.
- **Design ("Aurora/Foundry") shell:** dark `#0B0E13`, dot-grid, diamond-node brand mark, left rail (224→298px with copilot), topbar with role switcher, login = role-select cards → PIN (preview) or Google/Email (auth).
- **Screens:** Dashboard (KPIs/upcoming/live-feed, derived from real data), The Map (toolbars + Status/Sequence color + sequence filter + right dock PROJECT TAKEOFF/POURS/RFI-TRAY + layer panel + footing hover card + embed slide-in panel + RFI/markup cards + pour hover-highlight/isolate), Schedule (List + SuperYap-style Gantt with today line, real `command-center/schedule`), Tools, Attendance, RFIs, Inspections, Admin, Submittals (stub).
- **Roles:** design model (admin/super/pm/pe) drives nav locks + edit affordances; real Firebase role still gates writes. Admin/preview can switch the *view* role.
- **Copilot (MiniMax):** in-rail chat; key from `config/minimax_key` (shared); endpoint `api.minimax.io/anthropic/v1/messages`, model `MiniMax-M2.7`; grounded on live context (pours, embeds, RFIs, inspections, schedule, tools, crew).
- **Verified** via a pure-node DOM/Firebase stub harness (no Chrome): boot→login→PIN→app, all 8 screens render clean, map builds 338 footing squares with 0 out-of-range projections.
- Fixes: map body uses flex (not absolute) so it stays in its slot; RFI flag drawn as a canvas shape (icon-font ligatures don't render on canvas).


## 2026-06-26 — Initial build (function-first)
Consolidation hub for the OpenYap suite. Single `index.html`, vanilla JS, Firebase compat,
no build. Function-first: a functional Aurora-lite skin now; the Claude Design front end
integrates later by swapping `<style>` + `render*()` markup (logic unchanged).

**Built**
- **Shell:** topbar + left rail + hash router; sign-in overlay; toast/modal; aurora bg.
- **Auth/roles:** Firebase Auth (Google + Email/Pw); roles in `command-center/users/{uid}`;
  `CAP`/`can()` gating; first-user→Admin bootstrap; Admin tab (grant/edit/remove roles);
  TOTP 2FA enroll + sign-in challenge (Identity Platform; Google-2-Step fallback);
  read-only **preview** mode when `apiKey` absent.
- **Map (centerpiece):** ported EmbedYap canvas engine to vanilla (pan/zoom, hit-test,
  `S`/`toFrac`). Footings mirror CUP via ported `buildGeo`/`buildFootings`
  (`materializeFootings` + `cup-foundation/footingEdits`) → `footingToNorm` projection into
  the shared 0–1 frame. Layers: footings / embeds / pours / RFIs / markups / grid, with
  per-user persisted toggles. Calibration sliders → `command-center/mapCalib`. Detail drawer
  with deep links + inspection control.
- **RFIs:** Apps Script Drive lister (`apps-script/Code.gs`); draggable palette + manual add;
  drop → `command-center/rfi/{id}` (link only, optional cover); RFIs tab.
- **Inspections:** synced toggle `'' → READY → PASS → FAIL`; logs `markedReadyBy/At`; feed;
  map badges; Inspections tab + export.
- **Schedule:** SuperYap xlsx/csv/pdf import (instant dates) → `command-center/schedule`;
  import→pours dedupe by name+section (`schedulePours`); export.
- **Tools / Crew:** read-only live readers from `tool-tracker/assets` and
  `foreman-attendance/*`; stat cards, search, export, deep links.
- **Rules:** `database.rules.json` — partial enforcement; `$legacy` wildcard keeps the other
  apps open; `command-center/*` gated by auth + role.

**Notes / TODO before production**
- Fill `FIREBASE_CONFIG.apiKey` + `appId`, and `RFI_API_URL`.
- Publish `database.rules.json` *after* first Admin exists.
- One-time map calibration pass (sliders) to align footings with pins/grid.
- Future: PM Cost/Submittals modules; move legacy nodes off `$legacy` as apps adopt Auth.
