// Match-day photos: the Match Info summary sections redrawn as crisp canvas
// pictures — the fixture, the Period 1 squad, goals & assists by player, and
// the goals logged (spread over several pictures when the list is long). They
// render on a fixed light palette so they look the same whatever the app's
// appearance is set to, and are handed over as PNG files the user can save to
// the camera roll or share.

import { formatDate, PERIOD_GREEN, PERIOD_RED } from './store.jsx';

const S = 3;            // drawn at 3x so photos stay sharp in Photos
const W = 390;          // design width in points
const BG = '#f2f2f7';   // iOS system grey 6
const CARD = '#ffffff';
const TEXT = '#111114';
const SECONDARY = '#8e8e93';
const HAIRLINE = 'rgba(60, 60, 67, 0.29)';
const GREEN = '#22c55e';
const RED = '#ef4444';
const GREY = '#c7c7cc';

const font = (size, weight) =>
  `${weight ? `${weight} ` : ''}${size}px -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Segoe UI', sans-serif`;

function makeCtx(height) {
  const h = Math.max(120, Math.ceil(height));
  const canvas = document.createElement('canvas');
  canvas.width = W * S;
  canvas.height = h * S;
  const ctx = canvas.getContext('2d');
  ctx.scale(S, S);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, h);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  return { canvas, ctx };
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function card(ctx, y, h, x = 20, w = W - 40) {
  ctx.fillStyle = CARD;
  roundRectPath(ctx, x, y, w, h, 12);
  ctx.fill();
}

function sectionLabel(ctx, text, cy) {
  ctx.font = font(13, 600);
  ctx.fillStyle = SECONDARY;
  ctx.fillText(text.toUpperCase(), 22, cy);
}

function footer(ctx, height, text) {
  ctx.font = font(11);
  ctx.fillStyle = SECONDARY;
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, height - 16);
  ctx.textAlign = 'left';
}

function hairline(ctx, x, y, w) {
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
}

function dot(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function minuteChip(ctx, text, x, cy, color) {
  const w = 46;
  const h = 24;
  ctx.fillStyle = color;
  roundRectPath(ctx, x, cy - h / 2, w, h, 6);
  ctx.fill();
  ctx.font = font(13, 600);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, cy + 0.5);
  ctx.textAlign = 'left';
  return x + w;
}

