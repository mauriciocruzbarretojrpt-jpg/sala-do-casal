// Avatares 3D feitos em código. Cada builder devolve { root, animate(phase, moving) }.
import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });

function canvasTex(size, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  return t;
}

// Estampa de oncinha: fundo creme, manchas marrons com miolo caramelo
const leopardTex = () => canvasTex(512, (x, s) => {
  x.fillStyle = '#e4dbd2'; x.fillRect(0, 0, s, s);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 55; i++) {
    const cx = rnd() * s, cy = rnd() * s, r = 16 + rnd() * 16, rot = rnd() * 3;
    for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {
      x.save(); x.translate(cx + ox, cy + oy); x.rotate(rot);
      x.fillStyle = '#9c8270'; x.beginPath(); x.ellipse(0, 0, r * 0.72, r * 0.52, 0, 0, 7); x.fill();
      x.strokeStyle = '#33251c'; x.lineWidth = 8; x.setLineDash([r * 0.9, r * 0.35]);
      x.beginPath(); x.ellipse(0, 0, r, r * 0.75, 0, 0, 7); x.stroke();
      x.restore();
    }
  }
}, [2, 1]);

// Saia verde-oliva/marrom com pregas
const pleatTex = () => canvasTex(256, (x, s) => {
  x.fillStyle = '#4e4630'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 12; i++) {
    const g = x.createLinearGradient(i * (s / 12), 0, (i + 1) * (s / 12), 0);
    g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(0.5, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(i * (s / 12), 0, s / 12, s);
  }
  x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, s, 18); // cós
});

// membro pendurado num pivô (articulação no topo)
function limb(len, r1, r2, material) {
  const pivot = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 14), material);
  m.position.y = -len / 2; pivot.add(m);
  const joint = new THREE.Mesh(new THREE.SphereGeometry(r1, 12, 10), material); pivot.add(joint);
  const end = new THREE.Group(); end.position.y = -len; pivot.add(end);
  return { pivot, end };
}

