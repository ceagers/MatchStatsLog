// Bulk import: a simple spreadsheet the coach fills in by hand, one row per
// match, read back into full match records. The simplified format carries just
// the sections shown on the Match Info screen — the fixture details, the player
// of the match, the squad split into starting, subs and not available, and the
// goals & assists by player — plus an optional goal log for matches where the
// minute each goal was scored was noted down.
//
// Columns (header row first; only Opposition and Starting are required):
//
//   Opposition,Home/Away,Date,Result,POTM,Starting,Subs,Not Available,
//   Goals,Assists,Goal Minutes,Competition,Type
//
//  - Date is YYYY-MM-DD, DD/MM/YYYY or DD/MM/YY (day first).
//  - Names inside Starting/Subs/Not Available are separated with ";" — commas
//    work too when the spreadsheet quotes the cell.
//  - Goals/Assists list "Name 2;Name 1" — the count is optional, defaults to 1.
//  - Goal Minutes, when filled, builds the logged goals for that row from
//    "12:Name;25:Name:Assist" entries; its per-player counts are combined with
//    the Goals/Assists tallies, the higher of the two winning — so a partial
//    goal log never lowers a total, and a totals-only row needs no minutes.
//
// parseBulkMatchesCsv never throws: it returns { ok: true, matches, warnings }
// or { ok: false, error }. The matches are plain records the store normalises
// before filing them in history, exactly as the full-match transfer does.

const BOM = '\uFEFF';

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

// Header cells collapse to bare letters and digits, so "Home / Away",
// "home away" and "H/A" all match the same column.
const headerKey = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// A multi-name cell: ";" is the separator to reach for, but a comma-separated
// cell that arrived quoted is accepted too.
function splitCells(raw) {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return [];
  const sep = v.includes(';') ? ';' : ',';
  return v.split(sep).map((s) => s.trim()).filter(Boolean);
}

// A tallies cell: "Name 2;Name 1" — a trailing count is peeled off the name.
const TALLY_RE = /^(.+?)\s+(\d+)$/;

function parseTallies(raw) {
  return splitCells(raw).map((entry) => {
    const m = entry.match(TALLY_RE);
    if (m) return { name: m[1].trim(), count: num(m[2], 1) };
    return { name: entry, count: 1 };
  });
}

// A goal-log cell: "12:Name;25:Name:Assist". Entries that don't parse are
// reported back, not dropped silently.
function parseGoalLog(raw) {
  const entries = splitCells(raw);
  const log = [];
  const bad = [];
  entries.forEach((entry) => {
    const parts = entry.split(':').map((s) => s.trim());
    const minute = Math.round(num(parts[0], 0));
    if (minute >= 1 && minute <= 200 && parts.length >= 2 && parts[1]) {
      log.push({ minute, scorer: parts[1], assist: parts[2] || '' });
    } else {
      bad.push(entry);
    }
  });
  return { log, bad };
}

// Fixture dates travel as ISO, or day-first with any separator. Excel often
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

function parseHomeAway(raw) {
  const v = str(raw).toLowerCase();
  if (!v) return '';
  if (v === 'h' || v.startsWith('home')) return 'Home';
  if (v === 'a' || v.startsWith('away')) return 'Away';
  return '';
}

