/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioService {
  private ctx: AudioContext | null = null;

  private isMuted(): boolean {
    try {
      const savedSound = localStorage.getItem('chess_sound_enabled');
      return savedSound === 'false';
    } catch {
      return false;
    }
  }

  private isMoveEnabled(): boolean {
    if (this.isMuted()) return false;
    try {
      const saved = localStorage.getItem('chess_sound_move_enabled');
      return saved !== 'false';
    } catch {
      return true;
    }
  }

  private isCaptureEnabled(): boolean {
    if (this.isMuted()) return false;
    try {
      const saved = localStorage.getItem('chess_sound_capture_enabled');
      return saved !== 'false';
    } catch {
      return true;
    }
  }

  private isAlertEnabled(): boolean {
    if (this.isMuted()) return false;
    try {
      const saved = localStorage.getItem('chess_sound_alert_enabled');
      return saved !== 'false';
    } catch {
      return true;
    }
  }

  private initContext() {
    if (!this.ctx) {
      // Lazy initialize to bypass browser autoplay policies
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    // Resume context if it was suspended (autoplay prevention)
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Synthesizes a clean, wooden tap sound representing a standard piece movement.
   */
  public playMove() {
    try {
      if (!this.isMoveEnabled()) return;
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      // Low wooden pluck frequencies
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.08);

      // Filter settings for warm acoustic tone
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.1);

      // Gain Envelope
      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.15);
    } catch (error) {
      console.warn('Audio playMove failed:', error);
    }
  }

  /**
   * Synthesizes a sharper, double-strike sound with mechanical wood characteristics for captures.
   */
  public playCapture() {
    try {
      if (!this.isCaptureEnabled()) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // Primary solid strike
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(220, now);
      osc1.frequency.exponentialRampToValueAtTime(110, now + 0.12);

      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      // Secondary transient crack
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      const filter2 = this.ctx.createBiquadFilter();

      osc2.connect(filter2);
      filter2.connect(gain2);
      gain2.connect(this.ctx.destination);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(650, now);
      
      filter2.type = 'bandpass';
      filter2.frequency.setValueAtTime(1500, now);
      filter2.Q.setValueAtTime(3, now);

      gain2.gain.setValueAtTime(0.25, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc1.start(now);
      osc1.stop(now + 0.2);
      osc2.start(now);
      osc2.stop(now + 0.1);
    } catch (error) {
      console.warn('Audio playCapture failed:', error);
    }
  }

  /**
   * Synthesizes an alert warning chime indicating a King check status.
   */
  public playCheck() {
    try {
      if (!this.isAlertEnabled()) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // Two harmonic oscillators to produce an elegant chime chord (minor second warning)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(554.37, now); // Db5 (creates warning tension)

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc1.start(now);
      osc1.stop(now + 0.6);
      osc2.start(now);
      osc2.stop(now + 0.6);
    } catch (error) {
      console.warn('Audio playCheck failed:', error);
    }
  }

  /**
   * Synthesizes an elegant, triumphant chime chord for game-end alerts.
   */
  public playGameEnd() {
    try {
      if (!this.isAlertEnabled()) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const osc3 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.connect(gain);
      osc2.connect(gain);
      osc3.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(261.63, now); // C4
      osc1.frequency.exponentialRampToValueAtTime(523.25, now + 0.5); // Slide to C5

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(329.63, now); // E4
      osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.5); // Slide to E5

      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(392.00, now); // G4
      osc3.frequency.exponentialRampToValueAtTime(783.99, now + 0.5); // Slide to G5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc1.start(now);
      osc1.stop(now + 0.9);
      osc2.start(now);
      osc2.stop(now + 0.9);
      osc3.start(now);
      osc3.stop(now + 0.9);
    } catch (error) {
      console.warn('Audio playGameEnd failed:', error);
    }
  }
}

export const audioService = new AudioService();
