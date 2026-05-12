# KPI Tracker — Support Team

A lightweight, zero-dependency web app for tracking support team KPIs. Built with plain HTML, CSS, and JavaScript — no build tools, no npm, no frameworks.

---

## Project structure

```
kpi-tracker/
├── index.html   — app shell & markup
├── style.css    — all styles & design tokens
├── app.js       — KPI logic, state, event handlers
└── README.md    — this file
```

---

## How to run locally

### Option A — VS Code Live Server (recommended, 1 click)

1. Open VS Code
2. Install the **Live Server** extension
   - Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
   - Search: `Live Server` by Ritwick Dey
   - Click **Install**
3. Open the `kpi-tracker` folder in VS Code (`File → Open Folder`)
4. Right-click `index.html` in the Explorer panel → **Open with Live Server**
5. Browser opens automatically at `http://127.0.0.1:5500`

Any file you save auto-reloads the browser.

---

### Option B — Python (no extensions needed)

If you have Python installed, open a terminal in the `kpi-tracker` folder and run:

```bash
# Python 3
python -m http.server 3000
```

Then open `http://localhost:3000` in your browser.

---

### Option C — Node.js serve

```bash
npx serve .
```

Then open the URL shown in the terminal (usually `http://localhost:3000`).

---

## Login credentials

| Field    | Value      |
|----------|------------|
| Username | `admin`    |
| Password | `admin123` |

To change credentials, edit the top of `app.js`:

```js
const CREDS = { login: 'admin', pass: 'admin123' };
```

---

## KPI formula

| Block            | Weight | Logic                                              |
|------------------|--------|----------------------------------------------------|
| Output quality   | 35%    | `closed_own / tasks_done × 100`                    |
| Deadline quality | 25%    | Penalty: `<1d×0.5`, `1-3d×1.0`, `>3d×2.0`        |
| Throughput       | 20%    | Employee output vs team average                    |
| Teamwork         | 15%    | Assist frequency × help efficiency                 |
| Transparency     | 5%     | `MIN(blocker_reports × 20, 100)`                   |

### Grade scale

| Score  | Grade                |
|--------|----------------------|
| 90–100 | ⭐ Exceeds expectations |
| 75–89  | ✓ Meets expectations   |
| 55–74  | ⚠ Needs improvement    |
| 0–54   | ✕ Below expectations   |

---

## Customising

### Add more period options
In `index.html`, find the `<select id="period-sel">` block and add `<option>` entries.

### Change the default team data
In `app.js`, edit the `employees` array at the top of the file.

### Persist data between sessions
Currently data resets on page refresh. To save it, replace the `employees` array with `localStorage`:

```js
// Load
let employees = JSON.parse(localStorage.getItem('kpi-employees') || 'null') || defaultEmployees;

// Save (call after every mutation)
function save() { localStorage.setItem('kpi-employees', JSON.stringify(employees)); }
```

Call `save()` inside `saveModal()` and `delEmp()`.
