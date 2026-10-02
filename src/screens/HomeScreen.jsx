// Home: the launch screen. The photo fills the whole screen as this tab's
// wallpaper, with the title over it and one way in: the match info screen.

import { Page, Button } from 'konsta/react';

export default function HomeScreen({ onNavigate }) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      {/* The photo as the full wallpaper for this screen. It sits on the same
          layer as the badge wallpaper (later in the DOM, so it covers it),
          and unmounts with the tab so the badge returns on every other
          screen. A light solid scrim keeps the title readable over any
          photo. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <img src="assets/home.jpg" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <Page colors={{ bgIos: 'bg-transparent' }} className="relative z-10 pb-safe-24">
        <div className="flex min-h-full flex-col">
          {/* The title, over the photo */}
          <div className="px-5 pt-24 text-center">
            <h1 className="text-[34px] font-bold leading-tight tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.55)]">
              MatchStatsLog
            </h1>
            <p className="mt-1 text-sm font-medium text-white/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.55)]">
              {today}
            </p>
          </div>

          {/* The one way in */}
          <div className="mt-auto px-5 pb-6">
            <Button large rounded onClick={() => onNavigate('info')}>
              Go to Match Info
            </Button>
          </div>
        </div>
      </Page>
    </>
  );
}
