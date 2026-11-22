// Tênis 3D: quadra, os dois avatares com raquete, bola sincronizada pelo servidor.
// Usa os globais de app.js: socket, players, me, game, RENDER, mountedId, setStatus, showRestart, name, esc, isMobile, setChat.
import * as THREE from 'three';
import { buildAvatar } from './avatars.js';

const HW = 4.115, HL = 11.885;
let T = null; // estado da partida montada

RENDER.tenis = function () {
  const g = game;
  const [a, b] = g.players;
  const srv = g.phase !== 'over' ? (id) => (g.server === id ? ' 🎾' : '') : () => '';
  const score = `<b style="color:${color(a)}">${esc(name(a))}${srv(a)} ${g.points[a]}</b> x <b style="color:${color(b)}">${g.points[b]} ${esc(name(b))}${srv(b)}</b>`;
  setStatus(`${score}<br><small class="muted">${g.msg ? esc(g.msg) : `Primeiro a 7 pontos (2 de vantagem). ${matchMedia('(any-pointer: coarse)').matches ? 'Você corre sozinho: deslize para cima quando a bola chegar!' : 'Espaço na hora certa = golpe forte!'}`}</small>`);
  showRestart(!!g.winner);
  if (mountedId !== g.id) mount(g);
};

function makeRacket() {
  const r = new THREE.Group();
  const frameM = new THREE.MeshStandardMaterial({ color: '#ff4d8d', roughness: 0.4 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.28, 8), new THREE.MeshStandardMaterial({ color: '#222' }));
  handle.position.y = -0.14; r.add(handle);
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.014, 8, 24), frameM); head.scale.set(0.85, 1.15, 1); head.position.y = 0.15; r.add(head);
  const strings = new THREE.Mesh(new THREE.CircleGeometry(0.125, 20), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  strings.scale.set(0.85, 1.15, 1); strings.position.y = 0.15; r.add(strings);
  return r;
}

function buildCourt(scene) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 70), new THREE.MeshStandardMaterial({ color: '#2f7d4f', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 + 6, HL * 2 + 9), new THREE.MeshStandardMaterial({ color: '#3d8a5c', roughness: 1 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = 0.005; scene.add(outer);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, HL * 2), new THREE.MeshStandardMaterial({ color: '#3a6fb8', roughness: 0.9 }));
  court.rotation.x = -Math.PI / 2; court.position.y = 0.01; scene.add(court);
  const lineM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const line = (w, l, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), lineM); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.015, z); scene.add(m); };
  const lw = 0.06;
  line(lw, HL * 2, -HW, 0); line(lw, HL * 2, HW, 0);              // laterais
  line(HW * 2, lw, 0, -HL); line(HW * 2, lw, 0, HL);              // fundo
  line(HW * 2, lw, 0, -6.4); line(HW * 2, lw, 0, 6.4);            // linhas de saque
  line(lw, 12.8, 0, 0);                                            // linha central
  line(lw, 0.25, 0, -HL + 0.12); line(lw, 0.25, 0, HL - 0.12);    // marcas do centro
  // rede
  const netTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 2;
    for (let i = 0; i <= 64; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(64, i); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 4); return t;
  })();
  const net = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 + 1, 0.92), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, color: '#222' }));
  net.position.y = 0.46; scene.add(net);
  const band = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 1, 0.07, 0.03), new THREE.MeshStandardMaterial({ color: '#fff' }));
  band.position.y = 0.93; scene.add(band);
  [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.07, 10), new THREE.MeshStandardMaterial({ color: '#444' })); p.position.set(s * (HW + 0.5), 0.53, 0); scene.add(p); });
  // arquibancada de corações
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, -1.4); heartShape.bezierCurveTo(-2.6, 0.2, -1.4, 2, 0, 0.9); heartShape.bezierCurveTo(1.4, 2, 2.6, 0.2, 0, -1.4);
  const hg = new THREE.ShapeGeometry(heartShape, 16);
  for (let i = 0; i < 14; i++) {
    const h = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ color: i % 2 ? '#ff4d8d' : '#ff8fb7', side: THREE.DoubleSide }));
    const s = i < 7 ? -1 : 1; h.scale.setScalar(0.5); h.position.set(s * (HW + 4.2), 1.6 + (i % 3) * 0.6, -HL + (i % 7) * 4);
    h.rotation.y = s * Math.PI / 2; scene.add(h);
  }
}

