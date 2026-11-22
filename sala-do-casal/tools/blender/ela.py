# Gera a personagem "Ela" no Blender e exporta GLB com esqueleto e animações (Idle, Walk).
# Uso: blender -b --factory-startup --python ela.py -- <saida.glb> [pasta_previews]
import bpy, bmesh, math, sys, os, random, time, functools
import numpy as np
print = functools.partial(print, flush=True)
T0 = time.time()
def log(msg): print(f'[{time.time() - T0:6.1f}s] {msg}')
from mathutils import Vector, Quaternion, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.abspath('ela.glb')
PREVIEW = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24
col = scene.collection

def hexcol(h, a=1.0):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]  # sRGB -> linear
    return (*c, a)

def material(name, color, rough=0.6, image=None, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = hexcol(color)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if image:
        t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = image
        m.node_tree.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    return m

def np_image(name, arr):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(arr.astype(np.float32).ravel())
    img.pack()
    return img

def lin(h):  # cor sRGB (as imagens novas do Blender guardam pixels em sRGB)
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [1.0])

# ---------- texturas ----------
def leopard_texture(size=512, seed=7):
    rnd = random.Random(seed)
    arr = np.ones((size, size, 4)) * lin('#d6cbc0')
    yy, xx = np.mgrid[0:size, 0:size]
    for _ in range(240):
        cx, cy, r = rnd.uniform(0, size), rnd.uniform(0, size), rnd.uniform(12, 21)
        ang = rnd.uniform(0, math.pi); ca, sa = math.cos(ang), math.sin(ang)
        for ox in (-size, 0, size):
            for oy in (-size, 0, size):
                dx = xx - (cx + ox); dy = yy - (cy + oy)
                u = (dx * ca + dy * sa) / r; v = (-dx * sa + dy * ca) / (r * 0.75)
                d = np.sqrt(u * u + v * v)
                theta = np.arctan2(v, u)
                inner = d < 0.72
                ring = (d >= 0.72) & (d < 1.0) & (np.sin(theta * 3 + ang * 5) > -0.55)
                arr[inner] = lin('#9a806d')
                arr[ring] = lin('#30231b')
    return np_image('leopard', arr)

