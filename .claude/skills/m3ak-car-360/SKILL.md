---
name: m3ak-car-360
description: Reconstruct a Mercedes-like car from a single reference image using an external image-to-3D service or a licensed GLB model, then render a seamless 360-degree turntable video and optionally integrate an interactive 3D viewer into M3AK. Use for automotive hero animations, Blender turntables, GLB validation, FFmpeg loops, and React/React Native car displays.
---

# M3AK Car 360

## Mission
Create a premium, seamless 360-degree car turntable for M3AK using `assets/mercedes-reference.png`. The reference is a dark purple metallic Mercedes sedan viewed from the front three-quarter angle, with pink/orange rim lighting, blue-white headlights, dark windows and sporty wheels. Preserve those visual cues without claiming exact model identity or unseen geometry accuracy.

## Non-negotiable reality check
A single 2D photo is **not** a complete 3D mesh. Do not rotate a PNG in 2D or invent 25 independently generated angles and call it a real 360-degree rotation. Claude Code cannot guarantee faithful back/roof/underside reconstruction. Obtain a real GLB/GLTF/FBX/OBJ from a user-approved image-to-3D service, or a legally usable comparable car asset. Ask permission before external uploads, paid APIs, downloading assets, or installing tools. Never claim a model or rendered video exists before verifying its file.

## Workflow
1. Inspect M3AK repository, stack, routes, styling, current hero, build commands and mobile platform. Do not overwrite unrelated changes. Do not push/commit without instruction.
2. Check available Blender and FFmpeg executables and GPU capabilities. Check if the user already has a real 3D asset. Use the bundled image only as a visual reference, not a mesh.
3. If no 3D mesh exists, explain options: (a) image-to-3D generation through an explicitly authorized service (e.g. Tripo, Meshy or another service the user chooses), with the uploaded reference and export to GLB; (b) licensed comparable sedan GLB customized in Blender; (c) manual modeling. Do not hardcode a service endpoint or pretend API access. Require approval for paid services and external image upload. Save the original asset and record its source/license.
4. Inspect mesh quality in Blender: full 360-degree geometry, car body shape, wheels, glass, textures, normals, mesh pivot and orientation. Fix obvious mesh errors where feasible; report inferred/inaccurate regions. Use purple metallic material and studio lights to approximate the reference. Do not add fake random paint blotches.
5. Create a 360-degree **turntable** using `scripts/render_turntable.py`: stationary car, orbiting camera at consistent height, 120 frames at 30 fps by default, alpha output PNG sequence, first and last frames NOT duplicated. Render a complete 360 degrees with angle = 2*pi*frame/N. Set transparent film and consistent lighting. Use a 3/4 elevated viewpoint; do not accidentally show top-down angles.
6. Encode to MP4 and optionally transparent WebM using `scripts/encode_video.sh`. For MP4, choose a background consistent with the UI because H.264 has no alpha. For transparency, use WebM VP9 alpha when available and test playback in target clients; keep transparent PNG frames as a fallback.
7. Inspect frame samples at 0/90/180/270 degrees, check the loop seam and wheel geometry, confirm car fits the frame, and ensure no black background artifacts, visual stains, or abrupt exposure changes. If output fails, correct and re-render.
8. Integrate the video into the M3AK homepage using the project's existing UI conventions. Autoplay, muted, loop, playsInline; provide poster and reduced-motion static image. On mobile, use native video component appropriate to the existing stack. Optimize size and loading; never ship 120 PNGs to production unnecessarily.
9. Optional interactive mode: if requested, load the verified GLB with Three.js / React Three Fiber on web or an appropriate native 3D solution, enable horizontal orbit only, clamp polar angle to avoid overhead views, disable pan, preserve visual styling, and offer static fallback.
10. Run relevant build/tests and report actual outputs, paths, licenses, assumptions and limitations. Never present unverified claims as finished.

## Assets and scripts
- `assets/mercedes-reference.png`: original user-supplied image; preserve it.
- `scripts/render_turntable.py`: Blender headless turntable renderer (requires a real model).
- `scripts/encode_video.sh`: FFmpeg MP4/WebM encoder.
- `references/integration.md`: practical integration guidance.

## Example commands
```bash
blender -b -P scripts/render_turntable.py -- --model /absolute/path/car.glb --output /absolute/path/frames --frames 120 --width 1280 --height 720
bash scripts/encode_video.sh /absolute/path/frames /absolute/path/output 30
```

## Deliverables
- `car-turntable.mp4` looped, muted, browser/mobile-compatible
- `car-turntable-alpha.webm` if transparent alpha encoding works on target platform
- `car-poster.png` still frame
- original or corrected `.glb` if license permits
- integration changes and concise validation report

## Quality bar
Never substitute a 2D perspective warp for a real model. Favor believable body shape and consistent highlights over exaggerated reflections. Report uncertainties in the rear, far side, and underbody reconstructed from one image.
