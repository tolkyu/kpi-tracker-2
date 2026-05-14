'use strict';
const express          = require('express');
const { PrismaClient } = require('@prisma/client');

const app    = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(express.static(__dirname));

// ── Date helpers ──────────────────────────────────────────────────

// Returns ISO date string in UTC for a Date object
function isoDay(d) { return d.toISOString().slice(0, 10); }

// Parses "YYYY-MM-DD" as UTC midnight Date
function utcDay(str) { return new Date(str + 'T00:00:00.000Z'); }

function periodBounds(periodKey) {
  if (periodKey.startsWith('month-')) {
    const [, y, m] = periodKey.split('-');
    const year = Number(y), month = Number(m) - 1;
    return {
      start: new Date(Date.UTC(year, month, 1)),
      end:   new Date(Date.UTC(year, month + 1, 0)),
    };
  }
  if (periodKey.startsWith('custom-')) {
    const p = periodKey.replace('custom-', '').split('-');
    return {
      start: utcDay(`${p[0]}-${p[1]}-${p[2]}`),
      end:   utcDay(`${p[3]}-${p[4]}-${p[5]}`),
    };
  }
  if (periodKey.startsWith('preset-')) {
    const id   = periodKey.slice(7);
    const d0   = utcDay(isoDay(new Date()));
    const shift = n => { const r = new Date(d0); r.setUTCDate(r.getUTCDate() + n); return r; };
    const yr   = d0.getUTCFullYear();
    const mo   = d0.getUTCMonth();
    switch (id) {
      case 'last7':     return { start: shift(-6),   end: d0 };
      case 'last14':    return { start: shift(-13),  end: d0 };
      case 'last3m':    return { start: shift(-89),  end: d0 };
      case 'last12m':   return { start: shift(-364), end: d0 };
      case 'mtd':       return { start: new Date(Date.UTC(yr, mo, 1)),     end: d0 };
      case 'lastmonth': return { start: new Date(Date.UTC(yr, mo - 1, 1)), end: new Date(Date.UTC(yr, mo, 0)) };
      case 'alltime':   return null;
    }
  }
  return null;
}

// ── Employee routes ───────────────────────────────────────────────

