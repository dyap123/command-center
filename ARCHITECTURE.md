# OpenYap Command Center — Architecture

A single-file (`index.html`) vanilla-JS web app that consolidates the OpenYap field suite —
**CUP Pour Dashboard, EmbedYap, Tool Tracker, and SuperYap** — into one role-aware command
center optimized for *information flow + essential actions*. Heavy editing still happens in
the specialist apps; the Command Center reads everything live, adds its own RFI / markup /
inspection layer, and deep-links out for the rest.

- **Stack:** one `index.html`, vanilla JS, Firebase compat 10.12.0 (Database + Auth), no build step.
- **Geometry data:** `foundation_geo.js` (bundled copy of CUP's 495-footing plan).
- **Backend:** the shared Firebase RTDB `gen-lang-client-0119642855` (no servers of our own).
- **RFI source:** `apps-script/Code.gs` (lists a Google Drive folder → JSON).
- **Security:** `database.rules.json` (partial enforcement — see §5).
- **Live:** https://dyap123.github.io/command-center/

This doc explains **each component and how it works**, so you can reason about and extend the system.

---

## 1. The big picture / data model

Every OpenYap app writes to **one** Realtime Database and partitions by top-level key
(`cup-foundation/…`, `embed-tracker/…`, `tool-tracker/…`, `look-ahead-schedule/…`,
`foreman-attendance/…`). The Command Center follows one rule:

> **READ widely from the legacy (open) namespaces; WRITE only under `command-center/`.**

So it never corrupts another app's data, and anything it owns (RFIs, markups, inspections,
schedule, calibration, roles) lives in its own subtree that *can* be access-controlled.

```
RTDB root
├── cup-foundation/footingEdits     ← READ  (footing move/resize/add/delete overlay)
├── cup-foundation/footingPours     ← READ  (footingNo → pourId membership, for color)
├── cup-foundation/pours            ← READ  (pour zones: geometry, status, mix, CY)
├── pours-user                      ← READ  (spreadsheet pours)
├── embed-tracker/pins              ← READ  (embed anchor pins, normalized x,y)
├── embed-tracker/zones             ← READ  (WCG pour polygons)
├── embed-tracker/grid              ← READ  (shared grid config: cols/rows/colW/rowH/plan)
├── tool-tracker/assets             ← READ  (live tool inventory)
├── foreman-attendance/{foremen,members,areas,attendance} ← READ
└── command-center/                 ← READ + WRITE (this app owns it)
    ├── users/{uid}      = {email, role, createdAt}
    ├── rfi/{id}         = {number,title,status,viewUrl,cover?,x,y,by,at}
    ├── markups/{id}     = {x,y,text,by,at}
    ├── inspections/{key}= {status, markedReadyBy, markedReadyAt, updatedBy, updatedAt}
    ├── schedule         = {id,name,startDate,sections{},tasks{},importedAt,importedBy}
    ├── schedulePours/{k}= {name,section,date,source}     (informational; CUP owns geometry)
    ├── mapCalib         = {dx,dy,sx,sy}                  (footing↔pin alignment)
    ├── mapGrid          = {cols,rows,colW,rowH,plan}     (optional grid override)
    ├── feed/{pushId}    = {ts,type,msg}                  (activity log)
    └── prefs/{uid}      = {layers:{…}}                   (per-user UI prefs)
```

