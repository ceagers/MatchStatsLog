import { Page, Navbar, Block, BlockTitle, List, Button } from 'konsta/react';
import { useMatch } from '../store.jsx';
import { haptic } from '../haptics.js';

export default function PlayersScreen({ onNext }) {
  const { match, togglePeriod } = useMatch();

  return (
    <Page className="pb-safe-24">
      <Navbar title="Players" large transparent className="top-0 sticky" />

      <Block className="!mb-2 text-[13px] text-gray-500 dark:text-gray-400">
        Tap a number to mark that period as played.
      </Block>

      <BlockTitle>Squad</BlockTitle>
      <List strong inset>
        <li className="flex items-center gap-2 px-3 pt-2 pb-1">
          <span className="w-11 shrink-0 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Player
          </span>
          <div className="grid flex-1 grid-cols-8 gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <span
                key={n}
                className="text-center text-[11px] tabular-nums text-gray-400 dark:text-gray-500"
              >
                {n}
              </span>
            ))}
          </div>
        </li>

        {match.players.map((player, i) => (
          <li
            key={player.name}
            className={`flex items-center gap-2 px-3 py-1.5 ${
              i < match.players.length - 1 ? 'hairline-b' : ''
            }`}
          >
            <span className="w-11 shrink-0 truncate text-[15px] font-semibold">
              {player.name}
            </span>

            <div className="grid flex-1 grid-cols-8 gap-1">
              {player.periods.map((on, index) => (
                <button
                  key={index}
                  onClick={() => {
                    haptic(on ? 'periodOff' : 'periodOn');
                    togglePeriod(player.name, index);
                  }}
                  className={`h-9 rounded-lg text-[13px] font-semibold tabular-nums
                    transition-all duration-150 active:scale-90 ${
                      on
                        ? 'bg-green-500 text-white shadow-sm shadow-green-500/30'
                        : 'bg-black/5 dark:bg-white/10 text-gray-400 dark:text-gray-500'
                    }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </li>
        ))}
      </List>

      <Block className="mt-6">
        <Button
          large
          rounded
          onClick={() => {
            haptic('tick');
            onNext();
          }}
        >
          Go to Goal Logger
        </Button>
      </Block>
    </Page>
  );
}
