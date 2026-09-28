let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtor = window.AudioContext;
    ctx = new AudioCtor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface Tone {
  freq: number;
  duration: number;
  type: OscillatorType;
  gain: number;
}

function playTone(tone: Tone, delay = 0): void {
  const audio = getContext();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = tone.type;
  osc.frequency.setValueAtTime(tone.freq, audio.currentTime + delay);
  gain.gain.setValueAtTime(tone.gain, audio.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + delay + tone.duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(audio.currentTime + delay);
  osc.stop(audio.currentTime + delay + tone.duration);
}

export function sfxHitEnemy(): void {
  playTone({ freq: 220, duration: 0.08, type: 'square', gain: 0.08 });
}

export function sfxHitPlayer(): void {
  playTone({ freq: 110, duration: 0.12, type: 'sawtooth', gain: 0.1 });
}

export function sfxEnemyDied(): void {
  playTone({ freq: 440, duration: 0.1, type: 'square', gain: 0.07 });
  playTone({ freq: 660, duration: 0.12, type: 'square', gain: 0.07 }, 0.08);
}

export function sfxRelic(): void {
  playTone({ freq: 880, duration: 0.1, type: 'sine', gain: 0.06 });
  playTone({ freq: 1320, duration: 0.14, type: 'sine', gain: 0.06 }, 0.07);
}

export function sfxFloorCleared(): void {
  playTone({ freq: 523, duration: 0.12, type: 'triangle', gain: 0.07 });
  playTone({ freq: 659, duration: 0.16, type: 'triangle', gain: 0.07 }, 0.1);
}

export function sfxDescend(): void {
  playTone({ freq: 300, duration: 0.2, type: 'sine', gain: 0.06 });
  playTone({ freq: 220, duration: 0.2, type: 'sine', gain: 0.06 }, 0.1);
}

export function sfxExtracted(): void {
  playTone({ freq: 523, duration: 0.14, type: 'triangle', gain: 0.08 });
  playTone({ freq: 659, duration: 0.14, type: 'triangle', gain: 0.08 }, 0.12);
  playTone({ freq: 784, duration: 0.22, type: 'triangle', gain: 0.08 }, 0.24);
}

export function sfxDead(): void {
  playTone({ freq: 180, duration: 0.3, type: 'sawtooth', gain: 0.1 });
  playTone({ freq: 120, duration: 0.4, type: 'sawtooth', gain: 0.1 }, 0.2);
}
