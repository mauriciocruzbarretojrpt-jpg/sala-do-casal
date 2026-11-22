// Minijogos de turno no estilo dos jogos mobile do gênero:
// Ligue 4 (peça caindo), Memória (flip 3D + combo), Pedra-Papel-Tesoura (melhor de 3 com "jo-ken-pô"),
// Sintonia (10 perguntas + compatibilidade) e Desenhe e Adivinhe (3 palavras, cronômetro, dicas, banco de letras).
const prevOf = (g) => (prevGame && prevGame.id === g.id ? prevGame : null);

// ======================= LIGUE 4 =======================
function lig4Line(b, who) {
  const at = (r, c) => (r >= 0 && r < 6 && c >= 0 && c < 7 ? b[r * 7 + c] : null);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    if (at(r, c) !== who) continue;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [0, 1, 2, 3].map((k) => [r + dr * k, c + dc * k]);
      if (cells.every(([rr, cc]) => at(rr, cc) === who)) return cells.map(([rr, cc]) => rr * 7 + cc);
    }
  }
  return [];
}
RENDER.lig4 = function () {
  const g = game, end = endText(g), prev = prevOf(g);
  setStatus(end || turnText(g) + ` <span style="color:${color(g.turn)}">●</span>`); showRestart(!!end);
  const win = g.winner ? lig4Line(g.board, g.winner) : [];
  const dropped = prev ? g.board.findIndex((v, i) => v && !prev.board[i]) : -1;
  const myTurn = !end && g.turn === me;
  let html = `<div class="lig4-board ${myTurn ? 'my-turn' : ''}" style="--mine:${color(me)}">`;
  for (let c = 0; c < 7; c++) {
    html += `<button class="l4-col" data-c="${c}" ${myTurn && !g.board[c] ? '' : 'disabled'}><i class="l4-ghost"></i>`;
    for (let r = 0; r < 6; r++) {
      const i = r * 7 + c, v = g.board[i];
      html += `<span class="l4-slot">${v ? `<i class="disc ${i === dropped ? 'drop' : ''} ${win.includes(i) ? 'win' : ''}" style="background:${color(v)};--rows:${r + 1}"></i>` : ''}</span>`;
    }
    html += '</button>';
  }
  $('#board').innerHTML = html + '</div>';
  $('#board').querySelectorAll('.l4-col').forEach((b) => (b.onclick = () => move({ c: +b.dataset.c })));
};

// ======================= MEMÓRIA =======================
let memCombo = { id: null, n: 0 };
RENDER.memoria = function () {
  const g = game, end = endText(g), prev = prevOf(g);
  // combo: pares seguidos do mesmo jogador
  if (memCombo.id !== g.id) memCombo = { id: g.id, n: 0 };
  if (prev) {
    if (g.matched.length > prev.matched.length) memCombo.n++;
    else if (g.turn !== prev.turn) memCombo.n = 0;
  }
  const pairs = g.players.map((p) => `<span style="color:${color(p)}">${esc(name(p))}: ${g.scores[p]} 🃏</span>`).join(' · ');
  const combo = memCombo.n >= 2 ? ` <b class="combo">Combo x${memCombo.n}! 🔥</b>` : '';
  setStatus(`${end || turnText(g)}${combo}<br><small>${pairs}</small>`); showRestart(!!end);
  const was = (i) => (prev ? prev.cards[i] !== null : false);
  $('#board').innerHTML = `<div class="grid memoria">${g.cards.map((c, i) => {
    const face = c ?? (prev ? prev.cards[i] : null) ?? '';
    return `<button class="mcard ${was(i) ? 'up' : ''} ${g.matched.includes(i) ? 'done' : ''}" data-i="${i}"><span class="inner"><span class="face back">💗</span><span class="face front">${face}</span></span></button>`;
  }).join('')}</div>`;
  const cards = [...$('#board').querySelectorAll('.mcard')];
  requestAnimationFrame(() => requestAnimationFrame(() => cards.forEach((el, i) => el.classList.toggle('up', g.cards[i] !== null)))); // anima o flip
  cards.forEach((el) => (el.onclick = () => { if (g.turn === me && !end && !el.classList.contains('up')) move({ i: +el.dataset.i }); }));
};