def pleat_texture(size=256):
    arr = np.ones((size, size, 4)) * lin('#504731')
    x = np.arange(size)
    shade = 0.82 + 0.18 * ((x % (size // 16)) / (size // 16))
    arr[:, :, :3] *= shade[None, :, None]
    return np_image('pleats', arr)

log('inicio texturas')
M = {
    'skin': material('skin', '#7c4b33', 0.5),
    'top': material('top', '#ffffff', 0.85, leopard_texture()),
    'skirt': material('skirt', '#ffffff', 0.9, pleat_texture()),
    'under': material('under', '#3f382a', 0.9),
    'sandal': material('sandal', '#a8652f', 0.6),
    'band': material('band', '#d8c6ab', 0.95),
    'hair': material('hair', '#1b120d', 0.85),
    'braid': material('braid', '#b8894b', 0.5),
    'eye_w': material('eye_white', '#f4eee8', 0.3),
    'eye': material('eye', '#140c08', 0.2),
    'lips': material('lips', '#6e2b30', 0.4),
    'gold': material('gold', '#e0bf63', 0.3, metal=0.9),
}

# ---------- esqueleto base (Skin modifier) ----------
P = {
    'hips': (0, 0, 0.95), 'spine': (0, 0, 1.12), 'chest': (0, 0, 1.28), 'upchest': (0, 0, 1.41),
    'neck': (0, 0, 1.53), 'head': (0, 0, 1.64),
}
R = {
    'hips': (0.17, 0.125), 'spine': (0.135, 0.105), 'chest': (0.15, 0.11), 'upchest': (0.145, 0.1),
    'neck': (0.055, 0.055), 'head': (0.04, 0.04),
}
for s, sx in (('L', 1), ('R', -1)):
    P.update({
        f'hip{s}': (0.1 * sx, 0, 0.9), f'knee{s}': (0.105 * sx, 0.005, 0.5), f'ankle{s}': (0.11 * sx, 0.015, 0.085),
        f'toe{s}': (0.11 * sx, -0.11, 0.035),
        f'sh{s}': (0.19 * sx, 0, 1.43), f'elb{s}': (0.27 * sx, 0.01, 1.17), f'wri{s}': (0.31 * sx, -0.005, 0.93),
        f'hand{s}': (0.32 * sx, -0.015, 0.84),
    })
    R.update({
        f'hip{s}': (0.1, 0.1), f'knee{s}': (0.064, 0.066), f'ankle{s}': (0.04, 0.045), f'toe{s}': (0.035, 0.028),
        f'sh{s}': (0.058, 0.058), f'elb{s}': (0.043, 0.043), f'wri{s}': (0.032, 0.03), f'hand{s}': (0.035, 0.017),
    })
E = [('hips', 'spine'), ('spine', 'chest'), ('chest', 'upchest'), ('upchest', 'neck'), ('neck', 'head')]
for s in 'LR':
    E += [('hips', f'hip{s}'), (f'hip{s}', f'knee{s}'), (f'knee{s}', f'ankle{s}'), (f'ankle{s}', f'toe{s}'),
          ('upchest', f'sh{s}'), (f'sh{s}', f'elb{s}'), (f'elb{s}', f'wri{s}'), (f'wri{s}', f'hand{s}')]
names = list(P.keys()); idx = {n: i for i, n in enumerate(names)}
me = bpy.data.meshes.new('body')
me.from_pydata([P[n] for n in names], [(idx[a], idx[b]) for a, b in E], [])
body = bpy.data.objects.new('Ela', me); col.objects.link(body)
skin = body.modifiers.new('Skin', 'SKIN'); skin.use_smooth_shade = True
for n in names:
    d = me.skin_vertices[0].data[idx[n]]
    d.radius = R[n]; d.use_root = (n == 'hips')
sub = body.modifiers.new('Subsurf', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2

log('texturas ok, criando armadura')
bpy.context.view_layer.objects.active = body; body.select_set(True)
bpy.ops.object.skin_armature_create(modifier='Skin')
log('armadura ok')
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
arm.name = 'Rig'

# nomeia os ossos pela ponta (tail)
BONE = {}
for b in arm.data.bones:
    tail = Vector(b.tail_local)
    for n, p in P.items():
        if (tail - Vector(p)).length < 1e-3:
            b.name = n; BONE[n] = n
print('BONES', sorted(BONE))

# armadura por último e aplica skin + subsurf
log('mods antes: ' + str([m.type for m in body.modifiers]))
ai = next(i for i, m in enumerate(body.modifiers) if m.type == 'ARMATURE')
body.modifiers.move(ai, len(body.modifiers) - 1)
log('mods depois: ' + str([m.type for m in body.modifiers]))
bpy.context.view_layer.objects.active = body
bpy.ops.object.modifier_apply(modifier='Skin')
bpy.ops.object.modifier_apply(modifier='Subsurf')
print('MODS', [m.type for m in body.modifiers], 'VGROUPS', len(body.vertex_groups), 'VERTS', len(body.data.vertices))

# materiais do corpo por região
for k in ('skin', 'top', 'under', 'sandal'):
    body.data.materials.append(M[k])
mi = {k: i for i, k in enumerate(('skin', 'top', 'under', 'sandal'))}
for p in body.data.polygons:
    c = p.center
    if c.z < 0.06: p.material_index = mi['sandal']
    elif 0.81 < c.z < 1.07 and abs(c.x) < 0.23: p.material_index = mi['under']
    elif 1.07 <= c.z < 1.455 and abs(c.x) < (0.17 if c.z > 1.36 else 0.2): p.material_index = mi['top']
    else: p.material_index = mi['skin']

def cyl_uv(obj, su=1.0, sv=1.0):
    """UV cilíndrico em volta do eixo Z: estampas contínuas e na mesma escala"""
    mesh = obj.data
    uv = mesh.uv_layers.new(name='UVMap') if not mesh.uv_layers else mesh.uv_layers[0]
    for poly in mesh.polygons:
        cu = math.atan2(poly.center.x, -poly.center.y)
        for li in poly.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co
            a = math.atan2(co.x, -co.y)
            if abs(a - cu) > math.pi: a += 2 * math.pi if a < cu else -2 * math.pi  # evita costura esticada
            uv.data[li].uv = ((a / (2 * math.pi) + 0.5) * su, co.z * sv)

log('uv do corpo')
cyl_uv(body, 1.0, 1.0)
log('uv ok, pecas')

# ---------- peças rígidas (presas a um osso) ----------
parts = []
def rigid(obj, bone, mat=None, smooth=True):
    if mat is not None:
        obj.data.materials.clear(); obj.data.materials.append(mat)
    vg = obj.vertex_groups.new(name=bone)
    vg.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    if smooth:
        for p in obj.data.polygons: p.use_smooth = True
    parts.append(obj); return obj

def sphere(loc, r, scale=(1, 1, 1), seg=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc)
    o = bpy.context.active_object; o.scale = scale
    bpy.ops.object.transform_apply(scale=True); return o

def torus(loc, R_, r_, rot=(0, 0, 0), scale=(1, 1, 1), half=False):
    bpy.ops.mesh.primitive_torus_add(major_radius=R_, minor_radius=r_, major_segments=36, minor_segments=10, location=(0, 0, 0))
    o = bpy.context.active_object
    if half:
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.002], context='VERTS')
        bm.to_mesh(o.data); bm.free()
    o.scale = scale; o.rotation_euler = rot; o.location = loc
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); return o

HC = Vector((0, 0, 1.765))  # centro da cabeça
rigid(sphere(HC, 0.2, (0.94, 1.0, 1.08), 32, 24), 'head', M['skin'])
# cabelo preso pra trás: hemisfério cortado no plano da tiara
cap = sphere(HC, 0.203, (0.945, 1.0, 1.085), 32, 24)
n = Vector((0, 0.58, 0.81))
bm = bmesh.new(); bm.from_mesh(cap.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if (v.co - HC).dot(n) < -0.012], context='VERTS')
bm.to_mesh(cap.data); bm.free()
rigid(cap, 'head', M['hair'])
rigid(sphere(HC + Vector((0, 0.19, 0.03)), 0.075), 'head', M['hair'])  # coque
rigid(torus(HC, 0.2, 0.024, rot=(-0.62, 0, 0), scale=(0.96, 1.03, 1.0)), 'head', M['band'])
for sx in (-1, 1):
    x = 0.068 * sx
    rigid(sphere(HC + Vector((x, -0.166, 0.01)), 0.036, (1.1, 0.3, 0.95)), 'head', M['eye_w'])
    rigid(sphere(HC + Vector((x, -0.177, 0.006)), 0.025, (1, 0.3, 1.05)), 'head', M['eye'])
    rigid(sphere(HC + Vector((x + 0.008, -0.185, 0.018)), 0.007, (1, 0.3, 1)), 'head', M['eye_w'])  # brilho
    bpy.ops.mesh.primitive_cube_add(size=1, location=HC + Vector((x, -0.185, 0.065)))
    b = bpy.context.active_object; b.scale = (0.06, 0.01, 0.012); b.rotation_euler = (0, 0.1 * sx, 0)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); rigid(b, 'head', M['eye'], smooth=False)
    rigid(torus(HC + Vector((0.19 * sx, 0, -0.07)), 0.022, 0.006, rot=(0, math.pi / 2, 0)), 'head', M['gold'])
