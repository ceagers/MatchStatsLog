// The countdown's alarm tone: a repeating synthesized beep through the
// speakers, independent of any audio file. The AudioContext is created the
// moment a countdown is started (a user gesture), so iOS lets it sound later
// when the countdown reaches zero without needing another tap.
//
// The alarm rings until stopAlarm() is called — dismissing it is always an
// explicit user action.

let ctx = null;
let cycleId = null;

function beepAt(at) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(880, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.28, at + 0.012);
  gain.gain.setValueAtTime(0.28, at + 0.17);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.21);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.24);
}

function cycle() {
  try {
    const t = ctx.currentTime + 0.06;
    beepAt(t);
    beepAt(t + 0.3);
    beepAt(t + 0.6);
  } catch {
    // The audio graph failed this cycle — the haptic alarm still rings.
  }
}

export function ensureAudio() {
  try {
    if (!ctx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) ctx = new AudioCtor();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  } catch {
    // No audio available — the alarm still vibrates.
  }
}

export function startAlarm() {
  if (!ctx || cycleId) return;
  cycle();
  cycleId = setInterval(cycle, 1500);
}

export function stopAlarm() {
  if (cycleId) {
    clearInterval(cycleId);
    cycleId = null;
  }
}