// ======================= PEDRA, PAPEL E TESOURA (melhor de 3) =======================
let pptAnim = null, pptParty = null;
RENDER.ppt = function () {
  const g = game, prev = prevOf(g), op = g.players.find((p) => p !== me), mine = g.choices[me];
  const dots = (id) => [0, 1].map((k) => `<i class="pdot ${g.wins[id] > k ? 'on' : ''}" style="--c:${color(id)}"></i>`).join('');
  const head = `<div class="ppt-head"><span>${esc(name(me))} ${dots(me)}</span><b>Rodada ${g.round}</b><span>${dots(op)} ${esc(name(op))}</span></div>`;
  if (g.reveal) {
    const key = `${g.id}:${g.round}`;
    const fresh = !prev?.reveal && pptAnim !== key;
    const show = () => {
      if (game?.id !== g.id || !game.reveal) return;
      const rw = g.reveal.roundWinner;
      setStatus(g.winner ? endText(g) : rw ? (rw === me ? 'Você levou a rodada! 💪' : `${esc(name(rw))} levou a rodada!`) : 'Empatou a rodada! 🤝');
      showRestart(!!g.winner);
      if (g.winner && pptParty !== g.id) {
        pptParty = g.id;
        if (g.winner === me) { FX.play('win'); FX.confetti(); } else { FX.play('lose'); FX.shake($('#board'), 6); }
      }
      $('#board').innerHTML = head + `<div class="reveal">${[me, op].map((p) => `<div class="${rw === p ? 'won' : rw ? 'lost' : ''}"><span>${PPT[g.reveal[p]]}</span>${esc(name(p))}</div>`).join('')}</div>`
        + (g.winner ? '' : '<p class="muted center">Próxima rodada já vem…</p>');
    };
    if (fresh) { // "Jo… Ken… Pô!"
      pptAnim = key; showRestart(false); setStatus('Jo… Ken… Pô!');
      $('#board').innerHTML = head + `<div class="reveal shaking"><div><span>✊</span>${esc(name(me))}</div><div><span>✊</span>${esc(name(op))}</div></div>`;
      FX.play('tick'); setTimeout(() => FX.play('tick'), 380); setTimeout(() => { FX.play('reveal'); show(); }, 1150);
    } else if (pptAnim !== key || !$('#board .shaking')) show();
    return;
  }
  showRestart(false);
  setStatus(mine ? (g.choices[op] ? '' : `Esperando ${esc(name(op))} escolher… 🤫`) : (g.choices[op] ? `${esc(name(op))} já escolheu! Sua vez` : 'Escolha em segredo!'));
  $('#board').innerHTML = head + `<div class="ppt-choices">${Object.entries(PPT).map(([k, e]) =>
    `<button data-k="${k}" class="${mine === k ? 'sel' : ''}" ${mine ? 'disabled' : ''} title="${k}">${e}<small>${k}</small></button>`).join('')}</div>`;
  $('#board').querySelectorAll('.ppt-choices button').forEach((b) => (b.onclick = () => move({ choice: b.dataset.k })));
};

// ======================= SINTONIA (10 perguntas + compatibilidade) =======================
let sintoniaParty = null;
RENDER.sintonia = function () {
  const g = game, mine = g.answers[me], op = g.players.find((p) => p !== me);
  if (g.done) {
    const pct = g.percent, msg = pct >= 80 ? 'Almas gêmeas! 💞' : pct >= 60 ? 'Muito em sintonia! 💖' : pct >= 40 ? 'Combinam bem, mas têm surpresas 😏' : 'Opostos se atraem! 😂';
    setStatus('Resultado da Sintonia'); showRestart(true);
    $('#board').innerHTML = `<div class="sint-result"><div class="sint-heart" style="--p:${pct}"><b>${pct}%</b></div><h3>${msg}</h3>
      <p class="muted">${g.matches} de ${g.total} respostas iguais</p></div>`;
    if (sintoniaParty !== g.id) { sintoniaParty = g.id; if (pct >= 60) FX.confetti(); FX.play(pct >= 60 ? 'win' : 'reveal'); }
    return;
  }
  showRestart(false);
  let html = `<div class="sint-progress"><i style="width:${((g.round - 1) / g.total) * 100}%"></i></div>
    <p class="muted center">Pergunta ${g.round} de ${g.total} · ${g.matches} 💞 em comum</p><div class="question">${esc(g.question)}</div>`;
  if (g.reveal) {
    setStatus(g.reveal.match ? 'Sintonia total! 💖' : 'Ih, discordaram! 😅');
    html += `<div class="reveal">${g.players.map((p) => `<div>${esc(name(p))} disse<span style="font-size:28px;color:${color(g.reveal[p])}">${esc(name(g.reveal[p]))}</span></div>`).join('')}</div>
      <div class="center"><button id="nextQ" class="btn primary">${g.round >= g.total ? 'Ver resultado 💞' : 'Próxima pergunta ➜'}</button></div>`;
  } else {
    setStatus(mine ? `Esperando ${esc(name(op))} responder… 🤫` : (g.answers[op] ? `${esc(name(op))} já respondeu!` : 'Responda em segredo'));
    html += `<div class="who">${g.players.map((p) => `<button data-p="${p}" class="${mine === p ? 'sel' : ''}" style="background:${color(p)}">${esc(name(p))}${p === me ? ' (eu)' : ''}</button>`).join('')}</div>`;
  }
  $('#board').innerHTML = html;
  $('#board').querySelectorAll('.who button').forEach((b) => (b.onclick = () => move({ who: b.dataset.p })));
  if ($('#nextQ')) $('#nextQ').onclick = () => move({ next: true });
};

