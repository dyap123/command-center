# DEVLOG — OpenYap Command Center

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
