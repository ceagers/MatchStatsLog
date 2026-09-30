// Match history: every saved match, and a read-only detail view of one.

import { useState } from 'react';
import {
  Page, Navbar, NavbarBackLink, Block, BlockTitle, List, ListItem, ListButton,
  Dialog, DialogButton,
} from 'konsta/react';
import {
  useMatch, formatDate, formatSavedAt, formatClock, clockTotalMs,
} from '../store.jsx';
import MatchSummary from '../components/MatchSummary.jsx';
import { haptic } from '../haptics.js';

export default function SavedMatchesScreen() {
  const { savedMatches, deleteSavedMatch, restoreSavedMatch } = useMatch();
  const [openId, setOpenId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(null);

  const open = savedMatches.find((r) => r.id === openId) || null;

  const doDelete = (id) => {
    haptic('removed');
    deleteSavedMatch(id);
    setConfirmDelete(null);
    if (openId === id) setOpenId(null);
  };

  const doRestore = (id) => {
    haptic('archived');
    restoreSavedMatch(id);
    setConfirmRestore(null);
    setOpenId(null);
  };

  const dialogs = (
    <>
      <Dialog
        opened={confirmDelete !== null}
        onBackdropClick={() => setConfirmDelete(null)}
        title="Delete saved match?"
        content="This saved record will be removed. Your current match is not affected."
        buttons={
          <>
            <DialogButton onClick={() => setConfirmDelete(null)}>Cancel</DialogButton>
            <DialogButton strong onClick={() => doDelete(confirmDelete)}>
              Delete
            </DialogButton>
          </>
        }
      />
      <Dialog
        opened={confirmRestore !== null}
        onBackdropClick={() => setConfirmRestore(null)}
        title="Open as current match?"
        content="This replaces the match you are working on now. Save that one first if you need it."
        buttons={
          <>
            <DialogButton onClick={() => setConfirmRestore(null)}>Cancel</DialogButton>
            <DialogButton strong onClick={() => doRestore(confirmRestore)}>
              Open
            </DialogButton>
          </>
        }
      />
    </>
  );

  if (open) {
    return (
      <Page className="pb-safe-24">
        <Navbar
          title={open.match.opposition ? `vs ${open.match.opposition}` : 'Saved Match'}
          className="top-0 sticky"
          left={<NavbarBackLink text="Saved" onClick={() => setOpenId(null)} />}
        />

        <Block className="!mb-0 text-[13px] text-gray-500 dark:text-gray-400">
          Saved {formatSavedAt(open.savedAt)}
        </Block>

        <MatchSummary match={open.match} />

        <BlockTitle>Manage</BlockTitle>
        <List strong inset>
          <ListButton onClick={() => setConfirmRestore(open.id)}>
            Open As Current Match
          </ListButton>
          <ListButton className="k-color-brand-red" onClick={() => setConfirmDelete(open.id)}>
            Delete Saved Match
          </ListButton>
        </List>

        {dialogs}
      </Page>
    );
  }

  return (
    <Page className="pb-safe-24">
      <Navbar title="Saved" large transparent className="top-0 sticky" />

      {savedMatches.length === 0 ? (
        <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
          No saved matches yet. Use Save on the Match screen to keep a match for
          future reference.
        </Block>
      ) : (
        <>
          <BlockTitle>
            Match History{' '}
            <span className="font-normal text-gray-500 dark:text-gray-400">
              ({savedMatches.length})
            </span>
          </BlockTitle>
          <List strong inset>
            {savedMatches.map((record) => {
              const m = record.match;
              const goals = m.goalTimes.length;
              const timeMs = m.clock ? clockTotalMs(m.clock) : 0;
              return (
                <ListItem
                  key={record.id}
                  link
                  onClick={() => {
                    haptic('tick');
                    setOpenId(record.id);
                  }}
                  title={m.opposition ? `vs ${m.opposition}` : 'No opposition'}
                  subtitle={[m.homeAway, formatDate(m.date)].filter(Boolean).join(' · ')}
                  text={[
                    m.result || 'No result',
                    `${goals} goal${goals === 1 ? '' : 's'}`,
                    timeMs > 0 ? formatClock(timeMs) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  after={
                    <span className="text-[12px] text-gray-400 dark:text-gray-500">
                      {formatSavedAt(record.savedAt)}
                    </span>
                  }
                />
              );
            })}
          </List>
        </>
      )}

      {dialogs}
    </Page>
  );
}
