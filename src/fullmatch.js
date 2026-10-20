// Full-match transfer. One CSV carries every detail of a match — fixture,
// squad with every period state, the clock, the goals and the substitutions —
// in a strict machine-readable layout, and parseFullMatchCsv turns that same
// file back into a match. This is the round trip behind Export Full Match and
// Import Full Match on the Utilities screen: a backup, and a way to move a
// match between phones.

import {
  makeMatch, makeClock, sessionMs, totalTimedMs,
  PERIOD_UNSET, PERIOD_GREEN, PERIOD_RED,
} from './store.jsx';

const BOM = '\uFEFF';
const HEADER = 'MatchStatsLog — Full Match Export';
const CSV_MIME = 'text/csv;charset=utf-8';

export { CSV_MIME };

// A cell is quoted only when it has to be, and inner quotes are doubled.
function cell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function line(values) {
  return values.map(cell).join(',');
}

export function fullMatchFileName(matches) {
  const list = Array.isArray(matches) ? matches.filter(Boolean) : [matches];
  const first = list[0] || null;
  const date = (first && first.date) || 'undated';
  if (list.length > 1) {
    return `MatchStatsLog-${list.length}-matches-${date}-full.csv`;
  }
  const who = ((first && first.opposition) || 'match')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `MatchStatsLog-${who || 'match'}-${date}-full.csv`;
}

/// The whole match as one round-trippable spreadsheet. Section markers in
/// square brackets split the file; everything else is either a Key,Value pair
/// ([Match]) or a table ([Squad], [Goals], [Subs]). Period states travel as
/// their numbers (0 unset, 1 green, 2 red) and the date as raw YYYY-MM-DD, so
/// nothing is lost to presentation.
/// One match as rows, without the byte-order mark — matchRows is the block
/// builder and fullMatchCsv assembles one or more blocks into the file.
function matchRows(match) {
  const clock = match.clock || makeClock();
  const elapsed = Math.round(sessionMs(clock));
  const timed = Math.round(totalTimedMs(clock));

  const rows = [];
  rows.push(line([HEADER]));
  rows.push(line(['Version', '1']));

  rows.push(line(['[Match]']));
  rows.push(line(['Division', match.competition || '']));
  rows.push(line(['Type', match.type || '']));
  rows.push(line(['Opposition', match.opposition || '']));
  rows.push(line(['Home or Away', match.homeAway || '']));
  rows.push(line(['Date', match.date || '']));
  rows.push(line(['Result', match.result || '']));
  rows.push(line(['POTM', match.potm || '']));
  rows.push(line(['Game Length', match.gameLength || 0]));
  rows.push(line(['Periods Used', match.periodsUsed || 0]));
  rows.push(line(['Clock Start Minute', Math.round((clock.offsetMs || 0) / 60000)]));
  rows.push(line(['Clock Elapsed Ms', elapsed]));
  rows.push(line(['Clock Timed Ms', timed]));
  rows.push(line(['Clock Stopped', clock.stopped || clock.running || elapsed > 0 ? 'Y' : '']));

  rows.push(line(['[Squad]']));
  rows.push(
    line([
      'Name', 'Display Name',
      'Period 1', 'Period 2', 'Period 3', 'Period 4',
      'Period 5', 'Period 6', 'Period 7', 'Period 8',
      'Goals', 'Assists',
    ])
  );
  (match.players || []).forEach((p) => {
    rows.push(
      line([
        p.name,
        p.displayName || '',
        ...(p.periods || []).map((s) => (s === PERIOD_GREEN ? 1 : s === PERIOD_RED ? 2 : 0)),
        p.goals || 0,
        p.assists || 0,
      ])
    );
  });

  rows.push(line(['[Goals]']));
  rows.push(line(['Minute', 'Scorer', 'Assist', 'Notes']));
  [...(match.goalTimes || [])]
    .sort((a, b) => a.minute - b.minute)
    .forEach((g) => rows.push(line([g.minute, g.scorer || '', g.assist || '', g.notes || ''])));

  rows.push(line(['[Subs]']));
  rows.push(line(['Minute', 'On', 'Off', 'Notes']));
  [...(match.subs || [])]
    .sort((a, b) => a.minute - b.minute)
    .forEach((s) => rows.push(line([s.minute, s.on || '', s.off || '', s.notes || ''])));

  return rows;
}

/// One file can carry many matches: every match is a complete block — header
/// line, [Match], [Squad], [Goals], [Subs] — and the parser splits on the
/// header lines when it reads the file back.
export function fullMatchCsv(matches) {
  const list = Array.isArray(matches) ? matches : [matches];
  const blocks = list.filter(Boolean).map(matchRows);
  return `${BOM}${blocks.map((b) => b.join('\r\n')).join('\r\n\r\n')}\r\n`;
}

// --- The way back -------------------------------------------------------------

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

const num = (value, fallback = 0) => {
  const n = Number(typeof value === 'string' ? value.trim() : value);
  return Number.isFinite(n) ? n : fallback;
};

