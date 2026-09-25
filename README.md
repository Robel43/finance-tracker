# BirrTrack — Ethiopian Calendar Personal Finance Tracker

BirrTrack is a lightweight, dependency-free personal finance Progressive Web App (PWA) built for Ethiopian calendar-based money tracking. It runs entirely in the browser, works offline after installation, and stores financial data locally on the device using IndexedDB.

**Live app:** https://robel43.github.io/finance-tracker/

## Core features

- Ethiopian calendar date entry with all 13 months
- Pagumen transactions included in Nehase for monthly financial reporting
- Income and expense tracking
- Custom income and expense categories with emoji labels
- Multiple accounts such as bank accounts, mobile wallets, and cash
- Account-to-account transfers
- Personal loans and principal repayment tracking
- JSON backup and restore
- CSV transaction export
- Fully local IndexedDB storage
- Installable PWA with offline service worker
- Responsive mobile interface
- Light mode and persistent dark mode

## Dashboard

The redesigned dashboard gives a quick monthly financial overview:

- Total available balance across all accounts
- Monthly Income, Expenses, and Net
- Outstanding money loaned to other people
- Savings rate
- Highest expense category
- Expense change compared with the previous month
- Average monthly expense
- Six-month Income vs Expenses trend
- Recent transactions
- Expense-category summary
- Quick logging from recurring templates

### Income and expense breakdown

The **Income** and **Expenses** cards on the dashboard are interactive.

Tap **Income** or **Expenses** to see the selected month's overall breakdown. Entries using the same category are automatically combined into one monthly category total.

For example, if Transportation is entered several times during the month, BirrTrack shows one combined **Transportation** total.

Each category breakdown shows:

- Combined monthly amount
- Number of entries in that category
- Percentage of total monthly income or expenses
- A proportional visual bar
- Expandable individual entries
- A shortcut to open the Transactions page already filtered to that month and type

## Financial insights

BirrTrack calculates useful insights directly from your local transaction data:

- Monthly savings rate
- Top expense category
- Expense increase or decrease compared with the previous month
- Average monthly expense for the selected Ethiopian year
- Six-month Income vs Expenses trend

The six-month chart is interactive. Tap an Income or Expenses bar to display its exact ETB value.

## Compare

The Compare page supports both annual and month-to-month analysis:

- Year-to-date Income
- Year-to-date Expenses
- Year-to-date Net
- Interactive annual Income vs Expenses chart
- Net-only chart mode
- Tap a month to view its exact Income, Expenses, Net, and entry count
- Open the selected month's transactions directly
- Compare any two Ethiopian financial months
- Compare expense-category movement between two months

Pagumen remains included in Nehase for financial reporting.

## Accounts and balance history

Each account has its own calculated balance based on:

- Opening balance
- Income
- Expenses
- Loans given
- Loan repayments received
- Transfers between accounts

Tap **History** on an account to see:

- Monthly closing-balance history
- Recent account activity
- Incoming and outgoing transfers
- Loan activity
- Income and expense movements

Accounts that are still referenced by transactions, loans, repayments, transfers, or templates are protected from accidental deletion.

## Faster transaction entry

BirrTrack is designed for frequent manual entry on a phone.

The transaction form includes:

- Separate Income / Expense toggle
- Large mobile-friendly amount field
- Quick-add amount buttons
- Recent amount shortcuts
- Last-used account and category defaults
- **Today** shortcut for the Ethiopian date
- Repeat a recent transaction
- Duplicate and edit existing transactions
- Search and filtering by text, type, account, and category
- Monthly-first transaction history with an All time option

## Recurring templates

Create reusable entries from **Settings → Recurring templates** for transactions such as:

- Salary
- Rent
- Internet
- Transport
- Regular household expenses

Saved templates appear in the Dashboard's **Quick log** section for one-tap entry.

## Dark mode

BirrTrack includes Light and Dark themes.

Use the moon/sun button in the top bar or the Appearance option in Settings. The selected theme is remembered on the device. On first use, BirrTrack can follow the device's preferred color scheme.

## Install on Android

1. Open Chrome on your phone.
2. Visit https://robel43.github.io/finance-tracker/
3. Wait for the app to finish loading.
4. Open Chrome's menu.
5. Choose **Install app** or **Add to Home screen**.
6. Confirm installation.
7. Open BirrTrack from the new home-screen icon.

After the first successful online load, BirrTrack can operate offline.

## Install on iPhone

1. Open Safari.
2. Visit https://robel43.github.io/finance-tracker/
3. Tap **Share**.
4. Choose **Add to Home Screen**.
5. Confirm **Add**.
6. Launch BirrTrack from the home-screen icon.

## Run locally

Because BirrTrack is configured for the GitHub Pages project path **/finance-tracker/**, the easiest local setup is to serve the parent folder of the repository.

Example:

```text
Projects/
└── finance-tracker/
    ├── index.html
    ├── app.js
    ├── styles.css
    ├── manifest.webmanifest
    └── sw.js
```

From the **Projects** folder run:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/finance-tracker/
```

This keeps the local URL structure consistent with the GitHub Pages deployment path.

## GitHub Pages deployment

Repository:

```text
https://github.com/Robel43/finance-tracker.git
```

The production site is deployed from the `main` branch using GitHub Pages:

```text
https://robel43.github.io/finance-tracker/
```

The manifest, PWA scope, start URL, and icon paths are configured for the `/finance-tracker/` project path.

After a new deployment, an installed PWA may need to be refreshed or completely closed and reopened once so the updated service worker takes control.

Normal application updates do **not** delete existing IndexedDB finance data.

## Backup and restore

Your financial data is stored locally on the device, not in the GitHub repository.

Use:

**Settings → Export JSON backup**

regularly and keep the exported file somewhere safe.

Restoring a JSON backup replaces the current local dataset after showing a preview.

CSV export is also available for transaction analysis outside BirrTrack.

## Privacy

BirrTrack currently uses:

- No analytics
- No login
- No cloud database
- No advertising
- No external fonts
- No third-party scripts
- No remote financial-data API

Financial records remain in the device's browser storage unless the user explicitly exports a backup.

## Technology

BirrTrack intentionally keeps the stack small:

- HTML
- CSS
- Vanilla JavaScript
- IndexedDB
- Service Worker
- Web App Manifest
- GitHub Pages

No framework or runtime dependency is required.
