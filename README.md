# NoshTech Restaurant POS • Supabase Multi-Device Demo

This is a small **working demonstration**, rebuilt from the uploaded NoshTech Vite/React wrapper. It shares data between phones, tablets and web browsers through **Supabase Free**. It replaces the old localStorage-only demonstration and corrects the crucial flow: **Waiter → Counter approval → Kitchen**. The owner sees paid revenue and can assign waiter, accounts/POS and kitchen roles to existing staff users.

> **Important:** The source bundle does not contain a live Supabase project, passwords or an already compiled APK. Complete setup below before showing the app to the restaurant. The Android project uses a lightweight WebView of the live GitHub Pages website and requires internet.

## 1. Create a FREE Supabase backend (about 10 clicks)

1. Open https://supabase.com/dashboard and create a **new** project, e.g. `noshtech-restaurant-demo`. Use a strong database password; do not place it anywhere in this repository. Wait for the database to finish provisioning.
2. Project → **SQL Editor** → **New query**. Paste **all** of `supabase/01_schema.sql` and click **Run**. This creates five tables, safe row-level permissions, the role/approval logic, realtime and your original 6-item menu. Run in a *new* project (not an existing production database).
3. Project → **Authentication** → **Providers** → ensure **Email** is enabled.
4. Project → **Authentication** → **Users** → **Add user** → **Create new user**. Create **four users**, one for each role, using distinct email addresses and strong passwords. If the dashboard offers "auto-confirm", choose it for test users. Otherwise confirm the users' emails before login.
5. Reopen **SQL Editor**. Open `supabase/02_promote_owner.sql`, replace **both** occurrences of `OWNER_EMAIL_HERE` with your exact owner account email, then run it. The other new users automatically start as waiters.
6. Project → **Settings / Project Settings** → **API Keys**. Copy the **Project URL** (`https://...supabase.co`) and **publishable key** (`sb_publishable_...`). In older projects the public legacy `anon` key is also valid. **Never use the secret or service_role key in a website or Android app.**
7. In the owner's account, use **Team & permissions** to set one staff account to **Accounts / POS** and another to **Kitchen**. Leave the last one as **Waiter**. Each user signs in with the email and password from step 4.

You can verify database creation in **Database → Tables**: `profiles`, `menu_items`, `menu_variants`, `orders`, `order_items`. There should be 6 rows in `menu_items` and 13 in `menu_variants`. The owner profile will have role `owner`.

## 2. Run on localhost (Windows / Node 22+)

1. Extract this folder into your preferred development directory.
2. Open a terminal inside the folder and run `npm install`.
3. Copy `.env.example` to `.env.local` and replace the example values with your **actual** Supabase Project URL and publishable key:
   ```ini
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```
4. Run `npm run dev`. Open **http://localhost:5173/**.
5. Sign in separately as each of the four users, in different browsers/incognito sessions or on different devices using the hosted URL. Role controls are checked by SQL, not just the UI.

`.env.local` is ignored by Git. The public publishable key is safe for frontend use *because* RLS and RPC authorization are enforced. Do not store a secret/service_role key here.

## 3. Publish website for FREE on GitHub Pages

The repository already used for the old wrapper is `zaighaumrana/NoshTech-Wrapper`, and the app is configured for its GitHub Pages subfolder URL. The GitHub Actions workflow `.github/workflows/pages.yml` builds the React app and publishes it automatically on each push to `main`.

1. On GitHub, open **https://github.com/zaighaumrana/NoshTech-Wrapper**. With GitHub Free, a repository must be **public** for GitHub Pages; consider using a **separate demo repository** if you do not want to expose the project's source. The app itself is also accessible by anyone at the public website, though each staff area requires authentication.
2. Upload/commit all of this updated project, **including** `.github/workflows/` and `android-webview/`, into the repository's `main` branch. `node_modules` and `.env.local` should NOT be uploaded. GitHub Desktop can do this.
3. Repository → **Settings → Secrets and variables → Actions → New repository secret**. Create both:
   - `VITE_SUPABASE_URL` = your actual Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your public publishable key
