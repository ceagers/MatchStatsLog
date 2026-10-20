// Spreadsheet export. Excel, Numbers and Google Sheets all open a CSV, so that
// is what the app writes — with the leading BOM that tells Excel the file is
// UTF-8.

import {
  formatDate, formatClock, clockTotalMs, computePlayerMinutes,
  PERIOD_GREEN, PERIOD_RED,
} from './store.jsx';

const BOM = '\uFEFF';

export const CSV_MIME = 'text/csv;charset=utf-8';

// A cell is quoted only when it has to be, and inner quotes are doubled.
function cell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function line(values) {
  return values.map(cell).join(',');
}

function periodLabel(state) {
  if (state === PERIOD_GREEN) return 'Playing';
  if (state === PERIOD_RED) return 'Sub';
  return '-';
}

export function matchFileName(match) {
  const who = (match.opposition || 'match')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `MatchStatsLog-${who || 'match'}-${match.date || 'undated'}.csv`;
}

/// The whole match as one spreadsheet: fixture, squad, time, goals, subs.
export function matchCsv(match) {
  const goals = [...match.goalTimes].sort((a, b) => a.minute - b.minute);
  const subs = [...(match.subs || [])].sort((a, b) => a.minute - b.minute);
  const clock = match.clock || null;
  const startMinute = clock ? Math.round((clock.offsetMs || 0) / 60000) : 0;

  // Tallied from the logged goals, exactly as the summary shows them.
  const tallies = new Map();
  const tallyFor = (name) => {
    if (!tallies.has(name)) tallies.set(name, { name, goals: 0, assists: 0 });
    return tallies.get(name);
  };
  goals.forEach((g) => {
    if (g.scorer) tallyFor(g.scorer).goals += 1;
    if (g.assist) tallyFor(g.assist).assists += 1;
  });
  const table = [...tallies.values()].sort(
    (a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name)
  );
  const totalGoals = table.reduce((n, r) => n + r.goals, 0);
  const totalAssists = table.reduce((n, r) => n + r.assists, 0);

  const subsOn = new Map();
  const subsOff = new Map();
  subs.forEach((s) => {
    if (s.on) subsOn.set(s.on, (subsOn.get(s.on) || 0) + 1);
    if (s.off) subsOff.set(s.off, (subsOff.get(s.off) || 0) + 1);
  });

  const rows = [];

  rows.push(line(['MatchStatsLog — Match Export']));
  rows.push('');
  rows.push(line(['Fixture']));
  rows.push(line(['JPL / PDJAL', match.competition || '']));
  rows.push(line(['Type', match.type || '']));
  rows.push(line(['Opposition', match.opposition]));
  rows.push(line(['Home or Away', match.homeAway]));
  rows.push(line(['Date', formatDate(match.date)]));
  rows.push(line(['Result', match.result]));
  rows.push(line(['POTM', match.potm]));
  rows.push(line(['Match Time', formatClock(clockTotalMs(clock))]));
  rows.push(line(['Started From', startMinute > 0 ? `${startMinute} minutes` : 'Kick-off']));
  rows.push(
    line(['Game Length', match.gameLength ? `${match.gameLength} minutes` : 'Not set'])
  );
  rows.push('');

  rows.push(line(['Squad']));
  rows.push(
    line([
      'Player', 'Period 1', 'Period 2', 'Period 3', 'Period 4',
      'Period 5', 'Period 6', 'Period 7', 'Period 8',
      'Goals', 'Assists', 'Subs On', 'Subs Off',
    ])
  );
  match.players.forEach((p) => {
    rows.push(
      line([
        p.name,
        ...p.periods.map(periodLabel),
        tallyFor(p.name).goals,
        tallyFor(p.name).assists,
        subsOn.get(p.name) || 0,
        subsOff.get(p.name) || 0,
      ])
    );
  });
  rows.push(line(['Total', ...Array(8).fill(''), totalGoals, totalAssists, '', '']));
  rows.push('');

  const played = computePlayerMinutes(match);
  if (played.source !== 'none') {
    rows.push(
      line([
        'Minutes Played',
        played.source === 'clock'
          ? 'from clock & substitutions'
          : `estimated from ${played.periodsUsed} of 8 periods`,
      ])
    );
    rows.push(line(['Player', 'Minutes', 'Percent Of Game']));
    const minutesRows = match.players
      .map((p) => ({ name: p.name, mins: played.minutes.get(p.name) || 0 }))
      .sort((a, b) => b.mins - a.mins || a.name.localeCompare(b.name));
    minutesRows.forEach((r) => {
      const pct =
        played.fullTime > 0 ? Math.round((r.mins / played.fullTime) * 100) : 0;
      rows.push(line([r.name, r.mins, `${pct}%`]));
    });
    rows.push('');
  }

  rows.push(line(['Goals & Assists By Player']));
  rows.push(line(['Player', 'Goals', 'Assists']));
  table.forEach((r) => rows.push(line([r.name, r.goals, r.assists])));
  rows.push(line(['Total', totalGoals, totalAssists]));
  rows.push('');

  rows.push(line(['Goals']));
  rows.push(line(['Minute', 'Scorer', 'Assist', 'Notes']));
  goals.forEach((g) => rows.push(line([g.minute, g.scorer, g.assist, g.notes])));
  rows.push('');

  rows.push(line(['Substitutions']));
  rows.push(line(['Minute', 'On', 'Off', 'Notes']));
  subs.forEach((s) => rows.push(line([s.minute, s.on, s.off, s.notes])));

  return `${BOM}${rows.join('\r\n')}\r\n`;
}

