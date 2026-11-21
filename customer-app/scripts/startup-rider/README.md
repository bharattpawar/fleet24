# Fleet24 startup rider

Original articulated 3D character and bicycle. The 48-frame cycle includes two-bone leg IK, attached feet/pedals, rotating wheels/spokes/reflectors and crank, torso movement, helmet, bag, lighting and shadows. Phase 0 and phase 1 are pixel-matched when packing to verify a seamless loop.

The app displays the render at 32 fps using a single bundled 3840 × 2880 WebP atlas (about 1 MB). Native Animated transform tracks select complete poses without React state updates per frame. A smaller poster covers loading/failure and reduced motion. Road marks and the distant skyline move at different speeds. Playback stops when the splash unmounts. There are no added app packages, permissions, environment variables or network-dependent animation assets.

Build tooling stays outside the app runtime. Install Three.js **0.187.0** and Playwright in an isolated tools folder, then run from the repository root:

```powershell
node customer-app/scripts/startup-rider/render.cjs <tools>/node_modules/three <tools>/node_modules/playwright <temporary-frames>
python customer-app/scripts/startup-rider/pack.py <temporary-frames> customer-app/assets/illustrations/rider --preview <preview.webp>
```

Rendering uses installed Microsoft Edge through Playwright (SwiftShader supports headless machines). Packing needs Python/Pillow. `scene.mjs` contains all original mesh construction and pose math; the external Three.js renderer and RoundedBoxGeometry are MIT licensed build tools. The generated assets ship with the source, so app builds do not need those tools or WebGL.

The destination app renders underneath immediately. The ordinary intro holds for 1.7 seconds so a cycle is visible, then reveals a ready app. A 4-second network/auth deadline plus a bounded exit protects stalled startups. Reduced motion removes the forced ride and uses the static poster. Unit tests cover every atlas cell, loop reset, deadline, reduced motion and timer cleanup. Browser QA checks changing displayed poses, responsive layouts and the deadline; native iOS bundle compilation checks Expo Go compatibility. Physical device GPU/image decoding still needs device validation.
