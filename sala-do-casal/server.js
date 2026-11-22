const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use('/vendor/three-addons', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')));

const PORT = process.env.PORT || 3000;
const rooms = {}; // code -> { players: {id:{name,color}}, chat: [], game: null }
const COLORS = ['#ff4d8d', '#6c8cff'];

// ---------------- Conteúdo dos jogos ----------------
const EMOJIS = ['💖', '🌹', '🍓', '🐱', '🌙', '🍕', '🎁', '🧸', '🌻', '🍫', '🎶', '✨'];
const WORDS = ['coração', 'praia', 'pizza', 'gato', 'cachorro', 'bolo', 'flor', 'lua', 'sol', 'casa',
  'carro', 'avião', 'beijo', 'anel', 'cinema', 'sorvete', 'violão', 'árvore', 'chuva', 'estrela',
  'presente', 'bicicleta', 'montanha', 'peixe', 'castelo', 'balão', 'café', 'livro', 'televisão', 'urso'];
// Desenhe e Adivinhe: 3 níveis (estilo dos jogos de desenho mobile), valendo 1, 2 ou 3 pontos
const WORDS_BY_LEVEL = [
  ['sol', 'lua', 'gato', 'casa', 'flor', 'bolo', 'peixe', 'carro', 'anel', 'urso', 'café', 'livro', 'chuva', 'beijo', 'balão', 'pizza', 'coração'],
  ['praia', 'cinema', 'violão', 'árvore', 'estrela', 'presente', 'castelo', 'sorvete', 'avião', 'cachorro', 'montanha', 'bicicleta', 'foguete', 'girafa'],
  ['televisão', 'dinossauro', 'paraquedas', 'astronauta', 'pipoca', 'churrasco', 'arco-íris', 'guarda-chuva', 'pôr do sol', 'lua de mel', 'montanha-russa', 'fantasma'],
];
const QUESTIONS = [
  'Quem é mais provável de se atrasar?', 'Quem ronca mais?', 'Quem é mais ciumento(a)?',
  'Quem chora mais em filme?', 'Quem come mais?', 'Quem pede desculpa primeiro?',
  'Quem é mais romântico(a)?', 'Quem demora mais pra se arrumar?', 'Quem é mais bagunceiro(a)?',
  'Quem dorme primeiro no filme?', 'Quem gasta mais dinheiro?', 'Quem é mais engraçado(a)?',
  'Quem esquece datas importantes?', 'Quem manda mais na relação?', 'Quem é mais teimoso(a)?',
  'Quem disse "eu te amo" primeiro?', 'Quem cozinha melhor?', 'Quem fica mais bravo(a) com fome?',
  'Quem passa mais tempo no celular?', 'Quem é mais medroso(a)?', 'Quem sobreviveria a um apocalipse zumbi?',
  'Quem é mais carente?', 'Quem canta mais no chuveiro?', 'Quem escolhe o restaurante?',
];

const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function newGame(type, ids, prev) {
  const scores = prev && prev.type === type ? prev.scores : Object.fromEntries(ids.map((id) => [id, 0]));
  const first = prev && prev.type === type && prev.first ? ids.find((i) => i !== prev.first) || ids[0] : ids[0];
  const base = { type, id: Math.random().toString(36).slice(2), players: ids, scores, first, winner: null, draw: false };
  switch (type) {
    case 'corrida': return { ...base, created: Date.now(), finished: {}, laps: 3 };
    case 'tenis': return {
      ...base, points: Object.fromEntries(ids.map((id) => [id, 0])), server: first, phase: 'serve',
      phaseUntil: Date.now() + 2500, ball: { x: 0, y: 2.2, z: 12, vx: 0, vy: 0, vz: 0 }, bounces: 0,
      lastHitter: first, rally: 0, msg: '', pos: {},
    };
    case 'bilhar': return { ...base, balls: rackBalls(), turn: first, groups: {}, msg: '', busyUntil: 0 };
    case 'velha': return { ...base, board: Array(9).fill(null), turn: first };
    case 'lig4': return { ...base, board: Array(42).fill(null), turn: first, last: null };
    case 'ppt': return { ...base, choices: {}, reveal: null, round: 1, wins: Object.fromEntries(ids.map((id) => [id, 0])), history: [] };
    case 'memoria': return { ...base, cards: shuffle([...EMOJIS.slice(0, 8), ...EMOJIS.slice(0, 8)]), open: [], matched: [], turn: first, lock: false };
    case 'desenho': return {
      ...base, drawer: ids.includes('bot') ? ids.find((i) => i !== 'bot') : first, phase: 'choose',
      options: WORDS_BY_LEVEL.map((l) => pick(l)), word: null, points: 0, strokes: [], guessed: null, hints: 0, endsAt: 0, bank: [], msg: '',
    };
    case 'sintonia': return { ...base, question: pick(QUESTIONS), answers: {}, reveal: null, round: 1, total: 10, matches: 0, done: false, used: [] };
  }
}

function lineWin(board, lines) {
  for (const l of lines) { const v = board[l[0]]; if (v && l.every((i) => board[i] === v)) return v; }
  return null;
}
const VELHA_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function lig4Win(b) {
  const at = (r, c) => (r >= 0 && r < 6 && c >= 0 && c < 7 ? b[r * 7 + c] : null);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    const v = at(r, c); if (!v) continue;
    for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
      if ([1,2,3].every((k) => at(r + dr * k, c + dc * k) === v)) return v;
    }
  }
  return null;
}
const other = (g, id) => g.players.find((p) => p !== id);