// --- Season and player season exports ----------------------------------------

export function seasonSquadFileName(seasonName) {
  const who = (seasonName || 'season')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `MatchStatsLog-${who || 'season'}-squad-totals.csv`;
}

export function playerSeasonFileName(seasonName, playerName) {
  const slug = (s, fallback) =>
    (s || fallback)
      .trim()
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback;
  return `MatchStatsLog-${slug(seasonName, 'season')}-${slug(playerName, 'player')}-season.csv`;
}

// The squad totals table — the same numbers the Players tab shows, sorted and
// division-filtered exactly as on screen.
export function seasonSquadCsv(seasonName, division, matchesCounted, players) {
  const rows = [];
  rows.push(line(['MatchStatsLog — Season Squad Totals']));
  rows.push('');
  rows.push(line(['Season', seasonName || '']));
  rows.push(line(['Division', division || 'All']));
  rows.push(line(['Matches counted', matchesCounted]));
  rows.push('');
  rows.push(line(['Player', 'GP', 'St', 'NA', 'G', 'A', 'POTM', '%']));
  players.forEach((p) => {
    rows.push(line([
      p.name,
      p.played,
      p.starts,
      p.notAvailable,
      p.goals,
      p.assists,
      p.potm,
      p.percentage === null ? '' : `${p.percentage}%`,
    ]));
  });
  return `${BOM}${rows.join('\r\n')}\r\n`;
}

// One player's season — the totals tiles, then a row for every match.
export function playerSeasonCsv(seasonName, playerName, division, me, rows) {
  const out = [];
  out.push(line(['MatchStatsLog — Player Season']));
  out.push('');
  out.push(line(['Season', seasonName || '']));
  out.push(line(['Player', playerName]));
  out.push(line(['Division', division || 'All']));
  out.push('');
  out.push(line(['Games', me.played]));
  out.push(line(['Starts', me.starts]));
  out.push(line(['Goals', me.goals]));
  out.push(line(['Assists', me.assists]));
  out.push(line(['POTM', me.potm]));
  out.push(line(['Minutes', me.minutes]));
  out.push(line(['Played', me.percentage === null ? '' : `${me.percentage}%`]));
  out.push('');
  out.push(line(['Match by Match']));
  out.push(line([
    'Opposition', 'Date', 'H/A', 'Available', 'Started', 'Goals', 'Assists',
    'POTM', 'Minutes', '%',
  ]));
  rows.forEach((r) => {
    out.push(line([
      r.opposition || '',
      formatDate(r.date),
      r.homeAway === 'Home' ? 'Home' : r.homeAway === 'Away' ? 'Away' : '',
      r.available === null ? '' : r.available ? 'Y' : 'N',
      r.started === null ? '' : r.started ? 'Y' : 'N',
      r.goals,
      r.assists,
      r.potm ? 'Y' : '',
      r.minutes === null ? '' : r.minutes,
      r.pct === null ? '' : `${r.pct}%`,
    ]));
  });
  return `${BOM}${out.join('\r\n')}\r\n`;
}