import { useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListInput, Button, Link, Sheet,
  Actions, ActionsGroup, ActionsButton, ActionsLabel,
} from 'konsta/react';
import { useMatch, PERIOD_GREEN, PERIOD_RED } from '../store.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

const PERIOD_STYLES = [
  'bg-black/5 dark:bg-white/10 text-gray-400 dark:text-gray-500',
  'bg-green-500 text-white shadow-sm shadow-green-500/30',
  'bg-red-500 text-white shadow-sm shadow-red-500/30',
];

export default function PlayersScreen({ onNext }) {
  const { match, cyclePeriod, addPlayer, removePlayer, clearPeriods } = useMatch();

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [menuFor, setMenuFor] = useState(null);

  const trimmed = newName.trim();
  const duplicate =
    trimmed !== '' &&
    match.players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());

  const submitAdd = () => {
    if (!trimmed || duplicate) return;
    haptic('periodOn');
    addPlayer(trimmed);
    setNewName('');
    setAddOpen(false);
  };

  return (
    <Page className="pb-safe-24">
      <Navbar
        title="Players"
        large
        transparent
        className="top-0 sticky"
        right={
          <Link navbar iconOnly onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={26} />
          </Link>
        }
      />

      <Block className="!mb-2 text-[13px] text-gray-500 dark:text-gray-400">
        Tap a period to cycle grey, green, red. Tap a name for more options.
      </Block>

      <Block className="!mt-0 !mb-2 flex items-center gap-4 text-[12px] text-gray-500 dark:text-gray-400">
        <LegendDot className="bg-green-500" label="Green" />
        <LegendDot className="bg-red-500" label="Red" />
        <LegendDot className="bg-black/15 dark:bg-white/25" label="Not set" />
      </Block>

      <BlockTitle>
        Squad{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          ({match.players.length})
        </span>
      </BlockTitle>
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
            <button
              onClick={() => {
                haptic('tick');
                setMenuFor(player.name);
              }}
              className="w-11 shrink-0 truncate text-left text-[15px] font-semibold
                         transition-opacity duration-150 active:opacity-50"
            >
              {player.name}
            </button>

            <div className="grid flex-1 grid-cols-8 gap-1">
              {player.periods.map((state, index) => (
                <button
                  key={index}
                  onClick={() => {
                    const next = (state + 1) % 3;
                    haptic(
                      next === PERIOD_GREEN
                        ? 'periodOn'
                        : next === PERIOD_RED
                          ? 'bump'
                          : 'periodOff'
                    );
                    cyclePeriod(player.name, index);
                  }}
                  className={`h-9 rounded-lg text-[13px] font-semibold tabular-nums
                    transition-all duration-150 active:scale-90 ${PERIOD_STYLES[state] || PERIOD_STYLES[0]}`}
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

      <Sheet
        className="no-safe-areas-top pb-safe"
        opened={addOpen}
        onBackdropClick={() => setAddOpen(false)}
      >
        <Navbar
          title="Add Squad Member"
          right={<Link navbar onClick={() => setAddOpen(false)}>Cancel</Link>}
        />
        <List strong inset>
          <ListInput
            label="Name or initials"
            type="text"
            placeholder="e.g. JW"
            value={newName}
            onInput={(e) => setNewName(e.target.value)}
            error={duplicate ? 'Already in the squad' : undefined}
            clearButton
            onClear={() => setNewName('')}
          />
        </List>
        <Block>
          <Button large rounded disabled={!trimmed || duplicate} onClick={submitAdd}>
            Add to Squad
          </Button>
        </Block>
      </Sheet>

      <Actions opened={menuFor !== null} onBackdropClick={() => setMenuFor(null)}>
        <ActionsGroup>
          <ActionsLabel>{menuFor || ''}</ActionsLabel>
          <ActionsButton
            onClick={() => {
              haptic('periodOff');
              if (menuFor) clearPeriods(menuFor);
              setMenuFor(null);
            }}
          >
            Clear All Periods
          </ActionsButton>
          <ActionsButton
            bold
            className="k-color-brand-red"
            onClick={() => {
              haptic('removed');
              if (menuFor) removePlayer(menuFor);
              setMenuFor(null);
            }}
          >
            Remove From Squad
          </ActionsButton>
        </ActionsGroup>
        <ActionsGroup>
          <ActionsButton onClick={() => setMenuFor(null)}>Cancel</ActionsButton>
        </ActionsGroup>
      </Actions>
    </Page>
  );
}

function LegendDot({ className, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${className}`} />
      {label}
    </span>
  );
}