rigid(sphere(HC + Vector((0, -0.193, -0.035)), 0.022, (1.3, 0.8, 0.8)), 'head', M['skin'])  # nariz
rigid(torus(HC + Vector((0, -0.172, -0.072)), 0.042, 0.008, rot=(math.pi / 2, 0, 0), scale=(1, 1, 0.55), half=True), 'head', M['lips'])

# trança dourada caindo pelo lado esquerdo dela (+X)
N = 20
for i in range(N):
    t = i / (N - 1)
    pos = Vector((0.15 + math.sin(t * 2.4) * 0.07, 0.11 - t * 0.17, 1.86 - t * 0.9))
    pos.x += 0.014 if i % 2 else -0.014  # dois gomos entrelaçados
    o = sphere(pos, 0.047 - t * 0.018, (1, 1, 1.4), 12, 8)
    rigid(o, 'head' if t < 0.25 else 'upchest', M['braid'])

# saia com pregas
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=False, segments=48, radius1=0.31, radius2=0.2, depth=0.28)
for v in bm.verts:
    if v.co.z < 0:
        a = math.atan2(v.co.y, v.co.x)
        f = 1 + 0.045 * (1 if math.sin(a * 12) > 0 else -0.3)
        v.co.x *= f; v.co.y *= f
mesh = bpy.data.meshes.new('skirt'); bm.to_mesh(mesh); bm.free()
sk = bpy.data.objects.new('skirt', mesh); col.objects.link(sk)
sk.location = (0, 0, 0.935); sk.scale = (1, 0.86, 1)
bpy.context.view_layer.objects.active = sk; sk.select_set(True)
bpy.ops.object.transform_apply(location=True, scale=True)
sk.modifiers.new('solid', 'SOLIDIFY').thickness = 0.01
bpy.ops.object.modifier_apply(modifier='solid')
cyl_uv(sk, 1.0, 1.0)
rigid(sk, 'spine', M['skirt'], smooth=False)

