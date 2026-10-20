// One player's season: a header of their totals, then every match in the
// season as a row — whether they were available, whether they started, what
// they contributed, and how long they spent on the pitch.

import { useMemo } from 'react';
import {
  Page, Navbar, NavbarBackLink, Block, BlockTitle, List,
} from 'konsta/react';
import {
  computeSeasonStats, computePlayerMinutes, clockTotalMs, formatDate,
  PERIOD_UNSET, PERIOD_GREEN,
} from '../store.jsx';

const BLANK_TOTALS = {
  played: 0, starts: 0, notAvailable: 0, goals: 0, assists: 0,
  potm: 0, minutes: 0, percentage: null,
};

export default function PlayerSeasonScreen({ season, playerName, matches, onBack }) {
  const { rows, me } = useMemo(() => {
    const recs = Array.isArray(matches) ? matches : [];

    const gridUsed = (m) =>
      (Array.isArray(m.players) ? m.players : []).some(
        (p) => Array.isArray(p.periods) && p.periods.some((s) => s !== PERIOD_UNSET)
      );

    const matchRows = recs.map((record) => {
      const m = record.match || {};
      const p = (Array.isArray(m.players) ? m.players : []).find(
        (pl) => pl.name === playerName
      );
      const marked = gridUsed(m);
      const first = p && Array.isArray(p.periods) ? p.periods[0] : PERIOD_UNSET;
      const available = first !== PERIOD_UNSET;
      const started = first === PERIOD_GREEN;

      const timedMs = clockTotalMs(m.clock);
      const matchMinutes =
        timedMs >= 60000
          ? Math.floor(timedMs / 60000)
          : Number.isFinite(m.gameLength) && m.gameLength > 0
            ? m.gameLength
            : 0;
      const { minutes } = computePlayerMinutes(m);
      const mine = minutes.get(playerName) || 0;
      const pct =
        available && matchMinutes > 0 ? Math.round((100 * mine) / matchMinutes) : null;

      return {
        id: record.id,
        opposition: typeof m.opposition === 'string' ? m.opposition : '',
        date: typeof m.date === 'string' ? m.date : '',
        homeAway: typeof m.homeAway === 'string' ? m.homeAway : '',
        // null = the squad grid was never marked, so there is no data either way
        available: marked ? available : null,
        started: marked ? started : null,
        goals: p && Number.isFinite(p.goals) ? p.goals : 0,
        assists: p && Number.isFinite(p.assists) ? p.assists : 0,
        potm: typeof m.potm === 'string' && m.potm.trim() === playerName,
        minutes: marked && matchMinutes > 0 ? mine : null,
        pct,
      };
    });

    const stats = computeSeasonStats(recs);
    const totals =
      stats.players.find((p) => p.name === playerName) || BLANK_TOTALS;
    return { rows: matchRows, me: totals };
  }, [matches, playerName]);

  const tiles = [
    { label: 'Games', value: me.played },
    { label: 'Starts', value: me.starts },
    { label: 'Goals', value: me.goals },
    { label: 'Assists', value: me.assists },
    { label: 'POTM', value: me.potm },
    { label: 'Minutes', value: `${me.minutes}m` },
    { label: 'Played', value: me.percentage === null ? '—' : `${me.percentage}%` },
  ];

  return (
    <Page
      colors={{ bgIos: 'bg-transparent' }}
      className="relative pb-safe-24 z-10"
    >
      <Navbar
        title={playerName}
        className="top-0 sticky"
        left={<NavbarBackLink text="Back" onClick={onBack} />}
      />

      <Block className="!mb-2 text-[13px] text-gray-500 dark:text-gray-400">
        {season.name}
      </Block>

      <div className="mx-4 mb-2 grid grid-cols-4 gap-2">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-xl bg-black/5 px-1 py-2 text-center dark:bg-white/10"
          >
            <div className="text-[17px] font-semibold tabular-nums">{t.value}</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t.label}
            </div>
          </div>
        ))}
      </div>

      <BlockTitle>
        Match by Match{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          ({rows.length} match{rows.length === 1 ? '' : 'es'})
        </span>
      </BlockTitle>

      {rows.length === 0 ? (
        <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
          No matches in this season yet.
        </Block>
      ) : (
        <List strong inset>
          <li
            className="flex items-center px-3 pb-1 pt-2
                       text-[10px] font-medium uppercase tracking-wide
                       text-gray-400 dark:text-gray-500"
          >
            <span className="min-w-0 flex-1">Opposition</span>
            <span className="w-6 shrink-0 text-center">H/A</span>
            <span className="w-6 shrink-0 text-center">Av</span>
            <span className="w-6 shrink-0 text-center">St</span>
            <span className="w-5 shrink-0 text-center">G</span>
            <span className="w-5 shrink-0 text-center">A</span>
            <span className="w-8 shrink-0 text-center">POTM</span>
            <span className="w-9 shrink-0 text-center">Time</span>
            <span className="w-9 shrink-0 text-right">%</span>
          </li>
          {rows.map((r, i) => (
            <li key={r.id} className={i < rows.length - 1 ? 'hairline-b' : ''}>
              <div className="flex items-center px-3 py-2 text-[13px]">
                <span className="min-w-0 flex-1 pr-1">
                  <span className="block truncate font-medium">
                    {r.opposition || 'No opposition'}
                  </span>
                  <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                    {formatDate(r.date)}
                  </span>
                </span>
                <span className="w-6 shrink-0 text-center text-[12px] font-medium">
                  {r.homeAway === 'Home' ? 'H' : r.homeAway === 'Away' ? 'A' : '—'}
                </span>
                <span className="w-6 shrink-0 text-center text-[12px] font-semibold text-primary">
                  {r.available ? 'Y' : r.available === null ? '—' : ''}
                </span>
                <span className="w-6 shrink-0 text-center text-[12px] font-semibold text-primary">
                  {r.started ? 'Y' : r.started === null ? '—' : ''}
                </span>
                <span className="w-5 shrink-0 text-center tabular-nums">{r.goals}</span>
                <span className="w-5 shrink-0 text-center tabular-nums">{r.assists}</span>
                <span className="w-8 shrink-0 text-center text-[12px] font-semibold text-primary">
                  {r.potm ? 'Y' : ''}
                </span>
                <span className="w-9 shrink-0 text-center text-[12px] tabular-nums">
                  {r.minutes === null ? '—' : `${r.minutes}m`}
                </span>
                <span
                  className={`w-9 shrink-0 text-right font-semibold tabular-nums ${
                    r.pct === null ? '' : 'text-primary'
                  }`}
                >
                  {r.pct === null ? '—' : `${r.pct}%`}
                </span>
              </div>
            </li>
          ))}
        </List>
      )}

      <Block className="!mt-1 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
        Every match in {season.name}, newest first. H/A is home or away; Av is
        Y when the player was on the team sheet; St is Y when they started
        (green Period 1); POTM is Y for a player-of-the-match award. Time comes
        from the substitution log when the clock ran, otherwise from green grid
        periods against the game length; % is minutes on the pitch against that
        match's length, counted for matches they were available for. A dash
        means the match carries no data for that column — the squad grid was
        never marked, or there is no match time to measure against.
      </Block>
    </Page>
  );
}