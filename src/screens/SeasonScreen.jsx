// Season: the seasons the coach keeps, with the matches filed under each.
// Tapping a season opens its Matches/Players screen; each season can be set
// as the current one, which is where newly saved matches are filed.

import { useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListInput, Button, Link, Sheet, Badge,
} from 'konsta/react';
import { useMatch, formatDate } from '../store.jsx';
import SeasonDetailScreen from './SeasonDetailScreen.jsx';
import { haptic } from '../haptics.js';
import { showToast } from '../toast.jsx';
import { Icon } from '../icons.js';

export default function SeasonScreen({ onNavigate }) {
  const {
    seasons,
    currentSeasonId,
    savedMatches,
    addSeason,
    setCurrentSeason,
    savedOpenId,
    setSavedOpenId,
  } = useMatch();

  const [openSeasonId, setOpenSeasonId] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newName, setNewName] = useState('');

  // A match pushed open from Home jumps straight to its season's detail.
  const savedOpen = savedOpenId
    ? savedMatches.find((r) => r.id === savedOpenId)
    : null;
  const openSeason =
    seasons.find(
      (s) => s.id === (savedOpen ? savedOpen.seasonId : openSeasonId)
    ) || null;

  if (openSeason) {
    return (
      <SeasonDetailScreen
        season={openSeason}
        onNavigate={onNavigate}
        onBack={() => {
          setOpenSeasonId(null);
          setSavedOpenId(null);
        }}
      />
    );
  }

  const trimmed = newName.trim();
  const duplicate =
    trimmed !== '' &&
    seasons.some((s) => s.name.toLowerCase() === trimmed.toLowerCase());

  const submitAdd = () => {
    if (!trimmed || duplicate) return;
    haptic('archived');
    addSeason(trimmed);
    setNewName('');
    setSheetOpen(false);
    showToast(`${trimmed} added — new matches save to it`);
  };

  return (
    <Page
      colors={{ bgIos: 'bg-transparent' }}
      className={`relative pb-safe-24 ${sheetOpen ? 'z-40' : 'z-10'}`}
    >
      <Navbar
        title="Season"
        large
        transparent
        className="top-0 sticky"
        right={
          <Link
            navbar
            iconOnly
            onClick={() => {
              haptic('tick');
              setNewName('');
              setSheetOpen(true);
            }}
          >
            <Icon name="plus" size={26} />
          </Link>
        }
      />

      <Block className="!mb-2 text-[13px] text-gray-500 dark:text-gray-400">
        Matches are filed under a season. The current season is where newly
        saved matches go — tap a season for its matches and player totals.
      </Block>

      <BlockTitle>
        Seasons{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          ({seasons.length})
        </span>
      </BlockTitle>
      <List strong inset>
        {seasons.map((season, i) => {
          const isCurrent = season.id === currentSeasonId;
          const count = savedMatches.filter((r) => r.seasonId === season.id).length;
          return (
            <li
              key={season.id}
              className={i < seasons.length - 1 ? 'hairline-b' : ''}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    haptic('tick');
                    setOpenSeasonId(season.id);
                  }}
                  className="min-w-0 flex-1 py-1 text-left transition-opacity active:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <Icon
                      name="flag"
                      size={18}
                      className={`shrink-0 ${
                        isCurrent ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
                      }`}
                    />
                    <span className="truncate text-[16px] font-semibold">
                      {season.name}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-gray-500 dark:text-gray-400">
                    {count} match{count === 1 ? '' : 'es'} · added{' '}
                    {formatDate(season.createdAt.slice(0, 10))}
                  </span>
                </button>
                {isCurrent ? (
                  <Badge className="shrink-0" colors={{ bg: 'bg-green-500' }}>
                    Current
                  </Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      haptic('tick');
                      setCurrentSeason(season.id);
                      showToast(`${season.name} is now the current season`);
                    }}
                    className="shrink-0 rounded-full bg-black/5 px-3 py-1.5
                               text-[13px] font-semibold text-primary
                               transition-transform active:scale-95
                               dark:bg-white/10"
                  >
                    Set Current
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </List>

      <Sheet
        className="no-safe-areas-top pb-safe"
        opened={sheetOpen}
        onBackdropClick={() => setSheetOpen(false)}
      >
        <Navbar
          title="Add Season"
          right={
            <Link navbar onClick={() => setSheetOpen(false)}>
              Cancel
            </Link>
          }
        />
        <List strong inset>
          <ListInput
            label="Season name"
            type="text"
            placeholder="e.g. 2025/26"
            value={newName}
            onInput={(e) => setNewName(e.target.value)}
            error={duplicate ? 'A season with this name already exists' : undefined}
            clearButton
            onClear={() => setNewName('')}
          />
        </List>
        <Block className="!mt-1 text-[12px] text-gray-500 dark:text-gray-400">
          The new season becomes the current one, so the next match you save is
          filed under it.
        </Block>
        <Block>
          <Button large rounded disabled={!trimmed || duplicate} onClick={submitAdd}>
            Add Season
          </Button>
        </Block>
      </Sheet>
    </Page>
  );
}