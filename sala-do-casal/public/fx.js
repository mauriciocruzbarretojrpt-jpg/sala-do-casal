// "Juice": sons sintetizados (WebAudio, sem arquivos), confete de corações e tremor de tela.
// Uso: FX.play('hit'), FX.confetti(), FX.shake(elemento)
(function () {
  let ctx = null, muted = false;
  try { muted = localStorage.getItem('salaMute') === '1'; } catch {}
  const ac = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  // libera o áudio no primeiro toque/clique (regra dos navegadores)
  ['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, () => ac(), { once: true, passive: true }));

  function tone(freq, dur, { type = 'sine', vol = 0.18, slide = 0, delay = 0 } = {}) {
    const c = ac(); if (!c || muted) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, { vol = 0.25, freq = 1800, delay = 0 } = {}) {
    const c = ac(); if (!c || muted) return;
    const t = c.currentTime + delay, len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination); src.start(t);
  }
  const notes = (seq, step = 0.11, opts = {}) => seq.forEach((f, i) => tone(f, step * 1.6, { ...opts, delay: i * step }));

  const SOUNDS = {
    click: () => tone(660, 0.06, { type: 'triangle', vol: 0.1 }),
    msg: () => { tone(880, 0.08, { vol: 0.08 }); tone(1320, 0.1, { vol: 0.06, delay: 0.07 }); },
    place: () => { tone(220, 0.09, { type: 'triangle', vol: 0.22, slide: 0.6 }); noise(0.05, { vol: 0.12, freq: 900 }); },
    flip: () => { noise(0.06, { vol: 0.15, freq: 3000 }); tone(520, 0.05, { type: 'triangle', vol: 0.06 }); },
    match: () => notes([660, 880, 1320], 0.07, { type: 'triangle', vol: 0.12 }),
    hit: () => { noise(0.07, { vol: 0.35, freq: 1400 }); tone(300, 0.08, { type: 'square', vol: 0.06, slide: 0.5 }); },
    power: () => { noise(0.12, { vol: 0.5, freq: 900 }); tone(180, 0.18, { type: 'sawtooth', vol: 0.1, slide: 0.4 }); tone(1200, 0.12, { vol: 0.08, slide: 1.8 }); },
    bounce: () => tone(140, 0.07, { vol: 0.15, slide: 0.6 }),
    point: () => notes([523, 784], 0.1, { type: 'triangle', vol: 0.14 }),
    lostPoint: () => notes([392, 294], 0.12, { type: 'triangle', vol: 0.12 }),
    win: () => notes([523, 659, 784, 1047, 1319], 0.1, { type: 'triangle', vol: 0.16 }),
    lose: () => notes([392, 349, 311, 262], 0.16, { type: 'sine', vol: 0.14 }),
    draw: () => notes([523, 523], 0.14, { type: 'triangle', vol: 0.12 }),
    tick: () => tone(660, 0.12, { type: 'square', vol: 0.08 }),
    go: () => tone(1046, 0.35, { type: 'square', vol: 0.1 }),
    boost: () => tone(300, 0.5, { type: 'sawtooth', vol: 0.08, slide: 3 }),
    cue: () => { noise(0.04, { vol: 0.4, freq: 2500 }); tone(900, 0.03, { vol: 0.08 }); },
    pocket: () => { tone(180, 0.18, { vol: 0.2, slide: 0.5 }); noise(0.1, { vol: 0.12, freq: 400, delay: 0.05 }); },
    pop: () => tone(500, 0.12, { vol: 0.12, slide: 2.2 }),
    reveal: () => notes([392, 523, 659], 0.06, { type: 'triangle', vol: 0.1 }),
    heart: () => notes([784, 988], 0.08, { vol: 0.1 }),
  };
  let lastPlay = {};
  function play(name) {
    const now = performance.now();
    if (now - (lastPlay[name] || 0) < 40) return; // evita som "metralhadora"
    lastPlay[name] = now;
    try { SOUNDS[name]?.(); } catch {}
  }

  // ---------- confete de corações ----------
  function confetti(n = 90) {
    const c = document.createElement('canvas');
    c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
    c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
    const x = c.getContext('2d');
    const icons = ['💖', '💕', '✨', '🎉', '💗', '⭐'];
    const parts = Array.from({ length: n }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.55,
      vx: (Math.random() - 0.5) * 14, vy: -8 - Math.random() * 12, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      s: 16 + Math.random() * 18, i: icons[Math.floor(Math.random() * icons.length)],
    }));
    const t0 = performance.now();
    (function frame(t) {
      const el = (t - t0) / 1000; x.clearRect(0, 0, c.width, c.height);
      for (const p of parts) {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        x.save(); x.globalAlpha = Math.max(0, 1 - el / 2.6); x.translate(p.x, p.y); x.rotate(p.r);
        x.font = `${p.s}px serif`; x.textAlign = 'center'; x.fillText(p.i, 0, 0); x.restore();
      }
      if (el < 2.6) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }

  function shake(el, strength = 8) {
    if (!el) return;
    el.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${-strength}px,${strength / 2}px)` },
      { transform: `translate(${strength}px,${-strength / 2}px)` }, { transform: `translate(${-strength / 2}px,0)` }, { transform: 'translate(0,0)' }],
    { duration: 260, easing: 'ease-out' });
  }

  function toggleMute() { muted = !muted; try { localStorage.setItem('salaMute', muted ? '1' : '0'); } catch {} return muted; }
  window.FX = { play, confetti, shake, toggleMute, get muted() { return muted; } };
})();
