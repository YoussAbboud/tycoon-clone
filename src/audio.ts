// WebAudio synthesized sound: cheerful ambient loop + effects. No samples.

import type { Options } from './types.ts';

const MUSIC_LEVEL = 0.16;
const SFX_LEVEL = 0.5;

export class AudioSys {
  private opts: Options;
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private nextBarTime = 0;
  private bar = 0;

  constructor(opts: Options) {
    this.opts = opts;
  }

  setOptions(opts: Options): void {
    this.opts = opts;
    if (this.master && this.ac) {
      this.master.gain.setTargetAtTime(opts.volume, this.ac.currentTime, 0.05);
    }
    if (this.musicGain && this.ac) {
      this.musicGain.gain.setTargetAtTime(opts.music ? MUSIC_LEVEL : 0, this.ac.currentTime, 0.1);
    }
    if (this.sfxGain && this.ac) {
      this.sfxGain.gain.setTargetAtTime(opts.sfx ? SFX_LEVEL : 0, this.ac.currentTime, 0.05);
    }
  }

  /** Call from a user gesture to unlock the audio context. */
  unlock(): void {
    if (this.ac) {
      if (this.ac.state === 'suspended') void this.ac.resume();
      return;
    }
    try {
      this.ac = new AudioContext();
    } catch {
      return; // no audio support — play silently
    }
    this.master = this.ac.createGain();
    this.master.gain.value = this.opts.volume;
    this.master.connect(this.ac.destination);
    this.musicGain = this.ac.createGain();
    this.musicGain.gain.value = this.opts.music ? MUSIC_LEVEL : 0;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ac.createGain();
    this.sfxGain.gain.value = this.opts.sfx ? SFX_LEVEL : 0;
    this.sfxGain.connect(this.master);
    this.startMusic();
  }

  // -- Music ---------------------------------------------------------------
  // A lazy 2-bar scheduler: soft pad chords + pentatonic marimba plinks.

  startMusic(): void {
    if (!this.ac || this.musicTimer !== null) return;
    this.nextBarTime = this.ac.currentTime + 0.1;
    this.bar = 0;
    const BAR = (60 / 76) * 4; // 76 BPM, 4 beats
    const tick = () => {
      if (!this.ac) return;
      while (this.nextBarTime < this.ac.currentTime + BAR * 1.5) {
        this.scheduleBar(this.nextBarTime, BAR);
        this.nextBarTime += BAR;
        this.bar += 1;
      }
    };
    tick();
    this.musicTimer = window.setInterval(tick, 900);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleBar(t0: number, barLen: number): void {
    if (!this.ac || !this.musicGain) return;
    // I–vi–IV–V in C major, one chord per bar.
    const chords = [
      [261.63, 329.63, 392.0], // C
      [220.0, 261.63, 329.63], // Am
      [174.61, 220.0, 261.63], // F
      [196.0, 246.94, 293.66], // G
    ];
    const chord = chords[this.bar % 4];

    // Pad: slow-attack detuned triangles.
    for (const f of chord) {
      for (const det of [-2.5, 2.5]) {
        const o = this.ac.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f / 2;
        o.detune.value = det;
        const gn = this.ac.createGain();
        gn.gain.setValueAtTime(0, t0);
        gn.gain.linearRampToValueAtTime(0.06, t0 + barLen * 0.3);
        gn.gain.linearRampToValueAtTime(0.0001, t0 + barLen * 1.05);
        o.connect(gn).connect(this.musicGain);
        o.start(t0);
        o.stop(t0 + barLen * 1.1);
      }
    }

    // Bass pluck on beat 1 and 3.
    for (const beat of [0, 2]) {
      this.pluck(chord[0] / 2, t0 + (beat * barLen) / 4, 0.28, 'sine', 0.16);
    }

    // Melody: sparse pentatonic plinks (C D E G A), deterministic-ish per bar.
    const penta = [523.25, 587.33, 659.25, 783.99, 880.0];
    const seed = (this.bar * 2654435761) >>> 0;
    for (let i = 0; i < 4; i++) {
      const r = ((seed >> (i * 7)) & 127) / 127;
      if (r < 0.62) {
        const note = penta[Math.floor(r * 8.06) % penta.length];
        this.pluck(note, t0 + (i * barLen) / 4 + (r > 0.3 ? barLen / 8 : 0), 0.5, 'triangle', 0.11);
      }
    }
  }

  /** A marimba-ish decaying note into the music bus. */
  private pluck(freq: number, t: number, dur: number, type: OscillatorType, level: number): void {
    if (!this.ac || !this.musicGain) return;
    const o = this.ac.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const gn = this.ac.createGain();
    gn.gain.setValueAtTime(level, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = this.ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    o.connect(gn).connect(lp).connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // -- SFX -----------------------------------------------------------------

  private sfxNote(
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType = 'sine',
    level = 0.3,
  ): void {
    if (!this.ac || !this.sfxGain) return;
    const o = this.ac.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const gn = this.ac.createGain();
    gn.gain.setValueAtTime(level, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(t: number, dur: number, level = 0.2, freq = 3000): void {
    if (!this.ac || !this.sfxGain) return;
    const len = Math.max(1, Math.floor(this.ac.sampleRate * dur));
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    const bp = this.ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 0.8;
    const gn = this.ac.createGain();
    gn.gain.value = level;
    src.connect(bp).connect(gn).connect(this.sfxGain);
    src.start(t);
  }

  click(): void {
    if (!this.ac) return;
    this.sfxNote(660, this.ac.currentTime, 0.06, 'square', 0.08);
  }

  /** Cash register — the sound of success. */
  chaChing(): void {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    this.noise(t, 0.05, 0.25, 4200); // drawer clack
    this.sfxNote(2093, t + 0.03, 0.35, 'sine', 0.22); // C7 bell
    this.sfxNote(2637, t + 0.06, 0.4, 'sine', 0.18); // E7 bell
    this.sfxNote(3136, t + 0.06, 0.3, 'sine', 0.1);
  }

  /** Grumpy customer. */
  sad(): void {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    this.sfxNote(330, t, 0.12, 'triangle', 0.12);
    this.sfxNote(262, t + 0.11, 0.2, 'triangle', 0.12);
  }

  dayStart(): void {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.sfxNote(f, t + i * 0.09, 0.25, 'triangle', 0.16));
  }

  dayEnd(): void {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    [783.99, 659.25, 523.25].forEach((f, i) => this.sfxNote(f, t + i * 0.12, 0.3, 'triangle', 0.14));
    this.sfxNote(392, t + 0.36, 0.5, 'triangle', 0.14);
  }
}
