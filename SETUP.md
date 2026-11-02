# JLIC UCLA TV: setup

- **TV display:** `<site>/`
- **Upside-down TV:** `<site>/flipped/`
- **Dashboard:** `<site>/admin/`
- **Try the dashboard without signing in:** `<site>/admin/?demo`. Changes stay on your own device.

`<site>` is `https://arshiakohanteb.github.io/jlic-ucla-tv` until a custom domain is added.

## One-time Firebase setup (about 15 minutes)

This site has its own Firebase project and shares nothing with any other TV.

1. Go to https://console.firebase.google.com, click **Add project**, name it `jlic-ucla-tv`. Google Analytics can stay off.
2. **Blaze plan:** click the plan badge bottom-left, pick **Blaze**, and set a **$1 budget alert**. Photo storage requires it. Normal use should stay in the free allowance.
3. **Email sign-in:** **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save**. Then **Settings → Authorized domains → Add domain**: `arshiakohanteb.github.io` (and the custom domain later).
4. **Database:** **Build → Realtime Database → Create database**, **United States (us-central1)**, **locked mode**. On the **Rules** tab paste [`firebase/database.rules.json`](firebase/database.rules.json) and **Publish**.
5. **Storage:** **Build → Storage → Get started**, default location, **production mode**. On the **Rules** tab paste [`firebase/storage.rules`](firebase/storage.rules) and **Publish**.
6. **Web app config:** **Project settings (gear) → General → Your apps → Web (`</>`)**, nickname `tv`, no Hosting. Copy the `firebaseConfig` block into [`tv-app/src/shared/firebase.js`](tv-app/src/shared/firebase.js), replacing the `PASTE_...` values. These values are safe to publish; the rules protect the data.
7. **Owner account:** open `<site>/admin/`, choose **First-time setup**, enter your email and a password. Only the very first account can do this. Add everyone else under **People**.

## Are we on?

The top of the dashboard's Overview page holds the night-before controls: votes so far, still voting / we're on / not today, the time and the room. They only count for that date, so the board starts each day at "Not confirmed".

## Editing

Times, announcements, flyers, photos, theme, location and donation details (**Appearance → Names & donation details**) are all in the dashboard.

## Brand rules built in

From the JLIC Brand and Style Guide: purple `#391A92`, red `#F23207` and their listed tints only; Open Sans headlines, Montserrat body, Heebo or Open Sans Hebrew; the logo is never recoloured or used under 76px wide.

## Logo

`tv-app/tv/public/logo.png` is the mark from `JLIC_Logo.ai`. The "UCLA" line under it is set in Open Sans by the `.logo-mark` styles.

## Deploying

Push to `main`. GitHub Actions builds `tv-app/` and publishes it. For a custom domain, add it under the repo's **Settings → Pages** and to Firebase's authorized domains. No code change is needed, since the build follows the site's path.

## Working locally

```bash
cd tv-app && npm install && npm run preview
```

Then open http://localhost:8080/?demo. Add `&hold=schedule`, `flyer`, `announcement`, `community`, `donate` or `logo` to stay on one screen.