// ---------- Avatar "Ela": blusinha de oncinha, saia marrom, tiara bege, trança dourada ----------
export function buildOncinha() {
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
  const skin = mat('#7a4a32', { roughness: 0.5 });
  const top = new THREE.MeshStandardMaterial({ map: leopardTex(), roughness: 0.85 });
  const skirt = new THREE.MeshStandardMaterial({ map: pleatTex(), roughness: 0.9, side: THREE.DoubleSide });
  const sandal = mat('#b06d36'), band = mat('#d9c8ae', { roughness: 0.95 });
  const hair = mat('#1a110c', { roughness: 0.9 }), braid = mat('#b98a4c', { roughness: 0.55 });

  // pernas
  const legs = [], knees = [];
  [-1, 1].forEach((s) => {
    const thigh = limb(0.42, 0.097, 0.068, skin);
    thigh.pivot.position.set(s * 0.1, 0.86, 0);
    const shin = limb(0.4, 0.062, 0.042, skin);
    thigh.end.add(shin.pivot);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.2), skin); foot.position.set(0, -0.415, 0.05);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.24), sandal); sole.position.set(0, -0.445, 0.05);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.035, 0.07), sandal); strap.position.set(0, -0.4, 0.09);
    shin.end.parent.add(foot, sole, strap);
    rig.add(thigh.pivot); legs.push(thigh.pivot); knees.push(shin.pivot);
  });

  // quadril + saia
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.14, 20), mat('#3e3726'));
  pelvis.position.y = 0.92; rig.add(pelvis);
  const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.33, 0.3, 28, 1, true), skirt);
  sk.position.y = 0.95; sk.scale.z = 0.85; rig.add(sk);

  // tronco (regata de oncinha)
  const torsoGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.19, 0), new THREE.Vector2(0.17, 0.12), new THREE.Vector2(0.185, 0.26),
    new THREE.Vector2(0.19, 0.33), new THREE.Vector2(0.15, 0.4), new THREE.Vector2(0.07, 0.43),
  ], 28);
  const torso = new THREE.Mesh(torsoGeo, top); torso.position.y = 1.08; torso.scale.z = 0.78; rig.add(torso);
  // ombros e pescoço de pele (regata deixa à mostra)
  [-1, 1].forEach((s) => { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), skin); sh.position.set(s * 0.19, 1.43, 0); rig.add(sh); });
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.065, 0.14, 12), skin); neck.position.y = 1.54; rig.add(neck);

  // braços
  const arms = [];
  [-1, 1].forEach((s) => {
    const up = limb(0.29, 0.05, 0.043, skin); up.pivot.position.set(s * 0.23, 1.43, 0); up.pivot.rotation.z = s * 0.14;
    const fore = limb(0.27, 0.042, 0.034, skin); fore.pivot.rotation.x = -0.12; up.end.add(fore.pivot);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin); hand.scale.set(0.8, 1.2, 0.6); hand.position.y = -0.02; fore.end.add(hand);
    rig.add(up.pivot); arms.push(up.pivot);
  });

  // cabeça
  const head = new THREE.Group(); head.position.y = 1.76; rig.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 28, 22), skin); skull.scale.set(0.95, 1.08, 1); head.add(skull);
  // cabelo preso para trás: hemisfério cuja borda coincide com a tiara
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.205, 28, 22, 0, Math.PI * 2, 0, Math.PI * 0.54), hair);
  cap.scale.set(0.95, 1.08, 1); cap.rotation.x = -0.62; head.add(cap);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), hair); bun.position.set(0, 0.02, -0.2); head.add(bun);
  // tiara: círculo inclinado passando pela linha do cabelo (frente-alto) e atrás da cabeça
  const hb = new THREE.Mesh(new THREE.TorusGeometry(0.207, 0.03, 10, 36), band);
  hb.rotation.x = 0.95; hb.scale.set(0.96, 1.04, 1); head.add(hb);
  const eyeM = new THREE.MeshBasicMaterial({ color: '#1a0f0a' });
  [-0.068, 0.068].forEach((x) => {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: '#f5efe8' }));
    white.position.set(x, 0.01, 0.175); white.scale.z = 0.5; head.add(white);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), eyeM); e.position.set(x, 0.01, 0.19); head.add(e);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.01), eyeM); brow.position.set(x, 0.065, 0.19); brow.rotation.z = -Math.sign(x) * 0.15; head.add(brow);
  });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), skin); nose.position.set(0, -0.035, 0.2); nose.scale.set(1.2, 0.8, 0.8); head.add(nose);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 6, 16, Math.PI), mat('#7a2f35'));
  smile.rotation.z = Math.PI; smile.position.set(0, -0.08, 0.18); head.add(smile);
  [-1, 1].forEach((s) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 14), mat('#e2c26a', { metalness: 0.8, roughness: 0.3 }));
    ring.position.set(s * 0.19, -0.07, 0.0); ring.rotation.y = Math.PI / 2; head.add(ring);
  });

  // trança longa dourada caindo pelo lado esquerdo dela (lado direito de quem olha de frente)
  const braidG = new THREE.Group(); braidG.position.set(0.12, 1.84, -0.12); rig.add(braidG);
  const N = 18;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.048 - t * 0.02, 10, 8), braid);
    b.position.set(0.06 + Math.sin(t * 2.2) * 0.06, -t * 0.88, -0.02 + t * 0.03);
    b.scale.set(1, 1.35, 1); b.rotation.z = (i % 2 ? 0.4 : -0.4);
    braidG.add(b);
  }

  function animate(phase, moving) {
    const p = phase * 0.55;
    const sw = moving ? Math.sin(p) * 0.55 : 0;
    legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
    knees[0].rotation.x = moving ? Math.max(0, Math.sin(p - 1)) * 0.7 : 0;
    knees[1].rotation.x = moving ? Math.max(0, -Math.sin(p - 1)) * 0.7 : 0;
    arms[0].rotation.x = -sw * 0.75; arms[1].rotation.x = sw * 0.75;
    rig.position.y = moving ? Math.abs(Math.cos(p)) * 0.035 : Math.sin(phase * 0.8) * 0.006;
    rig.rotation.y = moving ? Math.sin(p) * 0.06 : 0;
    braidG.rotation.z = Math.sin(p) * (moving ? 0.1 : 0.02);
    braidG.rotation.x = moving ? -0.12 : 0;
    head.rotation.z = moving ? 0 : Math.sin(phase * 0.4) * 0.04;
  }
  return { root, animate };
}