export function parseBulkMatchesCsv(text) {
  const fail = (error) => ({ ok: false, error });
  if (typeof text !== 'string' || !text.trim()) {
    return fail('That file could not be read.');
  }

  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
  const headerAt = rows.findIndex((r) =>
    r.some((c) => headerKey(c) === 'opposition' || headerKey(c) === 'starting')
  );
  if (headerAt === -1) {
    return fail(
      'No header row found — the first row should name the columns, starting with Opposition.'
    );
  }

  const header = rows[headerAt].map(headerKey);
  const col = (...keys) => header.findIndex((h) => keys.includes(h));
  const iOpp = col('opposition', 'opponent', 'vs');
  const iHomeAway = col('homeaway', 'ha', 'homeoraway');
  const iDate = col('date');
  const iResult = col('result', 'score');
  const iPotm = col('potm', 'playerofthematch', 'playerofmatch');
  const iStart = col('starting', 'startinglineup', 'starters', 'startingxi');
  const iSubs = col('subs', 'substitutes', 'bench');
  const iNA = col('notavailable', 'unavailable');
  const iGoals = col('goals', 'goalsbyplayer', 'goalsassistsbyplayer');
  const iAssists = col('assists', 'assistsbyplayer');
  const iLog = col('goalminutes', 'goallog', 'goalslogged');
  const iComp = col('competition', 'division', 'jplpdjal');
  const iType = col('type', 'matchtype');

  if (iOpp === -1 || iStart === -1) {
    return fail('The file needs at least an "Opposition" column and a "Starting" column.');
  }

  const matches = [];
  const warnings = [];
  const seenWarnings = new Set();
  const warn = (text) => {
    if (!seenWarnings.has(text)) {
      seenWarnings.add(text);
      warnings.push(text);
    }
  };

  rows.slice(headerAt + 1).forEach((r, ri) => {
    const lineNo = headerAt + 2 + ri;
    if (r.every((c) => !str(c))) return; // blank line

    const opposition = iOpp >= 0 ? str(r[iOpp]) : '';
    const starting = iStart >= 0 ? splitCells(r[iStart]) : [];
    if (!opposition && starting.length === 0) return; // junk row, skipped

    // The squad in screen order — starting, subs, not available — with the
    // Period 1 mark each group carries.
    const groups = [
      { names: starting, state: 1 },
      { names: iSubs >= 0 ? splitCells(r[iSubs]) : [], state: 2 },
      { names: iNA >= 0 ? splitCells(r[iNA]) : [], state: 0 },
    ];
    const stateByName = new Map();
    const orderedNames = [];
    groups.forEach(({ names, state }) => {
      names.forEach((name) => {
        const key = name.toLowerCase();
        if (!stateByName.has(key)) {
          orderedNames.push(name);
          stateByName.set(key, state);
        }
      });
    });
    const players = orderedNames.map((name) => ({
      name,
      displayName: '',
      periods: [stateByName.get(name.toLowerCase()), 0, 0, 0, 0, 0, 0, 0],
      goals: 0,
      assists: 0,
    }));

    // The tallies: totals straight from the columns, per-player counts from
    // the goal log when it is filled in. The higher of the two wins per name,
    // so a partial log never lowers a total.
    const tallyGoals = new Map();
    const tallyAssists = new Map();
    if (iGoals >= 0) parseTallies(r[iGoals]).forEach(({ name, count }) =>
      tallyGoals.set(name, Math.max(tallyGoals.get(name) || 0, count))
    );
    if (iAssists >= 0) parseTallies(r[iAssists]).forEach(({ name, count }) =>
      tallyAssists.set(name, Math.max(tallyAssists.get(name) || 0, count))
    );

    const logGoals = new Map();
    const logAssists = new Map();
    const goalLog = iLog >= 0 ? parseGoalLog(r[iLog]) : { log: [], bad: [] };
    goalLog.log.forEach((g) => {
      if (g.scorer) logGoals.set(g.scorer, (logGoals.get(g.scorer) || 0) + 1);
      if (g.assist) logAssists.set(g.assist, (logAssists.get(g.assist) || 0) + 1);
    });
    goalLog.bad.forEach((entry) =>
      warn(`Row ${lineNo}: goal minute "${entry}" is not minute:scorer(:assist).`)
    );

    const countFor = (cell, log, name) =>
      Math.max(cell.get(name) || 0, log.get(name) || 0);
    players.forEach((p) => {
      p.goals = countFor(tallyGoals, logGoals, p.name);
      p.assists = countFor(tallyAssists, logAssists, p.name);
    });

    // A scorer the squad lists never mention still keeps their logged goals —
    // they show in the match summary — but season totals can't credit a player
    // who isn't on a team sheet, so it is flagged.
    const squad = new Set(players.map((p) => p.name.toLowerCase()));
    [...tallyGoals.keys(), ...tallyAssists.keys(), ...logGoals.keys(), ...logAssists.keys()]
      .filter((name) => name && !squad.has(name.toLowerCase()))
      .forEach((name) =>
        warn(`Row ${lineNo}: "${name}" scores or assists but is not in the squad lists.`)
      );

    const date = iDate >= 0 ? parseDateValue(r[iDate]) : { iso: '', bad: false };
    if (date.bad) {
      warn(`Row ${lineNo}: the date could not be read — the match will show today's date.`);
    }
    const homeAway = iHomeAway >= 0 ? parseHomeAway(r[iHomeAway]) : '';
    if (iHomeAway >= 0 && str(r[iHomeAway]) && !homeAway) {
      warn(`Row ${lineNo}: Home/Away should be Home or Away (or H/A).`);
    }

    matches.push({
      opposition,
      homeAway,
      competition: iComp >= 0 ? str(r[iComp]) : '',
      type: iType >= 0 ? str(r[iType]) : '',
      date: date.iso,
      result: iResult >= 0 ? str(r[iResult]) : '',
      potm: iPotm >= 0 ? str(r[iPotm]) : '',
      gameLength: 0,
      periodsUsed: 0,
      savedId: null,
      players,
      goalTimes: goalLog.log.map((g, gi) => ({
        id: `bulk-${ri}-${gi}-${Math.random().toString(36).slice(2, 8)}`,
        minute: g.minute,
        scorer: g.scorer,
        assist: g.assist,
        notes: '',
      })),
      subs: [],
    });
  });

  if (!matches.length) {
    return fail('No match rows found below the header.');
  }
  return { ok: true, matches, warnings };
}

