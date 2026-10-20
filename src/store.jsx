// The single match record for the app, plus every operation on it.
// State lives in React and is mirrored into localStorage on every change.

import { createContext, useContext, useEffect, useState } from 'react';

export const PLAYER_NAMES = [
  'BB', 'TP', 'TL', 'LJ', 'JE', 'RM', 'AM', 'JA',
  'OO', 'MHB', 'IC', 'TF', 'LP', 'EB',
];

// Period states: 0 = unset (grey), 1 = played (green), 2 = flagged (red).
export const PERIOD_UNSET = 0;
export const PERIOD_GREEN = 1;
export const PERIOD_RED = 2;

const STORE_KEY = 'matchday.v2';
const LEGACY_KEY = 'matchday.v1';
const SAVED_KEY = 'matchday.saved.v1';
const SEASONS_KEY = 'matchday.seasons.v1';

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function makePlayer(name) {
  return { name, periods: [0, 0, 0, 0, 0, 0, 0, 0], goals: 0, assists: 0 };
}

// --- The match clock -------------------------------------------------------
// Time is read off the wall clock rather than counted in ticks, so the minute is
// still right after the phone has been locked or the app sent to the background.
// offsetMs is the minute the clock counts on from — 45' for a second half, say.

export function makeClock() {
  return {
    running: false,
    stopped: false,
    startedAt: null,
    elapsedMs: 0,
    offsetMs: 0,
    // Everything timed across the whole match, banked each time the start
    // minute is moved on — so four stop-and-restart quarters still add up.
    timedMs: 0,
  };
}

/// Time counted since the clock was started, ignoring the start minute.
export function sessionMs(clock, at = Date.now()) {
  if (!clock) return 0;
  const banked =
    Number.isFinite(clock.elapsedMs) && clock.elapsedMs > 0 ? clock.elapsedMs : 0;
  const run =
    clock.running && Number.isFinite(clock.startedAt)
      ? Math.max(0, at - clock.startedAt)
      : 0;
  return banked + run;
}

/// Everything timed across the whole match, start-minute offsets aside: the
/// running total is banked each time the clock is moved on, so several
/// stop-and-restart segments add up to one figure.
export function totalTimedMs(clock, at = Date.now()) {
  if (!clock) return 0;
  const banked =
    Number.isFinite(clock.timedMs) && clock.timedMs > 0 ? clock.timedMs : 0;
  return banked + sessionMs(clock, at);
}

/// The match time on the clock: the start minute plus everything timed since.
export function clockTotalMs(clock, at = Date.now()) {
  if (!clock) return 0;
  const offset =
    Number.isFinite(clock.offsetMs) && clock.offsetMs > 0 ? clock.offsetMs : 0;
  return offset + sessionMs(clock, at);
}

/// The match minute the clock is sitting in — what a goal or a sub is logged at.
export function clockMinute(clock, at = Date.now()) {
  return Math.max(1, Math.min(120, Math.floor(clockTotalMs(clock, at) / 60000) + 1));
}

/// 'ready' | 'running' | 'paused' | 'stopped'
export function clockState(clock) {
  if (!clock) return 'ready';
  if (clock.running) return 'running';
  if (clock.stopped) return 'stopped';
  return sessionMs(clock) > 0 ? 'paused' : 'ready';
}

export const CLOCK_STATE_LABELS = {
  ready: 'Ready',
  running: 'Running',
  paused: 'Paused',
  stopped: 'Full Time',
};

