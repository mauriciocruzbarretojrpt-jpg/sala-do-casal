// Lobby 3D: andem pela sala e escolham o jogo indo até a máquina.
// Usa os globais de app.js: socket, players, me, game, NAMES.
import * as THREE from 'three';
import { buildAvatar } from './avatars.js';

const wrap = document.getElementById('world');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#2a1630');
scene.fog = new THREE.Fog('#2a1630', 18, 34);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);

scene.add(new THREE.HemisphereLight('#ffe6f0', '#4a2a50', 1.6));
const sun = new THREE.DirectionalLight('#fff4e0', 1.4); sun.position.set(4, 10, 6); scene.add(sun);

const ROOM = 9; // metade do tamanho da sala

// ---------- utilidades de textura ----------
function textTexture(lines, { w = 512, h = 256, bg = null, fg = '#fff', font = 'bold 64px Nunito, sans-serif', radius = 40, stroke = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, radius); x.fill(); }
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  // diminui a fonte se o texto não couber
  const widest = Math.max(...lines.map((t) => x.measureText(t).width));
  if (widest > w - 50) x.font = font.replace(/(\d+)px/, (_, n) => `${Math.floor((n * (w - 50)) / widest)}px`);
  const lh = h / (lines.length + 0.6);
  lines.forEach((t, i) => {
    const y = lh * (i + 0.8);
    if (stroke) { x.lineWidth = 10; x.strokeStyle = stroke; x.strokeText(t, w / 2, y); }
    x.fillStyle = fg; x.fillText(t, w / 2, y);
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
function sprite(tex, sx, sy) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(sx, sy, 1); return s;
}

// ---------- cenário ----------
const floorTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#f6d5e2' : '#fbe7ef'; x.fillRect(i * 32, j * 32, 32, 32); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, ROOM * 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);

const wallMat = new THREE.MeshStandardMaterial({ color: '#ffb3cf', roughness: 1 });
[[0, -ROOM, 0], [-ROOM, 0, Math.PI / 2], [ROOM, 0, -Math.PI / 2]].forEach(([x, z, r]) => {
  const w = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, 4), wallMat);
  w.position.set(x, 2, z); w.rotation.y = r; scene.add(w);
});
// tapete de coração no meio
const heart = new THREE.Shape();
heart.moveTo(0, -1.4); heart.bezierCurveTo(-2.6, 0.2, -1.4, 2, 0, 0.9); heart.bezierCurveTo(1.4, 2, 2.6, 0.2, 0, -1.4);
const rug = new THREE.Mesh(new THREE.ShapeGeometry(heart, 24), new THREE.MeshStandardMaterial({ color: '#ff4d8d', roughness: 1 }));
rug.rotation.x = -Math.PI / 2; rug.position.y = 0.01; rug.scale.setScalar(1.1); scene.add(rug);

// varal de luzinhas nas paredes
const bulbs = [];
for (let i = 0; i < 40; i++) {
  const t = i / 39; let x, z;
  if (t < 1 / 3) { x = -ROOM + 0.1; z = ROOM - t * 3 * ROOM * 2; }
  else if (t < 2 / 3) { x = -ROOM + (t - 1 / 3) * 3 * ROOM * 2; z = -ROOM + 0.1; }
  else { x = ROOM - 0.1; z = -ROOM + (t - 2 / 3) * 3 * ROOM * 2; }
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: ['#ffd23f', '#ff8fb7', '#9bd2ff'][i % 3] }));
  b.position.set(x, 3.3 + Math.sin(i * 1.3) * 0.12, z); scene.add(b); bulbs.push(b);
}
// corações flutuando
const floaters = [];
const heartGeo = new THREE.ExtrudeGeometry(heart, { depth: 0.3, bevelEnabled: false });
for (let i = 0; i < 10; i++) {
  const m = new THREE.Mesh(heartGeo, new THREE.MeshStandardMaterial({ color: i % 2 ? '#ff4d8d' : '#ff8fb7', emissive: '#ff4d8d', emissiveIntensity: 0.3 }));
  m.scale.setScalar(0.18); m.position.set((Math.random() - 0.5) * 16, 4.2 + Math.random() * 1.5, (Math.random() - 0.5) * 16);
  m.userData.phase = Math.random() * 6; scene.add(m); floaters.push(m);
}
// sofá e plantinhas
const sofa = new THREE.Group();
const sofaMat = new THREE.MeshStandardMaterial({ color: '#6c8cff', roughness: 0.9 });
const box = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
sofa.add(box(3, 0.5, 1.1, 0, 0.35, 0, sofaMat), box(3, 0.9, 0.3, 0, 0.8, -0.45, sofaMat), box(0.3, 0.7, 1.1, -1.5, 0.6, 0, sofaMat), box(0.3, 0.7, 1.1, 1.5, 0.6, 0, sofaMat));
sofa.position.set(0, 0, -ROOM + 1.2); scene.add(sofa);
const potMat = new THREE.MeshStandardMaterial({ color: '#c97b4a' }), leafMat = new THREE.MeshStandardMaterial({ color: '#2fb67c' });
[[-ROOM + 1, -ROOM + 1], [ROOM - 1, -ROOM + 1]].forEach(([x, z]) => {
  const p = new THREE.Group();
  p.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.6, 12), potMat));
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 10), leafMat); l.position.y = 0.9; p.add(l);
  p.position.set(x, 0.3, z); scene.add(p);
});

