/** Tiny Web Audio synth for board sounds. No audio files to download. */
type SoundName = 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'end' | 'illegal' | 'lowtime' | 'notify';

let ctx: AudioContext | null = null;
let enabled = true;
// Browsers refuse audio before the first user gesture; stay silent until then.
let gestured = false;
if (typeof window !== 'undefined') {
  const mark = () => {
    gestured = true;
    window.removeEventListener('pointerdown', mark, true);
    window.removeEventListener('keydown', mark, true);
  };
  window.addEventListener('pointerdown', mark, true);
  window.addEventListener('keydown', mark, true);
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call from a user gesture once so iOS Safari allows later sounds. */
export function unlockAudio() {
  audio();
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, peak: number) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseClick(start: number, dur: number, peak: number, cutoff: number) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + start;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = ac.createGain();
  gain.gain.value = peak;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
}

export function playSound(name: SoundName) {
  if (!enabled || !gestured) return;
  try {
    switch (name) {
      case 'move':
        noiseClick(0, 0.06, 0.9, 1800);
        tone(180, 0, 0.07, 'triangle', 0.25);
        break;
      case 'capture':
        noiseClick(0, 0.09, 1.2, 3200);
        tone(140, 0, 0.1, 'square', 0.12);
        break;
      case 'castle':
        noiseClick(0, 0.05, 0.8, 1800);
        noiseClick(0.09, 0.05, 0.8, 1800);
        break;
      case 'check':
        noiseClick(0, 0.06, 0.9, 2000);
        tone(660, 0.02, 0.12, 'sine', 0.18);
        tone(880, 0.1, 0.14, 'sine', 0.14);
        break;
      case 'promote':
        tone(523, 0, 0.1, 'sine', 0.15);
        tone(784, 0.08, 0.16, 'sine', 0.15);
        break;
      case 'end':
        tone(392, 0, 0.35, 'sine', 0.16);
        tone(494, 0.06, 0.35, 'sine', 0.13);
        tone(587, 0.12, 0.45, 'sine', 0.12);
        break;
      case 'illegal':
        tone(110, 0, 0.12, 'sawtooth', 0.06);
        break;
      case 'lowtime':
        tone(1200, 0, 0.05, 'sine', 0.08);
        break;
      case 'notify':
        tone(740, 0, 0.12, 'sine', 0.12);
        tone(988, 0.1, 0.16, 'sine', 0.1);
        break;
    }
  } catch {
    /* audio is best-effort */
  }
}

export function soundForMove(m: { san: string; captured?: string; flags: string; promotion?: string }): SoundName {
  if (m.san.includes('+') || m.san.includes('#')) return 'check';
  if (m.promotion) return 'promote';
  if (m.flags.includes('k') || m.flags.includes('q')) return 'castle';
  if (m.captured) return 'capture';
  return 'move';
}
