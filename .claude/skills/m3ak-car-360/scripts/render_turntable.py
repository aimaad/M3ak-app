"""Rend un plateau tournant 360° d'une voiture (GLB/GLTF/FBX/OBJ) avec Blender, sans interface.

Run : blender -b -P render_turntable.py -- --model car.glb --output frames
      (ou, avec le module `bpy` : python render_turntable.py --model car.glb --output frames)

Principes (voir SKILL.md) :
  - la VOITURE tourne sur elle-même (pivot au centre de son emprise au sol) ; la caméra, l'éclairage et l'environnement sont
    FIXES. C'est ce qui permet de composer la vidéo sur la photo du hero (décor identique à chaque image) ;
  - angle = 2π × i / N : la dernière image n'est PAS une copie de la première, la boucle est donc continue ;
  - fond transparent + « shadow catcher » : seule l'ombre portée est conservée sous la voiture (alpha), pour être posée sur la
    photo du hero par encode_video.sh ;
  - le monde Blender est créé explicitement (après read_factory_settings(use_empty=True) il n'y en a pas : `scene.world` vaut
    None) et reçoit un environnement procédural « coucher de soleil » violet/orange avec des barrettes lumineuses, pour des
    reflets premium sur la carrosserie ;
  - les matériaux du modèle sont CONSERVÉS par défaut (un GLB issu d'Image-to-3D porte les couleurs et reflets de l'image de
    référence dans sa texture : les repeindre les détruirait). --paint auto/force permet de repeindre la carrosserie d'un modèle
    à matériaux séparés.
"""
import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector

# Côté vers lequel regarde le capot dans le modèle importé (axe monde) : à régler selon le modèle (voir --front-axis).
FRONT_AXIS_DEG = {'+X': 0.0, '+Y': 90.0, '-X': 180.0, '-Y': 270.0}

