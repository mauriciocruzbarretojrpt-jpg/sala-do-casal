// =============== CORRIDA ===============
const TRACK = [[220, 620], [500, 632], [760, 615], [880, 540], [910, 400], [870, 250], [900, 130], [800, 70], [620, 90],
  [520, 180], [400, 190], [260, 90], [130, 130], [90, 280], [200, 360], [180, 480], [110, 560], [150, 615]];
const TW = 58; // meia-largura da pista
const N = TRACK.length;
let race = null;
// Turbos ⚡ fora da linha ideal: escolha de risco (desviar do caminho curto para ganhar velocidade)
const BOOSTS = [[1, 0.5, 40], [4, 0.45, -40], [8, 0.5, 40], [12, 0.5, 40], [15, 0.5, -38]].map(([s, t, off]) => {
  const [ax, ay] = TRACK[s], [bx, by] = TRACK[(s + 1) % TRACK.length];
  const a = Math.atan2(by - ay, bx - ax);
  return { x: ax + (bx - ax) * t - Math.sin(a) * off, y: ay + (by - ay) * t + Math.cos(a) * off, a };
});

function nearestSeg(x, y) {
  let best = { s: 0, d: 1e9 };
  for (let i = 0; i < N; i++) {
    const [ax, ay] = TRACK[i], [bx, by] = TRACK[(i + 1) % N];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
    if (d < best.d) best = { s: i, d };
  }
  return best;
}

RENDER.corrida = function () {
  const g = game;
  const times = g.players.filter((p) => g.finished[p] != null).map((p) => `${esc(name(p))}: ${(g.finished[p] / 1000).toFixed(2)}s`).join(' · ');
  if (g.winner) setStatus(`${g.winner === me ? 'Você venceu! 🏆' : esc(name(g.winner)) + ' venceu! 🏆'} <small class="muted">${times}</small>`);
  else setStatus(`${g.laps} voltas — quem cruzar primeiro vence! 🏁`);
  showRestart(!!g.winner);
  if (mountedId !== g.id) mountRace(g);
};

function mountRace(g) {
  mountedId = g.id;
  if (isMobile()) setChat(false);
  const touch = matchMedia('(any-pointer: coarse)').matches || document.body.classList.contains('touch');
  $('#board').innerHTML = `<div class="race-wrap ${touch ? 'touch-mode' : ''}" id="rwrap"><canvas id="rc"></canvas>
    <div class="steer-hint"><span>◀ segure</span><span>segure ▶</span></div>
    <button id="rbrake" class="race-brake">🛑</button></div>
    <p class="hint">${touch ? 'O carro acelera sozinho: segure o lado esquerdo/direito da tela para virar, 🛑 para frear.' : 'Teclado: ↑ acelera · ↓ freia/ré · ← → vira (ou W A S D).'} Na grama fica lento! Turbos ⚡ ficam fora da linha ideal — vale o desvio?</p>`;
  const idx = Math.max(0, g.players.indexOf(me));
  const [x0, y0] = TRACK[0], [x1, y1] = TRACK[1];
  const a = Math.atan2(y1 - y0, x1 - x0);
  const side = idx === 0 ? -22 : 22;
  race = {
    id: g.id, start: Date.now() + Math.max(0, g.startIn), cp: 1, done: false, time: null, others: {}, keys: {}, lastSend: 0, lastT: performance.now(),
    boostUntil: 0, padCool: {}, lastCount: null, went: false, touch, skids: [], cam: null,
    car: { x: x0 + Math.cos(a) * 50 - Math.sin(a) * side, y: y0 + Math.sin(a) * 50 + Math.cos(a) * side, a, v: 0 },
  };
  const cv = $('#rc');
  const fit = () => { const dpr = Math.min(devicePixelRatio || 1, 2); cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; race.dpr = dpr; };
  fit(); new ResizeObserver(fit).observe(cv);
  // toque: metade esquerda/direita da tela vira; acelera sozinho
  const ptrs = new Map();
  const upd = () => { const s = [...ptrs.values()]; race.keys.left = s.includes('l'); race.keys.right = s.includes('r'); };
  cv.addEventListener('pointerdown', (e) => {
    if (!race.touch && e.pointerType === 'mouse') return;
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {}
    const r = cv.getBoundingClientRect(); ptrs.set(e.pointerId, e.clientX - r.left < r.width / 2 ? 'l' : 'r'); upd();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => cv.addEventListener(ev, (e) => { ptrs.delete(e.pointerId); upd(); }));
  const brake = $('#rbrake');
  brake.addEventListener('pointerdown', (e) => { e.preventDefault(); race.keys.down = true; brake.classList.add('on'); try { brake.setPointerCapture(e.pointerId); } catch {} });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => brake.addEventListener(ev, () => { race.keys.down = false; brake.classList.remove('on'); }));
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  requestAnimationFrame(raceLoop);
}