// ---------------- Tênis (física no servidor, 60x por segundo) ----------------
const COURT = { hw: 4.115, hl: 11.885, net: 0.95, win: 7 };
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sideOf = (g, id) => (g.players[0] === id ? 1 : -1); // jogador 0 fica no lado +z

function stopTennis(room) { if (room.tennisTimer) { clearInterval(room.tennisTimer); room.tennisTimer = null; } }
function startTennis(room) {
  stopTennis(room);
  let tick = 0;
  room.tennisTimer = setInterval(() => {
    const g = room.game;
    if (!g || g.type !== 'tenis' || !rooms[room.code]) return stopTennis(room);
    tennisStep(room, g);
    if (++tick % 3 === 0) {
      const b = g.ball;
      io.to(room.code).emit('tball', { gid: g.id, ph: g.phase, b: [b.x, b.y, b.z, b.vx, b.vy, b.vz].map((v) => +v.toFixed(3)) });
    }
  }, 1000 / 60);
}

function launch(g, id, tx, tz, T) {
  const b = g.ball;
  for (let k = 0; k < 12; k++) { // garante que passa por cima da rede
    b.vx = (tx - b.x) / T; b.vz = (tz - b.z) / T; b.vy = (0.06 - b.y + 4.9 * T * T) / T;
    const tn = -b.z / b.vz;
    if (tn <= 0 || b.y + b.vy * tn - 4.9 * tn * tn > COURT.net + 0.25) break;
    T += 0.08;
  }
  g.lastHitter = id; g.bounces = 0;
}

function tennisPoint(room, g, winner, msg) {
  if (g.phase !== 'play') return;
  const loser = other(g, winner);
  g.points[winner]++;
  const pw = g.points[winner], pl = g.points[loser];
  g.msg = `${msg} Ponto de ${room.players[winner]?.name || ''}`;
  let matchPoint = false;
  if (pw >= COURT.win && pw - pl >= 2) {
    g.winner = winner; g.scores[winner]++; g.phase = 'over';
    g.msg = `${room.players[winner]?.name || ''} venceu o jogo! 🏆`;
  } else {
    g.phase = 'point'; g.phaseUntil = Date.now() + 1600;
    const total = g.players.reduce((s, p) => s + g.points[p], 0);
    g.server = g.players[Math.floor(total / 2) % 2]; // troca o saque a cada 2 pontos
    matchPoint = g.players.some((p) => g.points[p] >= COURT.win - 1 && g.points[p] > g.points[other(g, p)]);
    if (matchPoint) g.msg += ' — Match point! 🔥';
  }
  io.to(room.code).emit('tevent', { gid: g.id, type: 'point', winner, msg: g.msg, matchPoint, over: !!g.winner });
  broadcast(room);
}