BODY_WORDS = ('body', 'paint', 'carpaint', 'car_paint', 'exterior', 'shell', 'chassis', 'karosserie', 'lack', 'carrosserie')
GLASS_WORDS = ('glass', 'window', 'windshield', 'windscreen', 'vitre', 'lens', 'transparent')
TIRE_WORDS = ('tire', 'tyre', 'rubber', 'pneu')
LIGHT_WORDS = ('headlight', 'head_light', 'taillight', 'tail_light', 'lamp', 'led', 'lumiere')
KEEP_WORDS = ('chrome', 'metal', 'steel', 'alu', 'grille', 'badge', 'logo', 'mirror', 'rim', 'wheel', 'alloy', 'brake', 'interior',
              'seat', 'leather', 'dash', 'cabin', 'plate', 'carbon', 'trim')


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser()
    p.add_argument('--model', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--frames', type=int, default=180, help='images pour 360° (180 à 30 i/s = 6 s)')
    p.add_argument('--width', type=int, default=720)
    p.add_argument('--height', type=int, default=480)
    p.add_argument('--samples', type=int, default=64)
    p.add_argument('--front-axis', default='auto', choices=['auto'] + list(FRONT_AXIS_DEG), help='axe vers lequel pointe le capot (auto : déduit des feux arrière rouges)')
    p.add_argument('--start-view', type=float, default=35.0, help="angle du trois-quarts avant gauche à l'image 0 (degrés)")
    p.add_argument('--elevation', type=float, default=9.0, help='hauteur de la caméra au-dessus du sol (degrés), jamais de vue du dessus')
    p.add_argument('--lens', type=float, default=85.0, help='focale (mm) : longue = rendu showroom, sans déformation')
    p.add_argument('--fill', type=float, default=0.8, help="part de la largeur de l'image occupée par le cercle d'emprise de la voiture")
    p.add_argument('--shift-y', type=float, default=0.06, help="décalage vertical du cadrage (fraction de l'image)")
    p.add_argument('--paint', default='keep', choices=['keep', 'auto', 'force'])
    p.add_argument('--paint-color', default='#3D1B57', help='couleur de fond de la peinture (violet aubergine) ; les reflets rosés et orangés viennent de l’environnement')
    p.add_argument('--env-strength', type=float, default=0.55, help="intensité de l'environnement (reflets et lumière ambiante)")
    p.add_argument('--light-scale', type=float, default=0.6, help='multiplicateur des trois lumières de studio')
    p.add_argument('--dry-run', action='store_true', help='analyse le modèle et les matériaux, sans rendre')
    p.add_argument('--only-frames', type=str, default='', help='ex. 0,45,90,135 : ne rend que ces images (contrôle rapide)')
    return p.parse_args(argv)


def hex_to_rgb(value):
    value = value.lstrip('#')
    return tuple(int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def srgb_to_linear(c):
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def set_input(node, names, value):
    """Règle la première entrée du nœud qui existe parmi `names` (les noms changent selon la version de Blender)."""
    for name in names:
        socket = node.inputs.get(name)
        if socket is not None:
            socket.default_value = value
            return True
    return False


# --------------------------------------------------------------------------------------------------------------- modèle
def detect_front_axis(meshes):
    """Devine de quel côté pointe le capot : les feux arrière sont rouges et émissifs, le capot est à l'opposé. Renvoie
    '+X', '-X', '+Y' ou '-Y', ou None si rien de rouge n'est identifiable."""
    mins, maxs = world_bounds(meshes)
    center = (mins + maxs) / 2
    points = []
    for obj in meshes:
        for slot in obj.material_slots:
            mat = slot.material
            principled = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if mat and mat.node_tree else None
            if principled is None or principled.inputs['Base Color'].is_linked:
                continue
            r, g, b, _ = principled.inputs['Base Color'].default_value
            emission = principled.inputs.get('Emission Strength')
            reddish = r > 0.4 and g < 0.25 and b < 0.25
            if reddish or ('red' in mat.name.lower() and emission is not None and emission.default_value > 0):
                points.extend(obj.matrix_world @ Vector(c) for c in obj.bound_box)
    if not points:
        return None
    rear = sum(points, Vector()) / len(points) - center
    axis = max(range(2), key=lambda i: abs(rear[i]))
    # le capot est à l'opposé des feux arrière
    if axis == 0:
        return '-X' if rear.x > 0 else '+X'
    return '-Y' if rear.y > 0 else '+Y'


def import_model(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in ('.glb', '.gltf'):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == '.fbx':
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == '.obj':
        bpy.ops.wm.obj_import(filepath=path)
    else:
        raise ValueError('Formats pris en charge : GLB, GLTF, FBX, OBJ')


def is_invisible(obj):
    """Objet dont tous les matériaux ont une opacité nulle (plans « fantômes » présents dans certains modèles)."""
    alphas = []
    for slot in obj.material_slots:
        mat = slot.material
        principled = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if mat and mat.node_tree else None
        alpha = principled.inputs.get('Alpha') if principled else None
        alphas.append(alpha.default_value if alpha is not None and not alpha.is_linked else 1.0)
    return bool(alphas) and max(alphas) < 0.02


def world_bounds(meshes):
    corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    mins = Vector(tuple(min(v[i] for v in corners) for i in range(3)))
    maxs = Vector(tuple(max(v[i] for v in corners) for i in range(3)))
    return mins, maxs


def classify_material(mat, area):
    name = mat.name.lower()
    principled = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if mat.node_tree else None
    transmission = principled.inputs.get('Transmission Weight') if principled else None
    alpha = principled.inputs.get('Alpha') if principled else None
    if any(w in name for w in GLASS_WORDS) or (transmission is not None and transmission.default_value > 0.3) or (
            alpha is not None and alpha.default_value < 0.9):
        return 'glass'
    if any(w in name for w in TIRE_WORDS):
        return 'tire'
    emission = principled.inputs.get('Emission Strength') if principled else None
    if any(w in name for w in LIGHT_WORDS) or (emission is not None and emission.default_value > 1.0):
        return 'light'
    if any(w in name for w in BODY_WORDS):
        return 'body'
    if any(w in name for w in KEEP_WORDS):
        return 'keep'
    return 'unknown'


def material_report(meshes):
    """Surface de chaque matériau (m²) puis catégorie. Le plus grand matériau « inconnu » est pris pour la carrosserie."""
    areas = {}
    for obj in meshes:
        scale = obj.matrix_world.to_scale()
        # échelle de surface moyenne de l'objet (les surfaces sont mesurées dans le repère local du maillage)
        factor = (scale.x * scale.y + scale.y * scale.z + scale.x * scale.z) / 3 if scale.length else 1.0
        for poly in obj.data.polygons:
            if poly.material_index < len(obj.material_slots) and obj.material_slots[poly.material_index].material:
                mat = obj.material_slots[poly.material_index].material
                areas[mat] = areas.get(mat, 0.0) + poly.area * factor
    report = {mat: (classify_material(mat, area), area) for mat, area in areas.items()}
    if not any(kind == 'body' for kind, _ in report.values()):
        unknown = [(area, mat) for mat, (kind, area) in report.items() if kind == 'unknown']
        if unknown:
            mat = max(unknown, key=lambda item: item[0])[1]
            report[mat] = ('body?', report[mat][1])
    return report


def add_flakes(mat, principled):
    """Paillettes métalliques très fines : une micro-aspérité (bump) sur la couche de base uniquement ; le vernis reste lisse."""
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    coord = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 2500.0
    noise.inputs['Detail'].default_value = 0.0
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.12
    bump.inputs['Distance'].default_value = 0.0006
    links.new(coord.outputs['Object'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], principled.inputs['Normal'])


def tune_materials(report, mode, paint_color):
    """On garde la géométrie et les matériaux du modèle ; on ne repeint que la carrosserie (--paint auto/force), on ajoute un
    vernis, on affine le verre et on laisse les feux émissifs tels quels."""
    base = srgb_to_linear(hex_to_rgb(paint_color)) + (1.0,)
    body_areas = [area for kind, area in report.values() if kind in ('body', 'body?')]
    biggest = max(body_areas) if body_areas else 0.0
    repainted = []
    for mat, (kind, area) in report.items():
        principled = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if principled is None:
            continue
        if kind in ('body', 'body?'):
            # Seules les grandes surfaces de carrosserie sont repeintes : les petites pièces (liserés, inserts) restent intactes.
            if mode in ('auto', 'force') and area >= 0.1 * biggest and not principled.inputs['Base Color'].is_linked:
                set_input(principled, ['Base Color'], base)
                set_input(principled, ['Metallic'], 0.88)
                set_input(principled, ['Roughness'], 0.2)
                set_input(principled, ['Coat Weight', 'Clearcoat'], 1.0)
                set_input(principled, ['Coat Roughness', 'Clearcoat Roughness'], 0.02)
                set_input(principled, ['Coat IOR'], 1.5)
                add_flakes(mat, principled)
                repainted.append(mat.name)
        elif kind == 'glass':
            set_input(principled, ['Roughness'], 0.02)
            set_input(principled, ['IOR'], 1.5)
        elif kind == 'tire':
            set_input(principled, ['Roughness'], 0.7)
        # 'light' : déjà émissifs dans le modèle, rien à changer.
    return repainted


# ------------------------------------------------------------------------------------------------------------ environnement
def build_environment(strength):
    """Environnement procédural (équirectangulaire) : ciel aubergine, horizon rose et orange de coucher de soleil, barrettes
    lumineuses façon façade vitrée. Il ne sert qu'à l'éclairage et aux reflets (le décor visible est la photo du hero)."""
    import numpy as np
    width, height = 1024, 512
    u = (np.arange(width) + 0.5) / width
    v = (np.arange(height) + 0.5) / height
    uu, vv = np.meshgrid(u, v)
    elevation = (0.5 - vv) * math.pi                      # +π/2 au zénith, −π/2 au nadir
    t = np.clip(elevation / (math.pi / 2), -1, 1)          # −1 … 1
    zenith, mid, rose, orange, floor = (np.array(c) for c in (
        (0.045, 0.030, 0.085), (0.12, 0.05, 0.19), (0.43, 0.20, 0.42), (0.95, 0.52, 0.22), (0.02, 0.012, 0.035)))
    t3 = t[..., None]
    up = np.clip(t3, 0, 1)
    # dégradé : horizon (orange) → rose → aubergine → zénith
    horizon_glow = np.exp(-(up * 7.5) ** 2)
    color = (mid * (1 - up) ** 2 + zenith * (1 - (1 - up) ** 2)) * (1 - horizon_glow) + (rose * 0.55 + orange * 0.45) * horizon_glow
    # le soleil couchant est à l'arrière droite de la caméra : halo orange plus fort dans cette direction
    azimuth_glow = np.exp(-((((uu - 0.78 + 0.5) % 1.0) - 0.5) / 0.14) ** 2)[..., None]
    color = color + orange * azimuth_glow * np.exp(-(up * 5.0) ** 2) * 1.6
    color = np.where((t3 < 0), floor * (1 + 0.8 * np.exp(-((-t3) * 10) ** 2)), color)
    # barrettes lumineuses (reflets de façade vitrée), au-dessus de l'horizon
    for centre, half_w, elev_lo, elev_hi, power, tint in (
            (0.62, 0.010, 0.04, 0.22, 7.0, (1.0, 0.62, 0.30)), (0.70, 0.008, 0.05, 0.26, 6.0, (1.0, 0.70, 0.42)),
            (0.30, 0.012, 0.10, 0.34, 9.0, (0.80, 0.88, 1.0)), (0.20, 0.050, 0.55, 0.62, 12.0, (1.0, 0.96, 0.92))):
        d = np.abs(((uu - centre + 0.5) % 1.0) - 0.5)
        band = ((d < half_w) & (t > elev_lo) & (t < elev_hi))[..., None]
        color = np.where(band, np.array(tint) * power, color)
    pixels = np.concatenate([color, np.ones((height, width, 1))], axis=-1).astype(np.float32)
    image = bpy.data.images.new('M3AK_ENV', width, height, float_buffer=True, alpha=False)
    image.pixels.foreach_set(pixels.ravel())
    image.colorspace_settings.name = 'Non-Color'
    image.pack()

    world = bpy.data.worlds.new('M3AK_World')            # explicite : scene.world vaut None après read_factory_settings(use_empty=True)
    if hasattr(world, 'use_nodes'):
        world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    nodes.clear()
    coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    env = nodes.new('ShaderNodeTexEnvironment')
    env.image = image
    background = nodes.new('ShaderNodeBackground')
    background.inputs['Strength'].default_value = strength
    output = nodes.new('ShaderNodeOutputWorld')
    links.new(coord.outputs['Generated'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], env.inputs['Vector'])
    links.new(env.outputs['Color'], background.inputs['Color'])
    links.new(background.outputs['Background'], output.inputs['Surface'])
    return world


def add_area_light(name, location, target, energy, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'RECTANGLE'
    data.size, data.size_y = size, size * 0.55
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (target - Vector(location)).to_track_quat('-Z', 'Y').to_euler()
    return obj


# -------------------------------------------------------------------------------------------------------------------- main
def main():
    a = parse_args()
    if a.frames < 8 or a.width < 16 or a.height < 16:
        raise ValueError('Nombre d’images ou dimensions invalides')
    if not os.path.isfile(a.model):
        raise FileNotFoundError(a.model)
    os.makedirs(a.output, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    import_model(a.model)
    all_meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not all_meshes:
        raise RuntimeError('Aucun maillage dans le fichier')
    bpy.context.view_layer.update()
    ghosts = [o for o in all_meshes if is_invisible(o)]
    for obj in ghosts:                       # plans d'alpha 0 : ni visibles, ni pris en compte dans les dimensions
        obj.hide_render = True
        obj.hide_viewport = True
    meshes = [o for o in all_meshes if o not in ghosts]
    if ghosts:
        print('Objets invisibles ignorés :', [o.name for o in ghosts])
    if a.front_axis == 'auto':
        detected = detect_front_axis(meshes)
        a.front_axis = detected or '-Y'
        print('Axe avant :', a.front_axis, '(détecté)' if detected else '(non détecté : -Y par défaut, à régler avec --front-axis)')

    report = material_report(meshes)
    summary = {mat.name: {'categorie': kind, 'surface_m2': round(area, 3)} for mat, (kind, area) in report.items()}
    mins, maxs = world_bounds(meshes)
    size = maxs - mins
    center = (mins + maxs) / 2
    pivot_origin = Vector((center.x, center.y, mins.z))
    print('Dimensions du modèle (m) :', tuple(round(v, 3) for v in size))
    print('Matériaux :', json.dumps(summary, ensure_ascii=False))
    if a.dry_run:
        return
    repainted = tune_materials(report, a.paint, a.paint_color)
    print('Matériaux repeints :', repainted or 'aucun (--paint keep)')

    # --- pivot : tout le modèle est rattaché à un point d'axe vertical (la voiture tourne sur elle-même, sur le sol).
    pivot = bpy.data.objects.new('CarPivot', None)
    bpy.context.collection.objects.link(pivot)
    pivot.location = pivot_origin
    roots = [o for o in scene.objects if o.parent is None and o is not pivot]
    for obj in roots:
        obj.parent = pivot
        obj.matrix_parent_inverse = pivot.matrix_world.inverted()
    # Orientation de départ : trois-quarts avant gauche, comme sur la photo du hero. La caméra regarde vers +Y depuis −Y ;
    # le capot doit pointer vers la caméra, tourné de `start-view` degrés vers la gauche de l'image (direction −X).
    base_yaw = math.radians((270.0 - a.start_view) - FRONT_AXIS_DEG[a.front_axis])

    # --- sol « shadow catcher » : ne garde que l'ombre portée (dans le canal alpha).
    bpy.ops.mesh.primitive_plane_add(size=60, location=(pivot_origin.x, pivot_origin.y, mins.z))
    floor = bpy.context.active_object
    floor.name = 'ShadowCatcher'
    floor.is_shadow_catcher = True

    # --- caméra fixe, focale longue, vue légèrement surélevée.
    radius = math.hypot(size.x, size.y) / 2
    fov_half_tan = (36.0 / 2) / a.lens
    distance = radius / (a.fill * fov_half_tan)
    elevation = math.radians(a.elevation)
    target = Vector((pivot_origin.x, pivot_origin.y, mins.z + size.z * 0.38))
    cam_data = bpy.data.cameras.new('TurntableCamera')
    cam_data.lens = a.lens
    cam_data.sensor_fit = 'HORIZONTAL'
    cam_data.shift_y = a.shift_y
    camera = bpy.data.objects.new('TurntableCamera', cam_data)
    bpy.context.collection.objects.link(camera)
    camera.location = target + Vector((0.0, -distance * math.cos(elevation), distance * math.sin(elevation)))
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = camera

    # --- éclairage fixe : grande boîte à lumière froide en haut à gauche, rim orange et rim rose derrière.
    span = max(size.x, size.y, size.z)
    add_area_light('Key', target + Vector((-1.2, -1.4, 1.5)) * span, target, 2600 * a.light_scale, span * 1.6, (1.0, 0.93, 0.97))
    add_area_light('RimOrange', target + Vector((1.6, 1.1, 0.9)) * span, target, 2400 * a.light_scale, span * 0.9, (1.0, 0.58, 0.30))
    add_area_light('RimPink', target + Vector((-1.5, 1.2, 0.7)) * span, target, 1700 * a.light_scale, span * 0.8, (0.85, 0.45, 0.95))
    add_area_light('Fill', target + Vector((0.0, -1.8, 0.35)) * span, target, 500 * a.light_scale, span * 1.4, (0.85, 0.62, 0.88))

    scene.world = build_environment(a.env_strength)

    # --- rendu : Cycles, fond transparent, débruitage, colorimétrie AgX (ou Filmic selon la version).
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = a.samples
    scene.cycles.use_denoising = True
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.03
    scene.cycles.max_bounces, scene.cycles.diffuse_bounces, scene.cycles.glossy_bounces = 8, 2, 5
    scene.cycles.transmission_bounces, scene.cycles.transparent_max_bounces = 4, 8
    scene.render.use_persistent_data = True      # garde la géométrie en mémoire d'une image à l'autre (modèle très dense)
    try:
        scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    except TypeError:
        pass
    scene.render.film_transparent = True
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = a.width, a.height, 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    for transform in ('AgX', 'Filmic', 'Standard'):
        try:
            scene.view_settings.view_transform = transform
            break
        except TypeError:
            continue

    only = {int(x) for x in a.only_frames.split(',') if x.strip()} if a.only_frames else None
    for i in range(a.frames):
        if only is not None and i not in only:
            continue
        pivot.rotation_euler = (0.0, 0.0, base_yaw + 2 * math.pi * i / a.frames)    # i / N : dernière image ≠ première
        scene.render.filepath = os.path.join(a.output, f'frame_{i:04d}.png')
        bpy.ops.render.render(write_still=True)
    with open(os.path.join(a.output, 'render_report.json'), 'w') as handle:
        json.dump({'frames': a.frames, 'size_m': [round(v, 3) for v in size], 'materials': summary, 'view_transform': scene.view_settings.view_transform,
                   'front_axis': a.front_axis, 'start_view_deg': a.start_view, 'paint': a.paint}, handle, indent=1, ensure_ascii=False)
    print(f'{a.frames if only is None else len(only)} image(s) dans {a.output}')


if __name__ == '__main__':
    main()