// Tricô canelado (gorro)
const ribTex = (base) => canvasTex(128, (x, s) => {
  x.fillStyle = base; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.07)'; x.fillRect(i * 8, 0, 8, s); }
  for (let j = 0; j < s; j += 4) { x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(0, j, s, 1); }
}, [4, 1]);
// Moletom: tecido levemente texturizado
const fleeceTex = (base) => canvasTex(128, (x, s) => {
  x.fillStyle = base; x.fillRect(0, 0, s, s);
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) { x.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.04)'; x.fillRect(rnd() * s, rnd() * s, 2, 2); }
}, [3, 2]);

// ---------- Avatar "Ele": gorro marrom, fone preto, bigode, moletom marrom, calça cinza, tênis branco ----------
export function buildMoletom() {
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
  const skin = mat('#e2ad8a', { roughness: 0.55 });
  const hoodie = new THREE.MeshStandardMaterial({ map: fleeceTex('#6e4232'), roughness: 0.95 });
  const hoodieDark = mat('#5a3428', { roughness: 0.95 });
  const pants = new THREE.MeshStandardMaterial({ map: fleeceTex('#8b8e94'), roughness: 0.95 });
  const shoe = mat('#f4f4f2', { roughness: 0.5 }), sole = mat('#c9c9c9');
  const beanie = new THREE.MeshStandardMaterial({ map: ribTex('#6f5246'), roughness: 1 });
  const black = mat('#1b1b1e', { roughness: 0.4 }), hairM = mat('#24170f', { roughness: 0.9 });

  // pernas (calça cinza + tênis branco)
  const legs = [], knees = [];
  [-1, 1].forEach((s) => {
    const thigh = limb(0.43, 0.105, 0.085, pants); thigh.pivot.position.set(s * 0.115, 0.88, 0);
    const shin = limb(0.4, 0.083, 0.07, pants); thigh.end.add(shin.pivot);
    const sneaker = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.16, 4, 10), shoe);
    sneaker.rotation.x = Math.PI / 2; sneaker.scale.set(1.15, 1, 0.75); sneaker.position.set(0, -0.42, 0.05);
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.3), sole); sl.position.set(0, -0.465, 0.05);
    const lace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.08), mat('#ddd')); lace.position.set(0, -0.37, 0.09);
    shin.pivot.add(sneaker, sl, lace);
    rig.add(thigh.pivot); legs.push(thigh.pivot); knees.push(shin.pivot);
  });
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.16, 20), pants); pelvis.position.y = 0.92; pelvis.scale.z = 0.8; rig.add(pelvis);

  // moletom
  const torsoGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.22, 0), new THREE.Vector2(0.235, 0.06), new THREE.Vector2(0.23, 0.2),
    new THREE.Vector2(0.25, 0.38), new THREE.Vector2(0.22, 0.47), new THREE.Vector2(0.09, 0.52),
  ], 28);
  const torso = new THREE.Mesh(torsoGeo, hoodie); torso.position.y = 0.96; torso.scale.z = 0.72; rig.add(torso);
  const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.242, 0.238, 0.07, 28), hoodieDark); rib.position.y = 0.985; rib.scale.z = 0.74; rig.add(rib);
  [-1, 1].forEach((s) => { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), hoodie); sh.position.set(s * 0.235, 1.41, 0); rig.add(sh); });
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.13, 0.02), hoodieDark); pocket.position.set(0, 1.1, 0.165); rig.add(pocket);
  // capuz caído nas costas
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), hoodie);
  hood.scale.set(1.35, 0.65, 0.55); hood.position.set(0, 1.45, -0.14); rig.add(hood);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.03, 8, 20), hoodieDark);
  collar.rotation.x = Math.PI / 2; collar.position.y = 1.475; collar.scale.y = 0.8; rig.add(collar);
  [-0.045, 0.045].forEach((x) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.14, 6), mat('#d8c9b8')); c.position.set(x, 1.37, 0.17); rig.add(c); });
  // cordão (crachá) preto em V
  [-1, 1].forEach((s) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.008), black);
    strap.position.set(s * 0.06, 1.33, 0.175); strap.rotation.z = s * 0.22; strap.rotation.x = -0.15; rig.add(strap);
  });
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.075, 0.12, 12), skin); neck.position.y = 1.53; rig.add(neck);

  // braços (mangas + mãos)
  const arms = [];
  [-1, 1].forEach((s) => {
    const up = limb(0.3, 0.07, 0.06, hoodie); up.pivot.position.set(s * 0.255, 1.41, 0); up.pivot.rotation.z = s * 0.12;
    const fore = limb(0.26, 0.058, 0.05, hoodie); fore.pivot.rotation.x = -0.12; up.end.add(fore.pivot);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.04, 12), hoodieDark); cuff.position.y = -0.02; fore.end.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin); hand.scale.set(0.85, 1.2, 0.65); hand.position.y = -0.06; fore.end.add(hand);
    rig.add(up.pivot); arms.push(up.pivot);
  });

  // cabeça
  const head = new THREE.Group(); head.position.y = 1.77; rig.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.205, 28, 22), skin); skull.scale.set(0.95, 1.1, 1); head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 14), skin); jaw.position.set(0, -0.1, 0.025); jaw.scale.set(1.05, 0.8, 1); head.add(jaw);
  [-1, 1].forEach((s) => { const sb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.04), hairM); sb.position.set(s * 0.19, 0.02, 0.06); head.add(sb); });
  const nape = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), hairM); nape.position.set(0, -0.02, -0.08); nape.scale.set(1.1, 0.9, 0.9); head.add(nape);
  // gorro canelado marrom com etiqueta preta
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.222, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), beanie);
  hat.scale.set(0.97, 1.18, 1.02); hat.position.y = 0.06; hat.rotation.x = -0.12; head.add(hat);
  const cuffH = new THREE.Mesh(new THREE.CylinderGeometry(0.216, 0.216, 0.075, 28, 1, true), beanie);
  cuffH.position.y = 0.11; cuffH.rotation.x = -0.12; cuffH.scale.z = 1.02; head.add(cuffH);
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.03, 0.01), black); tag.position.set(0, 0.12, 0.21); tag.rotation.x = -0.12; head.add(tag);
  // fone de ouvido preto
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.018, 8, 28, Math.PI), black); band.position.y = 0.0; head.add(band);
  [-1, 1].forEach((s) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 20), black);
    cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.225, -0.02, 0); cup.scale.set(1, 1, 1.25); head.add(cup);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 20), mat('#2c2c30')); pad.rotation.z = Math.PI / 2; pad.position.set(s * 0.262, -0.02, 0); pad.scale.set(1, 1, 1.2); head.add(pad);
  });
  // rosto
  const eyeM = new THREE.MeshBasicMaterial({ color: '#21140d' });
  [-0.07, 0.07].forEach((x) => {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), new THREE.MeshBasicMaterial({ color: '#f3eee8' }));
    white.position.set(x, 0.01, 0.18); white.scale.set(1.15, 0.8, 0.5); head.add(white);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), eyeM); e.position.set(x, 0.01, 0.193); head.add(e);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.018, 0.012), hairM); brow.position.set(x, 0.058, 0.19); brow.rotation.z = Math.sign(x) * 0.06; head.add(brow);
  });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), skin); nose.position.set(0, -0.04, 0.205); nose.scale.set(1.2, 0.95, 0.85); head.add(nose);
  const lips = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.05, 4, 8), mat('#b56a66')); lips.rotation.z = Math.PI / 2; lips.position.set(0, -0.115, 0.178); head.add(lips);
  // bigode e cavanhaque
  const stache = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 16, Math.PI), hairM);
  stache.position.set(0, -0.09, 0.185); stache.scale.set(1.25, 0.45, 1); head.add(stache);
  const goatee = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), mat('#3a271b', { transparent: true, opacity: 0.75 }));
  goatee.position.set(0, -0.175, 0.14); goatee.scale.set(1.3, 0.55, 0.6); head.add(goatee);

  function animate(phase, moving) {
    const p = phase * 0.55;
    const sw = moving ? Math.sin(p) * 0.55 : 0;
    legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
    knees[0].rotation.x = moving ? Math.max(0, Math.sin(p - 1)) * 0.7 : 0;
    knees[1].rotation.x = moving ? Math.max(0, -Math.sin(p - 1)) * 0.7 : 0;
    arms[0].rotation.x = -sw * 0.7; arms[1].rotation.x = sw * 0.7;
    rig.position.y = moving ? Math.abs(Math.cos(p)) * 0.035 : Math.sin(phase * 0.8) * 0.006;
    rig.rotation.y = moving ? Math.sin(p) * 0.05 : 0;
    head.rotation.x = moving ? 0 : Math.sin(phase * 0.5) * 0.03; // balançando no ritmo da música 🎧
  }
  return { root, animate };
}

