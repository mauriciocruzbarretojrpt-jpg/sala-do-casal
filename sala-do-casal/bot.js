// 🤖 Robô: um jogador virtual que entra na sala para quem quer jogar/testar sozinho.
// Ele "pensa" depois de cada atualização de estado, com atrasos humanos e erros de propósito (para ser vencível).
const BOT = 'bot';
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// mesma pista da corrida (public/arcade.js)
const TRACK = [[220, 620], [500, 632], [760, 615], [880, 540], [910, 400], [870, 250], [900, 130], [800, 70], [620, 90],
  [520, 180], [400, 190], [260, 90], [130, 130], [90, 280], [200, 360], [180, 480], [110, 560], [150, 615]];
const SEG = TRACK.map((p, i) => { const q = TRACK[(i + 1) % TRACK.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });
const LAP = SEG.reduce((a, b) => a + b, 0);

const REPLIES = ['hehe 😊', 'te amo 💖', 'bora mais uma? 😏', 'você joga bem, hein 👀', 'tô treinando pra te ganhar 🤖',
  'beep boop 💕', 'kkkkk', 'que fofo 🥰', 'saudade de você', 'ah é? 😳', 'vem jogar comigo 🎮'];
const WIN_TALK = ['GG! 😎', 'ganhei hehe 🤖✌️', 'sorte de robô 🍀', 'quer revanche? 😏'];
const LOSE_TALK = ['ahhh 😤 revanche!', 'você é boa(bom) demais 😳', 'GG, mandou bem! 👏', 'meus circuitos tremeram 🤖💦'];

module.exports = function createBot(ctx) {
  const { io, applyMove, broadcast, handleChat, other, sideOf, COURT, PT, POCKETS, isGroup, WORDS, VELHA_LINES, lineWin, lig4Win, botSay } = ctx;

  function add(room, human) {
    const used = Object.values(room.players).map((p) => p.color);
    const avatar = room.players[human]?.avatar === 'ela3d' ? 'moletom' : 'ela3d';
    room.players[BOT] = { name: 'Robô 🤖', avatar, bot: true, color: ['#ff4d8d', '#6c8cff'].find((c) => !used.includes(c)), pos: { x: 1.4, z: 2.6, ry: Math.PI } };
    room.bot = { memory: {}, wander: { x: 1.5, z: 2 }, lastGame: null };
    clearInterval(room.botLobby);
    room.botLobby = setInterval(() => lobbyTick(room), 120);
  }
  function remove(room) {
    clearInterval(room.botLobby); clearInterval(room.botRace); clearTimeout(room.botTimer);
    delete room.players[BOT]; delete room.bot;
  }
  const has = (room) => !!room.players[BOT];
  const humanOf = (room) => Object.keys(room.players).find((id) => id !== BOT);

  // ---------- lobby: segue a pessoa e passeia ----------
  function lobbyTick(room) {
    if (!has(room)) return clearInterval(room.botLobby);
    if (room.game) return;
    const me = room.players[BOT].pos, h = room.players[humanOf(room)]?.pos;
    if (!h) return;
    const w = room.bot.wander;
    if (Math.random() < 0.02 || Math.hypot(w.x - h.x, w.z - h.z) > 3) { const a = rand(0, Math.PI * 2); w.x = h.x + Math.cos(a) * 1.8; w.z = h.z + Math.sin(a) * 1.8; }
    const dx = w.x - me.x, dz = w.z - me.z, d = Math.hypot(dx, dz);
    let moving = false;
    if (d > 0.25) { const sp = Math.min(d, 0.45); me.x += (dx / d) * sp; me.z += (dz / d) * sp; me.ry = Math.atan2(dx, dz); moving = true; }
    else me.ry = Math.atan2(h.x - me.x, h.z - me.z);
    me.x = clamp(me.x, -8, 8); me.z = clamp(me.z, -5, 8);
    io.to(room.code).emit('pos', { id: BOT, x: me.x, z: me.z, ry: me.ry, moving });
  }

  function onChat(room, msg) {
    if (!has(room) || msg.from === BOT || msg.system) return;
    if (room.game?.type === 'desenho') return;
    if (Math.random() < 0.55) setTimeout(() => has(room) && botSay(room, pick(REPLIES)), rand(900, 2200));
  }
  function onEmote(room, from) {
    if (!has(room) || from === BOT) return;
    if (Math.random() < 0.8) setTimeout(() => has(room) && io.to(room.code).emit('emote', { id: BOT, e: pick(['💖', '😘', '😂', '👋', '🥰']) }), rand(500, 1200));
  }

  // ---------- reage a cada estado ----------
  function onState(room) {
    if (!has(room)) return;
    const g = room.game;
    if (g && g.id !== room.bot.lastGame) { room.bot.lastGame = g.id; room.bot.memory = {}; room.bot.talked = false; startRealtime(room, g); }
    if (g && (g.winner || g.draw) && !room.bot.talked && g.type !== 'sintonia') {
      room.bot.talked = true;
      setTimeout(() => has(room) && botSay(room, pick(g.winner === BOT ? WIN_TALK : g.draw ? ['empate! 🤝'] : LOSE_TALK)), 1400);
    }
    clearTimeout(room.botTimer);
    if (!g || !g.players.includes(BOT)) return;
    const think = THINK[g.type]; if (!think) return;
    const plan = think(room, g); if (!plan) return;
    room.botTimer = setTimeout(() => {
      if (room.game !== g || !has(room)) return;
      const m = plan.move();
      if (m && applyMove(room, BOT, m)) broadcast(room);
    }, plan.delay);
  }

  // ---------- jogos por turno ----------
  const THINK = {
    velha(room, g) {
      if (g.winner || g.draw || g.turn !== BOT) return null;
      return { delay: rand(600, 1300), move: () => ({ i: velhaMove(g) }) };
    },
    lig4(room, g) {
      if (g.winner || g.draw || g.turn !== BOT) return null;
      return { delay: rand(700, 1400), move: () => ({ c: lig4Move(g) }) };
    },
    ppt(room, g) {
      if (g.reveal || g.choices[BOT]) return null;
      return { delay: rand(800, 2000), move: () => ({ choice: pick(['pedra', 'papel', 'tesoura']) }) };
    },
    sintonia(room, g) {
      if (g.reveal || g.answers[BOT]) return null;
      return { delay: rand(1200, 2500), move: () => ({ who: pick(g.players) }) };
    },
    memoria(room, g) {
      const mem = room.bot.memory;
      g.open.forEach((i) => (mem[i] = g.cards[i]));
      g.matched.forEach((i) => delete mem[i]);
      if (g.winner || g.draw || g.lock || g.turn !== BOT) return null;
      return { delay: rand(700, 1200), move: () => ({ i: memoriaMove(g, mem) }) };
    },
    bilhar(room, g) {
      if (g.winner || g.turn !== BOT) return null;
      const wait = Math.max(0, g.busyUntil - Date.now()) + rand(900, 1600);
      return {
        delay: wait,
        move: () => {
          const shot = poolMove(g);
          io.to(room.code).emit('aim', { gid: g.id, a: shot.angle, p: shot.power });
          setTimeout(() => { if (room.game === g && g.turn === BOT && applyMove(room, BOT, shot)) broadcast(room); io.to(room.code).emit('aim', null); }, 900);
          return null;
        },
      };
    },
    desenho(room, g) {
      if (g.guessed || g.drawer === BOT || g.phase !== 'draw') return null;
      // palpites de vez em quando; acerta depois de um tempo (mais rápido se tiver muito desenho)
      const startedAt = (room.bot.drawStart ||= {})[g.id] ||= Date.now();
      return {
        delay: rand(5000, 9000),
        move: () => {
          const elapsed = (Date.now() - startedAt) / 1000;
          const chance = clamp((elapsed - 12) / 40 + g.strokes.length / 1500, 0, 0.85);
          handleChat(room, BOT, Math.random() < chance ? g.word : pick(WORDS.filter((w) => w !== g.word)) + '?');
          onState(room); // agenda o próximo palpite
          return null;
        },
      };
    },
  };

  function velhaMove(g) {
    const free = g.board.map((v, i) => (v ? null : i)).filter((i) => i !== null);
    if (Math.random() < 0.18) return pick(free); // de vez em quando erra
    const me = BOT, op = other(g, BOT);
    const score = (b, turn, depth) => {
      const w = lineWin(b, VELHA_LINES);
      if (w === me) return 10 - depth; if (w === op) return depth - 10;
      if (b.every(Boolean)) return 0;
      const vals = [];
      for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = turn; vals.push(score(b, turn === me ? op : me, depth + 1)); b[i] = null; }
      return turn === me ? Math.max(...vals) : Math.min(...vals);
    };
    let best = -1e9, moves = [];
    for (const i of free) { const b = [...g.board]; b[i] = me; const s = score(b, op, 1); if (s > best) { best = s; moves = [i]; } else if (s === best) moves.push(i); }
    return pick(moves);
  }

  function lig4Move(g) {
    const me = BOT, op = other(g, BOT);
    const drop = (b, c, who) => { let r = 5; while (r >= 0 && b[r * 7 + c]) r--; if (r < 0) return null; const nb = [...b]; nb[r * 7 + c] = who; return nb; };
    const cols = [0, 1, 2, 3, 4, 5, 6].filter((c) => !g.board[c]);
    for (const c of cols) if (lig4Win(drop(g.board, c, me)) === me) return c;          // ganha
    for (const c of cols) if (lig4Win(drop(g.board, c, op)) === op) return c;          // bloqueia
    if (Math.random() < 0.15) return pick(cols);
    const safe = cols.filter((c) => { const b = drop(g.board, c, me); return !cols.some((c2) => { const b2 = b && drop(b, c2, op); return b2 && lig4Win(b2) === op; }); });
    const pool = safe.length ? safe : cols;
    return pool.sort((a, b) => Math.abs(3 - a) - Math.abs(3 - b) + rand(-1.2, 1.2))[0];
  }

  function memoriaMove(g, mem) {
    const hidden = g.cards.map((_, i) => i).filter((i) => !g.matched.includes(i) && !g.open.includes(i));
    const recall = (i) => Math.random() < 0.8 ? mem[i] : undefined; // memória imperfeita
    if (g.open.length === 1) {
      const want = g.cards[g.open[0]];
      const known = hidden.find((i) => recall(i) === want);
      if (known !== undefined) return known;
      const unknown = hidden.filter((i) => mem[i] === undefined);
      return pick(unknown.length ? unknown : hidden);
    }
    const seen = {};
    for (const i of hidden) { const v = recall(i); if (v === undefined) continue; if (seen[v] !== undefined) return seen[v]; seen[v] = i; }
    const unknown = hidden.filter((i) => mem[i] === undefined);
    return pick(unknown.length ? unknown : hidden);
  }

  function poolMove(g) {
    const cue = g.balls[0], own = g.groups[BOT];
    const left = own ? g.balls.filter((b) => !b.in && isGroup(b.n, own)) : [];
    let targets = own ? (left.length ? left : g.balls.filter((b) => b.n === 8 && !b.in)) : g.balls.filter((b) => !b.in && b.n !== 0 && b.n !== 8);
    const others = g.balls.filter((b) => !b.in && b.n !== 0);
    // há alguma bola no caminho entre A e B (fora as ignoradas)?
    const blocked = (ax, ay, bx, by, skip) => others.some((o) => {
      if (skip.includes(o)) return false;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      const t = clamp(((o.x - ax) * dx + (o.y - ay) * dy) / L2, 0, 1);
      return Math.hypot(o.x - (ax + dx * t), o.y - (ay + dy * t)) < PT.R * 2.05;
    });
    let best = null;
    for (const b of targets) for (const [px, py] of POCKETS) {
      const tx = px - b.x, ty = py - b.y, td = Math.hypot(tx, ty);
      const gx = b.x - (tx / td) * PT.R * 2, gy = b.y - (ty / td) * PT.R * 2; // "bola fantasma"
      const ax = gx - cue.x, ay = gy - cue.y, ad = Math.hypot(ax, ay);
      const cut = Math.acos(clamp((ax * tx + ay * ty) / (ad * td), -1, 1));
      if (cut > 1.1) continue;
      const clear = !blocked(cue.x, cue.y, gx, gy, [b]) && !blocked(b.x, b.y, px, py, [b]);
      const score = cut * 2.4 + (ad + td) / 700 + (clear ? 0 : 3);
      if (!best || score < best.score) best = { score, angle: Math.atan2(ay, ax), dist: ad + td, cut };
    }
    if (!best) return { angle: rand(-Math.PI, Math.PI), power: rand(0.5, 0.8) };
    // um pouco de imprecisão "humana" (maior em cortes finos)
    const jitter = 0.012 + best.cut * 0.012;
    return { angle: best.angle + rand(-jitter, jitter), power: clamp(0.28 + best.dist / (1300 * Math.max(0.35, Math.cos(best.cut))) + rand(-0.04, 0.06), 0.3, 0.95) };
  }

  // ---------- jogos em tempo real ----------
  function startRealtime(room, g) {
    clearInterval(room.botRace);
    if (g.type === 'corrida' && g.players.includes(BOT)) startRace(room, g);
  }

  function startRace(room, g) {
    const st = { dist: 0, v: 0, lateral: rand(-15, 15) };
    room.raceProg ||= {};
    const t0 = g.created + 3500;
    room.botRace = setInterval(() => {
      if (room.game !== g || !has(room)) return clearInterval(room.botRace);
      const now = Date.now(); if (now < t0) return;
      if (g.finished[BOT]) return;
      const dt = 0.05;
      // segmento atual e curva à frente
      let d = st.dist % LAP, k = 0; while (d > SEG[k]) { d -= SEG[k]; k++; }
      const N = TRACK.length, a = TRACK[k], b = TRACK[(k + 1) % N], c = TRACK[(k + 2) % N];
      const ang1 = Math.atan2(b[1] - a[1], b[0] - a[0]), ang2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      const turn = Math.abs(Math.atan2(Math.sin(ang2 - ang1), Math.cos(ang2 - ang1)));
      const nearCorner = SEG[k] - d < 120;
      let target = 400 * (nearCorner ? 1 - Math.min(0.45, turn * 0.35) : 1);
      // elástico sutil: acelera se está atrás da pessoa, alivia se está na frente
      const myCp = Math.floor((st.dist / LAP) * N) + 1;
      const hp = room.raceProg[humanOf(room)];
      if (hp && hp.gid === g.id) target *= clamp(1 + (hp.cp - myCp) * 0.025, 0.86, 1.12);
      st.v += clamp(target - st.v, -600 * dt, 260 * dt);
      st.dist += st.v * dt;
      const t = d / SEG[k];
      const x = a[0] + (b[0] - a[0]) * t - Math.sin(ang1) * st.lateral, y = a[1] + (b[1] - a[1]) * t + Math.cos(ang1) * st.lateral;
      const lap = Math.min(g.laps, Math.floor(st.dist / LAP) + 1);
      io.to(room.code).emit('racePos', { gid: g.id, id: BOT, x: Math.round(x), y: Math.round(y), a: +ang1.toFixed(3), lap, cp: myCp });
      if (st.dist >= g.laps * LAP) {
        if (applyMove(room, BOT, { finish: true, time: now - t0 })) broadcast(room);
      }
    }, 50);
  }

  // chamado pelo tênis a cada passo de física
  function tennis(room, g, dt) {
    if (!g.players.includes(BOT)) return;
    const s = sideOf(g, BOT), b = g.ball;
    const p = (g.pos[BOT] ||= { x: 0, z: s * 10.3, vx: 0 });
    const st = (room.bot.tennis ||= { err: 0, lastHitter: null, tick: 0 });
    if (st.lastHitter !== g.lastHitter) { // nova bola vindo: decide o quanto vai errar
      st.lastHitter = g.lastHitter;
      const lead = (g.points[BOT] || 0) - (g.points[other(g, BOT)] || 0);
      // erra mais em trocas longas, contra golpes fortes e quando está ganhando (elástico sutil)
      const sloppy = 0.5 + Math.max(0, lead) * 0.2 + (g.rally || 0) * 0.07 + (g.lastPower ? 0.9 : 0);
      const bigMiss = 0.1 + Math.max(0, lead) * 0.05 + (g.rally || 0) * 0.012 + (g.lastPower ? 0.2 : 0);
      st.err = rand(-1, 1) * sloppy + (Math.random() < bigMiss ? pick([-1, 1]) * 1.8 : 0);
    }
    let tx = 0, tz = s * 10.3;
    if (g.phase === 'play' && b.vz * s > 0) { const t = (s * 10.3 - b.z) / b.vz; tx = b.x + b.vx * Math.max(0, t) + st.err; }
    if ((g.phase === 'serve' || g.phase === 'point') && g.server === BOT) tz = s * (COURT.hl + 0.7);
    const maxv = 5.4;
    const dx = clamp(tx - p.x, -maxv * dt, maxv * dt);
    p.vx = dx / dt; p.x += dx; p.z += clamp(tz - p.z, -maxv * dt, maxv * dt);
    if (++st.tick % 3 === 0) io.to(room.code).emit('tpos', { gid: g.id, id: BOT, x: +p.x.toFixed(2), z: +p.z.toFixed(2), moving: Math.abs(dx) > 0.01 });
    if (g.phase === 'play' && b.vz * s > 0 && Math.random() < 0.004) (g.swingAt ||= {})[BOT] = Date.now(); // às vezes tenta um golpe forte
  }

  function onRacePos(room, id, d) { (room.raceProg ||= {})[id] = d; }

  return { BOT, add, remove, has, humanOf, onState, onChat, onEmote, tennis, onRacePos, _poolMove: poolMove };
};
