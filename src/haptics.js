// Every haptic the app plays, by name.
//
// THIS FILE IS A FIXED CONTRACT, like src/icons.js. Milq reads it to list the
// app's haptics, and it is written by the set_haptic and remove_haptic tools —
// not by hand. Three things must stay true:
//
//   1. the file stays at src/haptics.js
//   2. the export stays named HAPTICS
//   3. every value is a plain object literal (no function calls, no variables)
//
// There are no canned effects. An effect is a pattern you describe: a list of
// events on a timeline, in seconds.
//
//   type       'transient' (an instantaneous tap) or 'continuous' (a buzz)
//   time       when it fires, relative to the start
//   intensity  0-1, how hard it hits
//   sharpness  0-1, a dull thud at 0, a crisp tick at 1
//   duration   continuous events only, seconds
//
// Events also take an envelope — attackTime, decayTime, releaseTime, sustained
// — for how they rise, hold and fall.
//
// A pattern may carry curves, which ramp intensity or sharpness smoothly rather
// than in steps, and may loop, set a playbackRate, or be marked sustained so the
// app can change it with hapticUpdate() while it runs.
//
// There is no web haptics API on iOS: this goes through the app to the Taptic
// Engine, so it does nothing when the project is opened in a plain browser.

export const HAPTICS = {
  tick: { events: [{ intensity: 0.5, sharpness: 0.8, time: 0, type: 'transient' }] },

  impact: { events: [{ intensity: 1, sharpness: 0.9, time: 0, type: 'transient' }, { duration: 0.28, intensity: 0.55, sharpness: 0.2, time: 0.02, type: 'continuous' }] },

  charge: { curves: [{ parameter: 'intensity', points: [{ time: 0, value: 0.1 }, { time: 0.6, value: 1 }, { time: 0.8, value: 0 }], time: 0 }], events: [{ duration: 0.8, intensity: 0.4, sharpness: 0.3, time: 0, type: 'continuous' }] },

  periodOn: { events: [{ intensity: 0.65, sharpness: 0.85, time: 0, type: 'transient' }] },

  periodOff: { events: [{ intensity: 0.35, sharpness: 0.25, time: 0, type: 'transient' }] },

  bump: { events: [{ intensity: 0.4, sharpness: 0.6, time: 0, type: 'transient' }] },

  goalSaved: { events: [{ intensity: 0.9, sharpness: 0.7, time: 0, type: 'transient' }, { intensity: 0.7, sharpness: 0.5, time: 0.09, type: 'transient' }, { attackTime: 0.01, duration: 0.22, intensity: 0.45, releaseTime: 0.18, sharpness: 0.2, time: 0.1, type: 'continuous' }] },

  removed: { events: [{ intensity: 1, sharpness: 0.35, time: 0, type: 'transient' }, { duration: 0.16, intensity: 0.4, releaseTime: 0.14, sharpness: 0.15, time: 0.02, type: 'continuous' }] },

  archived: { events: [{ intensity: 0.55, sharpness: 0.5, time: 0, type: 'transient' }, { intensity: 0.85, sharpness: 0.75, time: 0.09, type: 'transient' }, { attackTime: 0.01, duration: 0.18, intensity: 0.35, releaseTime: 0.15, sharpness: 0.2, time: 0.1, type: 'continuous' }] },

  clockStart: { events: [{ intensity: 0.75, sharpness: 0.95, time: 0, type: 'transient' }, { intensity: 0.5, sharpness: 0.8, time: 0.06, type: 'transient' }] },

  clockPause: { events: [{ intensity: 0.45, sharpness: 0.25, time: 0, type: 'transient' }] },

  clockStop: { events: [{ intensity: 0.8, sharpness: 0.4, time: 0, type: 'transient' }, { duration: 0.3, intensity: 0.55, releaseTime: 0.24, sharpness: 0.1, time: 0.04, type: 'continuous' }] },

  subLogged: { events: [{ intensity: 0.6, sharpness: 0.2, time: 0, type: 'transient' }, { intensity: 0.85, sharpness: 0.9, time: 0.14, type: 'transient' }] },

  alarm: { events: [{ intensity: 1, sharpness: 0.85, time: 0, type: 'transient' }, { intensity: 0.9, sharpness: 0.85, time: 0.22, type: 'transient' }], loop: 1, loopEnd: 1 }
};

const channel =
  typeof window !== 'undefined' &&
  window.webkit &&
  window.webkit.messageHandlers &&
  window.webkit.messageHandlers.milqHaptics;

function send(payload) {
  if (channel) channel.postMessage(payload);
}

/// Plays a named haptic. Unknown names are ignored rather than throwing, so a
/// renamed effect never crashes a component mid-render.
///
/// Pass an id for an effect you intend to change or stop while it runs —
/// looping and sustained effects only. One-shots need no id.
export function haptic(name, id) {
  const effect = HAPTICS[name];
  if (!effect) return;
  send(id ? { ...effect, action: 'play', id } : effect);
}

/// Changes an effect that is already playing: intensity, sharpness, volume or
/// playbackRate. Only reaches effects started with an id.
export function hapticUpdate(id, params) {
  send({ action: 'update', id, ...params });
}

/// Stops one running effect, or every one when called with no id.
export function hapticStop(id) {
  send({ action: 'stop', id });
}

/// Plays an effect without naming it. Prefer named entries in HAPTICS — those
/// are the ones Milq can list and the user can find.
export function hapticNow(effect, id) {
  if (!effect) return;
  send(id ? { ...effect, action: 'play', id } : effect);
}
