// Home: the launch screen. The photo the coach added, the app's title laid
// over it, and the quickest way into everything else. The badge wallpaper
// shows around it, as on every other screen.

import { Page, Button } from 'konsta/react';

export default function HomeScreen({ onNavigate }) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Page colors={{ bgIos: 'bg-transparent' }} className="relative z-10 pb-safe-24">
      {/* The photo, with the title over it */}
      <div className="px-4 pt-3">
        <div className="relative h-[38vh] min-h-56 overflow-hidden rounded-2xl">
          <img
            src="assets/home.jpg"
            alt="Match day"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h1 className="text-[30px] font-bold leading-tight tracking-tight text-white drop-shadow-sm">
              MatchStatsLog
            </h1>
            <p className="mt-0.5 text-sm font-medium text-white/85">{today}</p>
          </div>
        </div>
      </div>

      {/* The ways in */}
      <div className="mt-5 space-y-3 px-4">
        <Button large rounded onClick={() => onNavigate('info')}>
          New Match
        </Button>
        <div className="grid grid-cols-2 gap-x-3">
          <Button tonal rounded onClick={() => onNavigate('timer')}>
            Timer
          </Button>
          <Button tonal rounded onClick={() => onNavigate('players')}>
            Players
          </Button>
          <Button tonal rounded onClick={() => onNavigate('goals')}>
            Goals
          </Button>
          <Button tonal rounded onClick={() => onNavigate('saved')}>
            Saved Matches
          </Button>
        </div>
      </div>
    </Page>
  );
}
