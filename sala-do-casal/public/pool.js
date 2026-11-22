// =============== BILHAR (estilo sinuca mobile) ===============
// Toque na mesa para mirar, faixa de ajuste fino, barra de FORÇA lateral (puxar e soltar),
// linha-guia com bola-fantasma e as trajetórias da bola-alvo e da branca.
// Usa constantes de arcade.js: PW, PH, PR, RAIL, POCKS, BALL_COLORS, pool.

RENDER.bilhar = function () {
  const g = game; const op = g.players.find((p) => p !== me);
  const grp = (id) => (g.groups[id] ? (g.groups[id] === 'lisas' ? 'lisas (1–7)' : 'listradas (9–15)') : 'a definir');
  let st;
  if (g.winner) st = g.winner === me ? 'Você venceu! 🏆' : `${esc(name(g.winner))} venceu! 🏆`;
  else st = g.turn === me ? 'Sua vez! Mire tocando na mesa e puxe a barra de FORÇA 🎯' : `Vez de ${esc(name(g.turn))}…`;
  setStatus(`${st}<br><small class="muted">Você: ${grp(me)} · ${esc(name(op))}: ${grp(op)}${g.msg ? ' — ' + esc(g.msg) : ''}</small>`);
  showRestart(!!g.winner);
  if (mountedId !== g.id) mountPool(g);
};

function mountPool(g) {
  mountedId = g.id;
  if (isMobile()) setChat(false);
  const rot = innerHeight > innerWidth && innerWidth < 800; // celular em pé: mesa na vertical
  const CW = PW + RAIL * 2, CH = PH + RAIL * 2;
  $('#board').innerHTML = `<div class="pool-wrap">
      <div class="pool-main">
        <canvas id="pc" class="${rot ? 'vertical' : ''}" width="${rot ? CH : CW}" height="${rot ? CW : CH}"></canvas>
        <div id="pfine" class="pool-fine">◀ arraste aqui para ajuste fino ▶</div>
      </div>
      <div id="pbar" class="pool-power"><div class="fill"></div><span class="lbl">FORÇA<br>⬇</span></div>
    </div>
    <p class="hint">Toque na mesa para mirar · ajuste fino na faixa (ou setas / roda do mouse) · <b>puxe a barra de FORÇA para baixo e solte</b> para tacar.</p>`;
  const keep = pool?.id === g.id ? pool : null;
  pool = { id: g.id, anim: keep?.anim || null, remoteAim: null, lastAimSend: 0, rot, angle: keep?.angle ?? 0, power: 0 };
  const cv = $('#pc'), bar = $('#pbar'), fill = bar.querySelector('.fill'), fine = $('#pfine');
  const toWorld = (e) => {
    const r = cv.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * cv.width, py = ((e.clientY - r.top) / r.height) * cv.height;
    return rot ? { x: py - RAIL, y: CH - px - RAIL } : { x: px - RAIL, y: py - RAIL };
  };
  const canShoot = () => game?.type === 'bilhar' && game.turn === me && !game.winner && !pool.anim;
  const sendAim = (force) => {
    const n = Date.now(); if (!force && n - pool.lastAimSend < 60) return;
    pool.lastAimSend = n; socket.emit('aim', { gid: pool.id, a: pool.angle, p: pool.power });
  };
  const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch {} };
  // mirar tocando/arrastando na mesa
  let aiming = false;
  const aimAt = (e) => { const p = toWorld(e), c = game.balls[0]; pool.angle = Math.atan2(p.y - c.y, p.x - c.x); sendAim(); };
  cv.addEventListener('pointerdown', (e) => { if (!canShoot()) return; e.preventDefault(); aiming = true; capture(cv, e); aimAt(e); });
  cv.addEventListener('pointermove', (e) => { if (aiming) aimAt(e); });
  ['pointerup', 'pointercancel'].forEach((ev) => cv.addEventListener(ev, () => (aiming = false)));
  cv.addEventListener('wheel', (e) => { if (!canShoot()) return; e.preventDefault(); pool.angle += Math.sign(e.deltaY) * 0.004; sendAim(); }, { passive: false });
  // ajuste fino
  let fx0 = null;
  fine.addEventListener('pointerdown', (e) => { if (!canShoot()) return; e.preventDefault(); fx0 = e.clientX; capture(fine, e); });
  fine.addEventListener('pointermove', (e) => { if (fx0 === null) return; pool.angle += (e.clientX - fx0) * 0.0018; fx0 = e.clientX; sendAim(); });
  ['pointerup', 'pointercancel'].forEach((ev) => fine.addEventListener(ev, () => (fx0 = null)));
  // barra de força: puxar para baixo e soltar
  let by0 = null;
  const setPower = (p) => { pool.power = Math.max(0, Math.min(1, p)); fill.style.height = `${pool.power * 100}%`; };
  bar.addEventListener('pointerdown', (e) => { if (!canShoot()) return; e.preventDefault(); by0 = e.clientY; capture(bar, e); });
  bar.addEventListener('pointermove', (e) => { if (by0 === null) return; setPower((e.clientY - by0) / (bar.clientHeight * 0.85)); sendAim(); });
  bar.addEventListener('pointerup', () => {
    if (by0 === null) return; by0 = null;
    const p = pool.power; setPower(0); sendAim(true);
    if (p > 0.03 && canShoot()) move({ angle: pool.angle, power: p });
  });
  bar.addEventListener('pointercancel', () => { by0 = null; setPower(0); });
  requestAnimationFrame(poolLoop);
}