function tennisStep(room, g) {
  const now = Date.now(), dt = 1 / 60, b = g.ball;
  if (g.phase === 'over') return;
  if (room.bot) bot.tennis(room, g, dt);
  if (g.phase === 'point' && now > g.phaseUntil) { g.phase = 'serve'; g.phaseUntil = now + 1300; g.msg = ''; broadcast(room); }
  if (g.phase === 'serve' || g.phase === 'point') {
    const s = sideOf(g, g.server), p = g.pos[g.server] || { x: 0 };
    Object.assign(b, { x: clamp(p.x, -3.5, 3.5) + 0.35 * s, y: 1.0, z: s * 12.1, vx: 0, vy: 0, vz: 0 });
    if (g.phase === 'serve') {
      const t = Math.max(0, (g.phaseUntil - now) / 1300);
      b.y = 1.0 + Math.sin((1 - t) * Math.PI) * 1.6; // bola subindo no lançamento
      if (now > g.phaseUntil) {
        b.y = 2.4; g.rally = 0;
        launch(g, g.server, rand(-2.6, 2.6), -s * rand(3.5, 6.0), 1.05);
        g.phase = 'play';
        io.to(room.code).emit('tevent', { gid: g.id, type: 'hit', id: g.server });
      }
    }
    return;
  }
  // em jogo
  const pz = b.z;
  b.vy -= 9.8 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  const receiver = other(g, g.lastHitter);
  if (pz !== 0 && Math.sign(pz) !== Math.sign(b.z) && b.y < COURT.net) {
    b.vz = -b.vz * 0.15; b.vx *= 0.2; b.z = pz;
    return tennisPoint(room, g, receiver, 'Na rede! 🥅');
  }
  if (b.y < 0.06 && b.vy < 0) {
    b.y = 0.06; b.vy = -b.vy * 0.72; b.vx *= 0.88; b.vz *= 0.88;
    if (g.bounces === 0) {
      const wrongSide = Math.sign(b.z) === sideOf(g, g.lastHitter);
      const out = Math.abs(b.x) > COURT.hw || Math.abs(b.z) > COURT.hl;
      if (wrongSide || out) return tennisPoint(room, g, receiver, 'Fora! 🙈');
      g.bounces = 1;
    } else {
      return tennisPoint(room, g, g.lastHitter, 'Quicou duas vezes!');
    }
  }
  if (Math.abs(b.z) > 22 || Math.abs(b.x) > 15) return tennisPoint(room, g, g.bounces ? g.lastHitter : receiver, g.bounces ? 'Não alcançou!' : 'Fora! 🙈');
  // rebatida automática quando a bola chega perto do jogador.
  // Golpe com timing (apertar Espaço/🎾 logo antes do contato): alcance maior, bola mais rápida e mais angulada.
  for (const id of g.players) {
    if (id === g.lastHitter) continue;
    const s = sideOf(g, id), p = g.pos[id];
    if (!p || b.z * s <= 0.3 || b.vz * s <= 0 || b.y > 2.7) continue;
    const swingAge = now - ((g.swingAt || {})[id] || 0);
    const aim = (g.aim || {})[id];
    const swiped = aim && now - aim.at < 450; // swipe do celular (direção + força escolhidas pelo gesto)
    const timed = (swingAge >= 0 && swingAge < 280) || swiped;
    if (Math.hypot(b.x - p.x, b.z - p.z) > (timed ? 1.8 : 1.45)) continue;
    // no celular o boneco anda sozinho, então rebater depende do swipe na hora certa (como nos jogos mobile)
    if ((g.manual || {})[id] && !swiped) continue;
    const perfect = swiped && now - aim.at < 220;
    const power = id === 'bot' ? Math.random() < 0.18 : swiped ? perfect && aim.power > 0.4 : timed;
    g.rally++;
    let T = Math.max(0.62, 1.25 - g.rally * 0.045); // a troca vai ficando mais rápida
    if (power) T *= 0.78;
    const off = b.x - p.x; // bater mais de lado = mais ângulo
    let tx = clamp(-off * 2.6 + (p.vx || 0) * 0.35 + rand(-1.4, 1.4), -3.8, 3.8);
    if (power) tx = clamp(tx * 1.35 + Math.sign(tx || rand(-1, 1)) * 0.6, -3.9, 3.9);
    if (swiped) { tx = clamp(aim.dx * s * 3.7 + rand(-0.4, 0.4), -3.9, 3.9); delete g.aim[id]; } // direção do swipe manda
    launch(g, id, tx, -s * rand(power ? 8.5 : 6.5, power ? 11.2 : 10.8), T);
    if (g.swingAt) delete g.swingAt[id];
    g.lastPower = power;
    io.to(room.code).emit('tevent', { gid: g.id, type: 'hit', id, rally: g.rally, power });
    break;
  }
}

// ---------------- Bilhar (física no servidor) ----------------
const PT = { W: 1000, H: 500, R: 14 };
const POCKETS = [[0, 0, 32], [500, -4, 26], [1000, 0, 32], [0, 500, 32], [500, 504, 26], [1000, 500, 32]];
const isGroup = (n, gr) => (gr === 'lisas' ? n >= 1 && n <= 7 : n >= 9 && n <= 15);

function rackBalls() {
  const rest = shuffle([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]);
  const order = [...rest.slice(0, 4), 8, ...rest.slice(4)];
  const balls = [{ n: 0, x: 250, y: 250, in: false }];
  let k = 0;
  for (let i = 0; i < 5; i++) for (let j = 0; j <= i; j++) {
    balls.push({ n: order[k++], x: 720 + i * (PT.R * 2 * 0.87 + 0.5), y: 250 + (j - i / 2) * (PT.R * 2 + 0.5), in: false });
  }
  return balls;
}