// ---------- máquinas de jogo ----------
const GAMES = [
  ['tenis', '🎾', '#3a6fb8'], ['corrida', '🏎️', '#ff4d8d'], ['bilhar', '🎱', '#1f8a3b'], ['velha', '❌⭕', '#6c8cff'], ['lig4', '🔴🟡', '#ff9f1c'],
  ['ppt', '✊✋✌️', '#9b5de5'], ['memoria', '🃏', '#2fb67c'], ['desenho', '🎨', '#ffd23f'], ['sintonia', '💑', '#e85a5a'],
];
const stations = [];
const clickable = [];
GAMES.forEach(([type, emoji, col], i) => {
  // semicírculo virado para o centro, deixando a frente (câmera) livre
  const ang = Math.PI * (0.05 + (i / (GAMES.length - 1)) * 0.9);
  const R = 6.6;
  const x = -Math.cos(ang) * R, z = -Math.sin(ang) * R + 1;
  const g = new THREE.Group(); g.position.set(x, 0, z); g.lookAt(0, 0, 1);
  const bodyMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 });
  g.add(box(1.3, 1.9, 0.9, 0, 0.95, 0, bodyMat));
  g.add(box(1.4, 0.35, 1.0, 0, 2.05, 0.05, bodyMat));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.8), new THREE.MeshBasicMaterial({ map: textTexture([emoji], { w: 256, h: 200, bg: '#1b1030', font: '90px sans-serif', radius: 16 }) }));
  scr.position.set(0, 1.45, 0.46); g.add(scr);
  g.add(box(1.3, 0.12, 0.5, 0, 0.95, 0.6, new THREE.MeshStandardMaterial({ color: '#333' })));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35 }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.02, 1.3); g.add(ring);
  const label = sprite(textTexture([NAMES[type].replace(/ [^\wÀ-ú].*$/u, '')], { w: 512, h: 128, bg: 'rgba(255,255,255,.92)', fg: '#3b2333', font: 'bold 52px Nunito, sans-serif' }), 2.2, 0.55);
  label.position.set(0, 2.75, 0); g.add(label);
  scene.add(g);
  g.traverse((o) => { if (o.isMesh) { o.userData.station = type; clickable.push(o); } });
  const spot = new THREE.Vector3(0, 0, 1.3).applyMatrix4(g.matrixWorld.compose(g.position, g.quaternion, g.scale));
  stations.push({ type, group: g, ring, label, spot, x, z, base: 2.75 });
});

