# M3AK integration notes

## Web React
Use `<video autoPlay muted loop playsInline preload="metadata" poster="/assets/car-poster.png"><source src="/assets/car-turntable.webm" type="video/webm" /><source src="/assets/car-turntable.mp4" type="video/mp4" /></video>` where WebM is the supported desired output. For transparent WebM, use the `-alpha.webm` file only after browser testing. CSS `object-fit: contain`, fixed aspect ratio and responsive sizing. For reduced motion, hide video and show poster using `prefers-reduced-motion: reduce`.

## React Native
Detect the existing video player dependency (for example expo-video or react-native-video) and follow its API; do not add a new dependency without approval. Use bundled or remote MP4, mute, repeat, contain resize, poster/fallback, and pause playback when offscreen. Alpha video support varies widely; prefer a solid background MP4 for consistent iOS/Android playback.

## Interactive optional
For React web use a GLB loader, OrbitControls with autoRotate optional, `enablePan=false`, `minPolarAngle` and `maxPolarAngle` around 65–85 degrees, and appropriate camera distance bounds. Do not promise interactive GLB works in native mobile without verifying the rendering stack.

## Verification
Inspect 0, 25, 50 and 75 percent rotation frames. Test MP4 playback on iOS and Android, reduced-motion behavior, responsive sizing, loop seam, and frame-rate performance. A perfect visual match to the source image is impossible to certify from a single view.
