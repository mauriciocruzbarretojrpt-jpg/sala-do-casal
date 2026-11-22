const socket = io();
const $ = (s) => document.querySelector(s);
let me = null, players = {}, game = null;

const NAMES = { velha: 'Jogo da Velha', lig4: 'Ligue 4', ppt: 'Pedra, Papel e Tesoura', memoria: 'Jogo da Memória', desenho: 'Desenhe e Adivinhe', sintonia: 'Sintonia do Casal', corrida: 'Corrida 🏎️', bilhar: 'Bilhar 🎱', tenis: 'Tênis 🎾' };
let mountedId = null; // id da partida cujo canvas está montado
const isMobile = () => matchMedia('(max-width: 800px)').matches;
window.addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });
const PPT = { pedra: '✊', papel: '✋', tesoura: '✌️' };
const name = (id) => players[id]?.name || '???';
const color = (id) => players[id]?.color || '#ccc';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Entrar ----------
const saved = JSON.parse(localStorage.getItem('salaCasal') || '{}');
$('#name').value = saved.name || '';
$('#room').value = new URLSearchParams(location.search).get('sala') || saved.room || '';
if (['ela3d', 'moletom'].includes(saved.avatar)) $('#avatar').value = saved.avatar;

$('#loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = { name: $('#name').value, room: $('#room').value, avatar: $('#avatar').value };
  socket.emit('join', data, (res) => {
    if (res.error) return ($('#loginError').textContent = res.error);
    localStorage.setItem('salaCasal', JSON.stringify(data));
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#roomCode').textContent = data.room.toUpperCase();
    $('#messages').innerHTML = '';
    res.chat.forEach(addMsg);
  });
});

socket.on('disconnect', () => addMsg({ system: true, text: 'Conexão perdida… recarregue a página 🔌' }));

// ---------- Chat ----------
function addMsg(m) {
  const box = $('#messages');
  const el = document.createElement('div');
  const time = new Date(m.ts || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (m.system) { el.className = 'msg system'; el.textContent = m.text; }
  else {
    el.className = 'msg' + (m.from === me ? ' mine' : '');
    el.innerHTML = `<b style="color:${m.color}">${esc(m.name)}<time>${time}</time></b>${esc(m.text)}`;
  }
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  if (document.body.classList.contains('chat-closed') && !m.system && m.from !== me) {
    unread++; $('#unread').textContent = unread; $('#unread').classList.remove('hidden');
  }
}
let unread = 0;
function setChat(open) {
  document.body.classList.toggle('chat-closed', !open);
  if (open) { unread = 0; $('#unread').classList.add('hidden'); $('#messages').scrollTop = 1e9; }
}
$('#chatToggle').addEventListener('click', () => setChat(document.body.classList.contains('chat-closed')));
socket.on('chat', (m) => {
  addMsg(m); window.dispatchEvent(new CustomEvent('roomchat', { detail: m }));
  if (m.from && m.from !== me) { $('#typing').textContent = ''; FX.play('msg'); }
});

$('#chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = $('#chatInput').value.trim();
  if (t) socket.emit('chat', t);
  $('#chatInput').value = '';
  $('#emojiPanel').classList.add('hidden');
});
let lastTyping = 0;
$('#chatInput').addEventListener('input', () => { if (Date.now() - lastTyping > 1500) { lastTyping = Date.now(); socket.emit('typing'); } });
let typingTimer;
socket.on('typing', (n) => { $('#typing').textContent = `${n} está digitando…`; clearTimeout(typingTimer); typingTimer = setTimeout(() => ($('#typing').textContent = ''), 2500); });

const EMOJI_LIST = '😍🥰😘❤️💖💕💞💋😂🤣😊😉😜🤗😳🥺😢😭😡😴🤔👀🙈🔥✨🎉👏💪👍🌹🍕🍫🐱🐶🌙⭐'.match(/\p{Extended_Pictographic}(️)?/gu);
$('#emojiPanel').innerHTML = EMOJI_LIST.map((e) => `<button type="button">${e}</button>`).join('');
$('#emojiPanel').addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') { $('#chatInput').value += e.target.textContent; $('#chatInput').focus(); } });
$('#emojiBtn').addEventListener('click', () => $('#emojiPanel').classList.toggle('hidden'));

// ---------- Estado ----------
document.querySelectorAll('.game-card').forEach((b) => b.addEventListener('click', () => socket.emit('start', b.dataset.game)));
$('#exitBtn').addEventListener('click', () => socket.emit('exitGame'));
$('#restartBtn').addEventListener('click', () => socket.emit('restart'));
const move = (m) => socket.emit('move', m);

// ---------- Robô, som ----------
const hasBot = () => !!players.bot;
$('#botCta').addEventListener('click', () => { FX.play('pop'); socket.emit('addBot'); });
$('#botBtn').addEventListener('click', () => { FX.play('click'); socket.emit(hasBot() ? 'removeBot' : 'addBot'); });
const muteIcon = () => ($('#muteBtn').textContent = FX.muted ? '🔇' : '🔊');
muteIcon();
$('#muteBtn').addEventListener('click', () => { FX.toggleMute(); muteIcon(); FX.play('click'); });
document.addEventListener('click', (e) => { if (e.target.closest('.game-card, #restartBtn, #exitBtn')) FX.play('click'); });