// ---------- avatares ----------
const avatars = {}; // id -> { group, body, nameTag, bubble, target }
function makeAvatar(id) {
  const p = players[id];
  const g = new THREE.Group();
  const av = buildAvatar(p.avatar, p.color);
  g.add(av.root);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.2 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015; g.add(shadow);
  const nameTag = sprite(textTexture([p.name + (id === me ? ' (você)' : '')], { w: 512, h: 128, fg: p.color, stroke: '#fff', font: 'bold 56px Nunito, sans-serif' }), 1.8, 0.45);
  nameTag.position.y = 2.25; g.add(nameTag);
  const pos = p.pos || { x: 0, z: 2, ry: Math.PI };
  g.position.set(pos.x, 0, pos.z); g.rotation.y = pos.ry;
  scene.add(g);
  return { group: g, animate: av.animate, nameTag, bubble: null, target: { ...pos }, moving: false, phase: 0, name: p.name, avatar: p.avatar };
}
function syncAvatars() {
  for (const id of Object.keys(players)) {
    if (avatars[id] && (avatars[id].name !== players[id].name || avatars[id].avatar !== players[id].avatar)) { scene.remove(avatars[id].group); delete avatars[id]; }
    if (!avatars[id]) avatars[id] = makeAvatar(id);
  }
  for (const id of Object.keys(avatars)) if (!players[id]) { scene.remove(avatars[id].group); delete avatars[id]; }
}

function wrapText(t, max = 22) {
  const words = t.split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].slice(0, max - 1) + '…'; }
  return lines;
}
function showBubble(id, text) {
  const a = avatars[id]; if (!a) return;
  if (a.bubble) a.group.remove(a.bubble);
  const lines = wrapText(text);
  const h = 70 + lines.length * 60;
  const b = sprite(textTexture(lines, { w: 640, h, bg: '#ffffff', fg: '#3b2333', font: 'bold 46px Nunito, sans-serif', radius: 36 }), 2.4, (2.4 * h) / 640);
  b.position.y = 2.75 + b.scale.y / 2; b.userData.until = performance.now() + 6000;
  a.group.add(b); a.bubble = b;
}

// ---------- entrada: teclado, joystick, toque ----------
const keys = {};
const KEYS = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
const lobbyActive = () => !document.getElementById('app').classList.contains('hidden') && !game;
addEventListener('keydown', (e) => {
  if (!lobbyActive() || e.target.tagName === 'INPUT') return;
  if (KEYS[e.code]) { keys[KEYS[e.code]] = true; autoTarget = null; e.preventDefault(); }
  if ((e.code === 'KeyE' || e.code === 'Enter') && nearStation) startGame(nearStation.type);
});
addEventListener('keyup', (e) => { if (KEYS[e.code]) keys[KEYS[e.code]] = false; });
addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));

const joy = document.getElementById('joystick'), knob = joy.querySelector('.knob');
const stick = { x: 0, y: 0, id: null };
function joyMove(e) {
  const r = joy.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy), max = 45;
  if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
  stick.x = dx / max; stick.y = dy / max;
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
}
joy.addEventListener('pointerdown', (e) => { e.preventDefault(); stick.id = e.pointerId; try { joy.setPointerCapture(e.pointerId); } catch {} autoTarget = null; joyMove(e); });
joy.addEventListener('pointermove', (e) => { if (stick.id === e.pointerId) joyMove(e); });
const joyEnd = () => { stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => joy.addEventListener(ev, joyEnd));

// tocar/clicar no chão anda até lá; tocar numa máquina anda até ela
let autoTarget = null, autoStation = null;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10) return;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(clickable, false)[0];
  if (hit) {
    const st = stations.find((s) => s.type === hit.object.userData.station);
    if (st === nearStation) return startGame(st.type);
    autoTarget = { x: st.spot.x, z: st.spot.z }; autoStation = st; return;
  }
  const f = ray.intersectObject(floor)[0];
  if (f) { autoTarget = { x: f.point.x, z: f.point.z }; autoStation = null; }
});

// ---------- escolher jogo ----------
const prompt = document.getElementById('playPrompt');
let nearStation = null;
function startGame(type) {
  if (Object.keys(players).length < 2) { prompt.textContent = 'Espere seu amor entrar 💌'; return; }
  socket.emit('start', type);
}
prompt.addEventListener('click', () => nearStation && startGame(nearStation.type));
document.getElementById('listBtn').addEventListener('click', () => document.getElementById('gameList').classList.toggle('hidden'));
document.querySelectorAll('.game-card').forEach((b) => b.addEventListener('click', () => document.getElementById('gameList').classList.add('hidden')));

