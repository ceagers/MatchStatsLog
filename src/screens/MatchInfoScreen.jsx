import { useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListInput, Button, Link,
} from 'konsta/react';
import { useMatch, formatSavedAt } from '../store.jsx';
import { showToast } from '../toast.jsx';
import MatchSummary from '../components/MatchSummary.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

export default function MatchInfoScreen({ onNext }) {
  const {
    match, savedMatches, setOpposition, setHomeAway, setDate, setResult, setPotm,
    setGameLength, saveCurrentMatch,
  } = useMatch();
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
          type="text"
          placeholder="Player of the match"
          value={match.potm}
          onInput={(e) => setPotm(e.target.value)}
          clearButton
          onClear={() => setPotm('')}
        />
      </List>

      <MatchSummary match={match} />

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
