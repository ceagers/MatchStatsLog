// The app's icons, from the bundled symbol library (vendor/symbols.js, the
// full Lucide set): <Icon name="chevron-left" /> just works — no lookup, no
// drawing. Icons inherit the surrounding text colour the way SF Symbols do.

import { createElement } from 'react';
import { SYMBOLS } from '../vendor/symbols.js';

/// An icon as a React element: <Icon name="calendar" size={24} />.
///
/// `currentColor` by default, so it inherits the surrounding text colour.
/// Unknown names render nothing and warn, so a typo is visible in the runtime
/// log instead of silently blank.
export function Icon({ name, size = 24, color = 'currentColor', ...rest }) {
  const symbol = SYMBOLS[name];
  if (symbol) {
    return createElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24',
      width: size, height: size,
      fill: 'none', stroke: color, strokeWidth: 2,
      strokeLinecap: 'round', strokeLinejoin: 'round',
      dangerouslySetInnerHTML: { __html: symbol },
      ...rest,
    });
  }

  console.warn(`Icon "${name}" is not a bundled symbol.`);
  return null;
}

/// An icon as an SVG data URI, for `background-image` or an <img src>.
export function iconDataURI(name, color = '#ffffff') {
  const symbol = SYMBOLS[name];
  if (!symbol) return null;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ` +
    `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" ` +
    `stroke-linejoin="round">${symbol}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