// ---------- eventos da sala ----------
// placar do casal nas placas das máquinas (meta-laço: motivo para "só mais uma")
let lastStats = '';
function updateLabels() {
  const key = JSON.stringify(stats); if (key === lastStats) return; lastStats = key;
  for (const s of stations) {
    const title = NAMES[s.type].replace(/ [^\wÀ-ú].*$/u, '');
    const st = stats[s.type] || {};
    const line = Object.entries(st).sort((a, b) => b[1] - a[1]).map(([n, w]) => `${n.split(' ')[0]} ${w}`).join(' · ');
    const lines = line ? [title, `🏆 ${line}`] : [title];
    s.label.material.map.dispose();
    s.label.material.map = textTexture(lines, { w: 512, h: line ? 200 : 128, bg: 'rgba(255,255,255,.92)', fg: '#3b2333', font: 'bold 50px Nunito, sans-serif' });
    s.label.scale.set(2.2, line ? 0.86 : 0.55, 1);
    s.label.material.needsUpdate = true;
  }
}
addEventListener('roomstate', () => { if (me) { syncAvatars(); updateLabels(); } });

// emotes: o emoji sobe do boneco com um somzinho
document.querySelectorAll('#emotes button').forEach((b) => b.addEventListener('click', () => socket.emit('emote', b.dataset.e)));
addEventListener('keydown', (e) => {
  if (!lobbyActive() || e.target.tagName === 'INPUT') return;
  const map = { Digit1: '💖', Digit2: '😘', Digit3: '😂', Digit4: '👋' };
  if (map[e.code]) socket.emit('emote', map[e.code]);
});
const emoteSprites = [];
socket.on('emote', ({ id, e }) => {
  const a = avatars[id]; if (!a) return;
  FX.play('heart');
  const s = sprite(textTexture([e], { w: 256, h: 256, font: '180px sans-serif' }), 1.1, 1.1);
  s.position.set(a.group.position.x, 2.4, a.group.position.z);
  s.userData = { t0: performance.now(), x0: a.group.position.x, drift: (Math.random() - 0.5) * 0.6 };
  scene.add(s); emoteSprites.push(s);
});
function tickEmotes() {
  const now = performance.now();
  for (let i = emoteSprites.length - 1; i >= 0; i--) {
    const s = emoteSprites[i], t = (now - s.userData.t0) / 1000;
    s.position.y = 2.4 + t * 1.3; s.position.x = s.userData.x0 + Math.sin(t * 4) * 0.15 + s.userData.drift * t;
    const k = t < 0.15 ? t / 0.15 : 1; s.scale.setScalar(1.1 * k);
    s.material.opacity = Math.max(0, 1 - Math.max(0, t - 1.2) / 0.8);
    if (t > 2) { scene.remove(s); s.material.map.dispose(); emoteSprites.splice(i, 1); }
  }
}
addEventListener('roomchat', (e) => { const m = e.detail; if (m.from) showBubble(m.from, m.text); });
socket.on('pos', (d) => { const a = avatars[d.id]; if (a) { a.target = d; a.moving = d.moving; } });

// ---------- loop ----------
const clock = new THREE.Clock();
let lastSend = 0, lastSent = '';
const camOffset = new THREE.Vector3(0, 7.5, 8.5);
const camPos = new THREE.Vector3(0, 7.5, 10);

function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  // tela em pé/estreita: câmera mais perto para tudo ficar maior
  const narrow = w / h < 1.2;
  camera.fov = narrow ? 55 : 50;
  camOffset.set(0, narrow ? 5.2 : 7.5, narrow ? 6.2 : 8.5);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(wrap);