addEventListener('resize', () => {
  if (!pool || game?.type !== 'bilhar' || mountedId !== pool.id) return;
  const rot = innerHeight > innerWidth && innerWidth < 800;
  if (rot !== pool.rot) mountPool(game);
});
addEventListener('keydown', (e) => { // setas: ajuste fino no PC
  if (!pool || game?.type !== 'bilhar' || game.turn !== me || e.target.tagName === 'INPUT') return;
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); pool.angle += (e.code === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 0.02 : 0.004); }
});

socket.on('poolShot', (d) => { if (pool && d.gid === pool.id) { pool.anim = { frames: d.frames, t0: performance.now() }; pool.remoteAim = null; FX.play('cue'); } });
socket.on('aim', (d) => { if (pool) pool.remoteAim = d && d.gid === pool.id ? d : null; });

function shade(hex) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(v * 0.55); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }

function drawBall(cx, x, y, n) {
  const col = BALL_COLORS[n > 8 ? n - 8 : n];
  const white = n > 8 || n === 0;
  cx.save(); cx.translate(x + RAIL, y + RAIL);
  if (pool?.rot) cx.rotate(-Math.PI / 2); // números sempre em pé
  cx.fillStyle = 'rgba(0,0,0,.3)'; cx.beginPath(); cx.arc(2, 3, PR, 0, 7); cx.fill();
  const grd = cx.createRadialGradient(-4, -5, 2, 0, 0, PR);
  grd.addColorStop(0, white ? '#ffffff' : col); grd.addColorStop(1, white ? '#d4d4d4' : shade(col));
  cx.beginPath(); cx.arc(0, 0, PR, 0, 7); cx.fillStyle = grd; cx.fill();
  if (n > 8) { cx.save(); cx.clip(); cx.fillStyle = col; cx.fillRect(-PR, -7, PR * 2, 14); cx.restore(); }
  if (n > 0) {
    cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(0, 0, 6.5, 0, 7); cx.fill();
    cx.fillStyle = '#111'; cx.font = 'bold 9px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(n, 0, 0.5);
  }
  cx.fillStyle = 'rgba(255,255,255,.55)'; cx.beginPath(); cx.arc(-4, -5, 3.2, 0, 7); cx.fill();
  cx.restore();
}

// linha-guia: onde a branca bate, para onde vai a bola-alvo e para onde a branca desvia
function drawGuide(cx, pos, angle, power, alpha) {
  const c = pos[0]; if (!c) return;
  const dx = Math.cos(angle), dy = Math.sin(angle), R2 = PR * 2;
  let tHit = Infinity, hitIdx = -1;
  pos.forEach((p, i) => {
    if (!p || i === 0) return;
    const ox = p[0] - c[0], oy = p[1] - c[1], proj = ox * dx + oy * dy; if (proj <= 0) return;
    const perp2 = ox * ox + oy * oy - proj * proj; if (perp2 > R2 * R2) return;
    const t = proj - Math.sqrt(R2 * R2 - perp2); if (t < tHit) { tHit = t; hitIdx = i; }
  });
  const wx = dx > 0 ? (PW - PR - c[0]) / dx : dx < 0 ? (PR - c[0]) / dx : Infinity;
  const wy = dy > 0 ? (PH - PR - c[1]) / dy : dy < 0 ? (PR - c[1]) / dy : Infinity;
  const wall = Math.min(wx, wy);
  const t = Math.min(tHit, wall), gx = c[0] + dx * t, gy = c[1] + dy * t;
  const X = (v) => v + RAIL;
  cx.save(); cx.globalAlpha = alpha; cx.lineCap = 'round';
  // taco (recua conforme a força)
  const back = 18 + power * 95;
  const seg = (a, b, w, col) => { cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(X(c[0] - dx * a), X(c[1] - dy * a)); cx.lineTo(X(c[0] - dx * b), X(c[1] - dy * b)); cx.stroke(); };
  seg(back + 150, back + 380, 9, '#3b2414'); seg(back, back + 160, 7, '#d9a35b'); seg(back, back + 10, 7, '#eaf2ff');
  // trajetória da branca + bola-fantasma
  cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = 2.5;
  cx.beginPath(); cx.moveTo(X(c[0]), X(c[1])); cx.lineTo(X(gx), X(gy)); cx.stroke();
  cx.beginPath(); cx.arc(X(gx), X(gy), PR, 0, 7); cx.stroke();
  if (hitIdx > 0 && tHit <= wall) {
    const b = pos[hitIdx]; let nx = b[0] - gx, ny = b[1] - gy; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    const along = dx * nx + dy * ny; // quanto da força vai para a bola-alvo
    cx.strokeStyle = 'rgba(255,230,90,.95)'; cx.lineWidth = 3;
    cx.beginPath(); cx.moveTo(X(b[0]), X(b[1])); cx.lineTo(X(b[0] + nx * 170 * along), X(b[1] + ny * 170 * along)); cx.stroke();
    let tx = dx - nx * along, ty = dy - ny * along; const tl = Math.hypot(tx, ty);
    if (tl > 0.05) {
      tx /= tl; ty /= tl; cx.strokeStyle = 'rgba(255,255,255,.45)'; cx.setLineDash([6, 6]);
      cx.beginPath(); cx.moveTo(X(gx), X(gy)); cx.lineTo(X(gx + tx * 90 * tl), X(gy + ty * 90 * tl)); cx.stroke(); cx.setLineDash([]);
    }
  } else { // bate na tabela: mostra o rebote
    const rx = wx <= wy ? -dx : dx, ry = wy <= wx ? -dy : dy;
    cx.strokeStyle = 'rgba(255,255,255,.4)'; cx.setLineDash([6, 6]);
    cx.beginPath(); cx.moveTo(X(gx), X(gy)); cx.lineTo(X(gx + rx * 110), X(gy + ry * 110)); cx.stroke(); cx.setLineDash([]);
  }
  cx.restore();
}

