# Backend setup — Firebase + Vercel

What you get when this is done:

- **Google sign-in**, so your data is tied to your account instead of one browser
- **Cloud sync** — the same meals, kitchen, and plan on your phone and laptop
- **Your Anthropic key off the browser**, living on the server instead

Both deployments keep working: **Vercel** is the full app, **GitHub Pages** stays
as the static demo (sign-in and sync work there too; only the server-side AI
proxy is Vercel-only).

---

## Accounts you need

| Account | For | Cost |
| --- | --- | --- |
| Google | Firebase console | Free (Spark plan) |
| Vercel | Hosting + API routes | Free (Hobby) — sign up **with GitHub** |
| GitHub | Vercel deploys from the repo | Already have it |

No credit card. Firestore + Auth are free on Spark; the Blaze plan is only
needed for Cloud Functions, which this app doesn't use.

> **Note:** Vercel's free Hobby tier is for non-commercial use. If Real Food
> Hackz ever becomes a business, that's Pro at $20/month.

---

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. **Add project** → name it `real-food-hackz` → Continue.
3. Google Analytics is optional — **disable** it unless you want it. → Create project.

### Turn on Google sign-in

4. Left sidebar → **Build → Authentication** → **Get started**.
5. **Sign-in method** tab → **Google** → toggle **Enable**.
6. Pick a support email (your own) → **Save**.

### Create the database

7. Left sidebar → **Build → Firestore Database** → **Create database**.
8. Choose **Production mode** (the rules below lock it down properly).
9. Pick the location closest to you (e.g. `nam5 (us-central)`) → Enable.

### Publish the security rules

10. Firestore Database → **Rules** tab.
11. Replace everything with the contents of [`firestore.rules`](./firestore.rules) → **Publish**.

These rules are what protect your data: a signed-in user can read and write
**only** their own `users/{uid}` document, and everything else is denied.

### Get the web config

12. Gear icon (top left) → **Project settings**.
13. Scroll to **Your apps** → click the **web** icon (`</>`).
14. Nickname it `web` → **Register app** (skip Firebase Hosting).
15. Copy the values out of the `firebaseConfig` object it shows you — you'll
    paste them in the next step.

---

## 2. Deploy to Vercel

1. Go to <https://vercel.com> → **Continue with GitHub** → authorize.
2. **Add New… → Project** → find `Real-Food-Hackz` → **Import**.
3. Framework preset should auto-detect **Next.js**. Leave build settings alone.
4. Expand **Environment Variables** and add these, using the values from step 15:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |
   | `ANTHROPIC_API_KEY` | your `sk-ant-…` key *(optional)* |

   `ANTHROPIC_API_KEY` has **no** `NEXT_PUBLIC_` prefix on purpose — that's what
   keeps it on the server. Set it and recipe scanning works for everyone with no
   key entry; leave it out and each user supplies their own key in Settings.

5. **Deploy.** You'll get a URL like `real-food-hackz.vercel.app`.

### Authorize the domains for sign-in

Google sign-in refuses to run on domains Firebase doesn't know about.

6. Firebase Console → **Authentication → Settings → Authorized domains** → **Add domain**:
   - `your-project.vercel.app` (your real Vercel URL)
   - `brendancasey812-prog.github.io` (so sign-in also works on the Pages demo)

`localhost` is already authorized for local development.

---

## 3. (Optional) Turn on sync for the GitHub Pages demo

The Pages build reads the same Firebase values from repo secrets. Skip this and
the demo simply stays local-only.

1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Add the same six `NEXT_PUBLIC_FIREBASE_*` names and values.
3. Re-run the deploy workflow (Actions tab → Deploy to GitHub Pages → Run workflow).

Do **not** add `ANTHROPIC_API_KEY` here — a static site can't hide it, and the
Pages build strips the server route anyway.

---

## 4. Local development

```bash
cp .env.example .env.local     # then paste your Firebase values in
npm run dev
```

With `.env.local` blank, the app runs exactly as before — everything in
localStorage, no sign-in. That's the intended fallback, not a broken state.

To build the static Pages version locally:

```bash
rm -rf src/app/api && BUILD_TARGET=pages npm run build   # outputs to ./out
```

---

## How your existing data is handled

**Nothing is wiped.** The first time you sign in on an account that has no cloud
data yet, whatever is already in that browser is uploaded as your starting point.
After that the cloud copy is the source of truth, and signing in on a second
device pulls it down.

Signing out leaves both copies intact — the cloud one stays in your account, the
local one stays in that browser.

---

## Costs, realistically

Firestore's free tier is 50,000 reads and 20,000 writes per day. This app writes
a single document per user, debounced to at most one write every 1.5 seconds of
active editing — so personal use is far inside the free tier.

The only thing that costs money is Anthropic API usage for recipe scanning,
billed per use on your own Anthropic account.
