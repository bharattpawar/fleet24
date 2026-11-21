// Original Fleet24 partner mascots. This 3D renderer is a build tool, never an app dependency.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const role = new URLSearchParams(location.search).get('role');
if (!['rider', 'restaurant'].includes(role)) throw new Error('Choose rider or restaurant.');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(480, 480); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(), model = new THREE.Group(); scene.add(model);
const camera = new THREE.OrthographicCamera(-2.3, 2.3, 2.3, -2.3, 0.1, 40);
camera.position.set(role === 'rider' ? 4.6 : 4, 3.5, 8.8); camera.lookAt(0, 1.6, 0);
scene.add(new THREE.HemisphereLight(0xfff8e9, 0x728574, 2.4));
const sun = new THREE.DirectionalLight(0xffefd4, 4);
sun.position.set(-3, 7, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 5, bottom: -4, near: 0.1, far: 20 });
sun.shadow.normalBias = 0.04; sun.shadow.bias = -0.0002; sun.shadow.radius = 5; scene.add(sun);
const rim = new THREE.DirectionalLight(0xe3f4dc, 2.8); rim.position.set(3, 4, -5); scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.13 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = 0.012; floor.receiveShadow = true; scene.add(floor);
const materials = new Map();
function material(color, roughness = 0.6, metalness = 0) {
  const key = `${color}:${roughness}:${metalness}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return materials.get(key);
}
const green = material('#24533F', 0.4), lime = material('#D9F078'), cream = material('#F8EEDC'),
  skin = material(role === 'rider' ? '#C98F68' : '#BD8158'), hair = material('#2D2822'), dark = material('#283B32'),
  white = material('#FFFCF2'), rubber = material('#28322D', 0.85), steel = material('#AABCAF', 0.3, 0.65);
function mesh(geometry, mat, parent = model) { const m = new THREE.Mesh(geometry, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
function sphere(position, scale, mat, parent = model) { const m = mesh(new THREE.SphereGeometry(1, 32, 24), mat, parent); m.position.set(...position); m.scale.set(...scale); return m; }
function box(position, size, radius, mat, parent = model) { const m = mesh(new RoundedBoxGeometry(...size, 4, radius), mat, parent); m.position.set(...position); return m; }
const vector = a => new THREE.Vector3(...a);
function placeLink(m, a, b, radius) {
  a = vector(a); b = vector(b); const delta = b.clone().sub(a);
  m.position.copy(a.clone().add(b).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  m.scale.set(radius, delta.length(), radius);
}
function link(a, b, radius, mat, parent = model) { const m = mesh(new THREE.CylinderGeometry(1, 1, 1, 20), mat, parent); placeLink(m, a, b, radius); return m; }
function tube(points, radius, mat, parent = model) { return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(vector)), 28, radius, 10, false), mat, parent); }
function badge(parent, position, scale = 1) {
  const group = new THREE.Group(); group.position.set(...position); group.scale.setScalar(scale); parent.add(group);
  box([0, 0, 0], [0.4, 0.33, 0.026], 0.05, lime, group);
  link([-0.09, -0.1, 0.025], [-0.09, 0.06, 0.025], 0.012, green, group);
  for (const x of [-0.125, -0.09, -0.055]) link([x, 0.04, 0.025], [x, 0.12, 0.025], 0.008, green, group);
  link([0.09, -0.1, 0.025], [0.09, 0.06, 0.025], 0.012, green, group);
  sphere([0.09, 0.095, 0.025], [0.035, 0.05, 0.012], green, group);
}
function face(position, parent, withHair = true) {
  const head = new THREE.Group(); head.position.set(...position); parent.add(head);
  sphere([0, 0, 0], [0.36, 0.4, 0.32], skin, head);
  if (withHair) { sphere([0, 0.13, -0.08], [0.36, 0.34, 0.3], hair, head); sphere([-0.16, 0.22, 0.18], [0.19, 0.12, 0.13], hair, head); }
  const eyes = [];
  for (const x of [-0.145, 0.145]) {
    const eye = new THREE.Group(); eye.position.set(x, 0.06, 0.285); head.add(eye); eyes.push(eye);
    sphere([0, 0, 0], [0.065, 0.087, 0.04], white, eye);
    sphere([0.012, 0, 0.035], [0.034, 0.052, 0.02], hair, eye);
    sphere([0.02, 0.02, 0.052], [0.014, 0.018, 0.01], white, eye);
    link([x - 0.055, 0.19, 0.27], [x + 0.04, 0.2, 0.29], 0.019, hair, head);
  }
  sphere([0, -0.04, 0.34], [0.07, 0.07, 0.1], skin, head);
  tube([[-0.1, -0.17, 0.27], [0, -0.2, 0.315], [0.1, -0.17, 0.27]], 0.015, material('#814A37'), head);
  for (const x of [-0.35, 0.35]) sphere([x, -0.015, -0.02], [0.055, 0.11, 0.08], skin, head);
  return { head, eyes };
}
function blink(eyes, phase) {
  const gap = Math.abs(phase - 0.76);
  const openness = gap < 0.025 ? 0.12 + gap / 0.025 * 0.88 : 1;
  eyes.forEach(eye => { eye.scale.y = openness; });
}

function courier() {
  const wheels = [];
  for (const x of [-1.03, 1.05]) {
    const wheel = new THREE.Group(); wheel.position.set(x, 0.5, 0); model.add(wheel); wheels.push(wheel);
    mesh(new THREE.TorusGeometry(0.4, 0.095, 24, 64), rubber, wheel);
    mesh(new THREE.TorusGeometry(0.325, 0.026, 12, 64), steel, wheel);
    sphere([0, 0, 0], [0.12, 0.12, 0.15], green, wheel);
    for (let j = 0; j < 5; j++) {
      const a = j / 5 * Math.PI * 2;
      link([0, 0, 0.04], [Math.cos(a) * 0.31, Math.sin(a) * 0.31, 0.04], 0.025, steel, wheel);
    }
    box([0.26, 0, 0.06], [0.08, 0.035, 0.03], 0.01, lime, wheel);
  }
  box([-0.08, 0.72, 0], [1.72, 0.15, 0.65], 0.07, cream);
  box([-0.89, 0.96, 0], [0.91, 0.53, 0.66], 0.22, green);
  box([-0.63, 1.32, 0], [1.05, 0.16, 0.61], 0.075, dark);
  const shield = box([0.67, 1.1, 0], [0.25, 0.91, 0.66], 0.12, green); shield.rotation.z = -0.18;
  box([0.77, 1.18, 0], [0.06, 0.46, 0.5], 0.025, lime).rotation.z = -0.18;
  link([0.85, 0.5, 0], [0.81, 1.73, 0], 0.055, steel);
  const fender = box([1.03, 0.9, 0], [0.64, 0.16, 0.38], 0.075, cream); fender.rotation.z = -0.12;
  box([0.88, 1.66, 0], [0.27, 0.22, 0.55], 0.09, green);
  sphere([1.03, 1.68, 0], [0.04, 0.092, 0.18], white);
  for (const z of [-0.34, 0.34]) { link([0.83, 1.68, 0], [0.78, 1.72, z], 0.03, steel); link([0.77, 1.72, z], [0.64, 1.72, z], 0.04, rubber); }
  link([0.75, 1.75, -0.3], [0.8, 2.04, -0.36], 0.018, steel);
  sphere([0.8, 2.06, -0.36], [0.08, 0.055, 0.03], steel);
  box([-1.29, 1.12, 0], [0.08, 0.1, 0.26], 0.025, material('#D78C65'));
  const cargo = new THREE.Group(); model.add(cargo);
  box([-1.07, 1.79, 0], [0.73, 0.78, 0.72], 0.09, green, cargo);
  box([-1.07, 2.12, 0], [0.76, 0.15, 0.75], 0.06, lime, cargo);
  badge(cargo, [-1.07, 1.76, 0.37], 1.12);
  box([-1.07, 1.49, 0.37], [0.62, 0.045, 0.02], 0.01, cream, cargo);
  const body = new THREE.Group(); model.add(body);
  const jacket = box([-0.3, 1.99, 0], [0.61, 0.74, 0.53], 0.16, cream, body); jacket.rotation.z = -0.1;
  box([-0.3, 1.68, 0], [0.56, 0.16, 0.5], 0.065, green, body);
  tube([[-0.1, 2.3, 0.26], [-0.07, 1.98, 0.28], [-0.2, 1.69, 0.28]], 0.02, green, body);
  link([-0.43, 2.06, 0.274], [-0.29, 2.06, 0.274], 0.022, green, body);
  sphere([-0.1, 2.41, 0], [0.12, 0.18, 0.12], skin, body);
  const { head, eyes } = face([0.02, 2.75, 0], body); head.rotation.y = Math.PI / 2;
  // Ponytail, tucked safely behind the helmet, makes this courier distinct from the customer cyclist.
  sphere([0, -0.06, -0.4], [0.15, 0.14, 0.18], hair, head);
  sphere([0.02, -0.24, -0.48], [0.12, 0.23, 0.12], hair, head);
  mesh(new THREE.TorusGeometry(0.1, 0.02, 10, 30), lime, head).position.set(0, -0.08, -0.43);
  const helmet = mesh(new THREE.SphereGeometry(0.43, 36, 26, 0, Math.PI * 2, 0, Math.PI * 0.55), green, head); helmet.position.y = 0.19; helmet.scale.y = 0.8;
  box([0, 0.23, 0.33], [0.6, 0.05, 0.29], 0.023, green, head);
  tube([[0, 0.29, 0.39], [0, 0.48, 0.2], [0, 0.52, -0.09], [0, 0.39, -0.33]], 0.04, lime, head);
  for (const x of [-0.32, 0.32]) tube([[x, 0.19, 0.02], [x * 0.8, -0.2, 0.1], [0, -0.24, 0.21]], 0.013, green, head);
  const arms = [], legs = [];
  for (const z of [-0.26, 0.26]) {
    arms.push({ z, sleeve: link([0, 0, 0], [0, 1, 0], 0.105, cream), forearm: link([0, 0, 0], [0, 1, 0], 0.075, skin), hand: sphere([0.69, 1.73, z * 1.25], [0.095, 0.085, 0.085], skin) });
    legs.push({ z, thigh: link([0, 0, 0], [0, 1, 0], 0.12, dark), shin: link([0, 0, 0], [0, 1, 0], 0.085, dark) });
    box([0.4, 0.86, z * 1.08], [0.39, 0.14, 0.19], 0.06, white);
    box([0.4, 0.795, z * 1.08], [0.4, 0.032, 0.2], 0.01, green);
  }
  return phase => {
    const a = phase * Math.PI * 2, bob = Math.sin(a * 2) * 0.017;
    wheels.forEach(wheel => { wheel.rotation.z = -a * 2; });
    body.position.y = bob; cargo.position.y = bob * 0.7;
    head.rotation.y = Math.PI / 2 + Math.sin(a) * 0.055;
    head.rotation.z = Math.sin(a * 2) * 0.015; blink(eyes, phase);
    arms.forEach(({ z, sleeve, forearm }) => {
      const elbow = [0.26, 1.94 + bob * 0.5, z * 1.1];
      placeLink(sleeve, [-0.13, 2.18 + bob, z], elbow, 0.105);
      placeLink(forearm, elbow, [0.69, 1.73, z * 1.25], 0.075);
    });
    legs.forEach(({ z, thigh, shin }) => {
      const knee = [0.28, 1.4 + bob * 0.4, z * 1.08];
      placeLink(thigh, [-0.33, 1.58 + bob, z], knee, 0.12);
      placeLink(shin, knee, [0.34, 0.97, z * 1.08], 0.085);
    });
  };
}

function chef() {
  // The cooking action has a stable counter/hob, a wrist-held pan and actual flying food meshes.
  box([0.88, 0.7, 0.03], [1.82, 1.25, 0.94], 0.08, green);
  box([0.88, 1.35, 0.03], [2.0, 0.16, 1.08], 0.07, cream);
  box([0.88, 1.44, 0.12], [1.0, 0.06, 0.72], 0.06, dark);
  const burner = mesh(new THREE.TorusGeometry(0.27, 0.018, 12, 50), lime); burner.rotation.x = Math.PI / 2; burner.position.set(0.92, 1.48, 0.15);
  for (const x of [0.45, 1.27]) { box([x, 0.68, 0.51], [0.71, 0.98, 0.03], 0.045, material('#2D6248')); link([x - 0.12, 1.04, 0.55], [x + 0.12, 1.04, 0.55], 0.023, steel); }
  badge(model, [0.89, 0.64, 0.55], 1.2);
  const torso = new THREE.Group(); model.add(torso);
  box([-0.63, 1.99, 0], [0.75, 0.94, 0.59], 0.17, white, torso);
  box([-0.63, 1.74, 0.31], [0.55, 0.64, 0.04], 0.05, green, torso);
  box([-0.63, 2.07, 0.32], [0.39, 0.32, 0.045], 0.055, green, torso);
  tube([[-0.79, 2.18, 0.31], [-0.76, 2.46, 0.15], [-0.47, 2.46, 0.15], [-0.47, 2.18, 0.31]], 0.022, green, torso);
  badge(torso, [-0.63, 1.86, 0.345], 0.65);
  for (const x of [-0.91, -0.36]) for (const y of [2.13, 2.27]) sphere([x, y, 0.265], [0.024, 0.024, 0.016], green, torso);
  for (const x of [-0.83, -0.43]) {
    link([x, 1.58, 0], [x, 0.32, 0], 0.14, dark);
    box([x, 0.15, 0.1], [0.29, 0.23, 0.49], 0.09, dark);
  }
  sphere([-0.63, 2.48, 0], [0.14, 0.2, 0.14], skin, torso);
  const { head, eyes } = face([-0.61, 2.88, 0], torso);
  head.rotation.y = 0.17;
  const hatBase = mesh(new THREE.CylinderGeometry(0.36, 0.34, 0.2, 40), white, head); hatBase.position.y = 0.31;
  for (const [x, y, z, sx, sy] of [[0, 0.53, 0, 0.33, 0.26], [-0.23, 0.5, 0.02, 0.23, 0.23], [0.23, 0.5, 0.02, 0.23, 0.23], [-0.1, 0.53, 0.16, 0.22, 0.23], [0.12, 0.54, 0.15, 0.22, 0.24]]) sphere([x, y, z], [sx, sy, 0.23], white, head);
  const pan = new THREE.Group(); model.add(pan);
  const profile = [[0, 0], [0.21, 0], [0.36, 0.025], [0.44, 0.1], [0.46, 0.15]].map(([r, y]) => new THREE.Vector2(r, y));
  const panMat = material('#46564C', 0.3, 0.6).clone(); panMat.side = THREE.DoubleSide;
  const bowl = mesh(new THREE.LatheGeometry(profile, 50), panMat, pan); bowl.position.set(0.83, -0.11, 0);
  const rim = mesh(new THREE.TorusGeometry(0.46, 0.02, 12, 60), steel, pan); rim.rotation.x = Math.PI / 2; rim.position.set(0.83, 0.04, 0);
  box([0.26, -0.03, 0], [0.55, 0.07, 0.12], 0.028, dark, pan);
  const food = [];
  const foodMaterials = ['#DB8144', '#DDB955', '#81A65B', '#C86345', '#E8C97E'].map(c => material(c));
  for (let i = 0; i < 15; i++) {
    const angle = i * 2.39996, radius = 0.12 + (i % 3) * 0.065;
    const item = box([0, 0, 0], [0.1 + (i % 2) * 0.03, 0.1, 0.09], 0.028, foodMaterials[i % 5], pan);
    food.push({ item, x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, i });
  }
  const rightUpper = link([0, 0, 0], [0, 1, 0], 0.12, white), rightLower = link([0, 0, 0], [0, 1, 0], 0.08, skin);
  const rightHand = sphere([0, 0, 0], [0.1, 0.09, 0.1], skin);
  const leftUpper = link([-1.02, 2.23, 0], [-1.22, 1.98, 0.2], 0.12, white);
  const leftLower = link([-1.22, 1.98, 0.2], [-1.1, 2.19, 0.38], 0.08, skin);
  const leftHand = sphere([-1.1, 2.19, 0.38], [0.095, 0.1, 0.09], skin);
  const spatula = new THREE.Group(); model.add(spatula);
  link([0, -0.02, 0], [0, 0.45, 0], 0.026, material('#C09B66'), spatula);
  box([0, 0.56, 0], [0.17, 0.25, 0.045], 0.04, material('#C09B66'), spatula);
  const steam = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshStandardMaterial({ color: '#E9EEDC', transparent: true, opacity: 0.25, depthWrite: false });
    const puff = sphere([0, 0, 0], [0.05, 0.1, 0.05], m); puff.castShadow = false;
    steam.push(puff);
  }
  return phase => {
    const a = phase * Math.PI * 2, bob = Math.sin(a) * 0.014;
    torso.position.y = bob; head.rotation.y = 0.17 + Math.sin(a) * 0.04; head.rotation.x = -0.02 + Math.sin(a) * 0.025; blink(eyes, phase);
    const grip = [0.18, 1.88 + Math.sin(a) * 0.055, 0.46];
    pan.position.set(...grip); pan.rotation.z = -0.05 + Math.sin(a - 0.6) * 0.16;
    const flightPhase = (phase - 0.12) / 0.56;
    const flying = flightPhase > 0 && flightPhase < 1;
    const lift = flying ? Math.sin(Math.PI * flightPhase) : 0;
    food.forEach(({ item, x, z, i }) => {
      item.position.set(0.83 + x + lift * 0.16, 0.015 + (0.6 + (i % 4) * 0.07) * lift, z);
      const spin = flying ? flightPhase * Math.PI * 2 : 0;
      item.rotation.set(spin + i * 0.4, spin + i, spin);
    });
    const elbow = [-0.02, 2.05 + bob, 0.25];
    placeLink(rightUpper, [-0.28, 2.25 + bob, 0], elbow, 0.12); placeLink(rightLower, elbow, grip, 0.08); rightHand.position.set(...grip);
    const leftGrip = [-1.1, 2.19 + Math.sin(a) * 0.03, 0.38];
    placeLink(leftUpper, [-1.02, 2.23 + bob, 0], [-1.22, 1.98 + bob, 0.2], 0.12);
    placeLink(leftLower, [-1.22, 1.98 + bob, 0.2], leftGrip, 0.08); leftHand.position.set(...leftGrip);
    spatula.position.set(...leftGrip); spatula.rotation.z = -0.16 + Math.sin(a) * 0.1;
    steam.forEach((puff, i) => { const t = (phase + i / 3) % 1; puff.position.set(1.02 + Math.sin(t * Math.PI * 2) * 0.08, 1.95 + t * 0.6, 0.42); puff.material.opacity = Math.sin(t * Math.PI) * 0.2; });
  };
}

const animate = role === 'rider' ? courier() : chef();
window.renderCharacter = function (phase) { animate(phase); renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); };
window.renderCharacter(0);
