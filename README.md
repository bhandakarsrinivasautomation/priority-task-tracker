# Priority Task Tracker

Colorful priority-based to-do list app — HTML/CSS/JS, Firebase Auth (Google SSO) + Firestore, Chart.js.

## Files
- `index.html` — app markup (login screen, dashboard, my tasks, admin panel, task modal)
- `style.css` — colorful styling, priority color-coding (Red=High, Orange=Medium, Green=Low, Purple=Completed)
- `firebase-config.js` — Firebase project config + superadmin email
- `app.js` — auth, Firestore realtime CRUD, charts, filtering, admin logic
- `firestore.rules` — production-mode security rules to paste into Firebase Console

## 1. Enable Google Sign-In
Firebase Console → your project (`prooritybasedtasktracker`) → **Authentication** → **Sign-in method** → enable **Google** → set a support email → Save.

Also add your hosting domain (e.g. `localhost`, or your deployed domain) under **Authentication → Settings → Authorized domains**.

## 2. Create Firestore Database
Firebase Console → **Firestore Database** → **Create database** → choose **Production mode** → pick a region.

## 3. Publish the security rules
Firebase Console → **Firestore Database** → **Rules** tab → replace contents with the file `firestore.rules` in this folder → **Publish**.

These rules enforce:
- Each signed-in user can only create/read/update/delete **their own** tasks (`uid` field must match `request.auth.uid`).
- The superadmin (`bhandakarsrinivas.automation@gmail.com`, matched via verified Google `request.auth.token.email`) can **read all tasks** from all users, and may **only modify the `priority` field** on tasks that aren't theirs — they cannot silently rewrite someone else's title/description or delete another user's task via the client.
- The superadmin has full normal owner rights on their *own* tasks.
- A `users/{uid}` profile doc (name/email/photo) is written on every login so the admin panel can show "who owns which task"; only the owner or superadmin can read it.

> Note: superadmin identification uses `request.auth.token.email`, which Firebase populates from the verified Google ID token — it cannot be spoofed by the client.

## 4. Run the app
Just open `index.html` via a local static server (Firebase Auth popups require `http://` or `https://`, not `file://`). Easiest options:

```bash
# Option A: Python
python -m http.server 5500

# Option B: Node
npx serve .
```

Then visit `http://localhost:5500`.

## 5. How it works
- **Login** — Google SSO popup via `firebase.auth.GoogleAuthProvider()`.
- **Dashboard** — stat cards + 3 charts (pie by priority, bar completed/pending by priority, donut overall progress), plus a "Needs Attention" list grouped by priority.
- **My Tasks** — full task list with filter chips (All / High / Medium / Low / Completed), click a card to edit, checkbox circle to toggle complete.
- **Admin Panel** (visible only to `bhandakarsrinivas.automation@gmail.com`) — sees every user's tasks with owner name/email, search by user, stat cards + priority bar chart across all users, and an inline dropdown to change any task's priority.

## Notes
- Superadmin email is set in two places — keep them in sync if you ever change it:
  - `firebase-config.js` → `SUPERADMIN_EMAIL`
  - `firestore.rules` → `isSuperAdmin()`
