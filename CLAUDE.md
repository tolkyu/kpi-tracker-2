# KPI Tracker — Project Index

## Overview

Support team KPI tracker. **Version 2** adds a Node/Express + SQLite persistence layer on top of what was originally a pure frontend app. Serves the same `index.html`/`app.js`/`style.css` frontend via `express.static`, with a REST API for CRUD.

**Stack:** Node.js · Express 4 · better-sqlite3 · Vanilla JS (no build tools, no framework)

---

## Project Structure

```
kpi-tracker-2/
├── server.js       — Express server + SQLite schema + REST API
├── app.js          — All frontend logic (KPI engine, date picker, auth, CRUD)
├── index.html      — App shell: login, main view, add/edit modal, FAQ modal
├── style.css       — Design tokens + all component styles (DM Sans / DM Mono fonts)
├── package.json    — Dependencies: express, better-sqlite3
├── data.db         — SQLite database (gitignored, auto-created on first run)
└── README.md       — User-facing setup guide and KPI formula reference
```

---

## Running the App

```bash
npm install
npm start           # → http://localhost:3000
```

Default credentials (hardcoded in `app.js`): `admin` / `admin123`

---

## Architecture

### Backend — `server.js`

Single-file Express server. Handles schema creation, seed data, and four REST routes. No auth middleware — authentication is frontend-only.

**SQLite schema (`employees` table):**

| Column       | Type    | Notes                              |
|--------------|---------|------------------------------------|
| `id`         | INTEGER | PK autoincrement                   |
| `period_key` | TEXT    | e.g. `month-2026-05`, `preset-last7`, `custom-2026-01-01-2026-01-31` |
| `name`       | TEXT    |                                    |
| `done`       | INTEGER | Tasks completed (total)            |
| `own`        | INTEGER | Tasks closed own (before deadline) |
| `l1`         | INTEGER | Overdue < 1 day                    |
| `l2`         | INTEGER | Overdue 1–3 days                   |
| `l3`         | INTEGER | Overdue > 3 days                   |
| `help`       | INTEGER | Times assisted a colleague         |
| `hdone`      | INTEGER | Colleague tasks closed together    |
| `blk`        | INTEGER | Blocker reports filed              |

Seeds 5 sample employees into `month-2026-05` on first run (when table is empty).

### REST API

| Method   | Route                    | Body                        | Returns            |
|----------|--------------------------|-----------------------------|--------------------|
| GET      | `/api/periods/:key`      | —                           | `Employee[]`       |
| POST     | `/api/employees`         | `{ periodKey, name, ...metrics }` | `{ id }`     |
| PUT      | `/api/employees/:id`     | `{ name, ...metrics }`      | `{ ok: true }`     |
| DELETE   | `/api/employees/:id`     | —                           | `{ ok: true }`     |

All routes return JSON. No pagination — periods are expected to have O(10s) of employees.

### Frontend — `app.js`

Pure vanilla JS (~584 lines). Structured into logical sections:

| Section            | Key Functions / State                                        |
|--------------------|--------------------------------------------------------------|
| Config & state     | `CREDS`, `periodKey`, `periodLabel`, `allData` cache         |
| Period/date picker | `openDatePicker`, `closeDatePicker`, `commitDatePicker`, `applyPreset`, `handleDayClick` |
| Date utilities     | `dateKey`, `dateFromKey`, `startOfDay`, `addDays`, `fmtDate` |
| KPI engine         | `calcKPI(e)`, `grade(total)`                                 |
| Render             | `render()` → `renderSummary()` + `renderTable()`             |
| Modal (add/edit)   | `openModal`, `closeModal`, `saveModal`, `delEmp`             |
| Auth               | Login/logout event listeners                                 |
| FAQ                | `closeFaq()`, event listeners                                |

**Data flow:** Login → `loadPeriod(key)` fetches `/api/periods/:key` → data stored in `allData[key]` → `render()` recalculates KPI and rebuilds DOM.

**Period key format:**
- Monthly: `month-YYYY-MM`
- Preset: `preset-{presetId}` (e.g. `preset-last7`)
- Custom: `custom-YYYY-MM-DD-YYYY-MM-DD`

---

## KPI Formula

Calculated in `calcKPI(e)` in `app.js:282`.

```
KPI = Output×0.35 + Deadline×0.25 + Throughput×0.20 + Teamwork×0.15 + Transparency×0.05
```

| Block        | Weight | Formula                                                          | Fields used        |
|--------------|--------|------------------------------------------------------------------|--------------------|
| Output       | 35%    | `own / done × 100`                                               | `own`, `done`      |
| Deadline     | 25%    | `MAX(0, 1 − (l1×0.5 + l2×1.0 + l3×2.0) / done) × 100`         | `l1`,`l2`,`l3`,`done` |
| Throughput   | 20%    | `MIN(done / teamAvg × 100, 100)`                                 | `done`             |
| Teamwork     | 15%    | `MIN(help/4×100, 100) × (hdone / help)`                          | `help`, `hdone`    |
| Transparency | 5%     | `MIN(blk × 20, 100)`                                             | `blk`              |

**Grade scale** (`grade()` in `app.js:297`):

| Score   | Label                |
|---------|----------------------|
| 90–100  | ⭐ Exceeds expectations |
| 75–89   | ✓ Meets expectations  |
| 55–74   | ⚠ Needs improvement   |
| 0–54    | ✕ Below expectations  |

---

## Frontend UI Components

### Login screen (`#login-screen`)
- Fields: `#inp-user`, `#inp-pass`
- Button: `#btn-login`
- Error: `#login-err`
- Auth is purely client-side; `CREDS` object at top of `app.js`

### Main screen (`#main-screen`)
- Topbar with period label (`#tb-period`), FAQ button, Sign out
- Summary cards (`#sum-grid`): Team size, Avg KPI, On track, Needs attention
- Grade legend (static HTML)
- Table (`#tbl-body`): 15-column employee table with computed KPI sub-scores

### Date picker (`#period-picker`)
- Dual-month calendar rendered via `renderMonth()`
- 8 preset options + custom range
- State: `dpStart`, `dpEnd`, `dpSelecting`, `dpHover`, `dpCalYear`, `dpCalMonth`

### Add/Edit modal (`#modal`)
- 9 input fields (name + 8 metrics)
- `editingId` global tracks whether we're adding or editing
- Save calls PUT or POST depending on `editingId`

### FAQ modal (`#faq-modal`)
- Static content, written in Ukrainian
- Explains all 5 KPI blocks with formulas and data sources

---

## Configuration Points

| What to change                | Where                                   |
|-------------------------------|-----------------------------------------|
| Login credentials             | `CREDS` at top of `app.js`              |
| Default period on login       | `periodKey` / `periodLabel` in `app.js` |
| Server port                   | `PORT` env var (default 3000)           |
| Seed data (initial employees) | `server.js:31–37`                       |
| Period dropdown options       | `PRESETS` array in `app.js:53`          |
| KPI formula weights           | `calcKPI()` in `app.js:292`             |

---

## Key Design Decisions

- **No real auth:** Login is client-side only — anyone who can reach the app can authenticate. This is intentional for an internal team tool.
- **Period-keyed data:** Employees are stored per-period rather than as a single record, so each month/range is an independent snapshot.
- **No ORM:** Raw SQL via better-sqlite3 (synchronous API) — keeps it simple, no migrations needed given the single-table schema.
- **In-memory cache:** `allData` caches fetched periods client-side, avoiding redundant API calls when switching back to a previously-loaded period.