function ellipsize(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

const captionFor = (match) =>
  ['MatchStatsLog', match.competition || null, match.opposition || null, formatDate(match.date)]
    .filter(Boolean)
    .join('  ·  ');

// --- Photo 1: the fixture ---------------------------------------------------

function fixturePhoto(match) {
  const sub = [match.homeAway, formatDate(match.date)].filter(Boolean).join(' · ');
  const hasResult = Boolean(match.result);
  const hasPotm = Boolean(match.potm);

  let inner = 16 + 28 + 2 + 20;
  inner += 22 + 22; // the JPL/PDJAL and Type rows
  if (hasResult) inner += 10 + 24;
  if (hasPotm) inner += 8 + 22;
  inner += 16;

  const labelCy = 30;
  const cardY = labelCy + 13;
  const height = cardY + inner + 46;
  const { canvas, ctx } = makeCtx(height);

  sectionLabel(ctx, 'Fixture', labelCy);
  card(ctx, cardY, inner);

  let y = cardY + 16;
  ctx.font = font(22, 700);
  ctx.fillStyle = TEXT;
  ctx.fillText(
    ellipsize(ctx, match.opposition ? `vs ${match.opposition}` : 'No opposition set', W - 90),
    36,
    y + 14
  );
  y += 28 + 2;
  ctx.font = font(15);
  ctx.fillStyle = SECONDARY;
  ctx.fillText(ellipsize(ctx, sub || 'Add the venue and date on Match Info', W - 90), 36, y + 10);
  y += 20;
  ctx.font = font(11, 600);
  ctx.fillStyle = SECONDARY;
  ctx.fillText('JPL/PDJAL', 36, y + 11);
  const compLw = ctx.measureText('JPL/PDJAL').width;
  ctx.font = font(15, 600);
  ctx.fillStyle = TEXT;
  ctx.fillText(
    ellipsize(ctx, match.competition || 'Not set', W - 130 - compLw),
    36 + compLw + 8,
    y + 11
  );
  y += 22;
  ctx.font = font(11, 600);
  ctx.fillStyle = SECONDARY;
  ctx.fillText('Type', 36, y + 11);
  const typeLw = ctx.measureText('Type').width;
  ctx.font = font(15, 600);
  ctx.fillStyle = TEXT;
  ctx.fillText(
    ellipsize(ctx, match.type || 'Not set', W - 130 - typeLw),
    36 + typeLw + 8,
    y + 11
  );
  y += 22;
  if (hasResult) {
    y += 10;
    ctx.font = font(17, 600);
    ctx.fillStyle = TEXT;
    ctx.fillText(match.result, 36, y + 12);
    y += 24;
  }
  if (hasPotm) {
    y += 8;
    ctx.font = font(11, 600);
    ctx.fillStyle = SECONDARY;
    ctx.fillText('POTM', 36, y + 11);
    const lw = ctx.measureText('POTM').width;
    ctx.font = font(15, 600);
    ctx.fillStyle = TEXT;
    ctx.fillText(ellipsize(ctx, match.potm, W - 120 - lw), 36 + lw + 8, y + 11);
    y += 22;
  }

  footer(ctx, height, captionFor(match));
  return { title: 'Fixture', name: 'Fixture.png', canvas };
}

// --- Photo 2: the squad, Period 1 -------------------------------------------

function squadPhoto(match) {
  const groups = [
    {
      label: 'Starting',
      color: GREEN,
      players: match.players.filter((p) => p.periods[0] === PERIOD_GREEN),
    },
    {
      label: 'Subs',
      color: RED,
      players: match.players.filter((p) => p.periods[0] === PERIOD_RED),
    },
    {
      label: 'Not Available',
      color: GREY,
      players: match.players.filter(
        (p) => p.periods[0] !== PERIOD_GREEN && p.periods[0] !== PERIOD_RED
      ),
    },
  ];
  const cardH = (players) => (players.length ? players.length * 34 + 10 : 38);

  let height = 30;
  groups.forEach((g, i) => {
    height += 13 + 4 + cardH(g.players) + (i < groups.length - 1 ? 16 : 0);
  });
  height += 46;

  const { canvas, ctx } = makeCtx(height);
  let y = 30;
  groups.forEach((g, i) => {
    dot(ctx, 26, y, 5.5, g.color);
    ctx.font = font(15, 600);
    ctx.fillStyle = TEXT;
    ctx.fillText(g.label, 38, y + 0.5);
    const lw = ctx.measureText(g.label).width;
    ctx.font = font(15);
    ctx.fillStyle = SECONDARY;
    ctx.fillText(`(${g.players.length})`, 38 + lw + 6, y + 0.5);
    y += 13 + 4;

    card(ctx, y, cardH(g.players));
    if (g.players.length) {
      g.players.forEach((p, j) => {
        const cy = y + 5 + 17 + j * 34;
        if (j > 0) hairline(ctx, 36, cy - 17, W - 72);
        ctx.font = font(15, 600);
        ctx.fillStyle = TEXT;
        ctx.fillText(p.name, 36, cy);
      });
    } else {
      ctx.font = font(14);
      ctx.fillStyle = SECONDARY;
      ctx.fillText('None', 36, y + 19);
    }
    y += cardH(g.players) + (i < groups.length - 1 ? 16 : 0);
  });

  footer(ctx, height, captionFor(match));
  return { title: 'Squad — Period 1', name: 'Squad - Period 1.png', canvas };
}

// --- Photo 3: goals & assists by player --------------------------------------

function goalsAssistsPhoto(match) {
  const tallies = new Map();
  const tallyFor = (name) => {
    if (!tallies.has(name)) tallies.set(name, { name, goals: 0, assists: 0 });
    return tallies.get(name);
  };
  match.goalTimes.forEach((g) => {
    if (g.scorer) tallyFor(g.scorer).goals += 1;
    if (g.assist) tallyFor(g.assist).assists += 1;
  });
  const rows = [...tallies.values()].sort(
    (a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name)
  );
  const totalGoals = rows.reduce((n, r) => n + r.goals, 0);
  const totalAssists = rows.reduce((n, r) => n + r.assists, 0);

  const labelCy = 30;
  const cardY = labelCy + 13;
  const empty = rows.length === 0;
  const cardH = empty ? 40 : 6 + 26 + rows.length * 34 + 44;
  const height = cardY + cardH + 46;
  const { canvas, ctx } = makeCtx(height);

  sectionLabel(ctx, 'Goals & Assists by Player', labelCy);
  card(ctx, cardY, cardH);

  if (empty) {
    ctx.font = font(14);
    ctx.fillStyle = SECONDARY;
    ctx.fillText('No goals or assists yet.', 36, cardY + 20);
  } else {
    const x1 = W - 36;
    let y = cardY + 6;
    ctx.font = font(11, 600);
    ctx.fillStyle = SECONDARY;
    ctx.fillText('PLAYER', 36, y + 13);
    ctx.textAlign = 'right';
    ctx.fillText('GOALS', x1 - 80, y + 13);
    ctx.fillText('ASSISTS', x1, y + 13);
    ctx.textAlign = 'left';
    y += 26;
    rows.forEach((r, i) => {
      const cy = y + 17;
      if (i > 0) hairline(ctx, 36, cy - 17, W - 72);
      ctx.font = font(15, 600);
      ctx.fillStyle = TEXT;
      ctx.fillText(ellipsize(ctx, r.name, x1 - 200), 36, cy);
      ctx.font = font(15);
      ctx.textAlign = 'right';
      ctx.fillText(String(r.goals), x1 - 80, cy);
      ctx.fillText(String(r.assists), x1, cy);
      ctx.textAlign = 'left';
      y += 34;
    });
    hairline(ctx, 36, y, W - 72);
    const tcy = y + 20;
    ctx.font = font(14, 600);
    ctx.fillStyle = SECONDARY;
    ctx.fillText('Total', 36, tcy);
    ctx.font = font(15, 600);
    ctx.textAlign = 'right';
    ctx.fillText(String(totalGoals), x1 - 80, tcy);
    ctx.fillText(String(totalAssists), x1, tcy);
    ctx.textAlign = 'left';
  }

  footer(ctx, height, captionFor(match));
  return { title: 'Goals & Assists', name: 'Goals & Assists.png', canvas };
}

// --- Photo 4+: the goals logged, paginated ------------------------------------

const GOALS_PER_PAGE = 8;

const goalRowH = (goal) => 10 + 20 + 18 + (goal.notes ? 18 : 0) + 10;

function goalsLoggedPhotos(match) {
  const goals = [...match.goalTimes].sort((a, b) => a.minute - b.minute);
  const pages = [];
  for (let i = 0; i < goals.length; i += GOALS_PER_PAGE) pages.push(goals.slice(i, i + GOALS_PER_PAGE));
  if (pages.length === 0) pages.push([]);

  return pages.map((page, pi) => {
    const labelCy = 30;
    const cardY = labelCy + 13;
    const empty = page.length === 0;
    const cardH = empty ? 40 : page.reduce((n, g) => n + goalRowH(g), 0);
    const height = cardY + cardH + 46;
    const { canvas, ctx } = makeCtx(height);

    const title =
      match.goalTimes.length === 0
        ? 'Goals Logged'
        : pages.length > 1
        ? `Goals Logged (${match.goalTimes.length}) · ${pi + 1} of ${pages.length}`
        : `Goals Logged (${match.goalTimes.length})`;
    sectionLabel(ctx, title, labelCy);
    card(ctx, cardY, cardH);

    if (empty) {
      ctx.font = font(14);
      ctx.fillStyle = SECONDARY;
      ctx.fillText('No goals logged yet.', 36, cardY + 20);
    } else {
      let y = cardY;
      page.forEach((g, i) => {
        if (i > 0) hairline(ctx, 36, y, W - 72);
        const chipX = minuteChip(ctx, `${g.minute}'`, 36, y + 20, GREEN);
        const tx = chipX + 12;
        const maxW = W - 56 - tx;
        ctx.font = font(15, 600);
        ctx.fillStyle = TEXT;
        ctx.fillText(ellipsize(ctx, g.scorer || 'Unknown scorer', maxW), tx, y + 20);
        ctx.font = font(13);
        ctx.fillStyle = SECONDARY;
        ctx.fillText(ellipsize(ctx, g.assist ? `Assist: ${g.assist}` : 'No assist', maxW), tx, y + 38);
        if (g.notes) ctx.fillText(ellipsize(ctx, g.notes, maxW), tx, y + 56);
        y += goalRowH(g);
      });
    }

    footer(ctx, height, captionFor(match));
    return {
      title: pi === 0 ? 'Goals Logged' : `Goals Logged (${pi + 1})`,
      name: pages.length > 1 ? `Goals Logged ${pi + 1}.png` : 'Goals Logged.png',
      canvas,
    };
  });
}

// --- The whole set ------------------------------------------------------------

export function buildMatchPhotos(match) {
  return [
    fixturePhoto(match),
    squadPhoto(match),
    goalsAssistsPhoto(match),
    ...goalsLoggedPhotos(match),
  ].map((p) => ({ ...p, dataUrl: p.canvas.toDataURL('image/png') }));
}

// A generated picture as a file, ready for the iOS share sheet.
export async function dataUrlToFile(dataUrl, name) {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: 'image/png' });
}