// ======================= DESENHE E ADIVINHE =======================
let ctx = null, penColor = '#3b2333', penSize = 8;
const PALETTE = ['#3b2333', '#ff4d8d', '#ff9f1c', '#ffd23f', '#2fb67c', '#6c8cff', '#9b5de5', '#8d5524', '#ffffff'];
const dz = { key: null, timer: null, endLocal: 0, answer: [], used: [], sid: 0 };

function drawSeg(s) {
  if (!ctx) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.strokeStyle = s.c; ctx.lineWidth = s.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(s.x0 * W, s.y0 * H); ctx.lineTo(s.x1 * W, s.y1 * H); ctx.stroke();
}
socket.on('stroke', drawSeg);
socket.on('strokes', (list) => { if (!ctx) return; ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); list.forEach(drawSeg); });
socket.on('guessWrong', () => {
  if (game?.type !== 'desenho') return;
  FX.play('lostPoint'); FX.shake($('#answer'), 6);
  dz.answer = []; dz.used = []; renderGuessInput();
});

RENDER.desenho = function () {
  const g = game, drawer = g.drawer === me;
  const key = `${g.id}:${g.phase}:${drawer}`;
  if (g.timeLeft) dz.endLocal = Date.now() + g.timeLeft;
  showRestart(g.phase === 'over');
  if (g.phase === 'choose') {
    setStatus(drawer ? 'Escolha a palavra que você vai desenhar ✏️' : `${esc(name(g.drawer))} está escolhendo a palavra… ✏️`);
    if (dz.key === key) return; dz.key = key;
    clearInterval(dz.timer); ctx = null;
    $('#board').innerHTML = drawer
      ? `<div class="word-pick">${g.options.map((w, i) => `<button data-i="${i}" class="lvl${i}"><small>${['Fácil', 'Média', 'Difícil'][i]}</small><b>${esc(w)}</b><span>${'⭐'.repeat(i + 1)}</span></button>`).join('')}</div>`
      : '<div class="wait-pick">✏️<p>Prepare-se para adivinhar!</p></div>';
    $('#board').querySelectorAll('.word-pick button').forEach((b) => (b.onclick = () => { FX.play('pop'); move({ choose: +b.dataset.i }); }));
    return;
  }
  if (g.phase === 'over') setStatus(g.msg ? esc(g.msg) : 'Fim da rodada');
  else setStatus(drawer ? `Desenhe: <b>${esc(g.word)}</b> (${'⭐'.repeat(g.points)}) — sem escrever letras 😜` : `Adivinhe o desenho de ${esc(name(g.drawer))}! ${'⭐'.repeat(g.points)}`);
  if (dz.key !== key) mountDraw(g, drawer, key);
  if (!drawer && g.phase === 'draw') renderGuessInput();
  if (g.phase === 'over') { $('#guessArea') && ($('#guessArea').innerHTML = `<div class="final-word">${esc(g.word || '')}</div>`); clearInterval(dz.timer); $('#tbar') && ($('#tbar').style.width = '0%'); }
};

