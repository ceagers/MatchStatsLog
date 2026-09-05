import { Page, Navbar, Block, BlockTitle, List, Button, Stepper } from 'konsta/react';
import { useMatch } from '../store.jsx';
import { haptic } from '../haptics.js';

const STEPPER_COLORS = { clearBgIos: 'bg-black/5 dark:bg-white/15 active:bg-primary/15' };

export default function PlayersScreen({ onNext }) {
  const { match, togglePeriod, bump } = useMatch();

  return (
    <Page className="pb-safe-24">
      <Navbar title="Players" large transparent className="top-0 sticky" />

      <Block className="!mb-2 text-[13px] text-gray-500 dark:text-gray-400">
        Tap a number to mark that period as played.
      </Block>

      <BlockTitle>Squad</BlockTitle>
      <List strong inset>
        {match.players.map((player, i) => (
          <li
            key={player.name}
            className={`px-4 py-3.5 ${i < match.players.length - 1 ? 'hairline-b' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[17px] font-semibold">{player.name}</span>
              <span className="text-[13px] tabular-nums text-gray-500 dark:text-gray-400">
                {player.periods.filter(Boolean).length}/8 periods
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-8 gap-1.5">
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
                        : 'bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                    }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              <StatRow
                label="Goals"
                value={player.goals}
                onPlus={() => {
                  haptic('bump');
                  bump(player.name, 'goals', 1);
                }}
                onMinus={() => {
                  haptic('bump');
                  bump(player.name, 'goals', -1);
                }}
              />
              <StatRow
                label="Assists"
                value={player.assists}
                onPlus={() => {
                  haptic('bump');
                  bump(player.name, 'assists', 1);
                }}
                onMinus={() => {
                  haptic('bump');
                  bump(player.name, 'assists', -1);
                }}
              />
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

function StatRow({ label, value, onPlus, onMinus }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[15px] text-gray-500 dark:text-gray-400">
        {label}
        <span className="ml-1.5 font-semibold tabular-nums text-black dark:text-white">
          {value}
        </span>
      </span>
      <Stepper
        rounded
        raised
        outline
        buttonsOnly
        colors={STEPPER_COLORS}
        value={value}
        onPlus={onPlus}
        onMinus={onMinus}
      />
    </div>
  );
}