// --- Season and player season exports -----------------------------------------
//
// The season tables are wider than a match photo needs to be — eight and nine
// columns of numbers — so these draw on a landscape canvas using the same
// palette and card language as the match photos.

const TW = 560;

function makeWideCtx(height) {
  const h = Math.max(120, Math.ceil(height));
  const canvas = document.createElement('canvas');
  canvas.width = TW * S;
  canvas.height = h * S;
  const ctx = canvas.getContext('2d');
  ctx.scale(S, S);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, TW, h);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  return { canvas, ctx };
}

function seasonFooter(ctx, height, seasonName) {
  ctx.font = font(11);
  ctx.fillStyle = SECONDARY;
  ctx.textAlign = 'center';
  ctx.fillText(`MatchStatsLog  ·  ${seasonName || ''}`, TW / 2, height - 16);
  ctx.textAlign = 'left';
}

// One picture of the squad totals table, as filtered and sorted on screen.
export function buildSeasonPhotos(seasonName, division, matchesCounted, players) {
  const cols = [
    { key: 'played', label: 'GP', w: 44 },
    { key: 'starts', label: 'St', w: 44 },
    { key: 'notAvailable', label: 'NA', w: 44 },
    { key: 'goals', label: 'G', w: 44 },
    { key: 'assists', label: 'A', w: 44 },
    { key: 'potm', label: 'POTM', w: 54 },
    { key: 'percentage', label: '%', w: 48 },
  ];
  const left = 36;
  const right = TW - 36;
  let x = right;
  const xs = cols.map((c) => { const cx = x; x -= c.w; return cx; });
  const nameW = xs[xs.length - 1] - cols[cols.length - 1].w - left - 14;

  const headerH = 30;
  const rowH = 36;
  const labelCy = 30;
  const cardY = labelCy + 13;
  const empty = players.length === 0;
  const cardH = empty ? 40 : headerH + 8 + players.length * rowH + 12;
  const height = cardY + cardH + 46;
  const { canvas, ctx } = makeWideCtx(height);

  sectionLabel(
    ctx,
    `Squad Totals — ${division || 'All'} (${matchesCounted} ${
      matchesCounted === 1 ? 'match' : 'matches'
    })`,
    labelCy
  );
  card(ctx, cardY, cardH, 20, TW - 40);

  if (empty) {
    ctx.font = font(14);
    ctx.fillStyle = SECONDARY;
    ctx.fillText('No players to count yet.', left, cardY + 20);
  } else {
    let y = cardY + 8;
    ctx.font = font(11, 600);
    ctx.fillStyle = SECONDARY;
    ctx.fillText('PLAYER', left, y + headerH / 2);
    cols.forEach((c, i) => {
      ctx.textAlign = 'right';
      ctx.fillText(c.label, xs[i], y + headerH / 2);
      ctx.textAlign = 'left';
    });
    y += headerH;
    hairline(ctx, left, y, TW - 72);
    players.forEach((p, i) => {
      const cy = y + rowH / 2 + 0.5;
      if (i > 0) hairline(ctx, left, y, TW - 72);
      ctx.font = font(15, 600);
      ctx.fillStyle = TEXT;
      ctx.fillText(ellipsize(ctx, p.name, nameW), left, cy);
      cols.forEach((c, j) => {
        const v =
          c.key === 'percentage'
            ? (p.percentage === null ? '—' : `${p.percentage}%`)
            : String(p[c.key]);
        ctx.font = font(c.key === 'percentage' ? 15 : 14, c.key === 'percentage' ? 600 : 400);
        ctx.fillStyle = TEXT;
        ctx.textAlign = 'right';
        ctx.fillText(v, xs[j], cy);
        ctx.textAlign = 'left';
      });
      y += rowH;
    });
  }

  seasonFooter(ctx, height, seasonName);
  return [{ title: 'Squad Totals', name: 'Squad Totals.png', canvas }].map((p) => ({
    ...p,
    dataUrl: p.canvas.toDataURL('image/png'),
  }));
}