4. Repository → **Settings → Pages → Build and deployment → Source**: choose **GitHub Actions**.
5. Repository → **Actions** → **Publish NoshTech Web Demo** → **Run workflow** if it hasn't run since setting up secrets. Wait until the job shows a green check.
6. Website URL: **https://zaighaumrana.github.io/NoshTech-Wrapper/**. Open this link and sign in to test.

The deployment is intentionally excluded from search indexing (`noindex`, `robots.txt`). The app does not provide public registration, making the demo easier to control.

**If you use a different repository name or GitHub account**: edit `VITE_BASE_PATH: /NoshTech-Wrapper/` in `.github/workflows/pages.yml` and `APP_URL` / host in `android-webview/app/src/main/java/com/noshtech/demo/MainActivity.java` to match the *new* GitHub Pages URL. The project is also Cloudflare Pages-compatible: use `npm run build`, output `dist`, and configure the same two VITE environment variables there, with no `VITE_BASE_PATH`.

## 4. Get an installable Android APK for FREE

The `.github/workflows/android-apk.yml` workflow builds a debug APK in GitHub Actions. This uses the standard Android SDK and the supplied `android-webview/` source. It does **not** require you to install Android Studio.

1. Push these files to the GitHub repo.
2. First complete **Step 3** so the hosted page works.
3. GitHub repo → **Actions** → **Build NoshTech Android APK** → **Run workflow**. It also builds automatically when you push to `main`.
4. Open the successful run → **Artifacts** → download **NoshTech-demo-APK**.
5. Unzip the downloaded artifact and copy `app-debug.apk` to an Android phone.
6. Open the APK on your phone and grant the normal *Install unknown apps* permission if Android asks. This is a debug/demo install, **not** a Play Store release.
7. Repeat on the owner's, waiter's, counter's and kitchen's phones. All four devices access the same Supabase backend with different accounts.

The Android app is deliberately a thin **hosted WebView** rather than a large second codebase. It always loads the currently deployed GitHub Pages version. **Internet access is required**. The app won't work if the GitHub Pages website has not been published successfully.

## 5. Restaurant demo script (about 3 minutes)

- **Owner:** login, open Team & permissions, assign another user as waiter, another as counter and another as kitchen. Open the analytics tab and show that sales are currently zero.
- **Waiter:** login on phone A, select Table 05, add 2 × Dal Chawal Full + 2 × Water 500ml, tap **Send to counter**. Amount: **Rs. 540**. It now says **Awaiting counter**.
- **Kitchen:** login on phone C, confirm it does **not** yet see that pending order.
- **Accounts / POS:** login on phone B, approve Table 05. The order moves into the **Kitchen queue**.
- **Kitchen:** ticket appears; tap **Start preparing**, then **Mark ready**.
- **Waiter:** the same order is now **Ready to serve**; tap **Served to table**.
- **Accounts / POS:** tap **Collect Rs. 540** on the open order to record payment.
- **Owner:** return to Analytics, set date to Today and confirm revenue = **Rs. 540**, 1 paid order and 4 portions/items sold. Search **Dal Chawal** to filter matching receipts. Try 7 days, 30 days and custom dates.

Updates normally arrive over Realtime. If a connection drops, the app refreshes every 10 seconds and when a screen regains focus. Logins persist separately on each phone. Times and daily reports use Pakistan Standard Time.

## 6. Limitations for this prototype

This is a **single-restaurant online demonstration** (no multi-tenancy). The owner assigns roles to users that you create from the Supabase Auth dashboard. It does not support creating login accounts inside the owner UI, discounts, tax, split bills, refunds, receipt printers, inventory, direct kitchen placement, online payments or offline mode. It is not yet a production POS. The site displays up to the 500 most recent orders, more than sufficient for the demo. Menu prices live in `menu_variants`; old order line prices remain snapshotted. Realtime and staff access are protected with RLS, and order changes are validated in Postgres RPC functions.

**Useful commands:** `npm test` for small domain tests, `npm run build` for a deployment build, `npm run dev` for local testing.
