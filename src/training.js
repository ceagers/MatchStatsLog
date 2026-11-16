// Training attendance CSV: the way in and the way out for the Training tab
// on the Squad screen. The layout the coach keeps outside the app is one
// column of dates with the player names across the top row and a Y or N in
// every cell — the export writes exactly that, and the import reads it back.

import { TRAINING_Y, TRAINING_N } from './store.jsx';

const BOM = '\uFEFF';

// A cell is quoted only when it has to be, and inner quotes are doubled — the
// same discipline as the other exports.
function cell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function line(values) {
  return values.map(cell).join(',');
}

/// A small CSV row parser — quoted fields, doubled inner quotes, CRLF or LF.
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const str = (value) => (typeof value === 'string' ? value.trim() : '');

// Header cells collapse to bare letters and digits, so "Date", "date" and
// "Session Date" all match the same column.
const headerKey = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Session dates travel as ISO, or day-first with any separator. Excel often
// appends a midnight time — everything after the first space is dropped.
function parseDateValue(raw) {
  const v = str(raw).split(/\s+/)[0] || '';
  if (!v) return { iso: '', bad: false };
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return { iso: v, bad: false };
  let m = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (m) {
    return { iso: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, bad: false };
  }
  m = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2})$/);
  if (m) {
    const year = Number(m[3]) < 50 ? 2000 + Number(m[3]) : 1900 + Number(m[3]);
    return { iso: `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, bad: false };
  }
  return { iso: '', bad: true };
}

const YES = new Set(['y', 'yes', 'p', 'present', 'true', '1', 'in']);
const NO = new Set(['n', 'no', 'a', 'absent', 'false', '0', 'out']);

export function trainingFileName() {
  return 'MatchStatsLog-training-attendance.csv';
}

/// Every saved session as one spreadsheet: a header row of player names
/// across the top, then a row per session with Y/N as the data, newest
/// date first. Player columns follow the squad's saved order, with any
/// names the sessions still carry but the squad no longer lists at the end.
export function trainingCsv(sessions, squadNames) {
  const list = (Array.isArray(sessions) ? sessions : []).slice();
  const key = (d) => {
    const t = new Date(d).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  list.sort((a, b) => key(b.date) - key(a.date));

  const names = [];
  (Array.isArray(squadNames) ? squadNames : []).forEach((n) => {
    if (n && !names.includes(n)) names.push(n);
  });
  list.forEach((s) => {
    Object.keys((s && s.attendance) || {}).forEach((n) => {
      if (n && !names.includes(n)) names.push(n);
    });
  });

  const rows = [];
  rows.push(line(['MatchStatsLog — Training Attendance']));
  rows.push('');
  rows.push(line(['Date', ...names]));
  list.forEach((s) => {
    const att = (s && s.attendance) || {};
    rows.push(line([
      s.date,
      ...names.map((n) =>
        att[n] === TRAINING_Y ? 'Y' : att[n] === TRAINING_N ? 'N' : ''
      ),
    ]));
  });
  return `${BOM}${rows.join('\r\n')}\r\n`;
}

// parseTrainingCsv never throws: it returns { ok: true, sessions, warnings }
// or { ok: false, error }. Sessions are { date, attendance } records the
// store upserts by date — the live data is merged, never replaced wholesale.
export function parseTrainingCsv(text) {
  const fail = (error) => ({ ok: false, error });
  if (typeof text !== 'string' || !text.trim()) {
    return fail('That file could not be read.');
  }

  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
  const headerAt = rows.findIndex((r) => r.some((c) => headerKey(c) === 'date'));
  if (headerAt === -1) {
    return fail(
      'No header row found — the first row should start with Date, then the player names across the top.'
    );
  }

  const header = rows[headerAt];
  const dateCol = header.findIndex((c) => headerKey(c) === 'date');
  const names = [];
  const cols = [];
  header.forEach((c, i) => {
    if (i === dateCol) return;
    const name = str(c);
    if (!name) return;
    names.push(name);
    cols.push(i);
  });
  if (!cols.length) {
    return fail(
      'No player columns found — the player names should sit across the top row after Date.'
    );
  }

  const sessions = [];
  const byDate = new Map();
  const warnings = [];

  rows.slice(headerAt + 1).forEach((r, ri) => {
    const lineNo = headerAt + 2 + ri;
    if (r.every((c) => !str(c))) return; // blank line

    const date = parseDateValue(r[dateCol]);
    if (!date.iso) {
      warnings.push(`Row ${lineNo}: the date could not be read — the row was skipped.`);
      return;
    }

    const attendance = {};
    cols.forEach((col, ci) => {
      const raw = str(r[col]).toLowerCase();
      if (!raw) return; // no mark for this player
      let v = null;
      if (YES.has(raw)) v = TRAINING_Y;
      else if (NO.has(raw)) v = TRAINING_N;
      if (v === null) {
        warnings.push(
          `Row ${lineNo}: "${str(r[col])}" for ${names[ci]} is not Y or N — skipped.`
        );
        return;
      }
      attendance[names[ci]] = v;
    });

    if (byDate.has(date.iso)) {
      warnings.push(`Row ${lineNo}: ${date.iso} appears twice — the rows were combined.`);
      Object.assign(byDate.get(date.iso).attendance, attendance);
    } else {
      const session = { date: date.iso, attendance };
      byDate.set(date.iso, session);
      sessions.push(session);
    }
  });

  if (!sessions.length) {
    return fail('No dated rows found below the header.');
  }
  return { ok: true, sessions, warnings };
}
