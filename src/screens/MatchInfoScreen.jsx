import {
  Page, Navbar, Block, BlockTitle, List, ListInput, Button, Link,
} from 'konsta/react';
import {
  useMatch, formatSavedAt, POTM_ALL, potmList, potmIncludes,
} from '../store.jsx';
import { useSettings } from '../settings.jsx';
import { showToast } from '../toast.jsx';
import MatchSummary from '../components/MatchSummary.jsx';
import { haptic } from '../haptics.js';
import { Icon } from '../icons.js';

export default function MatchInfoScreen({ onNext }) {
  const {
    match, savedMatches, setOpposition, setHomeAway, setDate, setResult,
    togglePotm, setCompetition, setType, setGameLength,
    setPeriodsUsed, saveCurrentMatch,
  } = useMatch();
  const { competitions, matchTypes } = useSettings();

  const savedRecord = savedMatches.find((r) => r.id === match.savedId) || null;

  // The rows to offer: the whole-squad option, then the squad list, then any
  // POTM name saved before it left the squad — kept so old records never lose
  // their saved value.
  const potmOptions = [
    POTM_ALL,
    ...match.players.map((p) => p.name),
    ...potmList(match.potm).filter(
      (n) =>
        n !== POTM_ALL && !match.players.some((p) => p.name === n)
    ),
  ];

  // Same save as the Utilities screen, kept handy at the top right of the
  // fixture the coach is filling in.
  const saveMatch = () => {
    haptic('archived');
    saveCurrentMatch();
    showToast(savedRecord ? 'Saved match updated' : 'Match saved');
  };

  return (
    <Page
      colors={{ bgIos: 'bg-transparent' }}
      className="relative z-10 pb-safe-24"
    >
      <Navbar
        title="Match Info"
        large
        transparent
        className="top-0 sticky"
        right={<Link navbar onClick={saveMatch}>Save</Link>}
      />

      <BlockTitle>Fixture</BlockTitle>
      <List strong inset>
        <ListInput
          label="JPL/PDJAL"
          type="select"
          dropdown
          value={match.competition || ''}
          onChange={(e) => {
            haptic('bump');
            setCompetition(e.target.value);
          }}
        >
          <option value="">Not set</option>
          {/* A division saved before it was removed from the settings list is
              kept as an option, so old records never lose their value. */}
          {match.competition && !competitions.includes(match.competition) && (
            <option value={match.competition}>{match.competition}</option>
          )}
          {competitions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </ListInput>
        <ListInput
          label="Type"
          type="select"
          dropdown
          value={match.type || ''}
          onChange={(e) => {
            haptic('bump');
            setType(e.target.value);
          }}
        >
          <option value="">Not set</option>
          {match.type && !matchTypes.includes(match.type) && (
            <option value={match.type}>{match.type}</option>
          )}
          {matchTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </ListInput>
        <ListInput
          label="Opposition"
          type="text"
          placeholder="e.g. Riverside FC"
          value={match.opposition}
          onInput={(e) => setOpposition(e.target.value)}
          clearButton
          onClear={() => setOpposition('')}
        />
        <ListInput
          label="Home/Away"
          type="text"
          placeholder="Home or Away"
          value={match.homeAway}
          onInput={(e) => setHomeAway(e.target.value)}
          clearButton
          onClear={() => setHomeAway('')}
        />
        <ListInput
          label="Date"
          type="date"
          value={match.date}
          onChange={(e) => setDate(e.target.value)}
        />
        <ListInput
          label="Game Length"
          type="select"
          dropdown
          value={match.gameLength ? String(match.gameLength) : ''}
          onChange={(e) => {
            haptic('bump');
            setGameLength(e.target.value);
          }}
        >
          <option value="">Not set</option>
          {[30, 40, 45, 50, 60, 70, 80, 90].map((m) => (
            <option key={m} value={String(m)}>
              {m} minutes
            </option>
          ))}
        </ListInput>
        <ListInput
          label="Result"
          type="text"
          placeholder="e.g. 3-1 win"
          value={match.result}
          onInput={(e) => setResult(e.target.value)}
          clearButton
          onClear={() => setResult('')}
        />
      </List>

      <BlockTitle>Player of the Match</BlockTitle>
      <List strong inset className="!py-1">
        {/* The award is shared: every row toggles independently, and "All"
            gives it to everyone available for the match — the starters and
            the bench. The stored value is one string of names joined with
            ", ", so old single-name records read as-is. */}
        {potmOptions.map((name, i, all) => {
          const selected = potmIncludes(match.potm, name, match);
          return (
            <li key={name} className={i < all.length - 1 ? 'hairline-b' : ''}>
              <button
                type="button"
                onClick={() => {
                  haptic('bump');
                  togglePotm(name);
                }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left
                           transition-colors active:bg-black/5 dark:active:bg-white/10"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center
                              rounded-full border transition-colors ${
                                selected
                                  ? 'border-primary bg-primary'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                >
                  {selected && <Icon name="check" size={14} className="text-white" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                  {name === POTM_ALL ? 'All' : name}
                </span>
              </button>
            </li>
          );
        })}
      </List>
      <Block className="!mt-1 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
        {match.players.length === 0
          ? 'Populate the squad on the Players tab to pick the winner from the list.'
          : 'Tap to award — pick several players to share it, or All for everyone available (starting or on the bench).'}
      </Block>

      <MatchSummary match={match} onPeriodsUsed={setPeriodsUsed} />

      <Block className="mt-6">
        <Button
          large
          rounded
          onClick={() => {
            haptic('tick');
            onNext();
          }}
        >
          Go to Match Clock
        </Button>
      </Block>
    </Page>
  );
}