function simulatePool(balls, angle, power) {
  const { W, H, R } = PT;
  const b = balls.map((o) => ({ ...o, vx: 0, vy: 0 }));
  const sp = 3 + power * 27;
  b[0].vx = Math.cos(angle) * sp; b[0].vy = Math.sin(angle) * sp;
  const frames = [], potted = []; let firstHit = null;
  const snap = () => b.map((o) => (o.in ? null : [Math.round(o.x * 10) / 10, Math.round(o.y * 10) / 10]));
  for (let step = 0; step < 3000; step++) {
    const SUB = 6;
    for (let s = 0; s < SUB; s++) {
      for (const o of b) {
        if (o.in) continue;
        o.x += o.vx / SUB; o.y += o.vy / SUB;
        for (const [px, py, pr] of POCKETS) if (Math.hypot(o.x - px, o.y - py) < pr) { o.in = true; o.vx = o.vy = 0; potted.push(o.n); break; }
        if (o.in) continue;
        if (o.x < R) { o.x = R; o.vx = -o.vx * 0.8; } if (o.x > W - R) { o.x = W - R; o.vx = -o.vx * 0.8; }
        if (o.y < R) { o.y = R; o.vy = -o.vy * 0.8; } if (o.y > H - R) { o.y = H - R; o.vy = -o.vy * 0.8; }
      }
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
        const a = b[i], c = b[j]; if (a.in || c.in) continue;
        const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
        if (d >= 2 * R || d === 0) continue;
        const nx = dx / d, ny = dy / d, ov = (2 * R - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
        const dvn = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        if (dvn > 0) { const jn = dvn * 0.97; a.vx -= jn * nx; a.vy -= jn * ny; c.vx += jn * nx; c.vy += jn * ny; }
        if (firstHit === null && (a.n === 0 || c.n === 0)) firstHit = a.n === 0 ? c.n : a.n;
      }
    }
    let moving = false;
    for (const o of b) { o.vx *= 0.986; o.vy *= 0.986; if (Math.hypot(o.vx, o.vy) < 0.05) o.vx = o.vy = 0; else moving = true; }
    if (step % 2 === 0) frames.push(snap());
    if (!moving) break;
  }
  frames.push(snap());
  return { balls: b.map(({ n, x, y, in: i }) => ({ n, x, y, in: i })), frames, potted, firstHit };
}

function poolShot(room, g, id, angle, power) {
  const opp = other(g, id), own = g.groups[id];
  const remainingBefore = own ? g.balls.filter((b) => !b.in && isGroup(b.n, own)).length : 7;
  const res = simulatePool(g.balls, angle, power);
  io.to(room.code).emit('poolShot', { gid: g.id, frames: res.frames });
  g.busyUntil = Date.now() + res.frames.length * 33;
  g.balls = res.balls;
  const pot = res.potted.filter((n) => n !== 0 && n !== 8);
  const scratch = res.potted.includes(0);
  const nm = room.players[id]?.name || '';
  if (scratch) {
    const cue = g.balls[0]; cue.in = false; cue.x = 250; cue.y = 250;
    while (g.balls.some((b) => b.n !== 0 && !b.in && Math.hypot(b.x - cue.x, b.y - cue.y) < PT.R * 2)) cue.x -= PT.R * 2;
  }
  if (res.potted.includes(8)) {
    const legal = !scratch && own && remainingBefore === 0;
    g.winner = legal ? id : opp; g.scores[g.winner]++;
    g.msg = legal ? `${nm} encaçapou a bola 8! 🎱` : `${nm} derrubou a 8 antes da hora 😬`;
    return;
  }
  if (!own && pot.length && !scratch) {
    const gr = pot[0] < 8 ? 'lisas' : 'listradas';
    g.groups[id] = gr; g.groups[opp] = gr === 'lisas' ? 'listradas' : 'lisas';
  }
  const mine = g.groups[id];
  const keep = !scratch && mine && pot.some((n) => isGroup(n, mine));
  if (scratch) g.msg = `${nm} encaçapou a branca! Vez do outro 🙈`;
  else if (res.firstHit === null) g.msg = `${nm} não acertou nenhuma bola`;
  else if (keep) g.msg = `${nm} acertou! Joga de novo 🔥`;
  else if (pot.length) g.msg = `${nm} encaçapou bola do adversário 😅`;
  else g.msg = '';
  if (!keep) g.turn = opp;
}
const BEATS = { pedra: 'tesoura', tesoura: 'papel', papel: 'pedra' };