// ---------- Avatar clássico (bonequinho) ----------
export function buildClassico(color) {
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
  const col = new THREE.Color(color);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 6, 14), mat(col, { roughness: 0.6 }));
  body.position.y = 0.75; rig.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 16), mat('#ffd9c2')); head.position.y = 1.55; rig.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#2b1b25' });
  [-0.11, 0.11].forEach((ex) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat); e.position.set(ex, 1.6, 0.29); rig.add(e); });
  [-0.2, 0.2].forEach((ex) => { const c = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: '#ff9db8' })); c.position.set(ex, 1.5, 0.26); rig.add(c); });
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2.2), mat(col.clone().multiplyScalar(0.55)));
  hair.position.y = 1.58; rig.add(hair);
  function animate(phase, moving) {
    rig.position.y = moving ? Math.abs(Math.sin(phase)) * 0.12 : Math.sin(phase) * 0.015;
    rig.rotation.z = moving ? Math.sin(phase) * 0.08 : 0;
  }
  return { root, animate };
}

// ---------- Avatares GLB (feitos no Blender, com esqueleto e animações Idle/Walk) ----------
const gltfCache = {};
function loadGLB(url) {
  return (gltfCache[url] ||= import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) =>
    new Promise((res, rej) => new GLTFLoader().load(url, res, undefined, rej))));
}
function buildGLB(url, fallback) {
  const root = new THREE.Group();
  const ph = fallback(); root.add(ph.root);
  let animate = ph.animate, mixer = null, actions = {}, current = null, last = performance.now();
  Promise.all([loadGLB(url), import('three/addons/utils/SkeletonUtils.js')]).then(([gltf, SU]) => {
    const model = SU.clone(gltf.scene);
    model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } });
    root.remove(ph.root); root.add(model);
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    const play = (name) => {
      const a = actions[name]; if (!a || current === a) return;
      a.reset().fadeIn(0.2).play(); if (current) current.fadeOut(0.2); current = a;
    };
    play('Idle');
    animate = (phase, moving) => {
      const now = performance.now(); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      play(moving ? 'Walk' : 'Idle');
      if (actions.Walk) actions.Walk.timeScale = 1.15;
      mixer.update(dt);
    };
  }).catch((e) => console.warn('Falha ao carregar', url, e));
  return { root, animate: (p, m) => animate(p, m) };
}

export function buildAvatar(kind, color) {
  if (kind === 'ela3d') return buildGLB('/models/ela.glb', buildOncinha);
  if (kind === 'oncinha') return buildOncinha();
  if (kind === 'moletom') return buildMoletom();
  return buildClassico(color);
}