function mountDraw(g, drawer, key) {
  dz.key = key; dz.answer = []; dz.used = [];
  clearInterval(dz.timer);
  const tools = drawer && g.phase === 'draw' ? `<div class="tools">
      ${PALETTE.map((c) => `<button class="swatch ${c === penColor ? 'sel' : ''}" data-c="${c}" style="background:${c}" title="${c === '#ffffff' ? 'borracha' : ''}"></button>`).join('')}
      <span class="sizes">${[4, 8, 16].map((s) => `<button class="size ${s === penSize ? 'sel' : ''}" data-s="${s}"><i style="width:${s + 4}px;height:${s + 4}px"></i></button>`).join('')}</span>
      <button id="undoCv" class="btn ghost">↩️</button><button id="clearCv" class="btn ghost">🧽</button></div>` : '';
  $('#board').innerHTML = `<div class="draw-wrap">
      <div class="timer"><i id="tbar"></i><span id="tsec"></span></div>
      <canvas id="cv" width="800" height="600"></canvas>${tools}
      <div id="guessArea"></div></div>`;
  const cv = $('#cv'); ctx = cv.getContext('2d');
  socket.emit('needStrokes');
  dz.timer = setInterval(() => {
    const left = Math.max(0, dz.endLocal - Date.now());
    const bar = $('#tbar'); if (!bar) return clearInterval(dz.timer);
    bar.style.width = `${(left / 80000) * 100}%`; bar.classList.toggle('low', left < 15000);
    $('#tsec').textContent = game?.phase === 'draw' ? `${Math.ceil(left / 1000)}s` : '';
  }, 250);
  if (!drawer || g.phase !== 'draw') return;
  document.querySelectorAll('.swatch').forEach((b) => (b.onclick = () => { penColor = b.dataset.c; document.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('sel', x === b)); }));
  document.querySelectorAll('.size').forEach((b) => (b.onclick = () => { penSize = +b.dataset.s; document.querySelectorAll('.size').forEach((x) => x.classList.toggle('sel', x === b)); }));
  $('#undoCv').onclick = () => move({ undo: true });
  $('#clearCv').onclick = () => move({ clear: true });
  let last = null;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  const send = (s) => { drawSeg(s); socket.emit('stroke', s); };
  cv.onpointerdown = (e) => {
    if (game?.phase !== 'draw') return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {}
    dz.sid++; last = pos(e); send({ x0: last.x, y0: last.y, x1: last.x + 0.0001, y1: last.y, c: penColor, w: penSize, sid: `${me}:${dz.sid}` });
  };
  cv.onpointermove = (e) => { if (!last) return; const p = pos(e); send({ x0: last.x, y0: last.y, x1: p.x, y1: p.y, c: penColor, w: penSize, sid: `${me}:${dz.sid}` }); last = p; };
  cv.onpointerup = cv.onpointercancel = () => (last = null);
}

// resposta montada com o banco de letras (como nos jogos de desenho mobile)
function renderGuessInput() {
  const g = game, area = $('#guessArea'); if (!area || !g.mask) return;
  const slots = g.mask.map((m) => (/[\s-]/.test(m) ? null : m)); // null = espaço
  let k = 0;
  const html = `<div id="answer" class="answer">${slots.map((m) => {
    if (m === null) return '<span class="gap"></span>';
    const ch = dz.answer[k++];
    return `<span class="aslot ${ch ? 'filled' : ''}">${ch || (m !== '_' ? `<em>${m}</em>` : '')}</span>`;
  }).join('')}</div>
    <div class="bank">${g.bank.map((L, i) => `<button class="tile" data-i="${i}" ${dz.used.includes(i) ? 'disabled' : ''}>${L}</button>`).join('')}
      <button class="tile del" id="delTile">⌫</button></div>`;
  area.innerHTML = html;
  const need = slots.filter((s) => s !== null).length;
  area.querySelectorAll('.tile[data-i]').forEach((b) => (b.onclick = () => {
    if (dz.answer.length >= need) return;
    FX.play('click'); dz.used.push(+b.dataset.i); dz.answer.push(g.bank[+b.dataset.i]);
    if (dz.answer.length === need) { // completou: envia o palpite
      let j = 0; const guess = g.mask.map((m) => (/[\s-]/.test(m) ? m : dz.answer[j++])).join('');
      socket.emit('chat', guess.toLowerCase());
    }
    renderGuessInput();
  }));
  $('#delTile').onclick = () => { dz.answer.pop(); dz.used.pop(); renderGuessInput(); };
}
