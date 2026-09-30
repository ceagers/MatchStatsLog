// Root of the match-day app: the screens, and the bar that switches between
// them. The bar is built here rather than taken from the component library so
// its surface and label colours are fixed for both appearances — a glass
// surface can render as a flat white slab and leave the labels unreadable.

import { useState } from 'react';
import { MatchProvider } from './store.jsx';
import { Icon } from './icons.js';
import MatchInfoScreen from './screens/MatchInfoScreen.jsx';
import TimerScreen from './screens/TimerScreen.jsx';
import PlayersScreen from './screens/PlayersScreen.jsx';
import GoalLoggerScreen from './screens/GoalLoggerScreen.jsx';
import SavedMatchesScreen from './screens/SavedMatchesScreen.jsx';

// The screens, in the order the coach walks them on the day.
const TABS = [
  { id: 'info', label: 'Match', icon: 'clipboard-list' },
  { id: 'timer', label: 'Timer', icon: 'timer' },
  { id: 'players', label: 'Players', icon: 'users' },
  { id: 'goals', label: 'Goals', icon: 'target' },
  { id: 'saved', label: 'Saved', icon: 'archive' },
];

export default function AppScreen() {
  const [tab, setTab] = useState('info');

  return (
    <MatchProvider>
      {tab === 'info' && <MatchInfoScreen onNext={() => setTab('timer')} />}
      {tab === 'timer' && <TimerScreen onNext={() => setTab('players')} />}
      {tab === 'players' && <PlayersScreen onNext={() => setTab('goals')} />}
      {tab === 'goals' && <GoalLoggerScreen />}
      {tab === 'saved' && <SavedMatchesScreen />}

      <nav
        className="fixed bottom-0 left-0 z-30 w-full border-t border-black/10
                   bg-white/95 pb-safe backdrop-blur-xl
                   dark:border-white/10 dark:bg-neutral-900/95"
      >
        <div className="flex items-stretch">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex min-h-11 flex-1 flex-col items-center justify-center
                            gap-0.5 pt-1.5 pb-1 text-[10px] font-medium
                            tracking-tight transition-colors active:opacity-60 ${
                              active
                                ? 'text-primary'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
              >
                <Icon name={item.icon} size={26} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </MatchProvider>
  );
}