// tela cheia (e, no Android, gira para deitado nos jogos de ação)
$('#fsBtn').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) return void (await document.exitFullscreen());
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    if (['corrida', 'bilhar', 'tenis'].includes(game?.type) && screen.orientation?.lock) await screen.orientation.lock('landscape').catch(() => {});
  } catch {}
});

let stats = {};
let prevGame = null;
// Feedback (juice) a cada mudança de estado: sons, confete, tremor
function feedback(prev, g) {
  if (!g || !prev || prev.id !== g.id) return;
  const ended = (x) => x.winner || x.draw;
  if (!ended(prev) && ended(g) && g.type !== 'ppt') { // no PPT a comemoração vem depois do "jo-ken-pô"
    if (g.draw) FX.play('draw');
    else if (g.winner === me) { FX.play('win'); FX.confetti(); }
    else { FX.play('lose'); FX.shake($('#board'), 6); }
    return;
  }
  switch (g.type) {
    case 'velha': case 'lig4': if (g.board.filter(Boolean).length > prev.board.filter(Boolean).length) FX.play('place'); break;
    case 'memoria':
      if (g.matched.length > prev.matched.length) FX.play('match');
      else if (g.open.length > prev.open.length) FX.play('flip');
      break;
    case 'ppt': if (!g.reveal && Object.keys(g.choices).length > Object.keys(prev.choices).length) FX.play('click'); break;
    case 'sintonia':
      if (g.reveal && !prev.reveal) { if (g.reveal.match) { FX.play('match'); FX.confetti(40); } else FX.play('lostPoint'); }
      break;
  }
}

socket.on('state', (s) => {
  me = s.you; players = s.players;
  prevGame = game; game = s.game; stats = s.stats || {};
  feedback(prevGame, game);
  document.body.classList.toggle('in-game', !!game);
  if (game && !prevGame && isMobile()) setChat(false); // no celular, o jogo ocupa a tela toda
  const ids = Object.keys(players);
  $('#playersBar').innerHTML = ids.map((id) => `<span class="chip" style="background:${color(id)}">● ${esc(name(id))}${id === me ? ' (você)' : ''}</span>`).join('')
    + (ids.length < 2 ? '<span class="chip empty">esperando seu amor…</span>' : '');
  $('#waitMsg').textContent = ids.length < 2 ? `Mande o código da sala para seu amor entrar 💌` : '';
  $('#botCta').classList.toggle('hidden', ids.length >= 2);
  $('#botBtn').classList.toggle('hidden', !(ids.length < 2 || hasBot()));
  $('#botBtn').textContent = hasBot() ? '🤖 Tirar robô' : '🤖';
  $('#botBtn').title = hasBot() ? 'Tirar o robô da sala' : 'Chamar o robô para jogar';
  $('#lobby').classList.toggle('hidden', !!game);
  $('#gameArea').classList.toggle('hidden', !game);
  document.querySelector('.stage').classList.toggle('in-lobby', !game);
  window.dispatchEvent(new CustomEvent('roomstate'));
  if (!game) { mountedId = null; return; }
  $('#gameTitle').textContent = NAMES[game.type];
  $('#score').innerHTML = game.players.map((id) => `<span class="chip" style="background:${color(id)}">${esc(name(id))}: ${game.scores[id]}</span>`).join('');
  if (!['desenho', 'corrida', 'bilhar', 'tenis'].includes(game.type)) mountedId = null;
  RENDER[game.type]();
});

const setStatus = (html) => ($('#status').innerHTML = html);
const turnText = (g) => (g.turn === me ? 'Sua vez! 💫' : `Vez de ${esc(name(g.turn))}…`);
function endText(g) {
  if (g.draw) return 'Empate! 🤝';
  if (g.winner) return g.winner === me ? 'Você venceu! 🏆' : `${esc(name(g.winner))} venceu! 🏆`;
  return null;
}
const showRestart = (v) => $('#restartBtn').classList.toggle('hidden', !v);

// ---------- Renderização dos jogos ----------
const RENDER = {
  velha() {
    const g = game; const end = endText(g);
    setStatus(end || turnText(g)); showRestart(!!end);
    const sym = (id) => (id === g.players[0] ? '❌' : '⭕');
    const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const winLine = g.winner ? LINES.find((l) => l.every((i) => g.board[i] === g.winner)) || [] : [];
    const placed = prevGame?.id === g.id ? g.board.findIndex((v, i) => v && !prevGame.board[i]) : -1;
    $('#board').innerHTML = `<div class="grid velha">${g.board.map((v, i) =>
      `<button class="cell ${winLine.includes(i) ? 'win' : ''}" data-i="${i}" ${v || end || g.turn !== me ? 'disabled' : ''}>${v ? `<span class="${i === placed ? 'pop-in' : ''}">${sym(v)}</span>` : ''}</button>`).join('')}</div>`;
    $('#board').querySelectorAll('.cell').forEach((c) => (c.onclick = () => move({ i: +c.dataset.i })));
  },

};
// lig4, ppt, memoria, desenho e sintonia ficam em minigames.js
