// WebAudio synthesized sound: cheerful ambient loop + effects. No samples.
// (Filled in properly in the audio milestone; the interface is stable.)

import type { Options } from './types.ts';

export class AudioSys {
  private opts: Options;

  constructor(opts: Options) {
    this.opts = opts;
  }

  setOptions(opts: Options): void {
    this.opts = opts;
  }

  /** Call from a user gesture to unlock the audio context. */
  unlock(): void {}

  click(): void {}

  chaChing(): void {}

  sad(): void {}

  dayStart(): void {}

  dayEnd(): void {}

  startMusic(): void {}

  stopMusic(): void {}

  protected get enabled(): boolean {
    return this.opts.volume > 0;
  }
}