# alças das sandálias
for s, sx in (('L', 1), ('R', -1)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.11 * sx, -0.06, 0.07))
    b = bpy.context.active_object; b.scale = (0.115, 0.06, 0.022); b.rotation_euler = (0.3, 0, 0)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bev = b.modifiers.new('b', 'BEVEL'); bev.width = 0.01; bev.segments = 2
    bpy.context.view_layer.objects.active = b; bpy.ops.object.modifier_apply(modifier='b')
    rigid(b, f'toe{s}', M['sandal'])

# junta tudo num só objeto com pele (skinned mesh)
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body.parent = arm
print('FINAL VERTS', len(body.data.vertices), 'MATS', [m.name for m in body.data.materials])
print('VGROUPS', [g.name for g in body.vertex_groups])
for b in arm.data.bones:
    print('BONE', b.name, 'parent', b.parent.name if b.parent else None, 'head', tuple(round(x, 2) for x in b.head_local), 'tail', tuple(round(x, 2) for x in b.tail_local))

# ---------- animações ----------
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
pb = arm.pose.bones
for b in pb: b.rotation_mode = 'QUATERNION'

def rot(bone, axis, ang):
    """rotação em torno de um eixo do espaço da armadura, convertida para o espaço local do osso"""
    b = arm.data.bones[bone]
    local = (b.matrix_local.to_3x3().inverted() @ Vector(axis)).normalized()
    pb[bone].rotation_quaternion = Quaternion(local, ang)

def lift(dz):
    for b in arm.data.bones:
        if b.parent is None:
            pb[b.name].location = b.matrix_local.to_3x3().inverted() @ Vector((0, 0, dz))

def key(frame):
    for b in pb:
        b.keyframe_insert('rotation_quaternion', frame=frame)
        b.keyframe_insert('location', frame=frame)

def rest():
    for b in pb:
        b.rotation_quaternion = (1, 0, 0, 0); b.location = (0, 0, 0)