/// "07:42", or "1:07:42" once past the hour.
export function formatClock(ms) {
  const total = Math.max(0, Math.round((Number.isFinite(ms) ? ms : 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const rest = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${rest}` : rest;
}

// Stored clock data from an older shape must never crash the launch.
function normaliseClock(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const running = c.running === true && Number.isFinite(c.startedAt);
  // Records from before the clock was reworked timed the match in eight periods;
  // whatever they banked becomes time on this clock.
  const legacy = (Array.isArray(c.periodMs) ? c.periodMs : []).reduce(
    (n, ms) => n + (Number.isFinite(ms) && ms > 0 ? ms : 0),
    0
  );
  const elapsed = Number.isFinite(c.elapsedMs) && c.elapsedMs > 0 ? c.elapsedMs : 0;
  const offset = Number.isFinite(c.offsetMs) && c.offsetMs > 0 ? c.offsetMs : 0;
  const timedMs =
    Number.isFinite(c.timedMs) && c.timedMs > 0
      ? c.timedMs
      : // Records from before the running total was tracked moved the start
        // minute on to wherever the clock read, so it stands in for the time
        // already timed.
        offset;
  return {
    running,
    stopped: c.stopped === true && !running,
    startedAt: running ? c.startedAt : null,
    elapsedMs: elapsed + legacy,
    offsetMs: offset,
    timedMs,
  };
}

// A clock caught mid-run, ready for history: the run is banked and it stops, so a
// saved time never creeps forward.
function freezeClock(raw) {
  const clock = normaliseClock(raw);
  return {
    ...clock,
    running: false,
    startedAt: null,
    elapsedMs: sessionMs(clock),
    timedMs: totalTimedMs(clock),
  };
}

export function makeMatch() {
  return {
    opposition: '',
    homeAway: '',
    // Which division the match belongs to — JPL or PDJAL, say — and what
    // kind of fixture it is: League, Cup, and so on. Both are set on the
    // Match Info tab; their option lists are editable in Settings.
    competition: '',
    type: '',
    date: todayISO(),
    result: '',
    // Player of the match, picked from the squad list on the Match Info tab.
    potm: '',
    // Planned length of the game in minutes — 60 or 80, say. 0 until it is
    // set on the Match Info tab; used as the yardstick for minutes played.
    gameLength: 0,
    // How many of the grid's eight period columns this match spans — 4 for a
    // 60-minute game with subs every 15 minutes, say. 0 means work it out
    // from the furthest column the squad actually marked.
    periodsUsed: 0,
    // Set once the match has been written to history, so saving again updates
    // that same record instead of piling up duplicates.
    savedId: null,
    players: PLAYER_NAMES.map(makePlayer),
    goalTimes: [],
    subs: [],
    clock: makeClock(),
  };
}

// Older records stored booleans; true becomes green.
function toPeriodState(value) {
  if (value === true || value === 1) return PERIOD_GREEN;
  if (value === 2) return PERIOD_RED;
  return PERIOD_UNSET;
}

// Defensive: stored data from an older shape must never crash the launch.
function normalise(raw) {
  const base = makeMatch();
  if (!raw || typeof raw !== 'object') return base;

  const storedPlayers = Array.isArray(raw.players) ? raw.players : [];
  const seen = new Set();
  const players = [];
  storedPlayers.forEach((p) => {
    const name = p && typeof p.name === 'string' ? p.name.trim() : '';
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    const periods = Array.isArray(p.periods) ? p.periods : [];
    players.push({
      name,
      periods: Array.from({ length: 8 }, (_, i) => toPeriodState(periods[i])),
      goals: Number.isFinite(p.goals) ? p.goals : 0,
      assists: Number.isFinite(p.assists) ? p.assists : 0,
    });
  });

  const goalTimes = (Array.isArray(raw.goalTimes) ? raw.goalTimes : []).map((g, i) => ({
    id: g && g.id ? g.id : `g${i}-${Math.random().toString(36).slice(2, 8)}`,
    minute: g && Number.isFinite(g.minute) ? g.minute : 1,
    scorer: g && typeof g.scorer === 'string' ? g.scorer : '',
    assist: g && typeof g.assist === 'string' ? g.assist : '',
    notes: g && typeof g.notes === 'string' ? g.notes : '',
  }));

  const subs = (Array.isArray(raw.subs) ? raw.subs : []).map((s, i) => ({
    id: s && s.id ? s.id : `s${i}-${Math.random().toString(36).slice(2, 8)}`,
    minute: s && Number.isFinite(s.minute) ? s.minute : 1,
    on: s && typeof s.on === 'string' ? s.on : '',
    off: s && typeof s.off === 'string' ? s.off : '',
    notes: s && typeof s.notes === 'string' ? s.notes : '',
  }));

  return {
    opposition: typeof raw.opposition === 'string' ? raw.opposition : '',
    homeAway: typeof raw.homeAway === 'string' ? raw.homeAway : '',
    competition:
      typeof raw.competition === 'string' ? raw.competition : '',
    type: typeof raw.type === 'string' ? raw.type : '',
    date: typeof raw.date === 'string' && raw.date ? raw.date.slice(0, 10) : base.date,
    result: typeof raw.result === 'string' ? raw.result : '',
    potm: typeof raw.potm === 'string' ? raw.potm : '',
    gameLength:
      Number.isFinite(raw.gameLength) && raw.gameLength > 0
        ? Math.min(200, Math.round(raw.gameLength))
        : 0,
    periodsUsed:
      Number.isFinite(raw.periodsUsed) && raw.periodsUsed > 0
        ? Math.min(8, Math.round(raw.periodsUsed))
        : 0,
    savedId: typeof raw.savedId === 'string' ? raw.savedId : null,
    players: players.length ? players : base.players,
    goalTimes,
    subs,
    clock: normaliseClock(raw.clock),
  };
}

// --- Minutes played ----------------------------------------------------------
// Who was on the pitch, and for how long. When the clock has been used, the
// total comes from the substitution log: green Period 1 players are on from
// kick-off, each logged sub moves its pair at that minute, and anyone still
// on comes off at full time. Without the clock, each green period in the
// grid counts as one period of the game length set on the Match Info tab,
// where "a period" is one of the columns the squad actually marked — the
// estimate divides the game by the periods used, not always by eight.

/// How many of the grid's eight period columns a match spans: the explicit
/// override (match.periodsUsed) when set, otherwise the furthest column
/// anyone marked — so a 60-minute game logged in four periods estimates
/// correctly without any extra work.
export function effectivePeriodsUsed(match) {
  const override =
    Number.isFinite(match?.periodsUsed) ? Math.round(match.periodsUsed) : 0;
  if (override > 0 && override <= 8) return override;

  let used = 0;
  (Array.isArray(match?.players) ? match.players : []).forEach((p) => {
    if (!Array.isArray(p.periods)) return;
    p.periods.forEach((s, i) => {
      if (s !== PERIOD_UNSET && i + 1 > used) used = i + 1;
    });
  });
  return used || 8;
}

export function computePlayerMinutes(match) {
  const players = Array.isArray(match?.players) ? match.players : [];
  const minutes = new Map();
  const totalMs = clockTotalMs(match?.clock);

  if (totalMs >= 60000) {
    const fullTime = Math.max(1, Math.floor(totalMs / 60000));
    const onSince = new Map();
    const enter = (name, at) => {
      if (name && !onSince.has(name)) {
        onSince.set(name, Math.max(0, Math.min(at, fullTime)));
      }
    };
    const exit = (name, at) => {
      if (!name || !onSince.has(name)) return;
      const from = onSince.get(name);
      const to = Math.max(0, Math.min(at, fullTime));
      minutes.set(name, (minutes.get(name) || 0) + Math.max(0, to - from));
      onSince.delete(name);
    };
    players
      .filter((p) => p.periods[0] === PERIOD_GREEN)
      .forEach((p) => enter(p.name, 0));
    [...(Array.isArray(match.subs) ? match.subs : [])]
      .slice()
      .sort((a, b) => a.minute - b.minute)
      .forEach((s) => {
        exit(s.off, s.minute);
        enter(s.on, s.minute);
      });
    onSince.forEach((_from, name) => exit(name, fullTime));
    return { source: 'clock', fullTime, minutes };
  }

  const gameLength = Number.isFinite(match?.gameLength) ? match.gameLength : 0;
  if (gameLength > 0) {
    const periodsUsed = effectivePeriodsUsed(match);
    const per = gameLength / periodsUsed;
    players.forEach((p) => {
      const greens = p.periods.filter((s) => s === PERIOD_GREEN).length;
      minutes.set(p.name, Math.round(greens * per));
    });
    return { source: 'periods', fullTime: gameLength, minutes, periodsUsed };
  }

  return { source: 'none', fullTime: 0, minutes };
}

function loadMatch() {
  try {
    const raw = localStorage.getItem(STORE_KEY) || localStorage.getItem(LEGACY_KEY);
    return raw ? normalise(JSON.parse(raw)) : makeMatch();
  } catch {
    return makeMatch();
  }
}

// --- Seasons ---------------------------------------------------------------
// Matches are filed under a season, and exactly one season is current:
// every newly saved match lands in the current season.

function makeSeason(name) {
  return { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() };
}

function loadSeasonStore() {
  let seasons = [];
  let currentId = null;
  try {
    const raw = localStorage.getItem(SEASONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed && parsed.seasons)) {
        seasons = parsed.seasons
          .filter((s) => s && typeof s === 'object' && typeof s.id === 'string')
          .map((s) => ({
            id: s.id,
            name: typeof s.name === 'string' && s.name.trim() ? s.name : 'Season',
            createdAt:
              typeof s.createdAt === 'string' ? s.createdAt : new Date().toISOString(),
          }));
        if (typeof parsed.currentId === 'string') currentId = parsed.currentId;
      }
    }
  } catch {
    /* fall through to a fresh default season */
  }
  if (!seasons.length) seasons = [makeSeason('Default Season')];
  if (!seasons.some((s) => s.id === currentId)) currentId = seasons[0].id;
  return { seasons, currentId };
}

// Saved match history: newest first, each an immutable snapshot of a match,
// filed under a season. Records from before seasons existed land in the
// default season.
function loadSaved(seasonList, defaultSeasonId) {
  const known = new Set((seasonList || []).map((s) => s.id));
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((r) => r && typeof r === 'object' && typeof r.id === 'string')
      .map((r) => {
        // One-off backfill for records saved before the JPL/PDJAL and Type
        // fields existed: an 80-minute game is JPL, anything else PDJAL, and
        // every type is League. Runs once — the migrated records are written
        // straight back with the field set, so it never fires again.
        const needsBackfill =
          r.match && typeof r.match === 'object' && r.match.competition === undefined;
        const match = normalise(r.match);
        if (needsBackfill) {
          match.competition = match.gameLength === 80 ? 'JPL' : 'PDJAL';
          match.type = 'League';
        }
        return {
          id: r.id,
          savedAt: typeof r.savedAt === 'string' ? r.savedAt : new Date().toISOString(),
          seasonId:
            typeof r.seasonId === 'string' && known.has(r.seasonId)
              ? r.seasonId
              : defaultSeasonId,
          match,
        };
      });
  } catch {
    return [];
  }
}

const MatchContext = createContext(null);

export function useMatch() {
  return useContext(MatchContext);
}

export function MatchProvider({ children }) {
  const [match, setMatch] = useState(loadMatch);
  const seasonStore = loadSeasonStore();
  const [seasons, setSeasons] = useState(seasonStore.seasons);
  const [currentSeasonId, setCurrentSeasonId] = useState(seasonStore.currentId);
  const [savedMatches, setSavedMatches] = useState(() =>
    loadSaved(seasonStore.seasons, seasonStore.currentId)
  );

  // Which match the Home screen shows its fixture for: null is the match being
  // worked on, otherwise the id of a saved match. Ephemeral view state, not
  // persisted.
  const [homeViewId, setHomeViewId] = useState(null);
  // The saved match open in the Saved tab's detail view, so other screens
  // (Home) can jump straight to it. Also ephemeral.
  const [savedOpenId, setSavedOpenId] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(match));
    } catch {
      /* storage full or unavailable — the app keeps working in memory */
    }
  }, [match]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(savedMatches));
    } catch {
      /* storage full or unavailable — the app keeps working in memory */
    }
  }, [savedMatches]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SEASONS_KEY,
        JSON.stringify({ seasons, currentId: currentSeasonId })
      );
    } catch {
      /* storage full or unavailable — the app keeps working in memory */
    }
  }, [seasons, currentSeasonId]);

  // The season newly saved matches are filed under.
  const currentSeason =
    seasons.find((s) => s.id === currentSeasonId) || seasons[0] || null;

  const addSeason = (rawName) => {
    const name = (rawName || '').trim() || 'New Season';
    const season = makeSeason(name);
    setSeasons((list) => [...list, season]);
    setCurrentSeasonId(season.id);
    return season;
  };

  const setCurrentSeason = (id) => {
    if (!seasons.some((s) => s.id === id)) return;
    setCurrentSeasonId(id);
  };

  const renameSeason = (id, rawName) => {
    const name = (rawName || '').trim();
    if (!name) return;
    setSeasons((list) => list.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  // A season still holding matches cannot be deleted — its records would be
  // orphaned. Move or delete its matches first.
  const deleteSeason = (id) => {
    if (seasons.length <= 1) return false;
    if (savedMatches.some((r) => r.seasonId === id)) return false;
    const rest = seasons.filter((s) => s.id !== id);
    setSeasons(rest);
    if (currentSeasonId === id) setCurrentSeasonId(rest[0].id);
    return true;
  };

  // Re-file one or more saved matches into another season.
  const moveMatchesToSeason = (ids, seasonId) => {
    const wanted = new Set(Array.isArray(ids) ? ids : []);
    if (!wanted.size || !seasons.some((s) => s.id === seasonId)) return;
    setSavedMatches((list) =>
      list.map((r) => (wanted.has(r.id) ? { ...r, seasonId } : r))
    );
  };

  const value = {
    match,
    savedMatches,
    seasons,
    currentSeasonId,
    currentSeason,
    addSeason,
    setCurrentSeason,
    renameSeason,
    deleteSeason,
    moveMatchesToSeason,
    homeViewId,
    setHomeView: setHomeViewId,
    savedOpenId,
    setSavedOpenId,

    setOpposition: (opposition) => setMatch((m) => ({ ...m, opposition })),

    setHomeAway: (homeAway) => setMatch((m) => ({ ...m, homeAway })),

    setDate: (date) => setMatch((m) => ({ ...m, date })),

    setResult: (result) => setMatch((m) => ({ ...m, result })),

    setPotm: (potm) => setMatch((m) => ({ ...m, potm })),

    setCompetition: (competition) => setMatch((m) => ({ ...m, competition })),

    setType: (type) => setMatch((m) => ({ ...m, type })),

    setGameLength: (value) =>
      setMatch((m) => {
        const n = Math.round(Number(value) || 0);
        return { ...m, gameLength: Math.max(0, Math.min(200, n)) };
      }),

    setPeriodsUsed: (value) =>
      setMatch((m) => {
        const n = Math.round(Number(value) || 0);
        return { ...m, periodsUsed: Math.max(0, Math.min(8, n)) };
      }),

    // Tapping a period cycles grey -> green -> red -> grey.
    cyclePeriod: (name, index) =>
      setMatch((m) => ({
        ...m,
        players: m.players.map((p) =>
          p.name === name
            ? { ...p, periods: p.periods.map((s, i) => (i === index ? (s + 1) % 3 : s)) }
            : p
        ),
      })),

    clearPeriods: (name) =>
      setMatch((m) => ({
        ...m,
        players: m.players.map((p) =>
          p.name === name ? { ...p, periods: p.periods.map(() => PERIOD_UNSET) } : p
        ),
      })),

    addPlayer: (rawName) =>
      setMatch((m) => {
        const name = (rawName || '').trim();
        if (!name) return m;
        if (m.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return m;
        return { ...m, players: [...m.players, makePlayer(name)] };
      }),

    removePlayer: (name) =>
      setMatch((m) => ({ ...m, players: m.players.filter((p) => p.name !== name) })),

    // Drag-to-re-sort on the squad screen: lift a player out of one slot and
    // drop them into another. Everything that reads the squad order — the goal
    // and substitution pickers, the saved match — follows it.
    movePlayer: (from, to) =>
      setMatch((m) => {
        const players = [...m.players];
        const last = players.length - 1;
        if (from === to || from < 0 || to < 0 || from > last || to > last) return m;
        const [moved] = players.splice(from, 1);
        players.splice(to, 0, moved);
        return { ...m, players };
      }),

    bump: (name, field, delta) =>
      setMatch((m) => ({
        ...m,
        players: m.players.map((p) =>
          p.name === name ? { ...p, [field]: Math.max(0, p[field] + delta) } : p
        ),
      })),

    addGoal: ({ minute, scorer, assist, notes }) =>
      setMatch((m) => ({
        ...m,
        goalTimes: [
          ...m.goalTimes,
          { id: crypto.randomUUID(), minute, scorer, assist, notes },
        ],
        players: m.players.map((p) => {
          let next = p;
          if (p.name === scorer) next = { ...next, goals: next.goals + 1 };
          if (p.name === assist) next = { ...next, assists: next.assists + 1 };
          return next;
        }),
      })),

    removeGoal: (id) =>
      setMatch((m) => {
        const goal = m.goalTimes.find((g) => g.id === id);
        if (!goal) return m;
        return {
          ...m,
          goalTimes: m.goalTimes.filter((g) => g.id !== id),
          players: m.players.map((p) => {
            let next = p;
            if (p.name === goal.scorer) next = { ...next, goals: Math.max(0, next.goals - 1) };
            if (p.name === goal.assist) next = { ...next, assists: Math.max(0, next.assists - 1) };
            return next;
          }),
        };
      }),

    // Edit a logged goal in place — the scorer/assist tallies move with it,
    // so player counters stay in step with the log.
    updateGoal: (id, patch) =>
      setMatch((m) => {
        const goal = m.goalTimes.find((g) => g.id === id);
        if (!goal) return m;
        const next = { ...goal, ...patch };
        return {
          ...m,
          goalTimes: m.goalTimes.map((g) => (g.id === id ? next : g)),
          players: m.players.map((p) => {
            let n = p;
            const adjust = (name, field, delta) => {
              if (p.name === name) n = { ...n, [field]: Math.max(0, n[field] + delta) };
            };
            adjust(goal.scorer, 'goals', -1);
            adjust(goal.assist, 'assists', -1);
            adjust(next.scorer, 'goals', +1);
            adjust(next.assist, 'assists', +1);
            return n;
          }),
        };
      }),

    addSub: ({ minute, on, off, notes }) =>
      setMatch((m) => ({
        ...m,
        subs: [...m.subs, { id: crypto.randomUUID(), minute, on, off, notes }],
      })),

    removeSub: (id) => setMatch((m) => ({ ...m, subs: m.subs.filter((s) => s.id !== id) })),

    updateSub: (id, patch) =>
      setMatch((m) => ({
        ...m,
        subs: m.subs.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      })),

    // Keep whatever squad the user has built up; clear everything else.
    resetMatch: () =>
      setMatch((m) => ({ ...makeMatch(), players: m.players.map((p) => makePlayer(p.name)) })),

    startClock: () =>
      setMatch((m) =>
        m.clock.running
          ? m
          : {
              ...m,
              clock: { ...m.clock, running: true, stopped: false, startedAt: Date.now() },
            }
      ),

    pauseClock: () =>
      setMatch((m) =>
        m.clock.running
          ? {
              ...m,
              clock: {
                ...m.clock,
                running: false,
                startedAt: null,
                elapsedMs: sessionMs(m.clock),
              },
            }
          : m
      ),

    // Stop ends the run: the time is kept and the clock reads Full Time.
    stopClock: () =>
      setMatch((m) =>
        m.clock.running || !m.clock.stopped
          ? {
              ...m,
              clock: {
                ...m.clock,
                running: false,
                stopped: true,
                startedAt: null,
                elapsedMs: sessionMs(m.clock),
              },
            }
          : m
      ),

    resetClock: () => setMatch((m) => ({ ...m, clock: makeClock() })),

    // The minute the clock counts on from — 0 is kick-off. The clock jumps to
    // that minute now; everything timed so far is banked into the running
    // total, so several stop-and-restart segments still add up to one figure.
    setClockStart: (minutes) =>
      setMatch((m) => {
        const chosen = Math.max(0, Math.min(120, Math.round(Number(minutes) || 0)));
        return {
          ...m,
          clock: {
            ...makeClock(),
            offsetMs: chosen * 60000,
            timedMs: totalTimedMs(m.clock),
          },
        };
      }),

    // Write the current match into history. Re-saving a match that came from
    // history updates that record rather than creating a second copy.
    saveCurrentMatch: () => {
      const id = match.savedId || crypto.randomUUID();
      const savedAt = new Date().toISOString();
      const snapshot = JSON.parse(
        JSON.stringify({ ...match, clock: freezeClock(match.clock), savedId: id })
      );
      setSavedMatches((list) =>
        list.some((r) => r.id === id)
          ? list.map((r) =>
              r.id === id
                ? { id, savedAt, seasonId: r.seasonId || currentSeasonId, match: snapshot }
                : r
            )
          : [
              { id, savedAt, seasonId: currentSeasonId, match: snapshot },
              ...list,
            ]
      );
      setMatch((m) => ({ ...m, savedId: id }));
      return id;
    },

    deleteSavedMatch: (id) => {
      setSavedMatches((list) => list.filter((r) => r.id !== id));
      setMatch((m) => (m.savedId === id ? { ...m, savedId: null } : m));
      // A deleted match can no longer be the Home fixture or the open detail.
      setHomeViewId((v) => (v === id ? null : v));
      setSavedOpenId((v) => (v === id ? null : v));
    },

    // Patch a saved record in place — small corrections (periods used, say)
    // without pulling the whole match back out of history.
    updateSavedMatch: (id, patch) =>
      setSavedMatches((list) =>
        list.map((r) =>
          r.id === id
            ? { ...r, match: normalise({ ...r.match, ...patch }) }
            : r
        )
      ),

    // Bring a saved match back as the live match, so it can be edited again.
    restoreSavedMatch: (id) => {
      const record = savedMatches.find((r) => r.id === id);
      if (!record) return;
      setMatch({ ...normalise(record.match), savedId: id });
    },
  };

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>;
}

/// "Sat 14 Sep 2025" from a YYYY-MM-DD string.
export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/// "14 Sep, 19:30" for a saved-at timestamp.
export function formatSavedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// --- Season totals -----------------------------------------------------------
// Per-player roll-up across every saved match in a season. A green Period 1
// mark is a start, red is on the bench (still a game played), and no colour
// is not available. A match whose squad grid was never marked carries no
// appearance data, so it is left out of the played/started/not-available and
// minutes counts — goals logged in it still count. Percentage played is the
// player's minutes against the match time of only the matches they were
// available for (started or benched), not every match in the season.
export function computeSeasonStats(records) {
  const blank = () => ({
    played: 0,
    starts: 0,
    notAvailable: 0,
    goals: 0,
    assists: 0,
    potm: 0,
    minutes: 0,
    teamMinutes: 0,
  });

  const totals = new Map();
  const order = [];
  const ensure = (name) => {
    let t = totals.get(name);
    if (!t) {
      t = blank();
      totals.set(name, t);
      order.push(name);
    }
    return t;
  };

  let matchesCounted = 0;

  (Array.isArray(records) ? records : []).forEach((record) => {
    const match = record && record.match;
    if (!match) return;
    const players = Array.isArray(match.players) ? match.players : [];

    players.forEach((p) => ensure(p.name));
    players.forEach((p) => {
      const t = totals.get(p.name);
      t.goals += Number.isFinite(p.goals) ? p.goals : 0;
      t.assists += Number.isFinite(p.assists) ? p.assists : 0;
    });

    // Player-of-the-match awards count for every match in the season — even
    // one whose squad grid was never marked. A POTM name that doesn't sit in
    // the squad list still keeps its award (and gains its own row).
    const potmName = typeof match.potm === 'string' ? match.potm.trim() : '';
    if (potmName) ensure(potmName).potm += 1;

    const gridUsed = players.some(
      (p) => Array.isArray(p.periods) && p.periods.some((s) => s !== PERIOD_UNSET)
    );
    if (!gridUsed) return;

    matchesCounted += 1;

    players.forEach((p) => {
      const t = totals.get(p.name);
      const first = Array.isArray(p.periods) ? p.periods[0] : PERIOD_UNSET;
      if (first === PERIOD_GREEN) {
        t.played += 1;
        t.starts += 1;
      } else if (first === PERIOD_RED) {
        t.played += 1;
      } else {
        t.notAvailable += 1;
      }
    });

    const timedMs = clockTotalMs(match.clock);
    const matchMinutes =
      timedMs >= 60000
        ? Math.floor(timedMs / 60000)
        : Number.isFinite(match.gameLength) && match.gameLength > 0
          ? match.gameLength
          : 0;
    if (matchMinutes > 0) {
      const { minutes } = computePlayerMinutes(match);
      players.forEach((p) => {
        const t = totals.get(p.name);
        const first = Array.isArray(p.periods) ? p.periods[0] : PERIOD_UNSET;
        t.minutes += minutes.get(p.name) || 0;
        // The percentage denominator counts only the matches this player was
        // available for — started or benched — not every match logged.
        if (first !== PERIOD_UNSET) t.teamMinutes += matchMinutes;
      });
    }
  });

  const players = order.map((name) => {
    const t = totals.get(name);
    const percentage =
      t.teamMinutes > 0 ? Math.round((100 * t.minutes) / t.teamMinutes) : null;
    return { name, ...t, percentage };
  });
  return { players, matchesCounted };
}