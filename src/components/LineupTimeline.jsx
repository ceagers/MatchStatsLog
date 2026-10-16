// The running lineup: the period 1 starting lineup as the first column, then
// one column per logged substitution — whoever went off turns red, whoever
// came on turns green, and everyone else carries their state across. A
// phone-friendly read of the match without the squad grid's preset periods.

import { Block, BlockTitle, List } from 'konsta/react';
import { useMatch, PERIOD_GREEN, PERIOD_RED } from '../store.jsx';

// Same palette as the squad grid cells, minus the number text.
const CELL_STYLES = [
  'bg-black/5 dark:bg-white/10',
  'bg-green-500 shadow-sm shadow-green-500/30',
  'bg-red-500 shadow-sm shadow-red-500/30',
];

export default function LineupTimeline() {
  const { match } = useMatch();

  // Substitutions made in the same minute share one column — each group
  // applies all of its changes at once.
  const subs = [...match.subs].sort((a, b) => a.minute - b.minute);
  const groups = subs.reduce((acc, sub) => {
    const last = acc[acc.length - 1];
    if (last && last.minute === sub.minute) last.subs.push(sub);
    else acc.push({ minute: sub.minute, subs: [sub] });
    return acc;
  }, []);
  const hasStart = match.players.some(
    (p) => (p.periods[0] ?? 0) !== 0
  );

  // Nothing to draw until the coach marks a starting lineup or logs a sub.
  if (match.players.length === 0 || (!hasStart && subs.length === 0)) {
    return null;
  }

  // Column 0 is the period 1 starting lineup; every further column applies
  // its minute's substitutions on top of the column before it.
  const columns = groups.reduce(
    (cols, group) => {
      const states = new Map(cols[cols.length - 1].states);
      group.subs.forEach((sub) => {
        if (sub.off) states.set(sub.off, PERIOD_RED);
        if (sub.on) states.set(sub.on, PERIOD_GREEN);
      });
      cols.push({ minute: group.minute, states });
      return cols;
    },
    [
      {
        minute: 0,
        states: new Map(
          match.players.map((p) => [p.name, p.periods[0] ?? 0])
        ),
      },
    ]
  );

  return (
    <>
      <BlockTitle>Running Lineup</BlockTitle>

      <List strong inset className="overflow-hidden">
        <li className="block overflow-x-auto px-3 py-1.5">
          <div className="min-w-max">
            <div className="flex items-center gap-1 pb-1">
              <span className="w-10 shrink-0 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Player
              </span>
              {columns.map((c, i) => (
                <span
                  key={`head-${i}`}
                  className="w-9 shrink-0 text-center text-[11px] tabular-nums text-gray-400 dark:text-gray-500"
                >
                  {i === 0 ? 'KO' : `${c.minute}'`}
                </span>
              ))}
            </div>

            {match.players.map((player, i) => (
              <div
                key={player.name}
                className={`flex items-center gap-1 py-1.5 ${
                  i < match.players.length - 1 ? 'hairline-b' : ''
                }`}
              >
                <span className="w-10 shrink-0 truncate text-[15px] font-semibold">
                  {player.name}
                </span>
                {columns.map((c, j) => (
                  <div
                    key={`${player.name}-${j}`}
                    className={`h-9 w-9 shrink-0 rounded-lg ${
                      CELL_STYLES[c.states.get(player.name) ?? 0] ||
                      CELL_STYLES[0]
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
        </li>
      </List>

      <Block className="!my-1 text-[12px] text-gray-500 dark:text-gray-400">
        KO is the period 1 starting lineup. Each further column is one
        substitution — subs logged in the same minute share a column — off
        turns red, on turns green, everyone else carries over.
      </Block>
    </>
  );
}