function mount(g) {
  if (T) T.dispose();
  mountedId = g.id;
  if (isMobile()) setChat(false);
  $('#board').innerHTML = `<div class="tennis-wrap" id="twrap"><div id="tcv"></div>
    <div id="tjoy" class="joystick"><div class="knob"></div></div>
    <div id="tmsg" class="tmsg"></div><div id="rally" class="rally"></div>
    <canvas id="tswipe" class="tswipe"></canvas>
    <div id="tswipeHint" class="tswipe-hint">👆 Deslize para cima quando a bola chegar<br><small>para o lado = mira · na hora exata = golpe forte 💥</small></div>
    <button id="swingBtn" class="swing-btn" title="Golpe forte (Espaço)">🎾</button></div>
    <p class="hint">Ande com <b>WASD / setas</b> (ou o joystick). A raquete rebate sozinha quando a bola chega — mas aperte <b>Espaço</b> (ou 🎾) <b>bem na hora</b> para um golpe forte e angulado 💥</p>`;
  const wrap = $('#twrap'), holder = $('#tcv');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  holder.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#bfe3ff'); scene.fog = new THREE.Fog('#bfe3ff', 35, 70);
  scene.add(new THREE.HemisphereLight('#ffffff', '#3d8a5c', 1.5));
  const sun = new THREE.DirectionalLight('#fff4e0', 1.5); sun.position.set(5, 12, 4); scene.add(sun);
  buildCourt(scene);

  const s = g.players[0] === me ? 1 : -1; // meu lado (+z ou -z)
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 120);
  // avatares com raquete
  const avs = {};
  for (const id of g.players) {
    const ps = g.players[0] === id ? 1 : -1;
    const av = buildAvatar(players[id]?.avatar, players[id]?.color);
    const grp = new THREE.Group(); grp.add(av.root);
    // raquete na mão direita (-x quando o boneco olha para +z)
    const racket = makeRacket(); const pivot = new THREE.Group(); pivot.position.set(-0.36, 0.95, 0.12); pivot.add(racket);
    racket.scale.setScalar(1.7); racket.position.set(-0.2, 0.15, 0.08); racket.rotation.z = 0.7; grp.add(pivot);
    grp.position.set(0, 0, ps * 10.5); grp.rotation.y = ps > 0 ? Math.PI : 0; // de frente para a rede
    scene.add(grp);
    avs[id] = { grp, animate: av.animate, pivot, side: ps, swing: 0, x: 0, z: ps * 10.5, tx: 0, tz: ps * 10.5, moving: false, phase: 0 };
  }
  const mine = avs[me];
  // bola + sombra
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshStandardMaterial({ color: '#d8f540', emissive: '#6b7a10', emissiveIntensity: 0.3 }));
  scene.add(ball);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35 }));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  const bs = { x: 0, y: 2, z: s * 12, vx: 0, vy: 0, vz: 0, ph: g.phase };

  // entrada
  const keys = {};
  const KEYS = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  let lastSwing = 0;
  const swing = () => {
    const now = performance.now(); if (now - lastSwing < 450) return;
    lastSwing = now; mine.swing = 1; socket.emit('tswing'); FX.play('click');
  };
  const kd = (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) swing(); return; }
    if (KEYS[e.code]) { keys[KEYS[e.code]] = true; e.preventDefault(); }
  };
  const ku = (e) => { if (KEYS[e.code]) keys[KEYS[e.code]] = false; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const joy = $('#tjoy'), knob = joy.querySelector('.knob'); const stick = { x: 0, y: 0, id: null };
  const jm = (e) => {
    const r = joy.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy); if (d > 45) { dx = (dx / d) * 45; dy = (dy / d) * 45; }
    stick.x = dx / 45; stick.y = dy / 45; knob.style.transform = `translate(${dx}px,${dy}px)`;
  };
  joy.addEventListener('pointerdown', (e) => { e.preventDefault(); stick.id = e.pointerId; try { joy.setPointerCapture(e.pointerId); } catch {} jm(e); });
  joy.addEventListener('pointermove', (e) => { if (stick.id === e.pointerId) jm(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => joy.addEventListener(ev, () => { stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; }));

  // rede
  const onBall = (d) => { if (d.gid !== g.id) return; [bs.x, bs.y, bs.z, bs.vx, bs.vy, bs.vz] = d.b; bs.ph = d.ph; };
  const onPos = (d) => { if (d.gid !== g.id || !avs[d.id]) return; Object.assign(avs[d.id], { tx: d.x, tz: d.z, moving: d.moving }); };
  $('#swingBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); swing(); });

  // ---- Modo celular (estilo dos jogos de tênis mobile): movimento assistido + swipe para rebater ----
  const touchMode = matchMedia('(any-pointer: coarse)').matches || document.body.classList.contains('touch');
  wrap.classList.toggle('touch-mode', touchMode);
  socket.emit('tmode', { swipe: touchMode });
  const sw = $('#tswipe'), sctx = sw.getContext('2d'); let trail = [], swipeStart = null;
  const fitSwipe = () => { sw.width = wrap.clientWidth; sw.height = wrap.clientHeight; };
  fitSwipe(); addEventListener('resize', fitSwipe);
  holder.addEventListener('pointerdown', (e) => { swipeStart = { x: e.clientX, y: e.clientY, t: performance.now() }; trail = [{ x: e.offsetX, y: e.offsetY, t: performance.now() }]; });
  holder.addEventListener('pointermove', (e) => { if (swipeStart) trail.push({ x: e.offsetX, y: e.offsetY, t: performance.now() }); });
  holder.addEventListener('pointerup', (e) => {
    if (!swipeStart) return;
    const dx = e.clientX - swipeStart.x, dy = swipeStart.y - e.clientY; swipeStart = null;
    if (dy < 25) return; // precisa ser para cima
    const dir = Math.max(-1, Math.min(1, dx / (wrap.clientWidth * 0.3)));
    const power = Math.max(0.15, Math.min(1, Math.hypot(dx, dy) / (wrap.clientHeight * 0.55)));
    socket.emit('tshot', { dx: dir, power }); mine.swing = 1; FX.play('click');
    $('#tswipeHint').classList.add('gone');
  });
  setTimeout(() => $('#tswipeHint')?.classList.add('gone'), 6000);
  const drawTrail = () => {
    const now = performance.now(); trail = trail.filter((p) => now - p.t < 260);
    sctx.clearRect(0, 0, sw.width, sw.height);
    if (trail.length < 2) return;
    sctx.lineCap = 'round'; sctx.lineJoin = 'round';
    for (let i = 1; i < trail.length; i++) {
      const a = 1 - (now - trail[i].t) / 260;
      sctx.strokeStyle = `rgba(255,255,255,${a * 0.9})`; sctx.lineWidth = 4 + a * 10;
      sctx.beginPath(); sctx.moveTo(trail[i - 1].x, trail[i - 1].y); sctx.lineTo(trail[i].x, trail[i].y); sctx.stroke();
    }
  };
  const msgEl = $('#tmsg'), rallyEl = $('#rally'); let msgTimer;
  const flash = (text, ms = 1500) => { msgEl.textContent = text; msgEl.classList.add('show'); clearTimeout(msgTimer); msgTimer = setTimeout(() => msgEl.classList.remove('show'), ms); };
  const onEvent = (d) => {
    if (d.gid !== g.id) return;
    if (d.type === 'swing' && avs[d.id]) avs[d.id].swing = 1;
    if (d.type === 'hit') {
      if (avs[d.id]) avs[d.id].swing = 1;
      if (d.power) { FX.play('power'); FX.shake(wrap, 7); if (d.id === me) flash('Na mosca! 💥', 700); }
      else FX.play('hit');
      if (d.rally >= 3) { rallyEl.textContent = `🔥 ${d.rally}`; rallyEl.classList.remove('bump'); void rallyEl.offsetWidth; rallyEl.classList.add('bump'); }
    }
    if (d.type === 'point') {
      rallyEl.textContent = '';
      flash(d.msg);
      if (!d.over) { if (d.winner === me) FX.play('point'); else { FX.play('lostPoint'); FX.shake(wrap, 5); } }
    }
  };
  socket.on('tball', onBall); socket.on('tpos', onPos); socket.on('tevent', onEvent);

  const resize = () => {
    const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 1 ? 72 : 52; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(wrap); resize();

  let last = performance.now(), lastSend = 0, alive = true;
  const loop = () => {
    if (!alive || mountedId !== g.id) return;
    requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    const cur = game?.id === g.id ? game : g;
    // meu movimento (eixos relativos à câmera, que fica atrás de mim)
    let ix = (keys.r ? 1 : 0) - (keys.l ? 1 : 0) + stick.x, iz = (keys.d ? 1 : 0) - (keys.u ? 1 : 0) + stick.y;
    const len = Math.hypot(ix, iz);
    let vx = 0;
    if (len > 0.1 && cur.phase !== 'over') {
      const sp = 6.5 * Math.min(1, len) * dt;
      vx = (ix / len) * s * 6.5; mine.x += (ix / len) * s * sp; mine.z += (iz / len) * s * sp;
    }
    if (touchMode && len <= 0.1 && cur.phase !== 'over') { // movimento assistido: vai sozinho até onde a bola vai chegar
      let tx = mine.x * 0.98, tz = s * 10.2;
      if (bs.ph === 'play' && bs.vz * s > 0) { const t = (s * 10.2 - bs.z) / bs.vz; tx = bs.x + bs.vx * Math.max(0, t); }
      const step = 7 * dt, ddx = Math.max(-step, Math.min(step, tx - mine.x)), ddz = Math.max(-step, Math.min(step, tz - mine.z));
      mine.x += ddx; mine.z += ddz; vx = ddx / dt;
      mine.moving = Math.abs(ddx) + Math.abs(ddz) > 0.01;
    } else mine.moving = len > 0.1;
    mine.x = Math.max(-HW - 2.5, Math.min(HW + 2.5, mine.x));
    mine.z = s > 0 ? Math.max(1.2, Math.min(HL + 3, mine.z)) : Math.min(-1.2, Math.max(-HL - 3, mine.z));
    if ((cur.phase === 'serve' || cur.phase === 'point') && cur.server === me) mine.z = s * (HL + 0.7); // sacar atrás da linha
    if (now - lastSend > 50) { lastSend = now; socket.emit('tpos', { x: +mine.x.toFixed(2), z: +mine.z.toFixed(2), vx, moving: mine.moving }); }
    // outro jogador (interpolado)
    for (const [id, a] of Object.entries(avs)) {
      if (id !== me) { a.x += (a.tx - a.x) * Math.min(1, dt * 12); a.z += (a.tz - a.z) * Math.min(1, dt * 12); }
      a.grp.position.set(a.x, 0, a.z);
      a.phase += dt * (a.moving ? 12 : 2); a.animate(a.phase, a.moving);
      // balanço da raquete
      if (a.swing > 0) { a.swing = Math.max(0, a.swing - dt * 4); }
      const sw = Math.sin((1 - a.swing) * Math.PI) * (a.swing > 0 ? 1 : 0);
      a.pivot.rotation.y = sw * 2.2; a.pivot.rotation.x = -sw * 0.4;
    }
    // bola: extrapola entre pacotes
    if (bs.ph === 'play') {
      bs.vy -= 9.8 * dt; bs.x += bs.vx * dt; bs.y += bs.vy * dt; bs.z += bs.vz * dt;
      if (bs.y < 0.06 && bs.vy < 0) { bs.y = 0.06; bs.vy = -bs.vy * 0.72; bs.vx *= 0.88; bs.vz *= 0.88; if (bs.vy > 1) FX.play('bounce'); }
    }
    ball.position.set(bs.x, bs.y, bs.z);
    shadow.position.set(bs.x, 0.02, bs.z); shadow.material.opacity = Math.max(0.08, 0.38 - bs.y * 0.08);
    // câmera atrás de mim, seguindo um pouco para os lados
    if (camera.aspect < 1) { // celular em pé: câmera mais alta e inclinada para a quadra ocupar a tela
      camera.position.set(mine.x * 0.35, 11.5, s * (HL + 7.5));
      camera.lookAt(mine.x * 0.2, 0, -s * 1.5);
    } else {
      camera.position.set(mine.x * 0.45, 7.2, s * (HL + 8.5));
      camera.lookAt(mine.x * 0.25, 0, s * 1.5);
    }
    renderer.render(scene, camera);
    drawTrail();
  };
  requestAnimationFrame(loop);

  T = {
    dispose() {
      alive = false; ro.disconnect(); renderer.dispose();
      removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('resize', fitSwipe);
      socket.off('tball', onBall); socket.off('tpos', onPos); socket.off('tevent', onEvent);
      T = null;
    },
  };
}

// limpa quando sair do tênis
addEventListener('roomstate', () => { if (T && game?.type !== 'tenis') T.dispose(); });
