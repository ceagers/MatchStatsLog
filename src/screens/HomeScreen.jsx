// Home: the launch screen. The photo fills the whole screen as this tab's
// wallpaper, with the title over it and the day's fixture underneath, shown
// read-only straight from the match info screen. Any saved match can also be
// put here from the Season screen, so every match gets its own home view of
// its fixture.

import { Page, Button } from 'konsta/react';
import { useSettings } from '../settings.jsx';
import { useMatch, formatDate, formatSavedAt } from '../store.jsx';
import { haptic } from '../haptics.js';

function FixtureRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-[13px] font-medium text-white/60">{label}</span>
      <span className="min-w-0 break-words text-right text-[15px] font-semibold text-white">
        {value || '—'}
      </span>
    </div>
  );
}

export default function HomeScreen({ onNavigate }) {
  const { homeImage } = useSettings();
  const {
    match,
    savedMatches,
    homeViewId,
    setHomeView,
    savedOpenId,
    setSavedOpenId,
  } = useMatch();

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // The fixture on show: normally the match being worked on, or a saved match
  // the coach has put here from the Saved screen. A deleted match falls back
  // to the current one.
  const savedRecord = homeViewId
    ? savedMatches.find((r) => r.id === homeViewId) || null
    : null;
  const shown = savedRecord ? savedRecord.match : match;

  const rows = [
    ['JPL / PDJAL', shown.competition],
    ['Type', shown.type],
    ['Opposition', shown.opposition],
    ['Home / Away', shown.homeAway],
    ['Date', shown.date ? formatDate(shown.date) : ''],
    ['Result', shown.result],
    ['POTM', shown.potm],
  ];

  return (
    <>
      {/* The photo as the full wallpaper for this screen. It sits on the same
          layer as the badge wallpaper (later in the DOM, so it covers it),
          and unmounts with the tab so the badge returns on every other
          screen. A light solid scrim keeps the title readable over any
          photo. A custom photo chosen in Settings replaces the bundled one. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <img src={homeImage || 'assets/home.jpg'} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <Page colors={{ bgIos: 'bg-transparent' }} className="relative z-10 pb-safe-24">
        <div className="flex min-h-full flex-col">
          {/* The title, over the photo */}
          <div className="px-5 pt-20 text-center">
            <h1 className="text-[34px] font-bold leading-tight tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.55)]">
              MatchStatsLog
            </h1>
            <p className="mt-1 text-sm font-medium text-white/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.55)]">
              {today}
            </p>
          </div>

          {/* Viewing a saved match: say so, and keep the way back one tap away */}
          {savedRecord && (
            <div className="mt-5 px-5">
              <div className="flex items-center justify-between gap-3 rounded-full border border-white/15 bg-black/45 py-2 pl-4 pr-2 backdrop-blur-md">
                <span className="min-w-0 truncate text-[13px] font-medium text-white/85">
                  Showing{' '}
                  {savedRecord.match.opposition
                    ? `vs ${savedRecord.match.opposition}`
                    : 'a saved match'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    haptic('tick');
                    setHomeView(null);
                  }}
                  className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold text-white
                             transition-transform active:scale-95"
                >
                  Current
                </button>
              </div>
            </div>
          )}

          {/* The fixture, read-only */}
          <div className="mt-5 px-5">
            <div className="rounded-2xl border border-white/15 bg-black/45 px-4 py-1 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/15 py-2.5">
                <span className="text-[12px] font-semibold uppercase tracking-widest text-white/60">
                  Fixture
                </span>
                {savedRecord && (
                  <span className="text-[11px] font-medium text-white/50">
                    Saved {formatSavedAt(savedRecord.savedAt)}
                  </span>
                )}
              </div>
              {rows.map(([label, value]) => (
                <div key={label} className="border-b border-white/10 last:border-b-0">
                  <FixtureRow label={label} value={value} />
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-[12px] text-white/60 [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
              {savedRecord
                ? 'Read only. Open the saved match from the Season tab for the full record.'
                : 'Read only. Edit these details on the Match Info screen.'}
            </p>
          </div>

          {/* The way in */}
          <div className="mt-auto px-5 pb-6 pt-6">
            {savedRecord ? (
              <Button
                large
                rounded
                onClick={() => {
                  haptic('tick');
                  setSavedOpenId(savedRecord.id);
                  onNavigate('season');
                }}
              >
                View Full Match
              </Button>
            ) : (
              <Button large rounded onClick={() => onNavigate('info')}>
                Go to Match Info
              </Button>
            )}
          </div>
        </div>
      </Page>
    </>
  );
}
