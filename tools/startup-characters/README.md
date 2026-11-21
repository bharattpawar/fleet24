# Partner startup characters

Two original articulated 3D scenes extend the customer's Fleet24 intro style:

- **Rider:** a helmeted delivery courier with a ponytail riding a green/cream scooter, rotating wheels, stable grips/footrests, a dimensional delivery box, suspension/body motion and a subtle blink. Runtime scenery moves in parallax.
- **Restaurant:** a chef in a toque and green apron holding a spatula and tossing vegetables in a wrist-held pan above an induction hob. Hands follow their props; food follows an airborne arc and completes its rotation before landing. Steam and a gentle head/body motion complete the loop.

## Rebuild

Three.js 0.187.0 and Playwright are isolated **build tools**, not app packages. Rendering uses installed Microsoft Edge through Playwright/SwiftShader. Packing needs Python/Pillow. All original geometry, materials, lighting and animation math live in `scene.mjs`.

From the repo root, using your own tools and temporary-frame folders:

```powershell
node tools/startup-characters/render.cjs rider <tools>/node_modules/three <tools>/node_modules/playwright <courier-frames>
python tools/startup-characters/pack.py rider <courier-frames> rider-app/assets/illustrations/startup --preview <courier-preview.webp>

node tools/startup-characters/render.cjs restaurant <tools>/node_modules/three <tools>/node_modules/playwright <chef-frames>
python tools/startup-characters/pack.py restaurant <chef-frames> restaurant-app/assets/illustrations/startup --preview <chef-preview.webp>
```

Each output includes 48 poses, a 3840 × 2880 transparent WebP atlas, a smaller first-pose poster and playback metadata. The packer checks the loop endpoint and that poses actually change. Three.js and RoundedBoxGeometry are MIT licensed external build tools; the characters and scenes are original Fleet24 code.

## Runtime

Each Expo app owns its bundled assets and small startup components, so it builds independently without Metro workspace/cross-project imports. Both use the same frame-selection and lifecycle design. No native package, API permission, backend route, database migration or env variable was added.

`AppExperience` mounts inside the existing auth provider above the unchanged navigator. Fonts and authentication initialize underneath the splash, rather than holding the app at a blank font-loading return. Existing login, registration, approval gates, tabs and operational permissions remain in place.

The local atlas plays at 32 fps using native Animated transform tracks on iOS/Android and the web driver in the browser. React does not update the pose through state on every frame. A poster covers the initial load and image failure. Reduced motion displays only that poster, disables scenery movement and shortens the hold. AppState stops animation in the background; all loops/listeners stop on unmount.

Ordinary startup holds for 1.7 seconds so a complete loop is visible, then reveals a ready app. A 4-second deadline and bounded exit prevent a slow auth/font request from trapping the customer behind the intro. The underlying auth screen retains its own existing loading/error behavior. Intro timers do not approve a user or bypass an onboarding gate.

The startup colours, character assets, branding and copy are bundled, as in the customer intro. They are not admin-managed visuals. DM Sans is included with its OFL license for the intro; the apps' existing Instrument Serif font remains available to their screens.

## Validation

Both app typechecks and test suites pass, including three new tests per app covering the correct offline assets, all frame/cell/row boundaries, responsive scaling and loop reset. Browser QA checks 360, 390 and 1280px layouts, changing rendered poses, stalled-auth deadlines, ready startup, reduced motion and a failed-atlas poster fallback. Native iOS bundle compilation passes for both apps. A physical phone GPU/decoder check is still separate from bundle compilation.
