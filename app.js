/* ─────────────────────────────────────────────────────────────
   KPI Tracker — Support Team
   app.js  |  Pure vanilla JS, no dependencies
   ───────────────────────────────────────────────────────────── */

// ── Config ────────────────────────────────────────────────────
const CREDS = { login: 'admin', pass: 'admin123' };

// ── Period state ──────────────────────────────────────────────
const _MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _now = new Date();
const _mm  = String(_now.getMonth() + 1).padStart(2, '0');
let periodKey   = `month-${_now.getFullYear()}-${_mm}`;
let periodLabel = `${_MONTHS_LONG[_now.getMonth()]} ${_now.getFullYear()}`;

// ── Data cache (populated from server per period) ─────────────
const allData = {};

let editingId = null;

function emps() {
  if (!allData[periodKey]) allData[periodKey] = [];
  return allData[periodKey];
}

async function loadPeriod(key) {
  const res = await fetch(`/api/periods/${encodeURIComponent(key)}`);
  allData[key] = await res.json();
}

// ── Date utilities ─────────────────────────────────────────────
const MON_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MON_LONG   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function pad(n) { return String(n).padStart(2, '0'); }

function dateKey(d)    { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function dateFromKey(k){ const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d); }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d,n)  { const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function sameDay(a,b)  { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function fmtDate(d)    { return `${d.getDate()} ${MON_SHORT[d.getMonth()]}, ${d.getFullYear()}`; }

// ── Date picker state ─────────────────────────────────────────
let dpOpen         = false;
let dpActivePreset = null;
let dpStart        = null;
let dpEnd          = null;
let dpSelecting    = false;
let dpHover        = null;
let dpCalYear      = new Date().getFullYear();
let dpCalMonth     = new Date().getMonth() - 1 < 0 ? 11 : new Date().getMonth() - 1;

// ── Presets ───────────────────────────────────────────────────
const PRESETS = [
  { id: 'last7',     label: 'Last 7 days'    },
  { id: 'last14',    label: 'Last 14 days'   },
  { id: 'lastmonth', label: 'Last month'     },
  { id: 'last3m',    label: 'Last 3 months'  },
  { id: 'last12m',   label: 'Last 12 months' },
  { id: 'mtd',       label: 'Month to date'  },
  { id: 'alltime',   label: 'All time'       },
  { id: 'custom',    label: 'Custom'         },
];

function getPresetRange(id) {
  const today = startOfDay(new Date());
  switch (id) {
    case 'last7':     return { start: addDays(today,-6),   end: today };
    case 'last14':    return { start: addDays(today,-13),  end: today };
    case 'lastmonth': return { start: new Date(today.getFullYear(), today.getMonth()-1, 1),
                               end:   new Date(today.getFullYear(), today.getMonth(), 0) };
    case 'last3m':    return { start: addDays(today,-89),  end: today };
    case 'last12m':   return { start: addDays(today,-364), end: today };
    case 'mtd':       return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
    case 'alltime':   return { start: new Date(2020,0,1),  end: today };
    default:          return { start: null, end: null };
  }
}

// ── Date picker: open / close ─────────────────────────────────
function openDatePicker() {
  dpOpen = true;
  const today = new Date();
  dpCalYear  = today.getFullYear();
  dpCalMonth = today.getMonth() - 1;
  if (dpCalMonth < 0) { dpCalMonth = 11; dpCalYear--; }
  document.getElementById('period-picker').classList.add('open');
  renderDatePickerFull();
  positionPanel();
}

function positionPanel() {
  const btn   = document.getElementById('period-btn');
  const panel = document.getElementById('dp-panel');
  const rect  = btn.getBoundingClientRect();
  const gap   = 6;

  panel.style.top  = (rect.bottom + gap) + 'px';
  panel.style.left = 'auto';
  panel.style.right = 'auto';

  // Align right edge of panel to right edge of button; shift left if it overflows
  const panelW = panel.offsetWidth || 680;
  let left = rect.right - panelW;
  if (left < 8) left = 8;
  panel.style.left = left + 'px';
}

function closeDatePicker() {
  dpOpen = false;
  dpSelecting = false;
  dpHover = null;
  document.getElementById('period-picker').classList.remove('open');
}

function getRightCal() {
  let m = dpCalMonth + 1, y = dpCalYear;
  if (m > 11) { m = 0; y++; }
  return { year: y, month: m };
}

// ── Date picker: render ───────────────────────────────────────
function renderDatePickerFull() {
  const r = getRightCal();
  document.getElementById('dp-left-title').textContent  = `${MON_LONG[dpCalMonth]} ${dpCalYear}`;
  document.getElementById('dp-right-title').textContent = `${MON_LONG[r.month]} ${r.year}`;
  renderMonth(dpCalYear, dpCalMonth, document.getElementById('dp-month-left'));
  renderMonth(r.year, r.month,       document.getElementById('dp-month-right'));
  updateCellClasses();
  updatePresets();
  updateRangeDisplay();
}

function renderMonth(year, month, container) {
  const firstDay  = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  let html = `<table class="dp-cal-table"><thead><tr>`;
  DOW_LABELS.forEach(lbl => { html += `<th>${lbl}</th>`; });
  html += `</tr></thead><tbody>`;

  let day = 1 - firstDay;
  for (let row = 0; row < 6; row++) {
    if (day > totalDays) break;
    html += '<tr>';
    for (let col = 0; col < 7; col++, day++) {
      if (day < 1 || day > totalDays) {
        html += `<td class="dp-cell dp-empty"><span></span></td>`;
      } else {
        html += `<td class="dp-cell" data-date="${year}-${pad(month+1)}-${pad(day)}"><span>${day}</span></td>`;
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function updateCellClasses() {
  const eff    = dpEnd || (dpSelecting && dpHover ? dpHover : null);
  const rangeS = (dpStart && eff) ? (dpStart <= eff ? dpStart : eff) : null;
  const rangeE = (dpStart && eff) ? (dpStart <= eff ? eff : dpStart) : null;
  const today  = startOfDay(new Date());

  document.querySelectorAll('.dp-cell[data-date]').forEach(cell => {
    const d       = dateFromKey(cell.dataset.date);
    const isStart = dpStart && sameDay(d, dpStart);
    const isEnd   = eff     && sameDay(d, eff);
    const single  = isStart && isEnd;
    const inRange = rangeS && rangeE && d > rangeS && d < rangeE;

    cell.className = 'dp-cell';
    if (single)       cell.classList.add('dp-sel-single');
    else if (isStart) cell.classList.add('dp-sel-start');
    else if (isEnd)   cell.classList.add('dp-sel-end');
    if (inRange)      cell.classList.add('dp-in-range');
    if (sameDay(d, today)) cell.classList.add('dp-today');
  });
}

function updatePresets() {
  document.querySelectorAll('.dp-preset').forEach(el => {
    el.classList.toggle('dp-preset-active', el.dataset.preset === dpActivePreset);
  });
}

const ARROW_SVG = `<svg viewBox="0 0 14 8" style="width:13px;height:8px;fill:none;stroke:currentColor;stroke-width:1.5;vertical-align:middle;opacity:.35;flex-shrink:0"><line x1="0" y1="4" x2="11" y2="4"/><polyline points="8,1 12,4 8,7"/></svg>`;

function updateRangeDisplay() {
  const rd  = document.getElementById('dp-range-display');
  const eff = dpEnd || (dpSelecting && dpHover ? dpHover : null);

  if (dpStart && eff) {
    const s = dpStart <= eff ? dpStart : eff;
    const e = dpStart <= eff ? eff : dpStart;
    rd.innerHTML = `<span class="dp-rdate">${fmtDate(s)}</span>${ARROW_SVG}<span class="dp-rdate">${fmtDate(e)}</span>`;
    rd.style.display = 'flex';
  } else if (dpStart && dpSelecting) {
    rd.innerHTML = `<span class="dp-rdate">${fmtDate(dpStart)}</span>${ARROW_SVG}<span class="dp-rdate dp-rdate-muted">Select end date</span>`;
    rd.style.display = 'flex';
  } else {
    rd.style.display = 'none';
  }
}

function handleDayClick(dateStr) {
  const d = dateFromKey(dateStr);
  if (!dpSelecting || dpEnd) {
    dpStart = d; dpEnd = null; dpSelecting = true; dpHover = null;
  } else {
    if      (sameDay(d, dpStart)) { dpEnd = d; }
    else if (d < dpStart)         { dpEnd = dpStart; dpStart = d; }
    else                          { dpEnd = d; }
    dpSelecting = false; dpHover = null;
  }
  dpActivePreset = 'custom';
  updateCellClasses();
  updatePresets();
  updateRangeDisplay();
}

function applyPreset(id) {
  dpActivePreset = id;
  if (id === 'custom') {
    dpStart = null; dpEnd = null; dpSelecting = false;
    updateCellClasses(); updatePresets(); updateRangeDisplay();
    return;
  }
  const { start, end } = getPresetRange(id);
  dpStart = start; dpEnd = end; dpSelecting = false; dpHover = null;

  if (end) {
    dpCalMonth = end.getMonth() - 1;
    dpCalYear  = end.getFullYear();
    if (dpCalMonth < 0) { dpCalMonth = 11; dpCalYear--; }
  }
  renderDatePickerFull();
}

async function commitDatePicker() {
  if (!dpStart) { closeDatePicker(); return; }
  const s = dpStart, e = dpEnd || dpStart;
  const [fs, fe] = s <= e ? [s, e] : [e, s];

  let key, label;
  if (dpActivePreset && dpActivePreset !== 'custom') {
    const p = PRESETS.find(x => x.id === dpActivePreset);
    key = `preset-${dpActivePreset}`; label = p ? p.label : 'Custom';
  } else {
    key = `custom-${dateKey(fs)}-${dateKey(fe)}`;
    label = `${fmtDate(fs)} – ${fmtDate(fe)}`;
  }
  await switchPeriod(key, label);
  closeDatePicker();
}

async function switchPeriod(key, label) {
  periodKey = key; periodLabel = label;
  document.getElementById('period-btn-label').textContent = label;
  await loadPeriod(key);
  render();
}

async function resetToCurrentPeriod() {
  const t = new Date();
  const key   = `month-${t.getFullYear()}-${pad(t.getMonth()+1)}`;
  const label = `${MON_LONG[t.getMonth()]} ${t.getFullYear()}`;
  dpStart = null; dpEnd = null; dpSelecting = false; dpActivePreset = null;
  await switchPeriod(key, label);
}

// ── KPI Formula ───────────────────────────────────────────────
//
//  Block            Weight  Formula
//  ─────────────────────────────────────────────────────────────
//  Output quality    35%    closed_own / tasks_done × 100
//  Deadline quality  25%    MAX(0, 1 − penalty / done) × 100
//                           penalty = l1×0.5 + l2×1.0 + l3×2.0
//  Throughput        20%    MIN(done / team_avg × 100, 100)
//  Teamwork          15%    MIN(assists/4×100, 100) × help_efficiency
//  Transparency       5%    MIN(blockers × 20, 100)
//
function calcKPI(e) {
  const list    = emps();
  const teamAvg = list.reduce((s,x) => s+x.done, 0) / Math.max(1, list.length);
  const sO = (e.own / Math.max(1, e.done)) * 100;
  const penalty = e.l1*0.5 + e.l2*1.0 + e.l3*2.0;
  const sD = Math.max(0, 1 - penalty / Math.max(1, e.done)) * 100;
  const sT = Math.min(e.done / Math.max(1, teamAvg) * 100, 100);
  const helpEff = e.help > 0 ? Math.min(e.hdone / e.help, 1) : 0;
  const sK = Math.min(e.help / 4 * 100, 100) * helpEff;
  const sB = Math.min(e.blk * 20, 100);
  const total = sO*0.35 + sD*0.25 + sT*0.20 + sK*0.15 + sB*0.05;
  return { sO, sD, sT, sK, sB, total };
}

// ── Grade helper ──────────────────────────────────────────────
function grade(t) {
  if (t >= 90) return { cls:'b-exceeds', label:'Exceeds',     icon:'⭐', acc:'var(--green-acc)' };
  if (t >= 75) return { cls:'b-meets',   label:'Meets',       icon:'✓',  acc:'var(--blue-acc)'  };
  if (t >= 55) return { cls:'b-needs',   label:'Needs impr.', icon:'⚠',  acc:'var(--amber-acc)' };
  return             { cls:'b-below',   label:'Below',        icon:'✕',  acc:'var(--red-acc)'   };
}

// ── Utilities ─────────────────────────────────────────────────
function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
}

function kpiMini(val, color) {
  const w = Math.round(Math.min(val, 100));
  return `<div class="kpi-wrap">
    <span class="kpi-score-sm" style="color:${color}">${val.toFixed(1)}</span>
    <div class="kpi-bar" style="width:${w}%;background:${color};opacity:.65;"></div>
  </div>`;
}

function getVal(id) { return Math.max(0, parseInt(document.getElementById(id).value)||0); }

// ── Render: summary cards ─────────────────────────────────────
function renderSummary() {
  const list   = emps();
  const scores = list.map(e => calcKPI(e).total);
  const avg    = scores.reduce((a,b) => a+b, 0) / Math.max(1, scores.length);
  const exc    = scores.filter(s => s>=90).length;
  const mts    = scores.filter(s => s>=75 && s<90).length;
  const blw    = scores.filter(s => s<55).length;
  const g      = grade(avg);

  document.getElementById('sum-grid').innerHTML = `
    <div class="sum-card">
      <div class="slabel">Team size</div>
      <div class="sval">${list.length}</div>
      <div class="sdesc">members tracked</div>
    </div>
    <div class="sum-card">
      <div class="slabel">Avg KPI</div>
      <div class="sval" style="color:${g.acc}">${list.length ? avg.toFixed(1) : '—'}</div>
      <div class="sdesc">${list.length ? g.icon+' '+g.label : 'no data yet'}</div>
    </div>
    <div class="sum-card">
      <div class="slabel">On track</div>
      <div class="sval" style="color:var(--green-acc)">${exc+mts}</div>
      <div class="sdesc">Exceeds + Meets</div>
    </div>
    <div class="sum-card">
      <div class="slabel">Needs attention</div>
      <div class="sval" style="color:${blw>0?'var(--red-acc)':'var(--muted)'}">${blw}</div>
      <div class="sdesc">${blw===0?'all good':'below expectations'}</div>
    </div>`;
}

// ── Render: table ─────────────────────────────────────────────
function renderTable() {
  const list = emps();
  const thead = `
    <thead><tr>
      <th style="text-align:left;width:195px">Employee</th>
      <th style="width:76px">Tasks done</th>
      <th style="width:76px">Closed own</th>
      <th style="width:72px">O/due&lt;1D</th>
      <th style="width:72px">O/due 1-3D</th>
      <th style="width:72px">O/due&gt;3D</th>
      <th style="width:60px">Assists</th>
      <th style="width:80px">Hlp closure</th>
      <th style="width:62px">Blockers</th>
      <th style="width:72px;background:#F3FAF6;color:var(--green-fg)">Output</th>
      <th style="width:72px;background:#EEF4FC;color:var(--blue-fg)">Deadline</th>
      <th style="width:82px;background:#F5F4FE;color:var(--purple-fg)">Throughput</th>
      <th style="width:72px;background:#FDF8EE;color:var(--amber-fg)">Teamwork</th>
      <th style="width:58px">KPI</th>
      <th style="width:90px;text-align:center">Grade</th>
    </tr></thead>`;

  if (!list.length) {
    document.getElementById('tbl-body').innerHTML =
      `<table>${thead}<tbody><tr><td colspan="15" style="text-align:center;padding:2.5rem;color:var(--muted);font-size:13px">No data for this period — add a team member to get started.</td></tr></tbody></table>`;
    return;
  }

  const rows = list.map(e => {
    const k = calcKPI(e), g = grade(k.total);
    return `<tr>
      <td><div class="emp-cell">
        <div class="avatar">${initials(e.name)}</div>
        <div class="emp-info">
          <div class="ename">${e.name}</div>
          <div class="eperiod">${periodLabel}</div>
        </div>
        <button class="btn-pencil" onclick="openEdit(${e.id})" title="Edit">
          <svg viewBox="0 0 14 14"><path d="M9.5 1.5l3 3-8.5 8.5H1v-3z"/><line x1="7.5" y1="3.5" x2="10.5" y2="6.5"/></svg>
        </button>
        <button class="btn-del-row" onclick="delEmp(${e.id})" title="Remove">
          <svg viewBox="0 0 14 14"><polyline points="1,3 13,3"/><path d="M4,3V1.5h6V3M5,6v5M9,6v5"/><path d="M2,3l1,9h8l1-9"/></svg>
        </button>
      </div></td>
      <td class="num">${e.done}</td><td class="num">${e.own}</td>
      <td class="num">${e.l1}</td><td class="num">${e.l2}</td><td class="num">${e.l3}</td>
      <td class="num">${e.help}</td><td class="num">${e.hdone}</td><td class="num">${e.blk}</td>
      <td style="background:#F7FBF8">${kpiMini(k.sO,'var(--green-acc)')}</td>
      <td style="background:#EFF5FC">${kpiMini(k.sD,'var(--blue-acc)')}</td>
      <td style="background:#F5F4FE">${kpiMini(k.sT,'var(--purple-acc)')}</td>
      <td style="background:#FDFAF3">${kpiMini(k.sK,'var(--amber-acc)')}</td>
      <td style="text-align:center"><span style="font-family:var(--font-mono);font-size:17px;font-weight:600;color:${g.acc}">${k.total.toFixed(1)}</span></td>
      <td style="text-align:center"><span class="badge ${g.cls}">${g.icon} ${g.label}</span></td>
    </tr>`;
  }).join('');

  document.getElementById('tbl-body').innerHTML =
    `<table>${thead}<tbody>${rows}</tbody></table>`;
}

// ── Master render ─────────────────────────────────────────────
function render() {
  renderSummary();
  renderTable();
  document.getElementById('tb-period').textContent        = periodLabel;
  document.getElementById('period-btn-label').textContent = periodLabel;
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(title, sub, id = null) {
  editingId = id;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-sub').textContent   = sub;
  if (id !== null) {
    const e = emps().find(x => x.id === id);
    document.getElementById('m-name').value  = e.name;
    document.getElementById('m-done').value  = e.done;
    document.getElementById('m-own').value   = e.own;
    document.getElementById('m-l1').value    = e.l1;
    document.getElementById('m-l2').value    = e.l2;
    document.getElementById('m-l3').value    = e.l3;
    document.getElementById('m-help').value  = e.help;
    document.getElementById('m-hdone').value = e.hdone;
    document.getElementById('m-blk').value   = e.blk;
  } else {
    document.getElementById('m-name').value = '';
    ['m-done','m-own','m-l1','m-l2','m-l3','m-help','m-hdone','m-blk']
      .forEach(i => { document.getElementById(i).value = '0'; });
  }
  document.getElementById('modal').classList.add('open');
  setTimeout(() => document.getElementById('m-name').focus(), 50);
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editingId = null;
}

function openEdit(id) {
  const e = emps().find(x => x.id === id);
  openModal(`Edit — ${e.name}`, 'Update task data for this period', id);
}

async function saveModal() {
  const name = document.getElementById('m-name').value.trim();
  if (!name) { document.getElementById('m-name').focus(); return; }
  const values = { name,
    done: getVal('m-done'), own:  getVal('m-own'),
    l1:   getVal('m-l1'),   l2:   getVal('m-l2'),  l3: getVal('m-l3'),
    help: getVal('m-help'), hdone:getVal('m-hdone'),blk:getVal('m-blk'),
  };
  if (editingId !== null) {
    await fetch(`/api/employees/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const list = emps();
    const idx = list.findIndex(x => x.id === editingId);
    list[idx] = { ...list[idx], ...values };
  } else {
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodKey, ...values }),
    });
    const { id } = await res.json();
    emps().push({ id, ...values });
  }
  closeModal(); render();
}

async function delEmp(id) {
  if (!confirm('Remove this team member?')) return;
  await fetch(`/api/employees/${id}?periodKey=${encodeURIComponent(periodKey)}`, { method: 'DELETE' });
  allData[periodKey] = emps().filter(e => e.id !== id);
  render();
}

// ── Auth ──────────────────────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', async () => {
  const u = document.getElementById('inp-user').value.trim();
  const p = document.getElementById('inp-pass').value;
  if (u === CREDS.login && p === CREDS.pass) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-screen').style.display  = 'block';
    await loadPeriod(periodKey);
    render();
  } else {
    document.getElementById('login-err').style.display = 'block';
  }
});
document.getElementById('inp-user').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('inp-pass').focus(); });
document.getElementById('inp-pass').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('btn-login').click(); });
document.getElementById('btn-logout').addEventListener('click', () => {
  document.getElementById('main-screen').style.display  = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('inp-user').value = '';
  document.getElementById('inp-pass').value = '';
});

// ── Table controls ────────────────────────────────────────────
document.getElementById('btn-add').addEventListener('click', () => {
  openModal('Add team member', 'Fill in task data for the selected period');
});
document.getElementById('btn-reset-period').addEventListener('click', resetToCurrentPeriod);

// ── Period picker ─────────────────────────────────────────────
document.getElementById('period-btn').addEventListener('click', e => {
  e.stopPropagation();
  dpOpen ? closeDatePicker() : openDatePicker();
});

document.getElementById('dp-prev').addEventListener('click', e => {
  e.stopPropagation();
  dpCalMonth--; if (dpCalMonth < 0) { dpCalMonth = 11; dpCalYear--; }
  renderDatePickerFull();
});

document.getElementById('dp-next').addEventListener('click', e => {
  e.stopPropagation();
  dpCalMonth++; if (dpCalMonth > 11) { dpCalMonth = 0; dpCalYear++; }
  renderDatePickerFull();
});

document.querySelectorAll('.dp-preset').forEach(el => {
  el.addEventListener('click', e => { e.stopPropagation(); applyPreset(el.dataset.preset); });
});

document.getElementById('dp-set').addEventListener('click',    e => { e.stopPropagation(); commitDatePicker(); });
document.getElementById('dp-cancel').addEventListener('click', e => { e.stopPropagation(); closeDatePicker(); });

// Hover & click delegation on calendar grids
const calGrids = document.getElementById('dp-cal-grids');
calGrids.addEventListener('mouseover', e => {
  const cell = e.target.closest('.dp-cell[data-date]');
  if (!cell || !dpSelecting) return;
  dpHover = dateFromKey(cell.dataset.date);
  updateCellClasses(); updateRangeDisplay();
});
calGrids.addEventListener('mouseleave', () => {
  if (!dpSelecting || !dpHover) return;
  dpHover = null; updateCellClasses(); updateRangeDisplay();
});
calGrids.addEventListener('click', e => {
  const cell = e.target.closest('.dp-cell[data-date]');
  if (!cell) return;
  e.stopPropagation();
  handleDayClick(cell.dataset.date);
});

// Close on outside click
document.addEventListener('click', e => {
  if (dpOpen && !document.getElementById('period-picker').contains(e.target)) closeDatePicker();
});

// ── Modal controls ────────────────────────────────────────────
document.getElementById('btn-modal-close').addEventListener('click', closeModal);
document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
document.getElementById('btn-modal-save').addEventListener('click', saveModal);
document.getElementById('modal').addEventListener('click', e => { if(e.target===document.getElementById('modal')) closeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDatePicker(); closeFaq(); closeSyncModal(); closeMappingsModal(); }
});

// ── FAQ ───────────────────────────────────────────────────────
function closeFaq() { document.getElementById('faq-modal').classList.remove('open'); }

document.getElementById('btn-faq').addEventListener('click', () => {
  document.getElementById('faq-modal').classList.add('open');
});
document.getElementById('btn-faq-close').addEventListener('click', closeFaq);
document.getElementById('faq-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('faq-modal')) closeFaq();
});

// ── Toast ─────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, ms = 3500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('toast-show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('toast-show'), ms);
}

// ── Sync modal ────────────────────────────────────────────────
let _syncPreview = null;

function renderSyncBody(data) {
  const { mapped, unmapped, newTotal, skippedTotal } = data;
  const skipNote = skippedTotal ? ` &nbsp;·&nbsp; ${skippedTotal} already synced` : '';
  let html = `<div class="sync-stats">${newTotal} new task${newTotal !== 1 ? 's' : ''}${skipNote}</div>`;

  if (mapped.length) {
    html += `<div class="sync-section-label">Will be synced — ${mapped.length} employee${mapped.length !== 1 ? 's' : ''}</div>
             <div class="sync-rows">`;
    for (const e of mapped) {
      html += `<div class="sync-row sync-row-ok">
        <span class="sync-name">${e.name}</span>
        <span class="sync-tasks">${e.done}&nbsp;task${e.done !== 1 ? 's' : ''}</span>
        <span class="sync-breakdown">on‑time:${e.own}&nbsp; &lt;1d:${e.l1}&nbsp; 1‑3d:${e.l2}&nbsp; 3d+:${e.l3}</span>
      </div>`;
    }
    html += `</div>`;
  }

  if (unmapped.length) {
    html += `<div class="sync-section-label sync-section-warn">Unmapped — will be skipped (${unmapped.length})</div>
             <div class="sync-rows">`;
    for (const e of unmapped) {
      const safeName  = e.asanaName.replace(/'/g, "\\'");
      const safeEmail = e.email.replace(/'/g, "\\'");
      html += `<div class="sync-row sync-row-warn">
        <div class="sync-unm-info">
          <span class="sync-email">${e.email}</span>
          <span class="sync-asana-name">${e.asanaName}</span>
        </div>
        <span class="sync-tasks">${e.done}&nbsp;task${e.done !== 1 ? 's' : ''}</span>
        <button class="btn-map-quick" onclick="quickMapFromSync('${safeEmail}','${safeName}')">+ Map</button>
      </div>`;
    }
    html += `</div>
             <p class="sync-hint">Add a mapping to include these users in future syncs.</p>`;
  }

  if (!mapped.length && !unmapped.length) {
    const msg = skippedTotal
      ? `All ${skippedTotal} tasks for this period are already synced.`
      : 'No completed tasks found in "Manual Done" for this period.';
    html += `<div class="sync-empty">${msg}</div>`;
  }

  return html;
}

async function openSyncModal() {
  _syncPreview = null;
  document.getElementById('sync-period-label').textContent = periodLabel;
  document.getElementById('sync-body').innerHTML = '<div class="sync-loading">Loading from Asana…</div>';
  document.getElementById('btn-sync-apply').disabled = true;
  document.getElementById('btn-sync-apply').textContent = 'Apply sync';
  document.getElementById('sync-modal').classList.add('open');

  try {
    const res  = await fetch(`/api/sync/asana/preview?periodKey=${encodeURIComponent(periodKey)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Sync preview failed');
    _syncPreview = data;
    document.getElementById('sync-body').innerHTML = renderSyncBody(data);
    document.getElementById('btn-sync-apply').disabled = data.mapped.length === 0;
  } catch (err) {
    document.getElementById('sync-body').innerHTML =
      `<div class="sync-error">${err.message}</div>`;
  }
}

function closeSyncModal() {
  document.getElementById('sync-modal').classList.remove('open');
  _syncPreview = null;
}

async function applySyncModal() {
  const btn = document.getElementById('btn-sync-apply');
  btn.disabled = true;
  btn.textContent = 'Applying…';

  try {
    const res  = await fetch('/api/sync/asana', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ periodKey }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Sync failed');
    closeSyncModal();
    await loadPeriod(periodKey);
    render();
    showToast(`Sync complete: ${data.created} added, ${data.updated} updated`);
  } catch (err) {
    document.getElementById('sync-body').insertAdjacentHTML(
      'beforeend',
      `<div class="sync-error" style="margin-top:8px">${err.message}</div>`
    );
    btn.disabled = false;
    btn.textContent = 'Apply sync';
  }
}

function quickMapFromSync(email, asanaName) {
  closeSyncModal();
  document.getElementById('map-email').value = email;
  document.getElementById('map-name').value  = asanaName;
  openMappingsModal();
}

document.getElementById('btn-sync').addEventListener('click', openSyncModal);
document.getElementById('btn-sync-close').addEventListener('click', closeSyncModal);
document.getElementById('btn-sync-cancel').addEventListener('click', closeSyncModal);
document.getElementById('btn-sync-apply').addEventListener('click', applySyncModal);
document.getElementById('sync-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('sync-modal')) closeSyncModal();
});

// ── Mappings modal ────────────────────────────────────────────

function renderMappingsList(mappings) {
  if (!mappings.length) {
    return `<div class="mappings-empty">No mappings yet — add one above.</div>`;
  }
  return `<div class="mappings-list">${
    mappings.map(m => `
      <div class="mapping-row">
        <span class="mapping-email">${m.email}</span>
        <span class="mapping-arrow">→</span>
        <span class="mapping-name">${m.name}</span>
        <button class="btn-del-row" onclick="deleteMapping(${m.id})" title="Remove">
          <svg viewBox="0 0 14 14"><polyline points="1,3 13,3"/><path d="M4,3V1.5h6V3M5,6v5M9,6v5"/><path d="M2,3l1,9h8l1-9"/></svg>
        </button>
      </div>`
    ).join('')
  }</div>`;
}

async function loadMappingsList() {
  try {
    const res  = await fetch('/api/mappings');
    const data = await res.json();
    document.getElementById('mappings-list').innerHTML = renderMappingsList(data);
  } catch (err) {
    document.getElementById('mappings-list').innerHTML =
      `<div class="sync-error">${err.message}</div>`;
  }
}

async function openMappingsModal() {
  document.getElementById('mappings-modal').classList.add('open');
  await loadMappingsList();
  setTimeout(() => document.getElementById('map-email').focus(), 50);
}

function closeMappingsModal() {
  document.getElementById('mappings-modal').classList.remove('open');
  document.getElementById('map-email').value = '';
  document.getElementById('map-name').value  = '';
}

async function saveMapping() {
  const email = document.getElementById('map-email').value.trim();
  const name  = document.getElementById('map-name').value.trim();
  if (!email || !name) {
    document.getElementById(!email ? 'map-email' : 'map-name').focus();
    return;
  }
  try {
    const res  = await fetch('/api/mappings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    document.getElementById('map-email').value = '';
    document.getElementById('map-name').value  = '';
    document.getElementById('map-email').focus();
    await loadMappingsList();
  } catch (err) {
    showToast(err.message);
  }
}

async function deleteMapping(id) {
  if (!confirm('Remove this mapping?')) return;
  await fetch(`/api/mappings/${id}`, { method: 'DELETE' });
  await loadMappingsList();
}

document.getElementById('btn-mappings').addEventListener('click', openMappingsModal);
document.getElementById('btn-mappings-close').addEventListener('click', closeMappingsModal);
document.getElementById('btn-mappings-done').addEventListener('click', closeMappingsModal);
document.getElementById('btn-map-add').addEventListener('click', saveMapping);
document.getElementById('map-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') saveMapping();
});
document.getElementById('mappings-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('mappings-modal')) closeMappingsModal();
});