def assign(act):
    arm.animation_data_create(); arm.animation_data.action = act
    ad = arm.animation_data
    if hasattr(ad, 'action_slot') and len(getattr(act, 'slots', [])) and ad.action_slot is None:
        ad.action_slot = act.slots[0]

def new_action(name):
    act = bpy.data.actions.new(name); act.use_fake_user = True
    assign(act)
    return act

X = (1, 0, 0); Y = (0, 1, 0); Z = (0, 0, 1)

# Walk: 24 quadros = 1 ciclo (2 passos). Ângulo negativo em X = perna/braço para a frente.
new_action('Walk')
L = 24
for f in range(0, L + 1, 2):
    ph = 2 * math.pi * f / L
    rest()
    for s, off in (('L', 0), ('R', math.pi)):
        p = ph + off
        rot(f'knee{s}', X, -0.5 * math.cos(p))                 # coxa (osso hip->knee chama 'knee')
        bend = max(0.0, math.sin(p)) * 0.9 + 0.08                # joelho dobra quando a perna volta
        rot(f'ankle{s}', X, bend)                               # canela (knee->ankle chama 'ankle')
        rot(f'toe{s}', X, -bend * 0.4)
        rot(f'elb{s}', X, 0.38 * math.cos(p))                   # braço oposto à perna
        rot(f'wri{s}', X, -0.25 - 0.15 * max(0.0, -math.cos(p)))
    rot('upchest', Z, 0.07 * math.cos(ph))
    rot('spine', Z, -0.04 * math.cos(ph))
    rot('head', Z, -0.05 * math.cos(ph))
    lift(0.025 * abs(math.cos(ph)) - 0.012)
    key(f + 1)

# Idle: respiração e balanço suave (48 quadros)
new_action('Idle')
for f in range(0, 49, 4):
    ph = 2 * math.pi * f / 48
    rest()
    rot('upchest', X, 0.02 * math.sin(ph))
    rot('head', Y, 0.05 * math.sin(ph * 0.5))
    rot('head', Z, 0.04 * math.sin(ph))
    for s, sx in (('L', 1), ('R', -1)):
        rot(f'elb{s}', Y, 0.03 * math.sin(ph) * sx)
        rot(f'wri{s}', X, -0.12)
    lift(0.004 * math.sin(ph))
    key(f + 1)
bpy.ops.object.mode_set(mode='OBJECT')

# ---------- exportar ----------
arm.animation_data.action = None
rest_pose = True
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_animations=True,
                          export_animation_mode='ACTIONS', export_yup=True, export_skins=True)
print('EXPORTED', OUT, os.path.getsize(OUT))

# ---------- previews (opcional) ----------
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    log('renderizando previews')
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 600, 800
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.62, 0.68, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); col.objects.link(sun)
    sun.data.energy = 3.5; sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); col.objects.link(cam); scene.camera = cam
    cam.data.lens = 50
    shots = [('frente', (0, -4.2, 1.05), (math.radians(90), 0, 0)),
             ('lado', (4.2, 0, 1.05), (math.radians(90), 0, math.radians(90))),
             ('costas', (0, 4.2, 1.05), (math.radians(90), 0, math.radians(180))),
             ('rosto', (0.0, -1.1, 1.75), (math.radians(90), 0, 0))]
    for act, frame in (('Rest', 1), ('Idle', 1), ('Walk', 7)):
        if act == 'Rest':
            arm.animation_data.action = None; arm.data.pose_position = 'REST'
        else:
            arm.data.pose_position = 'POSE'; assign(bpy.data.actions[act])
        scene.frame_set(frame)
        for name, loc, r in shots:
            if act != 'Idle' and name in ('costas', 'rosto'): continue
            cam.location = loc; cam.rotation_euler = r
            scene.render.filepath = os.path.join(PREVIEW, f'{act}_{name}.png')
            bpy.ops.render.render(write_still=True)
    print('PREVIEWS', PREVIEW)
