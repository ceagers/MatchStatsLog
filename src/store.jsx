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

// The match is timed in eight periods — the same eight the squad grid uses.
export const MAX_PERIODS = 8;

const STORE_KEY = 'matchday.v2';
const LEGACY_KEY = 'matchday.v1';
const SAVED_KEY = 'matchday.saved.v1';

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

export function makeClock() {
  return { running: false, startedAt: null, elapsedMs: 0, periodIndex: 0, periodMs: [] };
}

/// Time on the clock in the period being timed right now.
export function livePeriodMs(clock, at = Date.now()) {
  if (!clock) return 0;
  const banked =
    Number.isFinite(clock.elapsedMs) && clock.elapsedMs > 0 ? clock.elapsedMs : 0;
  const run =
    clock.running && Number.isFinite(clock.startedAt)
      ? Math.max(0, at - clock.startedAt)
      : 0;
  return banked + run;
}

/// Every period timed so far, plus the one in progress.
export function clockTotalMs(clock, at = Date.now()) {
  if (!clock) return 0;
  const banked = (clock.periodMs || []).reduce(
    (n, ms) => n + (Number.isFinite(ms) && ms > 0 ? ms : 0),
    0
  );
  return banked + livePeriodMs(clock, at);
}

/// The match minute the clock is sitting in, for prefilling a goal.
export function clockMinute(clock, at = Date.now()) {
  return Math.max(1, Math.min(120, Math.floor(clockTotalMs(clock, at) / 60000) + 1));
}

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
  const index =
    Number.isFinite(c.periodIndex) && c.periodIndex > 0
      ? Math.min(Math.floor(c.periodIndex), MAX_PERIODS - 1)
      : 0;
  return {
    running,
    startedAt: running ? c.startedAt : null,
    elapsedMs: Number.isFinite(c.elapsedMs) && c.elapsedMs > 0 ? c.elapsedMs : 0,
    periodIndex: index,
    periodMs: (Array.isArray(c.periodMs) ? c.periodMs : [])
      .slice(0, MAX_PERIODS)
      .map((ms) => (Number.isFinite(ms) && ms > 0 ? ms : 0)),
  };
}

// A clock caught mid-period, ready for history: the run in progress is banked
// into its own period and the clock stops, so a saved time never creeps forward.
function freezeClock(raw) {
  const clock = normaliseClock(raw);
  const periodMs = [...clock.periodMs];
  periodMs[clock.periodIndex] = livePeriodMs(clock);
  return { ...clock, running: false, startedAt: null, elapsedMs: 0, periodMs };
}

export function makeMatch() {
  return {
    opposition: '',
    homeAway: '',
    date: todayISO(),
    result: '',
    // Set once the match has been written to history, so saving again updates
    // that same record instead of piling up duplicates.
    savedId: null,
    players: PLAYER_NAMES.map(makePlayer),
    goalTimes: [],
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

  return {
    opposition: typeof raw.opposition === 'string' ? raw.opposition : '',
    homeAway: typeof raw.homeAway === 'string' ? raw.homeAway : '',
    date: typeof raw.date === 'string' && raw.date ? raw.date.slice(0, 10) : base.date,
    result: typeof raw.result === 'string' ? raw.result : '',
    savedId: typeof raw.savedId === 'string' ? raw.savedId : null,
    players: players.length ? players : base.players,
    goalTimes,
    clock: normaliseClock(raw.clock),
  };
}

function loadMatch() {
  try {
    const raw = localStorage.getItem(STORE_KEY) || localStorage.getItem(LEGACY_KEY);
    return raw ? normalise(JSON.parse(raw)) : makeMatch();
  } catch {
    return makeMatch();
  }
}

// Saved match history: newest first, each an immutable snapshot of a match.
function loadSaved() {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((r) => r && typeof r === 'object' && typeof r.id === 'string')
      .map((r) => ({
        id: r.id,
        savedAt: typeof r.savedAt === 'string' ? r.savedAt : new Date().toISOString(),
        match: normalise(r.match),
      }));
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
  const [savedMatches, setSavedMatches] = useState(loadSaved);

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

  const value = {
    match,
    savedMatches,

    setOpposition: (opposition) => setMatch((m) => ({ ...m, opposition })),

    setHomeAway: (homeAway) => setMatch((m) => ({ ...m, homeAway })),

    setDate: (date) => setMatch((m) => ({ ...m, date })),

    setResult: (result) => setMatch((m) => ({ ...m, result })),

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

    // Keep whatever squad the user has built up; clear everything else.
    resetMatch: () =>
      setMatch((m) => ({ ...makeMatch(), players: m.players.map((p) => makePlayer(p.name)) })),

    startClock: () =>
      setMatch((m) =>
        m.clock.running
          ? m
          : { ...m, clock: { ...m.clock, running: true, startedAt: Date.now() } }
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
                elapsedMs: livePeriodMs(m.clock),
              },
            }
          : m
      ),

    resetClock: () => setMatch((m) => ({ ...m, clock: makeClock() })),

    // Bank the period being timed and roll the clock on to the next one. On the
    // last period it stops instead, leaving the match complete.
    nextPeriod: () =>
      setMatch((m) => {
        const c = m.clock;
        const index = Math.min(Math.max(0, c.periodIndex), MAX_PERIODS - 1);
        const periodMs = [...c.periodMs.slice(0, index)];
        periodMs[index] = livePeriodMs(c);
        const last = index >= MAX_PERIODS - 1;
        const carryOn = !last && c.running;
        return {
          ...m,
          clock: {
            running: carryOn,
            startedAt: carryOn ? Date.now() : null,
            elapsedMs: 0,
            periodIndex: last ? index : index + 1,
            periodMs,
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
          ? list.map((r) => (r.id === id ? { id, savedAt, match: snapshot } : r))
          : [{ id, savedAt, match: snapshot }, ...list]
      );
      setMatch((m) => ({ ...m, savedId: id }));
      return id;
    },

    deleteSavedMatch: (id) => {
      setSavedMatches((list) => list.filter((r) => r.id !== id));
      setMatch((m) => (m.savedId === id ? { ...m, savedId: null } : m));
    },

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
