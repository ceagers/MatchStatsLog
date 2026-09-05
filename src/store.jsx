// The single match record for the app, plus every operation on it.
// State lives in React and is mirrored into localStorage on every change.

import { createContext, useContext, useEffect, useState } from 'react';

export const PLAYER_NAMES = [
  'BB', 'TP', 'TL', 'LJ', 'JE', 'RM', 'AM', 'JA',
  'OO', 'MHB', 'IC', 'TF', 'LP', 'EB',
];

const STORE_KEY = 'matchday.v1';

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function makePlayer(name) {
  return { name, periods: [false, false, false, false, false, false, false, false], goals: 0, assists: 0 };
}

export function makeMatch() {
  return {
    opposition: '',
    date: todayISO(),
    players: PLAYER_NAMES.map(makePlayer),
    goalTimes: [],
  };
}

// Defensive: stored data from an older shape must never crash the launch.
function normalise(raw) {
  const base = makeMatch();
  if (!raw || typeof raw !== 'object') return base;

  const storedPlayers = Array.isArray(raw.players) ? raw.players : [];
  const players = PLAYER_NAMES.map((name) => {
    const found = storedPlayers.find((p) => p && p.name === name);
    if (!found) return makePlayer(name);
    const periods = Array.isArray(found.periods) ? found.periods : [];
    return {
      name,
      periods: Array.from({ length: 8 }, (_, i) => periods[i] === true),
      goals: Number.isFinite(found.goals) ? found.goals : 0,
      assists: Number.isFinite(found.assists) ? found.assists : 0,
    };
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
    date: typeof raw.date === 'string' && raw.date ? raw.date.slice(0, 10) : base.date,
    players,
    goalTimes,
  };
}

function loadMatch() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
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

    setDate: (date) => setMatch((m) => ({ ...m, date })),

    togglePeriod: (name, index) =>
      setMatch((m) => ({
        ...m,
        players: m.players.map((p) =>
          p.name === name
            ? { ...p, periods: p.periods.map((on, i) => (i === index ? !on : on)) }
            : p
        ),
      })),

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

    resetMatch: () => setMatch(makeMatch()),
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
