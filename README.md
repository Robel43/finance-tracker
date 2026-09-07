# BirrTrack — Ethiopian Calendar Personal Finance Tracker

A dependency-free, fully offline PWA designed for personal use in Ethiopia.

## Included

- Ethiopian calendar date entry (13 months)
- Pagumen transactions grouped into Nehase for monthly reports
- Income and expense tracking, with emoji-labeled categories and accounts
- Default categories based on the supplied workbook — add, rename, or delete your own from Settings
- Accounts: BOA, Telebirr, CBE, Cash — each with its own emoji, editable
- Loans given to people, with principal repayments tracked separately from income; loans and repayments can be edited/deleted
- Transfers between your own accounts, with visible transfer history and edit/delete controls
- Monthly income/expense comparison and two-month category comparison
- JSON backup/restore
- CSV transaction export
- IndexedDB local storage only
- Installable PWA + offline service worker

## Built for fast manual entry

Since every transaction is typed in by hand, this version adds:

- **Last-used account/category defaults** — a new transaction opens pre-filled with what you used last time.
- **Duplicate (⧉) and edit (✎) on every transaction** — resubmit a similar entry or fix a typo without deleting and retyping.
- **Quick-add amount chips** in the transaction form (+50 / +100 / +200 / +500 / +1000).
- **Recurring templates** (Settings → Recurring templates) — save things like Salary or Rent once, then log them in one tap from the Dashboard's Quick log row.
- **Monthly-first transaction history** — Transactions opens on the selected/current Ethiopian financial month (Pagumen rolls into Nehase), with an All time switch for full history.
- **Search and filter** on the Transactions page — by text, type, account, or category.
- **Category management** — add, rename, or delete categories (with an emoji picker) from Settings; a category in use can't be deleted until it's no longer referenced.
- **Account management** — rename/re-emoji accounts and safely delete unused accounts; accounts referenced by transactions, loans, repayments, transfers, or templates are protected from deletion.

## Run locally

A PWA service worker needs HTTP/HTTPS, so do not open index.html directly as a file.

From this folder run one of:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

For real installation on your phone, host this folder on an HTTPS static host (GitHub Pages, Cloudflare Pages, Netlify). A plain PC-hotspot IP over HTTP will not allow the service worker to register, so the app won't be fully installable/offline that way — use HTTPS for the real install, and your local hotspot only for quick testing.

After the first HTTPS visit, install it from the browser menu ("Add to Home Screen") and it will work fully offline afterward — your data stays in IndexedDB on your phone.

## Deploy to your GitHub repository

Repository: `https://github.com/Robel43/finance-tracker.git`

Put the files in this folder at the **repository root** (so `index.html` is at the top level), commit, and push to `main`. Then in GitHub open **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/(root)`, and save.

The project uses only relative URLs, so it works correctly from the GitHub Pages project path (`/finance-tracker/`). After an update, an already-installed PWA may need to be closed/reopened or refreshed once so the new service worker cache takes control. Existing IndexedDB finance data is preserved across normal app updates.

## Privacy

The app contains no analytics, login, API calls, cloud database, external fonts, or third-party scripts.

## Backup

Use Settings → Export JSON backup regularly. Restoring a backup replaces the current local dataset after showing a preview. Upgrading from an older BirrTrack version keeps your existing data — a new "templates" store is added automatically the first time you open the updated app.