app.get('/api/periods/:key', async (req, res) => {
  try {
    const bounds = periodBounds(req.params.key);
    let rows;
    if (bounds) {
      const s = isoDay(bounds.start);
      const e = isoDay(bounds.end);
      rows = await prisma.$queryRaw`
        SELECT MIN(id)::int AS id, name,
               SUM(done)::int  AS done,  SUM(own)::int   AS own,
               SUM(l1)::int    AS l1,    SUM(l2)::int    AS l2,
               SUM(l3)::int    AS l3,    SUM(help)::int  AS help,
               SUM(hdone)::int AS hdone, SUM(blk)::int   AS blk
        FROM   "Employee"
        WHERE  "periodStart" >= ${s}::date AND "periodEnd" <= ${e}::date
        GROUP  BY name
        ORDER  BY MIN(id)`;
    } else {
      rows = await prisma.$queryRaw`
        SELECT MIN(id)::int AS id, name,
               SUM(done)::int  AS done,  SUM(own)::int   AS own,
               SUM(l1)::int    AS l1,    SUM(l2)::int    AS l2,
               SUM(l3)::int    AS l3,    SUM(help)::int  AS help,
               SUM(hdone)::int AS hdone, SUM(blk)::int   AS blk
        FROM   "Employee"
        GROUP  BY name
        ORDER  BY MIN(id)`;
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/employees', async (req, res) => {
  try {
    const { periodKey, name, done, own, l1, l2, l3, help, hdone, blk } = req.body;
    const bounds = periodBounds(periodKey);
    if (!bounds) return res.status(400).json({ error: 'Cannot add to an unbounded period' });
    const row = await prisma.employee.create({
      data: {
        name,
        periodStart: bounds.start,
        periodEnd:   bounds.end,
        isManual:    true,
        done: done || 0, own: own || 0,
        l1: l1 || 0,    l2: l2 || 0,  l3: l3 || 0,
        help: help || 0, hdone: hdone || 0, blk: blk || 0,
      },
    });
    res.json({ id: row.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const { name, done, own, l1, l2, l3, help, hdone, blk } = req.body;
    await prisma.employee.update({
      where: { id: Number(req.params.id) },
      data:  { name, done, own, l1, l2, l3, help, hdone, blk },
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    const id  = Number(req.params.id);
    const { periodKey } = req.query;
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return res.status(404).json({ error: 'Not found' });

    const bounds = periodKey ? periodBounds(periodKey) : null;
    if (bounds) {
      await prisma.employee.deleteMany({
        where: {
          name:        emp.name,
          periodStart: { gte: bounds.start },
          periodEnd:   { lte: bounds.end },
        },
      });
    } else {
      await prisma.employee.deleteMany({ where: { name: emp.name } });
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Mapping routes ────────────────────────────────────────────────

app.get('/api/mappings', async (_req, res) => {
  try {
    res.json(await prisma.userMapping.findMany({ orderBy: { email: 'asc' } }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/mappings', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) return res.status(400).json({ error: 'email and name required' });
    const row = await prisma.userMapping.create({
      data: { email: email.toLowerCase().trim(), name: name.trim() },
    });
    res.json(row);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already mapped' });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/mappings/:id', async (req, res) => {
  try {
    const { email, name } = req.body;
    await prisma.userMapping.update({
      where: { id: Number(req.params.id) },
      data:  { email: email.toLowerCase().trim(), name: name.trim() },
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/mappings/:id', async (req, res) => {
  try {
    await prisma.userMapping.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Asana helpers ─────────────────────────────────────────────────

const ASANA_TOKEN   = process.env.ASANA_TOKEN;
const ASANA_PROJECT = process.env.ASANA_PROJECT_GID;

async function asanaGetAll(endpoint, extra = {}) {
  const results = [];
  const params  = new URLSearchParams({ limit: '100', ...extra });
  let offset    = null;

  do {
    if (offset) params.set('offset', offset);
    const r = await fetch(
      `https://app.asana.com/api/1.0${endpoint}?${params}`,
      { headers: { Authorization: `Bearer ${ASANA_TOKEN}`, Accept: 'application/json' } }
    );
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`Asana ${r.status}: ${body}`);
    }
    const json = await r.json();
    results.push(...json.data);
    offset = json.next_page?.offset ?? null;
  } while (offset);

  return results;
}

async function findManualDoneSection() {
  const sections = await asanaGetAll(`/projects/${ASANA_PROJECT}/sections`, { opt_fields: 'name' });
  const found = sections.find(s => s.name === 'Manual Done');
  if (!found) throw new Error('Section "Manual Done" not found in Asana project');
  return found.gid;
}

function deadlineBreaches(completedAt, dueOn) {
  if (!dueOn) return { own: 1, l1: 0, l2: 0, l3: 0 };
  const completed = new Date(completedAt);
  const due       = new Date(dueOn + 'T23:59:59');
  const diffDays  = (completed - due) / 86_400_000;
  if (diffDays <= 0) return { own: 1, l1: 0, l2: 0, l3: 0 };
  if (diffDays < 1)  return { own: 0, l1: 1, l2: 0, l3: 0 };
  if (diffDays <= 3) return { own: 0, l1: 0, l2: 1, l3: 0 };
  return               { own: 0, l1: 0, l2: 0, l3: 1 };
}

async function buildSyncPreview(periodKey) {
  if (!ASANA_TOKEN)   throw new Error('ASANA_TOKEN not set in .env');
  if (!ASANA_PROJECT) throw new Error('ASANA_PROJECT_GID not set in .env');

  const sectionGid = await findManualDoneSection();
  const bounds     = periodBounds(periodKey);

  const extra = { opt_fields: 'gid,name,assignee.email,assignee.name,completed_at,due_on,completed' };
  if (bounds) extra.completed_since = bounds.start.toISOString();

  const tasks = await asanaGetAll(`/sections/${sectionGid}/tasks`, extra);

  const inPeriod = tasks.filter(t => {
    if (!t.completed || !t.completed_at) return false;
    if (!bounds) return true;
    const d = new Date(t.completed_at);
    return d >= bounds.start && d <= bounds.end;
  });

  // globally deduplicate against already-synced GIDs
  const alreadySynced = await prisma.syncedTask.findMany({ select: { taskGid: true } });
  const syncedGids    = new Set(alreadySynced.map(s => s.taskGid));
  const newTasks      = inPeriod.filter(t => !syncedGids.has(t.gid));

  // resolve email → name mappings
  const emails      = [...new Set(newTasks.map(t => t.assignee?.email?.toLowerCase()).filter(Boolean))];
  const mappings    = await prisma.userMapping.findMany({ where: { email: { in: emails } } });
  const emailToName = Object.fromEntries(mappings.map(m => [m.email, m.name]));

  // per-email aggregates for the preview UI
  const byEmail = {};
  for (const task of newTasks) {
    const email = task.assignee?.email?.toLowerCase();
    if (!email) continue;
    if (!byEmail[email]) {
      byEmail[email] = { email, asanaName: task.assignee.name || email, done: 0, own: 0, l1: 0, l2: 0, l3: 0, taskGids: [] };
    }
    const a  = byEmail[email];
    const br = deadlineBreaches(task.completed_at, task.due_on);
    a.done++; a.own += br.own; a.l1 += br.l1; a.l2 += br.l2; a.l3 += br.l3;
    a.taskGids.push(task.gid);
  }

  // per-name-per-day records for the apply step (only mapped employees)
  const byNameDay = {};
  for (const task of newTasks) {
    const email = task.assignee?.email?.toLowerCase();
    if (!email) continue;
    const name = emailToName[email];
    if (!name) continue;
    const dayStr = isoDay(new Date(task.completed_at));
    const key    = `${name}::${dayStr}`;
    if (!byNameDay[key]) byNameDay[key] = { name, dayStr, done: 0, own: 0, l1: 0, l2: 0, l3: 0, taskGids: [] };
    const a  = byNameDay[key];
    const br = deadlineBreaches(task.completed_at, task.due_on);
    a.done++; a.own += br.own; a.l1 += br.l1; a.l2 += br.l2; a.l3 += br.l3;
    a.taskGids.push(task.gid);
  }

  const mapped = [], unmapped = [];
  for (const [email, agg] of Object.entries(byEmail)) {
    emailToName[email]
      ? mapped.push({ ...agg, name: emailToName[email] })
      : unmapped.push(agg);
  }

  return {
    mapped,
    unmapped,
    newTotal:     newTasks.length,
    skippedTotal: syncedGids.size,
    dailyRecords: Object.values(byNameDay),
  };
}

// GET /api/sync/asana/preview?periodKey=...
app.get('/api/sync/asana/preview', async (req, res) => {
  try {
    const { periodKey } = req.query;
    if (!periodKey) return res.status(400).json({ error: 'periodKey required' });
    const { mapped, unmapped, newTotal, skippedTotal } = await buildSyncPreview(periodKey);
    res.json({ mapped, unmapped, newTotal, skippedTotal });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sync/asana — apply sync (per-day records, preserves help/hdone/blk)
app.post('/api/sync/asana', async (req, res) => {
  try {
    const { periodKey } = req.body;
    if (!periodKey) return res.status(400).json({ error: 'periodKey required' });

    const { dailyRecords } = await buildSyncPreview(periodKey);
    let created = 0, updated = 0;

    for (const rec of dailyRecords) {
      const dayDate = utcDay(rec.dayStr);

      const existing = await prisma.employee.findFirst({
        where: { name: rec.name, periodStart: dayDate, periodEnd: dayDate, isManual: false },
      });
      if (existing) {
        await prisma.employee.update({
          where: { id: existing.id },
          data:  {
            done: { increment: rec.done },
            own:  { increment: rec.own },
            l1:   { increment: rec.l1  },
            l2:   { increment: rec.l2  },
            l3:   { increment: rec.l3  },
          },
        });
        updated++;
      } else {
        await prisma.employee.create({
          data: {
            name:        rec.name,
            periodStart: dayDate,
            periodEnd:   dayDate,
            isManual:    false,
            done: rec.done, own: rec.own, l1: rec.l1, l2: rec.l2, l3: rec.l3,
            help: 0, hdone: 0, blk: 0,
          },
        });
        created++;
      }

      if (rec.taskGids.length) {
        await prisma.syncedTask.createMany({
          data: rec.taskGids.map(gid => ({ taskGid: gid })),
          skipDuplicates: true,
        });
      }
    }
    res.json({ created, updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Seed ──────────────────────────────────────────────────────────

async function seedIfEmpty() {
  const count = await prisma.employee.count();
  if (count > 0) return;

  const start = new Date(Date.UTC(2026, 4, 1));  // 2026-05-01
  const end   = new Date(Date.UTC(2026, 5, 0));  // 2026-05-31

  const employees = [
    { name: 'Alice',   done: 42, own: 35, l1: 4, l2: 2, l3: 1, help: 8,  hdone: 7, blk: 3 },
    { name: 'Bob',     done: 38, own: 30, l1: 5, l2: 2, l3: 1, help: 6,  hdone: 5, blk: 2 },
    { name: 'Carol',   done: 51, own: 45, l1: 3, l2: 2, l3: 1, help: 10, hdone: 9, blk: 4 },
    { name: 'David',   done: 29, own: 20, l1: 5, l2: 3, l3: 1, help: 4,  hdone: 3, blk: 1 },
    { name: 'Eva',     done: 47, own: 40, l1: 4, l2: 2, l3: 1, help: 9,  hdone: 8, blk: 3 },
  ];

  await prisma.employee.createMany({
    data: employees.map(e => ({ ...e, periodStart: start, periodEnd: end, isManual: true })),
  });
  console.log('Seeded 5 sample employees into month-2026-05');
}

// ── Start ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await seedIfEmpty();
  console.log(`KPI Tracker → http://localhost:${PORT}`);
});