// Retorna true se o estado mudou
function applyMove(room, id, m) {
  const g = room.game; if (!g || !g.players.includes(id)) return false;
  switch (g.type) {
    case 'velha': {
      if (g.winner || g.draw || g.turn !== id || g.board[m.i] !== null || !(m.i >= 0 && m.i < 9)) return false;
      g.board[m.i] = id;
      const w = lineWin(g.board, VELHA_LINES);
      if (w) { g.winner = w; g.scores[w]++; } else if (g.board.every(Boolean)) g.draw = true; else g.turn = other(g, id);
      return true;
    }
    case 'lig4': {
      if (g.winner || g.draw || g.turn !== id || !(m.c >= 0 && m.c < 7)) return false;
      let r = 5; while (r >= 0 && g.board[r * 7 + m.c]) r--;
      if (r < 0) return false;
      g.board[r * 7 + m.c] = id; g.last = r * 7 + m.c;
      const w = lig4Win(g.board);
      if (w) { g.winner = w; g.scores[w]++; } else if (g.board.every(Boolean)) g.draw = true; else g.turn = other(g, id);
      return true;
    }
    case 'ppt': { // melhor de 3
      if (g.reveal || g.winner || !BEATS[m.choice] || g.choices[id]) return false;
      g.choices[id] = m.choice;
      if (g.players.every((p) => g.choices[p])) {
        const [a, b] = g.players; const ca = g.choices[a], cb = g.choices[b];
        const rw = ca === cb ? null : BEATS[ca] === cb ? a : b;
        g.reveal = { ...g.choices, roundWinner: rw };
        g.history.push(rw);
        if (rw) g.wins[rw]++;
        if (rw && g.wins[rw] >= 2) { g.winner = rw; g.scores[rw]++; }
        else setTimeout(() => { if (room.game === g) { g.choices = {}; g.reveal = null; g.round++; broadcast(room); } }, 3200);
      }
      return true;
    }
    case 'memoria': {
      if (g.winner || g.draw || g.lock || g.turn !== id) return false;
      if (!(m.i >= 0 && m.i < 16) || g.open.includes(m.i) || g.matched.includes(m.i)) return false;
      g.open.push(m.i);
      if (g.open.length === 2) {
        const [x, y] = g.open;
        if (g.cards[x] === g.cards[y]) {
          g.matched.push(x, y); g.open = []; g.scores[id]++;
          if (g.matched.length === 16) {
            const [a, b] = g.players;
            if (g.scores[a] === g.scores[b]) g.draw = true; else g.winner = g.scores[a] > g.scores[b] ? a : b;
          }
        } else {
          g.lock = true;
          setTimeout(() => { if (room.game === g) { g.open = []; g.lock = false; g.turn = other(g, id); broadcast(room); } }, 1100);
        }
      }
      return true;
    }
    case 'corrida': {
      if (!m.finish || g.finished[id] || typeof m.time !== 'number') return false;
      g.finished[id] = m.time;
      if (!g.winner) { g.winner = id; g.scores[id]++; }
      return true;
    }
    case 'bilhar': {
      if (g.winner || g.turn !== id || Date.now() < g.busyUntil) return false;
      const angle = +m.angle, power = Math.max(0, Math.min(1, +m.power));
      if (!Number.isFinite(angle) || !Number.isFinite(power)) return false;
      poolShot(room, g, id, angle, power);
      return true;
    }
    case 'desenho': {
      if (id !== g.drawer) return false;
      if (g.phase === 'choose' && m.choose >= 0 && m.choose <= 2) {
        g.word = g.options[m.choose]; g.points = m.choose + 1; g.phase = 'draw'; g.endsAt = Date.now() + 80000;
        // banco de letras (letras da palavra + algumas falsas), como nos jogos de desenho mobile
        const letters = norm(g.word).replace(/[^a-z]/g, '').toUpperCase().split('');
        const extra = Math.max(4, 12 - letters.length);
        for (let i = 0; i < extra; i++) letters.push('ABCDEFGHIJLMNOPRSTUVZ'[Math.floor(Math.random() * 21)]);
        g.bank = shuffle(letters);
        const timer = (ms, fn) => setTimeout(() => { if (room.game === g && g.phase === 'draw') { fn(); broadcast(room); } }, ms);
        timer(30000, () => (g.hints = 1)); timer(55000, () => (g.hints = 2));
        timer(80000, () => { g.phase = 'over'; g.msg = `⏰ Tempo esgotado! A palavra era "${g.word}"`; });
        return true;
      }
      if (g.phase !== 'draw') return false;
      if (m.clear) { g.strokes = []; return true; }
      if (m.undo) { const last = g.strokes[g.strokes.length - 1]; if (last) g.strokes = g.strokes.filter((s) => s.sid !== last.sid); return true; }
      return false;
    }
    case 'sintonia': {
      if (m.next) {
        if (!g.reveal || g.done) return false;
        if (g.round >= g.total) { g.done = true; g.percent = Math.round((g.matches / g.total) * 100); return true; }
        if (g.used.length >= QUESTIONS.length - 1) g.used = [];
        g.used.push(g.question);
        g.question = pick(QUESTIONS.filter((q) => !g.used.includes(q)));
        g.answers = {}; g.reveal = null; g.round++;
        return true;
      }
      if (g.reveal || !g.players.includes(m.who)) return false;
      g.answers[id] = m.who;
      if (g.players.every((p) => g.answers[p])) {
        const match = g.answers[g.players[0]] === g.answers[g.players[1]];
        g.reveal = { ...g.answers, match };
        if (match) { g.matches++; g.players.forEach((p) => g.scores[p]++); }
      }
      return true;
    }
  }
  return false;
}

