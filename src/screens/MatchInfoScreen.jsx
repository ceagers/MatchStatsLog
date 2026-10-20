import { useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListInput, Button, Link,
} from 'konsta/react';
import { useMatch, formatSavedAt } from '../store.jsx';
import { useSettings } from '../settings.jsx';
import { showToast } from '../toast.jsx';
import MatchSummary from '../components/MatchSummary.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

export default function MatchInfoScreen({ onNext }) {
  const {
    match, savedMatches, setOpposition, setHomeAway, setDate, setResult, setPotm,
    setCompetition, setType, setGameLength, setPeriodsUsed, saveCurrentMatch,
  } = useMatch();
  const { competitions, matchTypes } = useSettings();
  const [settingsOpened, setSettingsOpened] = useState(false);

  const savedRecord = savedMatches.find((r) => r.id === match.savedId) || null;

  // Same save as the Utilities screen, kept handy at the top right of the
  // fixture the coach is filling in.
  const saveMatch = () => {
    haptic('archived');
    saveCurrentMatch();
    showToast(savedRecord ? 'Saved match updated' : 'Match saved');
  };

  // The settings panel lifts this screen above the fixed tab bar while open.
  const modalOpen = settingsOpened;

  return (
    <Page
      colors={{ bgIos: 'bg-transparent' }}
      className={`relative pb-safe-24 ${modalOpen ? 'z-40' : 'z-10'}`}
    >
      <Navbar
        title="Match Info"
        large
        transparent
        className="top-0 sticky"
        left={
          <Link
            navbar
            iconOnly
            onClick={() => {
              haptic('tick');
              setSettingsOpened(true);
            }}
          >
            <Icon name="settings" size={24} />
          </Link>
        }
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
        <ListInput
          label="POTM"
          type="select"
          dropdown
          value={match.potm || ''}
          onChange={(e) => {
            haptic('bump');
            setPotm(e.target.value);
          }}
          footer={
            match.players.length === 0
              ? 'Populate the squad on the Players tab to pick the winner from the list.'
              : undefined
          }
        >
          <option value="">None</option>
          {/* A previously typed POTM that isn't in the squad list is kept as an
              option, so old records never lose their saved value. */}
          {match.potm && !match.players.some((p) => p.name === match.potm) && (
            <option value={match.potm}>{match.potm}</option>
          )}
          {match.players.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </ListInput>
      </List>

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

      <SettingsPanel opened={settingsOpened} onClose={() => setSettingsOpened(false)} />
    </Page>
  );
}
