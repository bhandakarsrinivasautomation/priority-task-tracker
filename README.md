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

Also add your hosting domain under **Authentication → Settings → Authorized domains**: `localhost` (local dev), `<username>.github.io` (GitHub Pages default domain), and `tasks.aiwithsrinivas.online` (custom domain).

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

## 5. Deployment (GitHub Pages)
This app is a static site (no build step), so it's hosted directly on **GitHub Pages**:

1. Push to the `master` branch on GitHub.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: `master`, folder: `/ (root)`.
3. Under **Custom domain**, enter `tasks.aiwithsrinivas.online` (this repo already has a `CNAME` file with that value, so GitHub Pages will pick it up automatically).
4. At your domain registrar's DNS settings for `aiwithsrinivas.online`, add a **CNAME record**:
   - Host/Name: `tasks`
   - Value/Target: `<your-github-username>.github.io`
   - TTL: default
5. Wait for DNS to propagate (a few minutes to a few hours), then GitHub Pages will issue an HTTPS certificate for the subdomain automatically.
6. Add `tasks.aiwithsrinivas.online` to Firebase Console → Authentication → Settings → **Authorized domains**, otherwise Google Sign-In will be blocked on that domain.

Any push to `master` auto-redeploys the Pages site — no manual deploy step needed.

## 6. How it works
- **Login** — Google SSO popup via `firebase.auth.GoogleAuthProvider()`.
- **Dashboard** — stat cards + 3 charts (pie by priority, bar completed/pending by priority, donut overall progress), plus a "Needs Attention" list grouped by priority.
- **My Tasks** — full task list with filter chips (All / High / Medium / Low / Completed), click a card to edit, checkbox circle to toggle complete.
- **Admin Panel** (visible only to `bhandakarsrinivas.automation@gmail.com`) — sees every user's tasks with owner name/email, search by user, stat cards + priority bar chart across all users, and an inline dropdown to change any task's priority.

## Notes
- Superadmin email is set in two places — keep them in sync if you ever change it:
  - `firebase-config.js` → `SUPERADMIN_EMAIL`
  - `firestore.rules` → `isSuperAdmin()`
