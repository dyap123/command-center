# OpenYap Command Center

One role-aware hub that consolidates the OpenYap field suite — **CUP Pour Dashboard,
EmbedYap, Tool Tracker, SuperYap** — into a single immersive map + workflow surface.
Read everything live from the shared Firebase; add RFIs / markups / inspections; deep-link
out to the specialist apps for heavy editing.

**Live:** https://dyap123.github.io/command-center/

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for how every component works.

---

## What it does

- **Map** — CUP footings (mirrored, edit-once) + EmbedYap embed pins + pour zones + grid, in
  one frame with show/hide layers. Drag RFIs onto the map; drop markups; click anything for a
  detail drawer with deep links.
- **Schedule** — import an Excel/CSV/PDF look-ahead (dates populate instantly); pour
  activities create/update pours by name+section; export to Excel.
- **Inspections** — CUP-style synced toggles (Ready → Pass → Fail) that log *who* marked it ready.
- **RFIs** — auto-listed from a Google Drive folder + manual add; stores the link only.
- **Tools / Crew** — read-only live tool inventory and daily attendance.
- **Admin** — manage users/roles; enroll 2FA.

Roles: **Admin** (all) › **Super** (schedule/tools/crew) › **PM** (RFIs/inspections) ›
**PE** (map zones/RFIs/inspections/pours).

---

## Setup (one-time)

### 1. Firebase Auth
1. Firebase Console → **Project settings → General → Your apps → Web app** → copy the SDK
   config. Put `apiKey` and `appId` into `index.html` → `FIREBASE_CONFIG`.
2. **Authentication → Sign-in method**: enable **Google** and **Email/Password**.
3. **Authentication → Settings → Authorized domains**: add `dyap123.github.io` and `localhost`.
4. *(Optional, for 2FA)* upgrade Authentication to **Identity Platform** to enable TOTP MFA.
   Otherwise Admins use Google sign-in + Google 2-Step.

### 2. First Admin + security rules
1. Deploy/open the app and sign in once. The **first** user (while `command-center/users` is
   empty) is auto-granted **Admin**. (Or seed your uid by hand in the Console RTDB editor:
   `command-center/users/<uid> = {email,role:"Admin",createdAt:0}`.)
2. Publish the rules: Firebase Console → **Realtime Database → Rules** → paste
   `database.rules.json` → Publish. (Or `firebase deploy --only database` with the CLI.)
   - ⚠️ Publish **after** the first Admin exists. The `$legacy` wildcard keeps all other
     OpenYap apps working unauthenticated.
3. In the **Admin tab**, grant roles to the other users (they sign in once to get a uid).

### 3. RFI Drive lister
1. Create an Apps Script project, paste `apps-script/Code.gs`, set `RFI_FOLDER_ID` (already
   set to the LACC RFI folder).
2. Deploy → **Web app** (Execute as *Me*, Access *Anyone*). Copy the `/exec` URL into
   `index.html` → `RFI_API_URL`.

Until `apiKey` / `RFI_API_URL` are set, the app runs in **read-only preview** and RFIs can
still be added manually.

---

## Deploy (GitHub Pages, static)

```bash
git add -A && git commit -m "update"
git push                       # Pages serves index.html from the repo root (main)
```
No build step. Settings → Pages → Source: **Deploy from a branch** → `main` / root.

---

## Conventions

- READ widely from legacy namespaces; WRITE only under `command-center/`.
- Functional skin now; the Claude Design front end integrates by swapping the `<style>` block
  and the markup in `render*()` — logic stays put.
