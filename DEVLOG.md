# DEVLOG — OpenYap Command Center

## 2026-06-27 — Takeoff parity, live SuperYap, Tools PM dashboard, edit-lock
- **Takeoff now matches CUP**: TOTAL CY = Σ footing `cyv` (CUP's `getTakeoff`), not sparse pour-zone CY; FOOTINGS = live footing count.
- **Schedule: pull live from SuperYap OR import Excel** — source toggle (SuperYap ● / Imported). Ported SuperYap's working-day chain engine (`laCompute`) so chained dates resolve; crew bars use each company's real color; reads `look-ahead-schedule/{projects,meta,companies,holidays}` live.
- **Tools: PM Summary dashboard** + Inventory toggle. Summary = stat cards (on-site, total, monthly rental $, need-attention, utilization) + by-status bar + by-category cost table + needs-attention list. Inventory = searchable table.
- **Ghost-pour filter**: empty/stray zones (no name/geometry/CY/area/seq) no longer show on the map or pour list.
- **Edit lock (shortcut L)**: app is view-only by default; unlock with PIN `050103` to enable edits (toast + topbar lock pill). `can()`/`canView()` gate all edit affordances on the lock.
- **Map**: clicking empty space now also clears an isolated pour/sequence (and `Esc` clears selection).
- Login upgrade from the working tree preserved (6-digit PIN `050103`, no-flash dots, keyboard, shake).


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