function poolLoop() {
  if (!pool || mountedId !== pool.id) return;
  const cv = $('#pc'); if (!cv) return; const cx = cv.getContext('2d');
  if (pool.rot) cx.setTransform(0, 1, -1, 0, PH + RAIL * 2, 0); else cx.setTransform(1, 0, 0, 1, 0, 0);
  // mesa: madeira com gradiente, feltro com vinheta, marcadores e caçapas com aro dourado
  const wood = cx.createLinearGradient(0, 0, 0, PH + RAIL * 2); wood.addColorStop(0, '#7a4524'); wood.addColorStop(1, '#4e2a14');
  cx.fillStyle = wood; cx.beginPath(); cx.roundRect(0, 0, PW + RAIL * 2, PH + RAIL * 2, 26); cx.fill();
  const felt = cx.createRadialGradient(RAIL + PW / 2, RAIL + PH / 2, 60, RAIL + PW / 2, RAIL + PH / 2, PW * 0.62);
  felt.addColorStop(0, '#22a85c'); felt.addColorStop(1, '#126b3a');
  cx.fillStyle = felt; cx.fillRect(RAIL, RAIL, PW, PH);
  cx.strokeStyle = 'rgba(255,255,255,.12)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(RAIL + 250, RAIL); cx.lineTo(RAIL + 250, RAIL + PH); cx.stroke();
  [0.25, 0.5, 0.75].forEach((fx) => [RAIL / 2, PH + RAIL * 1.5].forEach((y) => { cx.fillStyle = '#e8d8b0'; cx.beginPath(); cx.arc(RAIL + PW * fx, y, 3, 0, 7); cx.fill(); }));
  for (const [px, py, pr] of POCKS) { cx.fillStyle = '#0b0b0b'; cx.beginPath(); cx.arc(px + RAIL, py + RAIL, pr, 0, 7); cx.fill(); cx.strokeStyle = '#c9a227'; cx.lineWidth = 3; cx.stroke(); }
  let pos = game.balls.map((b) => (b.in ? null : [b.x, b.y]));
  if (pool.anim) {
    const i = Math.floor((performance.now() - pool.anim.t0) / 33.3);
    if (i >= pool.anim.frames.length) pool.anim = null;
    else {
      pos = pool.anim.frames[i];
      const gone = pos.filter((p) => !p).length;
      if (pool.anim.gone != null && gone > pool.anim.gone) FX.play('pocket');
      pool.anim.gone = gone;
    }
  }
  if (!pool.anim && !game.winner) {
    if (game.turn === me) drawGuide(cx, pos, pool.angle, pool.power, 1);
    else if (pool.remoteAim) drawGuide(cx, pos, pool.remoteAim.a, pool.remoteAim.p || 0, 0.45);
  }
  pos.forEach((p, i) => p && drawBall(cx, p[0], p[1], game.balls[i].n));
  game.balls.filter((b) => b.in && b.n !== 0).forEach((b, k) => drawBall(cx, 40 + k * 28, -20, b.n));
  requestAnimationFrame(poolLoop);
}
