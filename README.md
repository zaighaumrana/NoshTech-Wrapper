# NoshTech Restaurant POS Demo

A browser-local restaurant demonstration built with React, Vite, JavaScript, and plain CSS. No backend, login, environment variables, or database is needed.

## Start locally

Install Node.js (22.12 or newer), open a terminal in this project folder, and run:

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. On future visits, only `npm run dev` is needed. Vite updates the page automatically when source files change. Port 5173 is fixed; stop any other application using that port first.

## Try a service

- **Waiter:** select a table, select portions, add items, adjust quantities, and send to the kitchen. Revisit the table to add more items. Only the additional items create a new preparation batch. Mark ready food served, then request billing when the visit is finished. Send or clear any unsent items before requesting a bill.
- **Kitchen:** tickets from both ordering screens move from Pending to Preparing to Ready. Added items have their own batch under the original order number. Ready dine-in tickets disappear after service. Unfinished food remains visible even if its table is paid.
- **POS / Cash counter:** monitor all orders, open or print requested bills, and confirm payments. Dine-in payment closes the table. Create takeaway orders here; their bill is available immediately. Record payment, wait for kitchen readiness, then mark Handed over / Close. Takeaways cannot receive additional items after placement.
- **Analytics** inside POS shows today's recorded payments, revenue, item sales, and quantities by portion. Unpaid bills do not count. All dates use the browser's local timezone.

Start empty, or choose **Load sample orders** for a presentation. Loading samples asks for confirmation and replaces the entire session, so sample transactions never silently merge into existing orders. **Reset demo** also asks for confirmation and clears all saved orders and payments. Both actions affect other open tabs.

Data survives refresh through localStorage. Open multiple tabs at the same localhost address (or the same deployed URL) to demonstrate updates across screens. This is a single-browser demo: different devices, browser profiles, and origins do not share data. Clearing browser storage removes the session. It is intended for sequential demonstration actions, not simultaneous production transactions.

## Add your menu pictures

Copy JPG photos into **public/images/** using exactly these names:

| Menu item | Filename |
|---|---|
| Dal Chawal Plate | dal-chawal.jpg |
| Dal | dal.jpg |
| Anda | anda.jpg |
| Shami | shami.jpg |
| Water | water.jpg |
| Cold Drinks | cold-drinks.jpg |

The app uses `/images/` paths and one shared menu definition across all screens. Until files exist, illustrated placeholders appear automatically. After adding photos, reload the browser; no code changes are required.

## Production build and preview

```sh
npm run build
npm run preview
```

The build creates **dist/**, including all public assets. Preview opens at **http://localhost:4173**. `npm test` verifies the state transitions and accounting.

## Cloudflare Pages

Connect **zaighaumrana/NoshTech-Wrapper** in Cloudflare Pages with these settings:

| Setting | Value |
|---|---|
| Framework | React / Vite |
| Production branch | main |
| Root directory | repository root (leave blank) |
| Build command | npm run build |
| Build output directory | dist |
| Environment variables | None |

No Workers, Pages Functions, or additional infrastructure are needed. Navigation stays on the root page, so refresh works without redirect rules. The app includes `robots.txt`, noindex metadata, and `_headers` to discourage indexing and apply basic static security headers. This does not make the preview URL private.

To update images later, copy the six files into public/images/, commit and push to main. Cloudflare Pages will rebuild and show them on the next deployment.