// O que cada jogador pode ver (esconde segredos)
function viewFor(g, id) {
  if (!g) return null;
  const v = JSON.parse(JSON.stringify(g));
  if (g.type === 'ppt' && !g.reveal) v.choices = Object.fromEntries(Object.keys(g.choices).map((k) => [k, k === id ? g.choices[k] : '?']));
  if (g.type === 'sintonia' && !g.reveal) v.answers = Object.fromEntries(Object.keys(g.answers).map((k) => [k, k === id ? g.answers[k] : '?']));
  if (g.type === 'memoria') v.cards = g.cards.map((c, i) => (g.open.includes(i) || g.matched.includes(i) ? c : null));
  if (g.type === 'corrida') v.startIn = g.created + 3500 - Date.now();
  if (g.type === 'tenis') delete v.pos;
  if (g.type === 'desenho') {
    delete v.strokes;
    v.timeLeft = g.phase === 'draw' ? Math.max(0, g.endsAt - Date.now()) : 0;
    if (id !== g.drawer) {
      delete v.options;
      if (g.word && g.phase === 'draw' && !g.guessed) { // esconde a palavra; dicas revelam letras com o tempo
        const reveal = new Set(); const idx = [...g.word].map((c, i) => (/[\s-]/.test(c) ? -1 : i)).filter((i) => i >= 0);
        if (g.hints >= 1) reveal.add(idx[0]); if (g.hints >= 2) reveal.add(idx[Math.floor(idx.length / 2)]);
        v.mask = [...g.word].map((c, i) => (/[\s-]/.test(c) ? c : reveal.has(i) ? c.toUpperCase() : '_'));
        v.word = null;
      }
    } else v.bank = [];
  }
  return v;
}

function broadcast(room) {
  const g = room.game;
  // placar histórico do casal (meta-laço): conta cada vitória uma vez
  if (g && g.winner && !g.counted && room.players[g.winner]) {
    g.counted = true;
    const nm = room.players[g.winner].name;
    ((room.stats ||= {})[g.type] ||= {})[nm] = (room.stats[g.type][nm] || 0) + 1;
  }
  for (const id of Object.keys(room.players)) {
    if (id === 'bot') continue;
    io.to(id).emit('state', { players: room.players, game: viewFor(g, id), you: id, stats: room.stats || {} });
  }
  if (room.bot) bot.onState(room);
}

function sysMsg(code, text) {
  const msg = { system: true, text, ts: Date.now() };
  rooms[code].chat.push(msg); rooms[code].chat = rooms[code].chat.slice(-200);
  io.to(code).emit('chat', msg);
}

// mensagem de chat (de pessoa ou do robô), incluindo palpites do Desenhe e Adivinhe
function handleChat(r, id, text) {
  const code = r.code, p = r.players[id]; if (!p) return;
  text = String(text || '').slice(0, 500).trim(); if (!text) return;
  const g = r.game;
  const drawing = g?.type === 'desenho' && g.phase === 'draw' && !g.guessed;
  if (drawing && id !== g.drawer && norm(text.replace(/\?$/, '')).replace(/[^a-z]/g, '') === norm(g.word).replace(/[^a-z]/g, '')) {
    g.guessed = id; g.phase = 'over'; g.scores[id] += g.points; g.scores[g.drawer] += g.points;
    g.msg = `🎉 ${p.name} acertou "${g.word}"! +${g.points}⭐ para os dois`;
    sysMsg(code, g.msg);
    return broadcast(r);
  }
  if (drawing && id !== g.drawer) io.to(id).emit('guessWrong', text);
  if (drawing && id === g.drawer && norm(text).includes(norm(g.word))) {
    return io.to(id).emit('chat', { system: true, text: 'Ei, sem contar a palavra! 🤫', ts: Date.now() });
  }
  const msg = { name: p.name, color: p.color, from: id, text, ts: Date.now() };
  r.chat.push(msg); r.chat = r.chat.slice(-200);
  io.to(code).emit('chat', msg);
  if (r.bot) bot.onChat(r, msg);
}

