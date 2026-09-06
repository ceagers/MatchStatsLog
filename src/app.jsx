// Root of the match-day app: three screens sharing one match record.

import { useState } from 'react';
import { Tabbar, TabbarLink, ToolbarPane } from 'konsta/react';
import { MatchProvider } from './store.jsx';
import { Icon } from './icons.js';
import MatchInfoScreen from './screens/MatchInfoScreen.jsx';
import PlayersScreen from './screens/PlayersScreen.jsx';
import GoalLoggerScreen from './screens/GoalLoggerScreen.jsx';
import SavedMatchesScreen from './screens/SavedMatchesScreen.jsx';

export default function AppScreen() {
  const [tab, setTab] = useState('info');

  return (
    <MatchProvider>
      {tab === 'info' && <MatchInfoScreen onNext={() => setTab('players')} />}
      {tab === 'players' && <PlayersScreen onNext={() => setTab('goals')} />}
      {tab === 'goals' && <GoalLoggerScreen />}
      {tab === 'saved' && <SavedMatchesScreen />}

      <Tabbar labels icons className="left-0 bottom-0 fixed">
        <ToolbarPane>
          <TabbarLink
            active={tab === 'info'}
            onClick={() => setTab('info')}
            icon={<Icon name="clipboard-list" size={28} />}
            label="Match"
          />
          <TabbarLink
            active={tab === 'players'}
            onClick={() => setTab('players')}
            icon={<Icon name="users" size={28} />}
            label="Players"
          />
          <TabbarLink
            active={tab === 'goals'}
            onClick={() => setTab('goals')}
            icon={<Icon name="target" size={28} />}
            label="Goals"
          />
          <TabbarLink
            active={tab === 'saved'}
            onClick={() => setTab('saved')}
            icon={<Icon name="archive" size={28} />}
            label="Saved"
          />
        </ToolbarPane>
      </Tabbar>
    </MatchProvider>
  );
}
