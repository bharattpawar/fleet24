// Original Fleet24 3D character. Build-time only: no WebGL/Three.js dependency in the app.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(480, 480);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-2.45, 2.45, 2.45, -2.45, 0.1, 40);
camera.position.set(4.7, 3.4, 8.7);
camera.lookAt(0, 1.72, 0);
scene.add(new THREE.HemisphereLight(0xfff8e9, 0x728574, 2.3));
const sun = new THREE.DirectionalLight(0xffefd4, 4.2);
sun.position.set(-3, 7, 5); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 5, bottom: -4, near: 0.1, far: 20 });
sun.shadow.normalBias = 0.04; sun.shadow.bias = -0.0002; sun.shadow.radius = 5;
scene.add(sun);
const rim = new THREE.DirectionalLight(0xe3f4dc, 3); rim.position.set(3, 4, -5); scene.add(rim);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.14 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.position.y = 0.015; scene.add(ground);
const materials = {};
function mat(color, roughness = 0.65, metalness = 0) {
  const key = `${color}:${roughness}:${metalness}`;
  return materials[key] ||= new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
const green = mat('#24533F', 0.4), lime = mat('#D9F078', 0.5), cream = mat('#F5EBD5'), pants = mat('#263C36'),
  skin = mat('#C9885D'), hair = mat('#30281F'), tire = mat('#26332E', 0.85), metal = mat('#9BAF9F', 0.3, 0.65), white = mat('#FFFCF3');
const rider = new THREE.Group(); scene.add(rider);
function mesh(geometry, material, parent = rider) {
  const item = new THREE.Mesh(geometry, material); item.castShadow = true; item.receiveShadow = true; parent.add(item); return item;
}
function sphere(at, scale, material, parent = rider) {
  const item = mesh(new THREE.SphereGeometry(1, 32, 24), material, parent); item.position.set(...at); item.scale.set(...scale); return item;
}
function box(at, size, radius, material, parent = rider) {
  const item = mesh(new RoundedBoxGeometry(...size, 4, radius), material, parent); item.position.set(...at); return item;
}
const v = a => new THREE.Vector3(...a);
function placeLink(item, a, b, radius) {
  a = v(a); b = v(b); const direction = b.clone().sub(a);
  item.position.copy(a.clone().add(b).multiplyScalar(0.5));
  item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  item.scale.set(radius, direction.length(), radius);
}
function link(a, b, radius, material, parent = rider) {
  const item = mesh(new THREE.CylinderGeometry(1, 1, 1, 20), material, parent); placeLink(item, a, b, radius); return item;
}
function tube(points, radius, material, parent = rider) {
  const curve = new THREE.CatmullRomCurve3(points.map(v)); return mesh(new THREE.TubeGeometry(curve, 36, radius, 10, false), material, parent);
}

// A real bicycle frame, hub/spokes, forks, drivetrain, handlebars and contact shadows.
const rear = [-1.05, 0.66, 0], front = [1.16, 0.66, 0], crank = [-0.08, 0.88, 0], seatTube = [-0.5, 1.6, 0], headTube = [0.78, 1.52, 0];
const wheelGroups = [];
for (const center of [rear, front]) {
  const wheel = new THREE.Group(); wheel.position.set(...center); rider.add(wheel); wheelGroups.push(wheel);
  mesh(new THREE.TorusGeometry(0.574, 0.075, 20, 72), tire, wheel);
  mesh(new THREE.TorusGeometry(0.537, 0.023, 12, 72), metal, wheel);
  sphere([0, 0, 0], [0.09, 0.09, 0.12], green, wheel);
  for (let j = 0; j < 10; j++) { const angle = j / 10 * Math.PI * 2; link([0, 0, 0], [Math.cos(angle) * 0.53, Math.sin(angle) * 0.53, 0], 0.009, metal, wheel); }
  for (const j of [0, 1]) { const reflector = box([j ? -0.38 : 0.38, 0, 0.025], [0.12, 0.045, 0.035], 0.013, lime, wheel); reflector.rotation.z = 0.1; }
}
for (const [a, b] of [[rear, seatTube], [seatTube, headTube], [headTube, crank], [crank, rear], [seatTube, crank]]) link(a, b, 0.048, green);
for (const z of [-0.095, 0.095]) { link([0.83, 1.64, z], [1.16, 0.66, z], 0.033, green); link([-0.5, 1.68, z], [-1.05, 0.66, z], 0.027, metal); }
link([-0.5, 1.58, 0], [-0.5, 1.79, 0], 0.034, metal);
const saddle = box([-0.48, 1.8, 0], [0.43, 0.09, 0.24], 0.04, pants); saddle.rotation.z = -0.06;
link([0.8, 1.55, 0], [0.81, 1.88, 0], 0.035, metal);
tube([[0.81, 1.85, -0.3], [0.88, 1.91, -0.25], [0.89, 1.91, 0.25], [0.81, 1.85, 0.3]], 0.028, metal);
for (const z of [-0.3, 0.3]) link([0.82, 1.85, z], [0.69, 1.83, z], 0.045, pants);
box([0.91, 1.72, 0], [0.08, 0.12, 0.1], 0.035, lime);
const drivetrain = new THREE.Group(); drivetrain.position.set(...crank); rider.add(drivetrain);
mesh(new THREE.TorusGeometry(0.13, 0.027, 12, 40), metal, drivetrain);
tube([[-1.05, 0.76, 0.1], [-0.08, 1.0, 0.1], [0.04, 0.88, 0.1], [-0.08, 0.75, 0.1], [-1.05, 0.57, 0.1]], 0.013, pants);

// Torso, helmet and insulated delivery backpack are independent articulated meshes.
const body = new THREE.Group(); rider.add(body);
const torso = box([-0.28, 2.22, 0], [0.65, 0.76, 0.5], 0.17, green, body); torso.rotation.z = -0.3;
box([-0.23, 1.94, 0], [0.49, 0.18, 0.43], 0.07, pants, body);
for (const z of [-0.255, 0.255]) tube([[-0.38, 2.57, z], [-0.52, 2.32, z * 1.05], [-0.4, 2.0, z]], 0.032, lime, body);
link([0.03, 2.36, 0.265], [0.16, 2.31, 0.265], 0.025, lime, body);
const backpack = new THREE.Group(); backpack.position.set(-0.83, 2.35, 0); backpack.rotation.z = -0.15; body.add(backpack);
box([0, 0, 0], [0.6, 0.74, 0.66], 0.11, lime, backpack);
box([0, 0.3, 0], [0.63, 0.18, 0.68], 0.07, green, backpack);
box([-0.305, -0.02, 0], [0.025, 0.08, 0.62], 0.008, white, backpack);
box([0, -0.02, 0.34], [0.41, 0.33, 0.025], 0.055, green, backpack);
// A tiny dimensional fork-and-spoon badge on the visible bag face.
link([-0.09, -0.1, 0.365], [-0.09, 0.07, 0.365], 0.012, lime, backpack);
for (const x of [-0.125, -0.09, -0.055]) link([x, 0.04, 0.365], [x, 0.12, 0.365], 0.008, lime, backpack);
link([0.09, -0.1, 0.365], [0.09, 0.06, 0.365], 0.012, lime, backpack);
sphere([0.09, 0.095, 0.365], [0.035, 0.05, 0.012], lime, backpack);
sphere([0.08, 2.69, 0], [0.13, 0.19, 0.13], skin, body);
const head = new THREE.Group(); head.position.set(0.17, 3.06, 0); head.rotation.z = -0.07; body.add(head);
sphere([0, 0, 0], [0.37, 0.42, 0.33], skin, head);
sphere([-0.09, 0.1, 0], [0.32, 0.38, 0.34], hair, head);
// Face points in the direction of travel, with both eyes modeled in 3D.
for (const z of [-0.165, 0.165]) {
  sphere([0.299, 0.075, z], [0.034, 0.095, 0.069], white, head);
  sphere([0.33, 0.075, z + 0.006], [0.022, 0.055, 0.036], hair, head);
  sphere([0.349, 0.096, z + 0.015], [0.01, 0.019, 0.014], white, head);
  link([0.285, 0.215, z - 0.045], [0.313, 0.225, z + 0.045], 0.02, hair, head);
}
sphere([0.365, -0.03, 0], [0.09, 0.075, 0.085], skin, head);
tube([[0.315, -0.17, -0.09], [0.35, -0.19, 0], [0.315, -0.17, 0.09]], 0.014, mat('#8A4A37'), head);
for (const z of [-0.335, 0.335]) sphere([-0.04, -0.035, z], [0.09, 0.12, 0.055], skin, head);
const helmet = mesh(new THREE.SphereGeometry(0.44, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.55), green, head); helmet.position.set(-0.01, 0.19, 0); helmet.scale.set(1.02, 0.8, 0.96);
box([0.31, 0.23, 0], [0.35, 0.055, 0.6], 0.025, green, head);
tube([[0.37, 0.3, 0], [0.21, 0.48, 0], [-0.05, 0.53, 0], [-0.32, 0.4, 0]], 0.045, lime, head);
for (const z of [-0.32, 0.32]) tube([[0.02, 0.2, z], [0.12, -0.22, z * 0.8], [0.25, -0.22, 0]], 0.014, green, head);

const arms = [];
for (const z of [-0.27, 0.27]) {
  const sleeve = link([0.04, 2.47, z], [0.35, 2.13, z * 1.12], 0.115, green);
  const forearm = link([0.35, 2.13, z * 1.12], [0.74, 1.87, z * 1.1], 0.083, skin);
  const hand = sphere([0.74, 1.86, z * 1.1], [0.105, 0.09, 0.09], skin);
  arms.push({ sleeve, forearm, hand, z });
}
const legs = [];
for (const z of [-0.2, 0.2]) {
  const thigh = link([0, 0, 0], [0, 1, 0], 0.12, pants);
  const shin = link([0, 0, 0], [0, 1, 0], 0.085, pants);
  const knee = sphere([0, 0, 0], [0.12, 0.12, 0.12], pants);
  const shoe = box([0, 0, 0], [0.36, 0.14, 0.2], 0.06, cream);
  const sole = box([0, 0, 0], [0.37, 0.038, 0.21], 0.015, green);
  const pedal = box([0, 0, 0], [0.22, 0.05, 0.22], 0.012, metal);
  const crankArm = link([0, 0, 0], [0, 1, 0], 0.024, metal);
  legs.push({ thigh, shin, knee, shoe, sole, pedal, crankArm, z });
}
function kneePosition(hip, ankle) {
  // Two-bone inverse kinematics: the knee bends forward while the foot remains on its pedal.
  const dx = ankle[0] - hip[0], dy = ankle[1] - hip[1], d = Math.hypot(dx, dy);
  const upper = 0.66, lower = 0.67, along = (upper ** 2 - lower ** 2 + d ** 2) / (2 * d);
  const bend = Math.sqrt(Math.max(0, upper ** 2 - along ** 2));
  return [hip[0] + dx / d * along - dy / d * bend, hip[1] + dy / d * along + dx / d * bend, hip[2]];
}
window.renderRider = function (phase) {
  const angle = phase * Math.PI * 2, bob = Math.cos(angle * 2) * 0.012;
  rider.rotation.y = Math.sin(angle) * 0.018;
  body.position.y = bob; body.rotation.x = Math.sin(angle) * 0.015;
  wheelGroups.forEach(wheel => { wheel.rotation.z = -angle * 2; });
  drivetrain.rotation.z = -angle;
  legs.forEach(({ thigh, shin, knee, shoe, sole, pedal, crankArm, z }, index) => {
    const theta = -angle + index * Math.PI;
    const hip = [-0.39, 1.92 + bob, z];
    const foot = [crank[0] + Math.cos(theta) * 0.23, crank[1] + Math.sin(theta) * 0.23, z * 1.3];
    const ankle = [foot[0] - 0.045, foot[1] + 0.12, foot[2]];
    const joint = kneePosition(hip, ankle);
    placeLink(thigh, hip, joint, 0.12); placeLink(shin, joint, ankle, 0.085); knee.position.set(...joint);
    shoe.position.set(ankle[0] + 0.055, ankle[1] - 0.055, ankle[2]); shoe.rotation.z = Math.sin(theta) * 0.1;
    sole.position.copy(shoe.position); sole.position.y -= 0.063; sole.rotation.z = shoe.rotation.z;
    pedal.position.set(...foot); placeLink(crankArm, [crank[0], crank[1], foot[2]], foot, 0.024);
  });
  arms.forEach(({ sleeve, forearm, hand, z }) => {
    const shoulder = [0.04, 2.47 + bob, z], elbow = [0.35, 2.13 + bob * 0.5, z * 1.12], grip = [0.74, 1.87, z * 1.1];
    placeLink(sleeve, shoulder, elbow, 0.115); placeLink(forearm, elbow, grip, 0.083); hand.position.set(...grip);
  });
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
};
window.renderRider(0);