const bot = require('./bot')({
  io, applyMove, broadcast, handleChat, other, sideOf, COURT, PT, POCKETS, isGroup, WORDS, VELHA_LINES, lineWin, lig4Win,
  botSay: (r, text) => handleChat(r, 'bot', text),
});
const humans = (r) => Object.keys(r.players).filter((id) => id !== 'bot');

const GAME_NAMES = { velha: 'Jogo da Velha', lig4: 'Ligue 4', ppt: 'Pedra, Papel e Tesoura', memoria: 'Jogo da Memória', desenho: 'Desenhe e Adivinhe', sintonia: 'Sintonia do Casal', corrida: 'Corrida', bilhar: 'Bilhar', tenis: 'Tênis' };

io.on('connection', (socket) => {
  let code = null;

  socket.on('join', ({ name, room, avatar }, cb) => {
    avatar = ['moletom', 'ela3d'].includes(avatar) ? avatar : 'moletom';
    name = String(name || '').trim().slice(0, 20); room = String(room || '').trim().toUpperCase().slice(0, 12);
    if (!name || !room) return cb({ error: 'Preencha seu nome e o código da sala.' });
    rooms[room] ||= { code: room, players: {}, chat: [], game: null };
    const r = rooms[room];
    if (humans(r).length >= 2) return cb({ error: 'Essa sala já tem 2 pessoas 💑' });
    if (r.bot) { // chegou gente de verdade: o robô dá licença
      bot.remove(r); stopTennis(r);
      if (r.game) r.game = null;
      sysMsg(room, 'Robô 🤖 saiu para dar lugar ao casal 💑');
    }
    const used = Object.values(r.players).map((p) => p.color);
    const n = Object.keys(r.players).length;
    r.players[socket.id] = { name, avatar, color: COLORS.find((c) => !used.includes(c)), pos: { x: n ? 1.2 : -1.2, z: 2, ry: Math.PI } };
    code = room; socket.join(room);
    cb({ ok: true, chat: r.chat });
    sysMsg(room, `${name} entrou na sala 💕`);
    broadcast(r);
    if (r.game?.type === 'desenho') socket.emit('strokes', r.game.strokes);
  });

  socket.on('chat', (text) => {
    const r = rooms[code]; if (!r || !r.players[socket.id]) return;
    handleChat(r, socket.id, text);
  });

  // 🤖 jogar sozinho com o robô
  socket.on('addBot', () => {
    const r = rooms[code]; if (!r || r.bot || humans(r).length !== 1) return;
    bot.add(r, socket.id);
    sysMsg(code, 'Robô 🤖 entrou para jogar com você!');
    broadcast(r);
  });
  socket.on('removeBot', () => {
    const r = rooms[code]; if (!r?.bot) return;
    bot.remove(r); stopTennis(r); r.game = null;
    sysMsg(code, 'Robô 🤖 foi descansar 💤');
    broadcast(r);
  });

  // emotes no lobby (💖 😘 😂 👋)
  socket.on('emote', (e) => {
    const r = rooms[code]; if (!r?.players[socket.id] || !['💖', '😘', '😂', '👋', '🥰'].includes(e)) return;
    io.to(code).emit('emote', { id: socket.id, e });
    if (r.bot) bot.onEmote(r, socket.id);
  });

  socket.on('tmode', (d) => {
    const g = rooms[code]?.game; if (g?.type !== 'tenis' || !g.players.includes(socket.id)) return;
    (g.manual ||= {})[socket.id] = !!d?.swipe;
  });
  // swipe no tênis (celular): dx = direção na tela (-1..1), power = 0..1
  socket.on('tshot', (d) => {
    const g = rooms[code]?.game; if (g?.type !== 'tenis' || !g.players.includes(socket.id) || !d) return;
    const dx = clamp(+d.dx || 0, -1, 1), power = clamp(+d.power || 0, 0, 1);
    (g.aim ||= {})[socket.id] = { dx, power, at: Date.now() };
    socket.to(code).emit('tevent', { gid: g.id, type: 'swing', id: socket.id });
  });

  // golpe com timing no tênis
  socket.on('tswing', () => {
    const g = rooms[code]?.game; if (g?.type !== 'tenis' || !g.players.includes(socket.id)) return;
    (g.swingAt ||= {})[socket.id] = Date.now();
    socket.to(code).emit('tevent', { gid: g.id, type: 'swing', id: socket.id });
  });

  socket.on('typing', () => { if (code) socket.to(code).emit('typing', rooms[code]?.players[socket.id]?.name); });

  socket.on('start', (type) => {
    const r = rooms[code]; if (!r || !GAME_NAMES[type]) return;
    const ids = Object.keys(r.players);
    if (ids.length < 2) return socket.emit('chat', { system: true, text: 'Espere seu amor entrar, ou chame o robô 🤖 para jogar agora!', ts: Date.now() });
    r.game = newGame(type, ids, null);
    if (type === 'tenis') startTennis(r);
    sysMsg(code, `${r.players[socket.id].name} escolheu: ${GAME_NAMES[type]} 🎮`);
    broadcast(r);
    io.to(code).emit('strokes', []);
  });

  socket.on('restart', () => {
    const r = rooms[code]; if (!r?.game) return;
    const ids = Object.keys(r.players); if (ids.length < 2) return;
    r.game = newGame(r.game.type, ids, r.game);
    if (r.game.type === 'tenis') startTennis(r);
    broadcast(r);
    io.to(code).emit('strokes', []);
  });

  socket.on('exitGame', () => { const r = rooms[code]; if (!r) return; r.game = null; broadcast(r); });

  socket.on('move', (m) => {
    const r = rooms[code]; if (!r || !m || !applyMove(r, socket.id, m)) return;
    if (m.clear) io.to(code).emit('strokes', []);
    if (m.undo) io.to(code).emit('strokes', r.game.strokes);
    broadcast(r);
  });

  // Tempo real: posição dos carros e mira do taco (só repassa para o outro)
  socket.on('racePos', (d) => {
    if (!code || !d) return;
    socket.to(code).emit('racePos', { ...d, id: socket.id });
    if (rooms[code]?.bot) bot.onRacePos(rooms[code], socket.id, d);
  });
  socket.on('pos', (d) => {
    const p = rooms[code]?.players[socket.id]; if (!p || !d) return;
    const x = +d.x, z = +d.z, ry = +d.ry;
    if (![x, z, ry].every(Number.isFinite)) return;
    p.pos = { x, z, ry, moving: !!d.moving };
    socket.to(code).emit('pos', { id: socket.id, ...p.pos });
  });
  socket.on('tpos', (d) => {
    const g = rooms[code]?.game; if (!g || g.type !== 'tenis' || !g.players.includes(socket.id) || !d) return;
    const x = +d.x, z = +d.z, vx = +d.vx || 0;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    g.pos[socket.id] = { x, z, vx };
    socket.to(code).emit('tpos', { gid: g.id, id: socket.id, x, z, moving: !!d.moving });
  });
  socket.on('aim', (d) => { if (code) socket.to(code).emit('aim', d); });

  socket.on('needStrokes', () => { const g = rooms[code]?.game; if (g?.type === 'desenho') socket.emit('strokes', g.strokes); });

  socket.on('stroke', (s) => {
    const r = rooms[code]; const g = r?.game;
    if (!g || g.type !== 'desenho' || g.drawer !== socket.id || g.phase !== 'draw' || !s) return;
    g.strokes.push(s); if (g.strokes.length > 5000) g.strokes.shift();
    socket.to(code).emit('stroke', s);
  });

  socket.on('disconnect', () => {
    const r = rooms[code]; if (!r) return;
    const p = r.players[socket.id]; delete r.players[socket.id];
    if (r.game?.players.includes(socket.id)) r.game = null;
    if (!humans(r).length) { if (r.bot) bot.remove(r); stopTennis(r); delete rooms[code]; return; }
    if (p) sysMsg(code, `${p.name} saiu da sala 💔`);
    broadcast(r);
  });
});

server.listen(PORT, () => {
  const nets = require('os').networkInterfaces();
  const ips = Object.values(nets).flat().filter((n) => n.family === 'IPv4' && !n.internal).map((n) => n.address);
  console.log(`💖 Sala do Casal rodando!`);
  console.log(`   Neste PC:      http://localhost:${PORT}`);
  ips.forEach((ip) => console.log(`   Mesma rede Wi-Fi: http://${ip}:${PORT}`));
});