const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
['keydown', 'keyup'].forEach((t) => window.addEventListener(t, (e) => {
  if (!race || mountedId !== race.id || game?.type !== 'corrida' || e.target.tagName === 'INPUT') return;
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault(); race.keys[k] = t === 'keydown';
}));

socket.on('racePos', (d) => {
  if (!race || d.gid !== race.id) return;
  const o = race.others[d.id] ||= { x: d.x, y: d.y, a: d.a };
  Object.assign(o, { tx: d.x, ty: d.y, ta: d.a, lap: d.lap, cp: d.cp || 0 });
});

function raceLoop(t) {
  if (!race || mountedId !== race.id) return;
  const dt = Math.min(3, (t - race.lastT) / 16.67); race.lastT = t;
  const c = race.car, k = race.keys, now = Date.now();
  const go = now >= race.start && !race.done;
  // contagem regressiva com bipes
  const left = race.start - now, count = left > 0 ? Math.ceil(left / 1000) : 0;
  if (count && count !== race.lastCount) { race.lastCount = count; FX.play('tick'); }
  if (!count && !race.went) { race.went = true; FX.play('go'); }
  const near = nearestSeg(c.x, c.y);
  const off = near.d > TW;
  // turbos
  if (go) BOOSTS.forEach((b, i) => {
    if (Math.hypot(c.x - b.x, c.y - b.y) < 30 && now > (race.padCool[i] || 0)) {
      race.padCool[i] = now + 1500; race.boostUntil = now + 1000; c.v = Math.max(c.v, 9.5); FX.play('boost');
    }
  });
  const boosting = now < race.boostUntil;
  const max = boosting ? 11 : off ? 2.6 : 7.5;
  const gas = k.up || (race.touch && !k.down); // no celular acelera sozinho
  if (go && boosting) c.v += 0.35 * dt;
  else if (go && k.down) c.v -= 0.32 * dt;
  else if (go && gas) c.v += 0.22 * dt;
  else c.v *= Math.pow(0.975, dt);
  if (!go) c.v *= 0.85;
  if (c.v > max) c.v = Math.max(max, c.v * 0.93);
  c.v = Math.max(-2.5, c.v);
  const turn = 0.055 * dt * Math.min(1, Math.abs(c.v) / 2.5) * Math.sign(c.v);
  if (k.left) c.a -= turn; if (k.right) c.a += turn;
  // marcas de pneu nas curvas rápidas
  if ((k.left || k.right) && c.v > 5.5 && !off) {
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    race.skids.push({ x: c.x - ca * 14 - sa * 9, y: c.y - sa * 14 + ca * 9 }, { x: c.x - ca * 14 + sa * 9, y: c.y - sa * 14 - ca * 9 });
    if (race.skids.length > 900) race.skids.splice(0, 2);
  }
  c.x = Math.max(12, Math.min(988, c.x + Math.cos(c.a) * c.v * dt));
  c.y = Math.max(12, Math.min(688, c.y + Math.sin(c.a) * c.v * dt));
  for (const o of Object.values(race.others)) {
    o.x += ((o.tx ?? o.x) - o.x) * 0.3; o.y += ((o.ty ?? o.y) - o.y) * 0.3;
    let da = (o.ta ?? o.a) - o.a; da = Math.atan2(Math.sin(da), Math.cos(da)); o.a += da * 0.3;
    const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy);
    if (d < 28 && d > 0) { c.x += (dx / d) * (28 - d); c.y += (dy / d) * (28 - d); c.v *= 0.9; }
  }
  // voltas: precisa passar pelos trechos em ordem
  if (go) {
    const s = nearestSeg(c.x, c.y).s;
    const d = (s - (race.cp % N) + N) % N;
    if (d <= 2) race.cp += d + 1;
    if (race.cp >= game.laps * N + 1) {
      race.done = true; race.time = now - race.start;
      socket.emit('move', { finish: true, time: race.time });
    }
  }
  const lap = Math.min(game.laps, Math.floor((race.cp - 1) / N) + 1);
  if (now - race.lastSend > 50) {
    race.lastSend = now;
    socket.emit('racePos', { gid: race.id, x: Math.round(c.x), y: Math.round(c.y), a: +c.a.toFixed(3), lap, cp: race.cp });
  }
  drawRace(lap, now, boosting);
  requestAnimationFrame(raceLoop);
}