// One player's season as two pictures: the totals, then the match-by-match
// table (with the date under each opposition name).
export function buildPlayerSeasonPhotos(seasonName, playerName, division, me, rows) {
  const labelCy = 30;
  const cardY = labelCy + 13;

  // Photo 1 — the season totals, as label:value rows.
  const totals = [
    ['Games', me.played],
    ['Starts', me.starts],
    ['Goals', me.goals],
    ['Assists', me.assists],
    ['POTM', me.potm],
    ['Minutes', `${me.minutes}m`],
    ['Played', me.percentage === null ? '—' : `${me.percentage}%`],
  ];
  const totalsCardH = totals.length * 30 + 12;
  const totalsH = cardY + totalsCardH + 46;
  const t = makeCtx(totalsH);
  sectionLabel(t.ctx, `${playerName} — Season Totals (${division || 'All'})`, labelCy);
  card(t.ctx, cardY, totalsCardH);
  let ty = cardY + 6;
  totals.forEach(([k, v]) => {
    t.ctx.font = font(15);
    t.ctx.fillStyle = SECONDARY;
    t.ctx.fillText(k, 36, ty + 15);
    t.ctx.font = font(15, 600);
    t.ctx.fillStyle = TEXT;
    t.ctx.textAlign = 'right';
    t.ctx.fillText(String(v), W - 36, ty + 15);
    t.ctx.textAlign = 'left';
    ty += 30;
  });
  footer(t.ctx, totalsH, ['MatchStatsLog', seasonName].filter(Boolean).join('  ·  '));
  const totalsPhoto = {
    title: 'Season Totals',
    name: 'Season Totals.png',
    canvas: t.canvas,
  };

  // Photo 2 — the match-by-match table.
  const cols = [
    { label: 'H/A', w: 30 },
    { label: 'Av', w: 30 },
    { label: 'St', w: 30 },
    { label: 'G', w: 26 },
    { label: 'A', w: 26 },
    { label: 'POTM', w: 36 },
    { label: 'Time', w: 40 },
    { label: '%', w: 34 },
  ];
  const left = 36;
  const right = TW - 36;
  let x = right;
  const xs = cols.map((c) => { const cx = x; x -= c.w; return cx; });
  const oppW = xs[0] - left - 14;

  const headerH = 30;
  const rowH = 40;
  const empty = rows.length === 0;
  const tableCardH = empty ? 40 : headerH + 8 + rows.length * rowH + 12;
  const tableH = cardY + tableCardH + 46;
  const m = makeWideCtx(tableH);
  const c = m.ctx;
  sectionLabel(c, `${playerName} — Match by Match (${division || 'All'})`, labelCy);
  card(c, cardY, tableCardH, 20, TW - 40);

  if (empty) {
    c.font = font(14);
    c.fillStyle = SECONDARY;
    c.fillText('No matches in this season yet.', left, cardY + 20);
  } else {
    let y = cardY + 8;
    c.font = font(11, 600);
    c.fillStyle = SECONDARY;
    c.fillText('OPPOSITION', left, y + headerH / 2);
    cols.forEach((col, i) => {
      c.textAlign = 'right';
      c.fillText(col.label.toUpperCase(), xs[i], y + headerH / 2);
      c.textAlign = 'left';
    });
    y += headerH;
    hairline(c, left, y, TW - 72);
    rows.forEach((r, i) => {
      const cy = y + rowH / 2;
      if (i > 0) hairline(c, left, y, TW - 72);
      c.font = font(14, 600);
      c.fillStyle = TEXT;
      c.fillText(ellipsize(c, r.opposition || 'No opposition', oppW), left, cy - 8);
      c.font = font(11);
      c.fillStyle = SECONDARY;
      c.fillText(formatDate(r.date), left, cy + 10);
      const vals = [
        r.homeAway === 'Home' ? 'H' : r.homeAway === 'Away' ? 'A' : '—',
        r.available === null ? '—' : r.available ? 'Y' : 'N',
        r.started === null ? '—' : r.started ? 'Y' : 'N',
        String(r.goals),
        String(r.assists),
        r.potm ? 'Y' : '',
        r.minutes === null ? '—' : `${r.minutes}m`,
        r.pct === null ? '—' : `${r.pct}%`,
      ];
      const weights = [400, 600, 600, 400, 400, 600, 400, 600];
      vals.forEach((v, j) => {
        c.font = font(13, weights[j]);
        c.fillStyle = TEXT;
        c.textAlign = 'right';
        c.fillText(v, xs[j], cy);
        c.textAlign = 'left';
      });
      y += rowH;
    });
  }

  seasonFooter(c, tableH, seasonName);
  const tablePhoto = {
    title: 'Match by Match',
    name: 'Match by Match.png',
    canvas: m.canvas,
  };

  return [totalsPhoto, tablePhoto].map((p) => ({
    ...p,
    dataUrl: p.canvas.toDataURL('image/png'),
  }));
}