const str = (value) => (typeof value === 'string' ? value.trim() : '');

/// Parse one block — the rows between two header lines — back into a match.
/// Returns the match, or null when the block is not a complete one.
function parseMatchBlock(rows) {
  let section = '';
  const kv = {};
  const squad = [];
  const goals = [];
  const subs = [];
  let sawMatch = false;
  let sawSquadHeader = false;
  let sawGoalsHeader = false;
  let sawSubsHeader = false;

  rows.forEach((r) => {
    const c0 = str(r[0]);
    if (c0.startsWith('[') && c0.endsWith(']')) {
      section = c0.slice(1, -1).toLowerCase();
      return;
    }
    if (r.every((c) => !str(c))) return; // blank line
    if (!section) return;

    if (section === 'match') {
      if (r.length >= 2) {
        kv[c0] = str(r[1]);
        sawMatch = true;
      }
    } else if (section === 'squad') {
      if (!sawSquadHeader) {
        if (c0.toLowerCase() === 'name') sawSquadHeader = true;
        return;
      }
      if (c0) squad.push(r);
    } else if (section === 'goals') {
      if (!sawGoalsHeader) {
        if (c0.toLowerCase() === 'minute') sawGoalsHeader = true;
        return;
      }
      goals.push(r);
    } else if (section === 'subs') {
      if (!sawSubsHeader) {
        if (c0.toLowerCase() === 'minute') sawSubsHeader = true;
        return;
      }
      subs.push(r);
    }
  });

  if (!sawMatch || !sawSquadHeader) return null;

  const base = makeMatch();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(kv['Date'] || '') ? kv['Date'] : '';

  const clock = {
    ...makeClock(),
    offsetMs: Math.max(0, num(kv['Clock Start Minute'])) * 60000,
    elapsedMs: Math.max(0, num(kv['Clock Elapsed Ms'])),
    timedMs: Math.max(0, num(kv['Clock Timed Ms'])),
    stopped: kv['Clock Stopped'] === 'Y',
  };

  const match = {
    ...base,
    opposition: kv['Opposition'] ?? '',
    homeAway: kv['Home or Away'] ?? '',
    competition: kv['Division'] ?? '',
    type: kv['Type'] ?? '',
    date: isoDate || base.date,
    result: kv['Result'] ?? '',
    potm: kv['POTM'] ?? '',
    gameLength: Math.max(0, Math.min(200, Math.round(num(kv['Game Length'])))),
    periodsUsed: Math.max(0, Math.min(8, Math.round(num(kv['Periods Used'])))),
    savedId: null,
    players: squad
      .map((r) => ({
        name: str(r[0]),
        displayName: str(r[1]),
        periods: Array.from({ length: 8 }, (_, i) => {
          const n = Math.round(num(r[2 + i]));
          return n === 1 ? PERIOD_GREEN : n === 2 ? PERIOD_RED : PERIOD_UNSET;
        }),
        goals: Math.max(0, Math.round(num(r[10]))),
        assists: Math.max(0, Math.round(num(r[11]))),
      }))
      .filter((p) => p.name),
    goalTimes: goals.map((r, i) => ({
      id: `goal-imp-${i}-${Math.random().toString(36).slice(2, 8)}`,
      minute: Math.max(1, Math.min(200, Math.round(num(r[0], 1)))),
      scorer: str(r[1]),
      assist: str(r[2]),
      notes: str(r[3]),
    })),
    subs: subs.map((r, i) => ({
      id: `sub-imp-${i}-${Math.random().toString(36).slice(2, 8)}`,
      minute: Math.max(1, Math.min(200, Math.round(num(r[0], 1)))),
      on: str(r[1]),
      off: str(r[2]),
      notes: str(r[3]),
    })),
    clock,
  };

  if (!match.players.length) return null;
  return match;
}

/// Parse a full-match export back into matches. One file may carry several —
/// each starts with its own header line. Returns { ok: true, matches } or
/// { ok: false, error } — never throws, whatever the file holds.
export function parseFullMatchCsv(text) {
  const fail = (error) => ({ ok: false, error });
  if (typeof text !== 'string' || !text.trim()) return fail('That file could not be read.');

  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
  const first = (rows[0] || []).join(',');
  if (!first.includes('MatchStatsLog') || !first.includes('Full Match Export')) {
    return fail('That file is not a MatchStatsLog full match export.');
  }

  // Split the file into per-match blocks at the header lines.
  const blocks = [];
  let current = null;
  rows.forEach((r) => {
    const joined = r.join(',');
    if (joined.includes('MatchStatsLog') && joined.includes('Full Match Export')) {
      current = [];
      blocks.push(current);
      return;
    }
    if (current) current.push(r);
  });

  const matches = blocks.map(parseMatchBlock).filter(Boolean);
  if (!matches.length) {
    return fail('That file is missing the match or squad section.');
  }
  return { ok: true, matches };
}