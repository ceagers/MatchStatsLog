// Root of the match-day app: the screens, the bar that switches between them,
// and the horizontal swipe that moves to the next or previous screen.
// The bar is built here rather than taken from the component library so its
// surface and label colours are fixed for both appearances — a glass surface
// can render as a flat white slab and leave the labels unreadable.

import { useRef, useState } from 'react';
import { MatchProvider } from './store.jsx';
import { useSettings } from './settings.jsx';
import { Icon } from './icons.js';
import { haptic } from './haptics.js';
import { ToastHost } from './toast.jsx';
import HomeScreen from './screens/HomeScreen.jsx';
import MatchInfoScreen from './screens/MatchInfoScreen.jsx';
import TimerScreen from './screens/TimerScreen.jsx';
import PlayersScreen from './screens/PlayersScreen.jsx';
import GoalLoggerScreen from './screens/GoalLoggerScreen.jsx';
import SavedMatchesScreen from './screens/SavedMatchesScreen.jsx';
import UtilitiesScreen from './screens/UtilitiesScreen.jsx';

// Home first, then the screens in the order the coach walks them on the day.
const TABS = [
  { id: 'home', label: 'Home', icon: 'house' },
  { id: 'info', label: 'Match', icon: 'clipboard-list' },
  { id: 'timer', label: 'Timer', icon: 'timer' },
  { id: 'players', label: 'Players', icon: 'users' },
  { id: 'goals', label: 'Goals', icon: 'target' },
  { id: 'saved', label: 'Saved', icon: 'archive' },
  { id: 'utilities', label: 'Utilities', icon: 'wrench' },
];

// Swipes never start on form controls, sliders or anything floating over the
// screen — those own their own horizontal gestures.
const SWIPE_BLOCKED_SELECTOR =
  'input, textarea, select, [data-no-swipe], ' +
  '.k-dialog, .k-sheet, .k-popup, .k-panel, .k-actions, .k-toast, .k-popover';

export default function AppScreen() {
  const [tab, setTabState] = useState('home');
  const [dir, setDir] = useState(1); // 1: the new screen comes in from the right
  const { badgeImage } = useSettings();

  const indexOf = (id) => TABS.findIndex((t) => t.id === id);

  // Every switch funnels through here, so the incoming screen always slides
  // in from the direction of travel — whether the tap was on the bar or on a
  // "next" control on the screen itself.
  const setTab = (id) => {
    const from = indexOf(tab);
    const to = indexOf(id);
    if (to === -1 || to === from) return;
    setDir(to > from ? 1 : -1);
    setTabState(id);
  };

  // A horizontal swipe anywhere on a screen moves to the neighbouring screen.
  // Vertical scrolling always wins the gesture: a swipe only counts once the
  // finger is clearly travelling sideways, and it needs either distance or a
  // quick flick to commit.
  const gesture = useRef({ state: 'idle', x0: 0, y0: 0, t0: 0, dx: 0, blocked: false });
  const swallowClick = useRef(false);

  const onPointerDown = (e) => {
    const target = e.target;
    gesture.current = {
      state: 'pending',
      x0: e.clientX,
      y0: e.clientY,
      t0: e.timeStamp,
      dx: 0,
      blocked: !!(target.closest && target.closest(SWIPE_BLOCKED_SELECTOR)),
    };
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (g.state === 'idle' || g.state === 'vertical' || g.blocked) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    g.dx = dx;
    if (g.state === 'pending' && Math.max(Math.abs(dx), Math.abs(dy)) > 12) {
      g.state = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'horizontal' : 'vertical';
    }
  };

  const onPointerUp = (e) => {
    const g = gesture.current;
    const horizontal = g.state === 'horizontal';
    const dx = g.dx;
    const elapsed = e.timeStamp - g.t0;
    g.state = 'idle';
    if (!horizontal) return;
    const flick = elapsed < 200 && Math.abs(dx) > 36;
    if (Math.abs(dx) < 64 && !flick) return;
    const from = indexOf(tab);
    const to = dx < 0 ? from + 1 : from - 1;
    if (to < 0 || to >= TABS.length) return;
    // The release also lands as a click on whatever row or button the finger
    // left from — swallow it so a swipe doesn't press anything on the way out.
    swallowClick.current = true;
    haptic('tick');
    setTab(TABS[to].id);
  };

  const onPointerCancel = () => {
    gesture.current.state = 'idle';
  };

  const onClickCapture = (e) => {
    if (swallowClick.current) {
      swallowClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <MatchProvider>
      {/* The club badge as a faint wallpaper behind every screen. The screens
          sit above it with clear page backgrounds, so it shows through
          everywhere the content doesn't already cover. A custom badge chosen
          in Settings replaces the bundled one. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden
                   bg-white dark:bg-neutral-900"
      >
        <img
          src={badgeImage || 'assets/badge.PNG'}
          alt=""
          className="h-full w-full object-cover object-center
                     opacity-[0.15] dark:opacity-50"
        />
      </div>

      <div
        key={tab}
        className={`h-full ${
          dir === 1
            ? 'animate-[screen-in-right_240ms_ease-out]'
            : 'animate-[screen-in-left_240ms_ease-out]'
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={onClickCapture}
      >
        {tab === 'home' && <HomeScreen onNavigate={setTab} />}
        {tab === 'info' && <MatchInfoScreen onNext={() => setTab('timer')} />}
        {tab === 'timer' && <TimerScreen onNext={() => setTab('players')} />}
        {tab === 'players' && <PlayersScreen onNext={() => setTab('goals')} />}
        {tab === 'goals' && <GoalLoggerScreen />}
        {tab === 'saved' && <SavedMatchesScreen onNavigate={setTab} />}
        {tab === 'utilities' && <UtilitiesScreen />}
      </div>

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

      {/* The shared confirmation toast lives here, above everything the
          screens render, so the tab bar can never cover it. */}
      <ToastHost />
    </MatchProvider>
  );
}
