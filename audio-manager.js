export const AudioManager = {
  enabled: true,
  ctx: null,

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.enabled = false;
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  play(type) {
    if (!this.enabled || !this.ctx) return;
    this.resume();

    if (type === 'correct') {
      const popOsc = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      popOsc.type = 'sine';
      popOsc.connect(popGain);
      popGain.connect(this.ctx.destination);

      popOsc.frequency.setValueAtTime(720, this.ctx.currentTime);
      popOsc.frequency.exponentialRampToValueAtTime(
        180,
        this.ctx.currentTime + 0.09,
      );
      popGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      popGain.gain.exponentialRampToValueAtTime(
        0.2,
        this.ctx.currentTime + 0.01,
      );
      popGain.gain.exponentialRampToValueAtTime(
        0.001,
        this.ctx.currentTime + 0.11,
      );

      const sparkleOsc = this.ctx.createOscillator();
      const sparkleGain = this.ctx.createGain();
      sparkleOsc.type = 'triangle';
      sparkleOsc.connect(sparkleGain);
      sparkleGain.connect(this.ctx.destination);
      sparkleOsc.frequency.setValueAtTime(980, this.ctx.currentTime + 0.02);
      sparkleOsc.frequency.exponentialRampToValueAtTime(
        620,
        this.ctx.currentTime + 0.09,
      );
      sparkleGain.gain.setValueAtTime(0.001, this.ctx.currentTime + 0.02);
      sparkleGain.gain.exponentialRampToValueAtTime(
        0.08,
        this.ctx.currentTime + 0.04,
      );
      sparkleGain.gain.exponentialRampToValueAtTime(
        0.001,
        this.ctx.currentTime + 0.1,
      );

      popOsc.start(this.ctx.currentTime);
      popOsc.stop(this.ctx.currentTime + 0.12);
      sparkleOsc.start(this.ctx.currentTime + 0.02);
      sparkleOsc.stop(this.ctx.currentTime + 0.1);
    } else if (type === 'wrong') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(170, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        95,
        this.ctx.currentTime + 0.18,
      );
      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, this.ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.22);
    } else if (type === 'gameover') {
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.connect(g);
        g.connect(this.ctx.destination);
        o.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.15);
        g.gain.setValueAtTime(0.12, this.ctx.currentTime + i * 0.15);
        g.gain.exponentialRampToValueAtTime(
          0.001,
          this.ctx.currentTime + i * 0.15 + 0.3,
        );
        o.start(this.ctx.currentTime + i * 0.15);
        o.stop(this.ctx.currentTime + i * 0.15 + 0.3);
      });
    }
  },

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  },
};