function blocked(x, z) {
  if (Math.abs(x) > ROOM - 0.5 || z < -ROOM + 0.5 || z > ROOM - 0.5) return true;
  if (Math.abs(x) < 1.8 && z < -ROOM + 2) return true; // sofá
  return stations.some((s) => Math.hypot(x - s.x, z - s.z) < 1.05);
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  if (!lobbyActive() || !wrap.clientWidth) return;
  floaters.forEach((m) => { m.position.y += Math.sin(t + m.userData.phase) * 0.003; m.rotation.y += 0.01; });
  bulbs.forEach((b, i) => b.material.color.offsetHSL(0, 0, Math.sin(t * 3 + i) * 0.004));

  const mine = avatars[me];
  if (mine) {
    let ix = (keys.r ? 1 : 0) - (keys.l ? 1 : 0) + stick.x;
    let iz = (keys.d ? 1 : 0) - (keys.u ? 1 : 0) + stick.y;
    if (autoTarget && !ix && !iz) {
      const dx = autoTarget.x - mine.group.position.x, dz = autoTarget.z - mine.group.position.z, d = Math.hypot(dx, dz);
      if (d < 0.15) { autoTarget = null; if (autoStation) mine.group.rotation.y = Math.atan2(autoStation.x - mine.group.position.x, autoStation.z - mine.group.position.z); }
      else { ix = dx / d; iz = dz / d; }
    }
    const len = Math.hypot(ix, iz);
    mine.moving = len > 0.1;
    if (mine.moving) {
      const sp = 4.2 * Math.min(1, len) * dt; const nx = ix / len, nz = iz / len;
      const p = mine.group.position;
      if (!blocked(p.x + nx * sp, p.z)) p.x += nx * sp; else if (autoTarget) autoTarget = null;
      if (!blocked(p.x, p.z + nz * sp)) p.z += nz * sp; else if (autoTarget) autoTarget = null;
      let da = Math.atan2(nx, nz) - mine.group.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
      mine.group.rotation.y += da * Math.min(1, dt * 12);
    }
    // envia posição ~15x/s
    const now = performance.now();
    const p = mine.group.position;
    const msg = `${p.x.toFixed(2)},${p.z.toFixed(2)},${mine.group.rotation.y.toFixed(2)},${mine.moving}`;
    if (now - lastSend > 66 && msg !== lastSent) {
      lastSend = now; lastSent = msg;
      socket.emit('pos', { x: +p.x.toFixed(2), z: +p.z.toFixed(2), ry: +mine.group.rotation.y.toFixed(2), moving: mine.moving });
      if (players[me]) players[me].pos = { x: p.x, z: p.z, ry: mine.group.rotation.y };
    }
    // câmera segue
    camPos.lerp(new THREE.Vector3().copy(p).add(camOffset), Math.min(1, dt * 5));
    camera.position.copy(camPos); camera.lookAt(p.x, 1, p.z - 1);

    // máquina mais próxima
    let best = null, bd = 1.9;
    for (const s of stations) { const d = Math.hypot(p.x - s.spot.x, p.z - s.spot.z); if (d < bd) { bd = d; best = s; } }
    if (best !== nearStation) {
      nearStation = best;
      prompt.classList.toggle('hidden', !best);
      if (best) prompt.textContent = `▶ Jogar ${NAMES[best.type]}`;
    }
  }
  // outros avatares: interpolação
  for (const [id, a] of Object.entries(avatars)) {
    if (id !== me && a.target) {
      a.group.position.x += (a.target.x - a.group.position.x) * Math.min(1, dt * 10);
      a.group.position.z += (a.target.z - a.group.position.z) * Math.min(1, dt * 10);
      let da = a.target.ry - a.group.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
      a.group.rotation.y += da * Math.min(1, dt * 10);
    }
    // animação de andar
    a.phase += dt * (a.moving ? 12 : 2);
    a.animate(a.phase, a.moving);
    if (a.bubble && performance.now() > a.bubble.userData.until) { a.group.remove(a.bubble); a.bubble = null; }
  }
  // máquinas: anel acende quando perto, plaquinha flutua
  stations.forEach((s, i) => {
    s.ring.material.opacity = s === nearStation ? 0.6 + Math.sin(t * 6) * 0.3 : 0.3;
    s.label.position.y = s.base + Math.sin(t * 2 + i) * 0.08;
  });
  tickEmotes();
  renderer.render(scene, camera);
}
resize();
tick();
// se o estado chegou antes do módulo carregar
if (me) syncAvatars();