In code, all live state is held in two globals: **`DATA`** (raw Firebase snapshots) and
**`M`** (the map's derived/render state). Listeners in `startSync()` keep `DATA` current and
trigger re-renders.

---

## 2. The unified map (the centerpiece)

One `<canvas>` renders **six toggleable layers** in **one normalized 0–1 coordinate frame**.
The engine is ported from EmbedYap's proven canvas map (`MapScreen.jsx` → vanilla here).

### 2.1 Why one coordinate frame works
- EmbedYap pins are stored as normalized `x,y ∈ [0,1]` over a **1600×1200 (4:3)** blueprint.
- CUP's footing plan (`foundation_geo.js`) is **3456×2592 (also 4:3)** pixel space.
- Both are 4:3, so footings can be projected into the *same* 0–1 frame as the pins and they
  line up. CUP's pour zones already live in this exact frame, so pours need no projection.

### 2.2 Footings = a faithful, read-only mirror of CUP
The footing map **is CUP's** — you edit footings in one place (CUP), and the changes appear
here. We reproduce CUP's pipeline:

1. `buildGeo()` — ports CUP's `buildData()`: reads `FOUNDATION_GEO.foot`, sizes each footing
   from its type (`sideFt`), then **lattice-snaps** positions (so the layout matches CUP's
   displayed map) and computes grade-beam segments. It snapshots an immutable base `M.base`
   and records `M.ox/M.oy` (the `fb.x0-80 / fb.y0-80` plan offset).
2. `buildFootings()` — ports CUP's `materializeFootings()`: applies the live
   `cup-foundation/footingEdits` overlay (type/size/move/add/delete keyed by footing `no`)
   onto the base. **This is what makes CUP edits propagate** — when a footing is moved in CUP,
   the edit's `cx,cy` (CUP world coords) re-materialize here identically.
3. Coloring: `footColor(f)` uses `cup-foundation/footingPours[no]` → the pour's status color,
   else the footing-type family color.

Foundation editing is intentionally **not** in this app — the footing detail drawer has an
"Edit foundations in CUP →" deep link.

### 2.3 The projection
```
footingToNorm(planX, planY):
  u = (planX - FB.x0) / (FB.x1 - FB.x0)            // unit square over the footing bbox
  v = (planY - FB.y0) / (FB.y1 - FB.y0)
  u = 0.5 + (u-0.5)*calib.sx + calib.dx            // human calibration
  v = 0.5 + (v-0.5)*calib.sy + calib.dy
  x = EY_PLAN.x0 + u*(EY_PLAN.x1 - EY_PLAN.x0)     // → EmbedYap grid box (0..1)
  y = EY_PLAN.y0 + v*(EY_PLAN.y1 - EY_PLAN.y0)
```
A footing's plan-pixel center is `f.cx + M.ox`, `f.cy + M.oy`. Sizes use `normSizeX/Y`
(same affine, without the offset). We calibrate against the **footing bounding box → grid
box** rather than raw `x/3456` because the sheet has margins and the bbox is near-square while
the sheet is 4:3 — raw normalization would letterbox the footings off the gridlines.

### 2.4 Calibration
Identity `{dx:0,dy:0,sx:1,sy:1}` is already visually close. PE/Admin can open the calibration
panel (4 sliders), nudge until footings sit on the right gridlines/pins, and **Save** →
`command-center/mapCalib`. Everyone then loads the saved calibration. Expect one
one-time tuning session after first deploy.

### 2.5 The six layers
| Layer | Source | Draw |
|---|---|---|
| Footings | base + `footingEdits` (materialized) | rounded rects + grade-beam lines, colored by pour/type; inspection badge dot |
| Embeds | `embed-tracker/pins` | colored dots (installed/todo/next), knife ◆ / stub ■ / RFI ● markers |
| Pours | `cup-foundation/pours` + `embed-tracker/zones` | translucent polygons, status color, centroid label |
| RFIs | `command-center/rfi` | flag pins, status color |
| Markups | `command-center/markups` | note pins + text (this app's own annotations) |
| Grid | `embed-tracker/grid` / `command-center/mapGrid` | column/row lines + labels |

Toggles persist per-user to `command-center/prefs/{uid}`.

### 2.6 Pan / zoom / hit-test
Ported from EmbedYap: `M.view={tx,ty,s}`; `S(nx,ny)` projects normalized→screen,
`toFrac(px,py)` inverts it. Wheel + buttons call `zoomAt`. `hitTest(px,py)` checks pins →
RFIs → markups → footings → pour polygons and opens the **detail drawer**. The drawer shows
properties, the **inspection control**, and the relevant **"Edit in …" deep link**.

---

## 3. RFIs (drag-drop, link-only)

Two ways onto the map, exactly as requested:

1. **Auto-list from Drive** — `apps-script/Code.gs` (a web app over the RFI folder) returns
   `[{number,title,status,viewUrl}]`. `loadDriveRFIs()` fetches it and renders the
   **draggable RFI palette** on the Map. Drag a card → `drop` handler computes `toFrac` and
   writes `command-center/rfi/{id}` with the **link only** (`viewUrl`) + location.
2. **Manual add** — `addRfiManual()` lets you paste a Drive link + optional cover image
   (stored as a data-URL in `cover`). It's pinned centered; drag it where it belongs.

"More info" in the drawer opens `viewUrl` in a new tab. The server/RTDB never stores the PDF —
only the link (and an optional small cover image for context).

The **RFIs tab** lists pinned vs. available RFIs, supports refresh/export, and "locate"
flies the map to a pinned RFI.

---

## 4. Inspections (CUP-style sync + who marked ready)

Mirrors CUP's toggle pattern. Each footing/pour has a key (`foot_<no>` / `pour_<id>`).
`cycleInspection(key)` advances status `'' → READY → PASS → FAIL` and writes
`command-center/inspections/{key}`. On **READY** it stamps `markedReadyBy` (the signed-in
user's name) + `markedReadyAt` — the requested "log who marked it ready". Every change also
pushes to `command-center/feed`. The status shows as a colored badge on the map element, in
the detail drawer, and as a table on the **Inspections tab** (with export).

---

## 5. Auth, roles & 2FA

### 5.1 Identity
Real **Firebase Auth** (Google + Email/Password). The config needs `apiKey` + `appId`
(currently placeholders — see README setup). If the `apiKey` is missing, the app runs in
read-only **preview** mode so the map/tools/crew still render for development.

### 5.2 Roles (no backend, no custom claims)
Role is stored per-uid at `command-center/users/{uid}.role` (Admin-writable). After sign-in,
the client reads its own role and gates the UI via the `CAP` matrix and `can(cap)`:

| Capability | Admin | Super | PM | PE |
|---|---|---|---|---|
| Map view | ✓ | ✓ | ✓ | ✓ |
| Drop/edit RFIs | ✓ | — | ✓ | ✓ |
| Create/assign zones | ✓ | — | — | ✓ |
| Map calibration | ✓ | — | — | ✓ |
| Markups | ✓ | — | ✓ | ✓ |
| Schedule import/edit | ✓ | ✓ | — | — |
| Tools / Attendance view | ✓ | ✓ | ✓ | ✓ |
| Inspections | ✓ | — | ✓ | ✓ |
| Admin (users) | ✓ | — | — | — |
| Export to Excel | everyone who can view a module |

**Bootstrapping:** the very first signed-in user (when `command-center/users` is empty)
self-assigns Admin (allowed by the rule below); afterwards only an Admin can grant roles, via
the **Admin tab**. New users see an "Almost there" screen showing their uid for the Admin to grant.

### 5.3 2FA (Admin)
TOTP enrollment (`enroll2FA()` → QR → verify → `multiFactor.enroll`) and sign-in challenge
(`handleMfa` → `promptTotp`) use Firebase MFA, which requires **Identity Platform** enabled.
If it isn't, the buttons surface a clear error and the fallback is **Google sign-in + Google
2-Step** (second factor enforced by Google, zero backend).

### 5.4 Security rules — partial enforcement
`database.rules.json` keeps the root denied, gates every `command-center/*` child on
`auth != null` + a role lookup, and routes **all legacy nodes** through a `$legacy` wildcard
that stays fully open — so CUP/EmbedYap/Tool Tracker/SuperYap/Attendance keep working
unauthenticated. This is deliberately *partial*: new-app data is protected; legacy shared data
is still open. Migration path: move each legacy app's node out of `$legacy` into its own
auth-gated block once that app adopts Auth, until `$legacy` can be removed.

> ⚠️ Until you publish these rules, the DB is fully open. Publish them after the first Admin
> exists (or seed the first Admin's uid in the Console first).

---

## 6. Schedule (Excel-first)

- **Import** (`importSchedule`): ports SuperYap's `parseSheetRows` (xlsx/csv via SheetJS) and
  `rowsFromAoa` header detection, plus a PDF fallback. `buildScheduleFromRows` creates one
  section per group and one task per row with computed working-day durations → written to
  `command-center/schedule`. **Dates populate instantly** so a Super can keep using Excel.
- **Import → pours** (`createPoursFromSchedule`): every "pour" activity is recorded under
  `command-center/schedulePours` keyed by `section+name` — **same name → date updated, not
  duplicated**. (CUP remains the owner of pour geometry/CY; this is the informational link.)
- **Export** (`exportSchedule` + the generic `exportXLSX`): every module exports to `.xlsx`
  ("always be able to convert my data to Excel").

---

## 7. Tools & Attendance (read-only)

Direct ports of SuperYap's readers. **Tools** listens to `tool-tracker/assets` and renders a
live inventory (item · status chip · assigned · monthly $) with derived stat cards and search;
edits link out to Tool Tracker. **Attendance** reads `foreman-attendance/*` (+ a REST fetch
for the date list) and shows the daily roster with signatures; edits link out to the Sign-In
app. Both export to Excel.

---

## 8. UI shell & the design

The UI implements the **Claude Design handoff** ("Aurora/Foundry" — dark `#0B0E13`, dot-grid,
glassmorphic panels, diamond-node brand mark, Inter / JetBrains Mono / Material Symbols
Rounded). It is **state-driven**: a top-level `render()` paints either the **login** (role
cards → PIN in preview, or Google/Email when Auth is configured) or the **app shell**
(`renderRail` + `renderTopbar` + `renderBody`). Each screen is a `*HTML()` string builder;
the **Map** is the one `<canvas>` (built once per entry; selection/hover/layers update via
targeted DOM + `repaint()`).

- **Roles:** the design model (`admin/super/pm/pe`) drives nav locks (`LOCKS`) and edit
  affordances (`canView`); the **real** Firebase role still gates writes (`can`). Admin/preview
  can switch the *view* role from the topbar.
- **Map chrome:** toolbar (Status/Sequence color, sequence filter, deep links), right dock
  (PROJECT TAKEOFF / POURS / RFI tray), floating layer panel + legend, footing hover card,
  embed slide-in detail panel, RFI/markup/pour cards, calibration panel.

## 8a. OpenYap Copilot (MiniMax)

In-rail AI assistant (`renderCopilot`/`sendChat`). Key read from RTDB **`config/minimax_key`**
(shared with the other OpenYap apps; `localStorage cup_alfred_key` fallback). Calls the
Anthropic-compatible endpoint **`https://api.minimax.io/anthropic/v1/messages`**, model
**`MiniMax-M2.7`**, with a system prompt + a live **`buildContext()`** digest (pours, embeds,
open RFIs, inspections, schedule, tools, crew) so answers reflect current site state. If no
key is found, it says so (an Admin sets it once for all apps).

---

## 9. File map

| File | Purpose |
|---|---|
| `index.html` | The entire app (shell, Firebase, auth/roles, map engine, all modules) |
| `foundation_geo.js` | Bundled copy of CUP's 495-footing plan geometry (`window.FOUNDATION_GEO`) |
| `database.rules.json` | RTDB security rules (partial enforcement) |
| `apps-script/Code.gs` | Drive RFI lister web app (returns JSON) |
| `.nojekyll` | Serve `_`-prefixed assets on GitHub Pages |
| `ARCHITECTURE.md` | This document |
| `README.md` | Setup + deploy steps |
| `DEVLOG.md` | Build log / change history |

---

## 10. Known limitations / future

- Auth config (`apiKey`/`appId`) and the RFI Apps Script URL must be filled before
  production (placeholders ship). Preview mode covers the gap.
- 2FA requires Identity Platform; Google-2-Step is the zero-setup fallback.
- PM "Cost" and Submittals (from the spec) are not yet modules (PM role exists).
- Schedule→pour link is informational; pour geometry/CY stays authored in CUP.
- Map calibration may need a one-time visual tune after first deploy.