// --- The way out: the same format as a spreadsheet -----------------------------
//
// Export Bulk Format writes the simplified layout back out — one row per
// match, the same columns Import Matches reads — so a season can be seen,
// edited in a spreadsheet and loaded straight back in.

const BULK_COLUMNS = [
  'Opposition', 'Home/Away', 'Date', 'Result', 'POTM',
  'Starting', 'Subs', 'Not Available', 'Goals', 'Assists',
  'Goal Minutes', 'Competition', 'Type',
];

export function bulkImportFileName(matches) {
  const list = Array.isArray(matches) ? matches.filter(Boolean) : [matches];
  const first = list[0] || null;
  const date = (first && first.date) || 'undated';
  if (list.length > 1) {
    return `MatchStatsLog-${list.length}-matches-${date}-bulk.csv`;
  }
  const who = ((first && first.opposition) || 'match')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `MatchStatsLog-${who || 'match'}-${date}-bulk.csv`;
}

// "BB 2;TP 1" — the count is always written explicitly, so a name that happens
// to end in a digit can't be misread on the way back in.
const tallyText = (tally) =>
  [...tally.entries()]
    .filter(([, n]) => n > 0)
    .map(([name, n]) => `${name} ${n}`)
    .join('; ');

export function bulkMatchesCsv(matches) {
  const list = Array.isArray(matches) ? matches : [matches];
  const rows = [];
  rows.push(line(['MatchStatsLog — Bulk Export']));
  rows.push(line(BULK_COLUMNS));

  list.filter(Boolean).forEach((m) => {
    const byPeriod = (state) =>
      (m.players || [])
        .filter((p) => p.periods[0] === state)
        .map((p) => p.name);
    const starting = byPeriod(1);
    const subs = byPeriod(2);
    const notAvailable = (m.players || [])
      .filter((p) => p.periods[0] !== 1 && p.periods[0] !== 2)
      .map((p) => p.name);

    // The tallies live on the player rows; a scorer the squad lists never
    // mention keeps their goals in the goal log, so they travel in the
    // tallies too — the import flags them, exactly as a hand-made sheet would.
    const tallyGoals = new Map();
    const tallyAssists = new Map();
    (m.players || []).forEach((p) => {
      if (p.goals) tallyGoals.set(p.name, p.goals);
      if (p.assists) tallyAssists.set(p.name, p.assists);
    });
    const logGoals = new Map();
    const logAssists = new Map();
    [...(m.goalTimes || [])]
      .sort((a, b) => a.minute - b.minute)
      .forEach((g) => {
        if (g.scorer) logGoals.set(g.scorer, (logGoals.get(g.scorer) || 0) + 1);
        if (g.assist) logAssists.set(g.assist, (logAssists.get(g.assist) || 0) + 1);
      });
    logGoals.forEach((n, name) => {
      if (!tallyGoals.has(name)) tallyGoals.set(name, n);
    });
    logAssists.forEach((n, name) => {
      if (!tallyAssists.has(name)) tallyAssists.set(name, n);
    });

    const goalMinutes = [...(m.goalTimes || [])]
      .sort((a, b) => a.minute - b.minute)
      .map((g) => (g.assist ? `${g.minute}:${g.scorer}:${g.assist}` : `${g.minute}:${g.scorer}`));

    rows.push(
      line([
        m.opposition || '',
        m.homeAway || '',
        m.date || '',
        m.result || '',
        m.potm || '',
        starting.join('; '),
        subs.join('; '),
        notAvailable.join('; '),
        tallyText(tallyGoals),
        tallyText(tallyAssists),
        goalMinutes.join('; '),
        m.competition || '',
        m.type || '',
      ])
    );
  });

  return `${BOM}${rows.join('\r\n')}\r\n`;
}
