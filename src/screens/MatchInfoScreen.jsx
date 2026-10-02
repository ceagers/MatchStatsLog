import { useEffect, useRef, useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListInput, ListButton,
  Button, Dialog, DialogButton, Link, Toast,
} from 'konsta/react';
import { useMatch, formatSavedAt } from '../store.jsx';
import MatchSummary from '../components/MatchSummary.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

export default function MatchInfoScreen({ onNext }) {
  const {
    match, savedMatches, setOpposition, setHomeAway, setDate, setResult, setPotm,
    resetMatch, saveCurrentMatch,
  } = useMatch();
  const [confirmReset, setConfirmReset] = useState(false);
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  };

  const savedRecord = savedMatches.find((r) => r.id === match.savedId) || null;

  const saveMatch = () => {
    haptic('archived');
    saveCurrentMatch();
    showToast(savedRecord ? 'Saved match updated' : 'Match saved');
  };

  return (
    <Page colors={{ bgIos: 'bg-transparent' }} className="relative z-10 pb-safe-24">
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

      <BlockTitle>Save</BlockTitle>
      <List strong inset>
        <ListButton onClick={saveMatch}>
          {savedRecord ? 'Update Saved Match' : 'Save Match To History'}
        </ListButton>
      </List>
      <Block className="!mt-1 text-[13px] text-gray-500 dark:text-gray-400">
        {savedRecord
          ? `Last saved ${formatSavedAt(savedRecord.savedAt)}. Saving again updates that record.`
          : 'Keeps a full copy of this match — fixture, squad, clock, goals and substitutions — on the Saved tab.'}
      </Block>

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

      <BlockTitle>Reset</BlockTitle>
      <List strong inset>
        <ListButton className="k-color-brand-red" onClick={() => setConfirmReset(true)}>
          Start New Match
        </ListButton>
      </List>
      <Block className="text-[13px] text-gray-500 dark:text-gray-400 !mt-1">
        Clears the fixture details, the match clock, all logged goals and substitutions.
        The squad list is kept, and anything already saved to history stays there.
      </Block>

      <Dialog
        opened={confirmReset}
        onBackdropClick={() => setConfirmReset(false)}
        title="Start new match?"
        content="All fixture details, clock times, goals and substitutions will be cleared. Save this match first if you want to keep it."
        buttons={
          <>
            <DialogButton onClick={() => setConfirmReset(false)}>Cancel</DialogButton>
            <DialogButton
              strong
              onClick={() => {
                haptic('removed');
                resetMatch();
                setConfirmReset(false);
              }}
            >
              Reset
            </DialogButton>
          </>
        }
      />

      <SettingsPanel opened={settingsOpened} onClose={() => setSettingsOpened(false)} />

      <Toast position="center" opened={toast !== ''}>
        <div className="shrink">{toast}</div>
      </Toast>
    </Page>
  );
}