function drawCar(cx, x, y, a, col, label, scale = 1) {
  cx.save(); cx.translate(x, y); cx.rotate(a);
  cx.fillStyle = 'rgba(0,0,0,.28)'; cx.beginPath(); cx.roundRect(-16, -8, 36, 22, 7); cx.fill();
  cx.fillStyle = '#1d1d22'; [[-13, -13], [7, -13], [-13, 9], [7, 9]].forEach(([wx, wy]) => cx.fillRect(wx, wy, 9, 4));
  const body = cx.createLinearGradient(0, -10, 0, 10); body.addColorStop(0, col); body.addColorStop(1, shadeCar(col));
  cx.fillStyle = body; cx.beginPath(); cx.roundRect(-19, -10, 38, 20, 7); cx.fill();
  cx.fillStyle = 'rgba(255,255,255,.85)'; cx.fillRect(-4, -2, 26, 4); // faixa
  cx.fillStyle = '#bfe3ff'; cx.beginPath(); cx.roundRect(2, -7, 9, 14, 3); cx.fill();
  cx.fillStyle = '#ffe9a8'; cx.fillRect(16, -8, 3, 4); cx.fillRect(16, 4, 3, 4); // faróis
  cx.restore();
  cx.save(); cx.translate(x, y - 26); cx.scale(1 / scale, 1 / scale);
  cx.font = 'bold 15px Nunito, sans-serif'; cx.textAlign = 'center';
  cx.lineWidth = 4; cx.strokeStyle = '#fff'; cx.strokeText(label, 0, 0); cx.fillStyle = col; cx.fillText(label, 0, 0);
  cx.restore();
}
function shadeCar(hex) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(v * 0.6); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }

function drawTrack(cx, now) {
  cx.fillStyle = '#7cc66b'; cx.fillRect(-200, -200, 1400, 1100);
  cx.fillStyle = '#6fbb5e'; for (let i = -200; i < 1200; i += 50) for (let j = -200 + ((i / 50) % 2 ? 0 : 50); j < 900; j += 100) cx.fillRect(i, j, 50, 50);
  // árvores e flores decorativas
  for (let i = 0; i < 40; i++) {
    const x = (i * 263) % 1100 - 50, y = (i * 157) % 800 - 50;
    if (nearestSeg(x, y).d < TW + 40) continue;
    cx.fillStyle = 'rgba(0,0,0,.15)'; cx.beginPath(); cx.arc(x + 4, y + 5, 16, 0, 7); cx.fill();
    cx.fillStyle = i % 3 ? '#2f8f4a' : '#ff8fb7'; cx.beginPath(); cx.arc(x, y, i % 3 ? 16 : 8, 0, 7); cx.fill();
  }
  const path = () => { cx.beginPath(); TRACK.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.closePath(); };
  cx.lineJoin = 'round'; cx.lineCap = 'round';
  path(); cx.strokeStyle = '#fff'; cx.lineWidth = TW * 2 + 14; cx.stroke();
  path(); cx.strokeStyle = '#e85a5a'; cx.setLineDash([22, 22]); cx.stroke(); cx.setLineDash([]);
  path(); cx.strokeStyle = '#55575e'; cx.lineWidth = TW * 2; cx.stroke();
  path(); cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = 3; cx.setLineDash([24, 20]); cx.stroke(); cx.setLineDash([]);
  const [x0, y0] = TRACK[0], [x1, y1] = TRACK[1]; const a = Math.atan2(y1 - y0, x1 - x0);
  cx.save(); cx.translate(x0, y0); cx.rotate(a);
  for (let i = -TW; i < TW; i += 10) for (let j = 0; j < 2; j++) { cx.fillStyle = ((i / 10 + j) & 1) ? '#fff' : '#222'; cx.fillRect(j * 10 - 10, i, 10, 10); }
  cx.restore();
  cx.fillStyle = 'rgba(25,25,30,.35)'; for (const s of race.skids) cx.fillRect(s.x - 2, s.y - 2, 4, 4);
  const pulse = 0.6 + Math.sin(now / 150) * 0.4;
  BOOSTS.forEach((b) => {
    cx.save(); cx.translate(b.x, b.y); cx.rotate(b.a);
    cx.fillStyle = `rgba(255,210,63,${0.55 + pulse * 0.45})`; cx.beginPath(); cx.roundRect(-22, -16, 44, 32, 8); cx.fill();
    cx.strokeStyle = '#ff7b00'; cx.lineWidth = 5; cx.lineCap = 'round';
    [-8, 6].forEach((ox) => { cx.beginPath(); cx.moveTo(ox - 6, -9); cx.lineTo(ox + 4, 0); cx.lineTo(ox - 6, 9); cx.stroke(); });
    cx.restore();
  });
}

