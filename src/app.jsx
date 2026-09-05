// The app's root screen. Build the app out from here: new screens and
// components live in src/, imported by relative path ending in .jsx.

import { useState } from 'react';
import { Page, Glass } from 'konsta/react';
import { haptic } from './haptics.js';

export default function AppScreen() {
  const [taps, setTaps] = useState(0);

  return (
    <Page className="flex flex-col items-center justify-center gap-4 px-8 text-center">
      <h1 className="text-4xl font-bold">Hello World</h1>
      <p className="text-gray-500">
        Describe your idea, and watch it come to life right here.
      </p>

      {/* A text button on Konsta's liquid-glass surface. */}
      <Glass
        component="button"
        className="mt-4 rounded-full px-8 py-3.5 font-semibold text-lg"
        onClick={() => {
          haptic('tick');
          setTaps((count) => count + 1);
        }}
      >
        {taps === 0 ? 'Tap me' : `Tapped ${taps} ${taps === 1 ? 'time' : 'times'}`}
      </Glass>
    </Page>
  );
}
