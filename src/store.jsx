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

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function makePlayer(name) {
  return { name, periods: [0, 0, 0, 0, 0, 0, 0, 0], goals: 0, assists: 0 };
}

export function makeMatch() {
  return {
    opposition: '',
    homeAway: '',
    date: todayISO(),
    result: '',
    players: PLAYER_NAMES.map(makePlayer),
    goalTimes: [],
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
    players: players.length ? players : base.players,
    goalTimes,
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

const MatchContext = createContext(null);

export function useMatch() {
  return useContext(MatchContext);
}

export function MatchProvider({ children }) {
  const [match, setMatch] = useState(loadMatch);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(match));
    } catch {
      /* storage full or unavailable — the app keeps working in memory */
    }
  }, [match]);

  const value = {
    match,

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