function drawRace(lap, now, boosting) {
  const cv = $('#rc'); if (!cv || !cv.width) return; const cx = cv.getContext('2d');
  const dpr = race.dpr || 1, W = cv.width / dpr, H = cv.height / dpr;
  // câmera seguindo o carro com zoom (estilo corrida top-down de celular)
  const zoom = Math.max(1.05, Math.min(2.2, Math.max(W, H) / 640)) * (boosting ? 0.93 : 1);
  const c = race.car;
  const lookX = c.x + Math.cos(c.a) * c.v * 9, lookY = c.y + Math.sin(c.a) * c.v * 9; // olha um pouco à frente
  race.cam ||= { x: lookX, y: lookY, z: zoom };
  race.cam.x += (lookX - race.cam.x) * 0.12; race.cam.y += (lookY - race.cam.y) * 0.12; race.cam.z += (zoom - race.cam.z) * 0.08;
  const z = race.cam.z;
  cx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - race.cam.x * z), dpr * (H / 2 - race.cam.y * z));
  drawTrack(cx, now);
  for (const [id, o] of Object.entries(race.others)) drawCar(cx, o.x, o.y, o.a, color(id), name(id), z);
  if (boosting) {
    cx.save(); cx.translate(c.x, c.y); cx.rotate(c.a);
    cx.fillStyle = `rgba(255,140,0,${0.45 + Math.random() * 0.4})`; cx.beginPath(); cx.moveTo(-19, -7); cx.lineTo(-44 - Math.random() * 16, 0); cx.lineTo(-19, 7); cx.fill();
    cx.restore();
  }
  drawCar(cx, c.x, c.y, c.a, color(me), 'Você', z);
  // ---- HUD (coordenadas de tela) ----
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pill = (x, y, w, h) => { cx.fillStyle = 'rgba(255,255,255,.92)'; cx.beginPath(); cx.roundRect(x, y, w, h, 14); cx.fill(); };
  pill(10, 10, 150, 58);
  cx.fillStyle = '#3b2333'; cx.textAlign = 'left'; cx.font = 'bold 20px Nunito, sans-serif';
  cx.fillText(`Volta ${lap}/${game.laps}`, 22, 34);
  const el = race.done ? race.time : Math.max(0, now - race.start);
  cx.font = '15px Nunito, sans-serif'; cx.fillText(`⏱ ${(el / 1000).toFixed(2)}s`, 22, 56);
  const ahead = Object.values(race.others).filter((o) => (o.cp || 0) > race.cp).length;
  const place = race.done ? (game.winner === me ? 1 : 1 + ahead) : 1 + ahead;
  pill(10, 74, 64, 46);
  cx.fillStyle = place === 1 ? '#ff4d8d' : '#3b2333'; cx.textAlign = 'center'; cx.font = 'bold 30px Nunito, sans-serif';
  cx.fillText(`${place}º`, 42, 108);
  // velocímetro
  const sp = Math.max(0, Math.round(c.v * 26));
  pill(W / 2 - 52, H - 54, 104, 44);
  cx.fillStyle = boosting ? '#ff7b00' : '#3b2333'; cx.font = 'bold 22px Nunito, sans-serif'; cx.fillText(`${sp} km/h`, W / 2, H - 25);
  // minimapa
  const mw = Math.min(150, W * 0.32), ms = mw / 1000, mh = 700 * ms, mx = W - mw - 10, my = 10;
  cx.fillStyle = 'rgba(255,255,255,.85)'; cx.beginPath(); cx.roundRect(mx - 6, my - 6, mw + 12, mh + 12, 12); cx.fill();
  cx.save(); cx.translate(mx, my); cx.scale(ms, ms);
  cx.beginPath(); TRACK.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.closePath();
  cx.strokeStyle = '#55575e'; cx.lineWidth = 46; cx.lineJoin = 'round'; cx.stroke();
  for (const [id, o] of Object.entries(race.others)) { cx.fillStyle = color(id); cx.beginPath(); cx.arc(o.x, o.y, 34, 0, 7); cx.fill(); }
  cx.fillStyle = color(me); cx.strokeStyle = '#fff'; cx.lineWidth = 14; cx.beginPath(); cx.arc(c.x, c.y, 40, 0, 7); cx.fill(); cx.stroke();
  cx.restore();
  // contagem / chegada
  const left = race.start - now;
  const big = left > 0 ? String(Math.ceil(left / 1000)) : left > -800 ? 'VAI! 🏁' : race.done ? 'Chegou! 🏁' : null;
  if (big) {
    cx.textAlign = 'center'; cx.font = `bold ${Math.min(110, W / 5)}px Nunito, sans-serif`; cx.lineWidth = 10; cx.strokeStyle = '#fff';
    cx.strokeText(big, W / 2, H / 2 + 30); cx.fillStyle = '#ff4d8d'; cx.fillText(big, W / 2, H / 2 + 30);
  }
}

// =============== BILHAR ===============
const PW = 1000, PH = 500, PR = 14, RAIL = 40;
const POCKS = [[0, 0, 32], [500, -4, 26], [1000, 0, 32], [0, 500, 32], [500, 504, 26], [1000, 500, 32]];
const BALL_COLORS = ['#fff', '#f5c400', '#1e56d6', '#d62828', '#6a2fb0', '#ff7b00', '#1f8a3b', '#7a1f1f', '#111'];
let pool = null;

