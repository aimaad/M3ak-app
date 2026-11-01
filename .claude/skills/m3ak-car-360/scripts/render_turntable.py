"""Render an orbiting camera around a GLB/GLTF/FBX/OBJ car using Blender.
Run: blender -b -P render_turntable.py -- --model car.glb --output frames
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Vector


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--model', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--frames', type=int, default=120)
    p.add_argument('--width', type=int, default=1280)
    p.add_argument('--height', type=int, default=720)
    p.add_argument('--samples', type=int, default=32)
    return p.parse_args(argv)


def main():
    a = args()
    if a.frames < 4 or a.width < 1 or a.height < 1:
        raise ValueError('Invalid frame count or dimensions')
    if not os.path.isfile(a.model):
        raise FileNotFoundError(a.model)
    os.makedirs(a.output, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ext = os.path.splitext(a.model)[1].lower()
    if ext in ('.glb', '.gltf'):
        bpy.ops.import_scene.gltf(filepath=a.model)
    elif ext == '.fbx':
        bpy.ops.import_scene.fbx(filepath=a.model)
    elif ext == '.obj':
        bpy.ops.wm.obj_import(filepath=a.model)
    else:
        raise ValueError('Supported: GLB, GLTF, FBX, OBJ')
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not objects:
        raise RuntimeError('No mesh found in input')
    bpy.context.view_layer.update()
    corners = [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    mins = Vector(tuple(min(v[i] for v in corners) for i in range(3)))
    maxs = Vector(tuple(max(v[i] for v in corners) for i in range(3)))
    center = (mins + maxs) / 2
    size = maxs - mins
    radius = max(size.x, size.y, size.z) * 1.75
    camera_data = bpy.data.cameras.new('TurntableCamera')
    camera = bpy.data.objects.new('TurntableCamera', camera_data)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = max(size.x, size.y, size.z) * 1.85
    # For a car with Z-up geometry, keep elevation modest to avoid top-down angles.
    elevation = max(size.z * 0.55, radius * 0.17)
    def light(name, pos, energy, scale):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = energy
        data.shape = 'DISK'
        data.size = scale
        ob = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(ob)
        ob.location = center + Vector(pos) * max(size.x, size.y, size.z)
        return ob
    light('SoftboxLeft', (-1.0, -1.2, 1.7), 1500, 5)
    light('SoftboxRight', (1.1, 0.7, 1.3), 1000, 4)
    light('RimLight', (0.1, 1.4, 1.6), 1300, 3)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = a.samples
    scene.render.film_transparent = True
    scene.render.resolution_x = a.width
    scene.render.resolution_y = a.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.world.color = (0.12, 0.12, 0.12)
    for i in range(a.frames):
        angle = 2 * math.pi * i / a.frames
        camera.location = center + Vector((radius * math.cos(angle), radius * math.sin(angle), elevation))
        direction = center - camera.location
        camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(a.output, f'frame_{i:04d}.png')
        bpy.ops.render.render(write_still=True)
    print(f'Rendered {a.frames} frames to {a.output}')


if __name__ == '__main__':
    main()
