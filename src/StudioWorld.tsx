import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type StudioFocus = "studio" | "radar" | "vektr" | "lab";

type Props = {
  focus: StudioFocus;
  onFocus: (focus: StudioFocus) => void;
  onAgentSelect: (name: string) => void;
};

type Stop = {
  point: THREE.Vector3;
  activity: "walking" | "working" | "researching" | "reviewing" | "collaborating";
  wait?: number;
  face?: number;
};

type Agent = {
  group: THREE.Group;
  route: Stop[];
  stop: number;
  speed: number;
  phase: number;
  waiting: number;
  ring: THREE.Mesh;
  badge: THREE.Sprite;
  activity: Stop["activity"];
  accent: number;
};

const focusTargets: Record<StudioFocus, THREE.Vector3> = {
  studio: new THREE.Vector3(0, 2.1, -0.8),
  radar: new THREE.Vector3(-5.2, 0.7, 2.6),
  vektr: new THREE.Vector3(-3.7, 2.9, -1.2),
  lab: new THREE.Vector3(5.2, 1, 2.7),
};

const palette = {
  stone: 0x25282a,
  stoneDark: 0x14191d,
  trim: 0x3c3d3a,
  wood: 0x6a4931,
  cyan: 0x50dfff,
  violet: 0x926dff,
  amber: 0xffa642,
  red: 0xff554e,
  green: 0x62f0b3,
};

function material(color: number, roughness = 0.78, metalness = 0.12) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(
  size: [number, number, number],
  color: number,
  position: [number, number, number],
  customMaterial?: THREE.Material,
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    customMaterial ?? material(color),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(
  radius: number,
  height: number,
  color: number,
  position: [number, number, number],
  sides = 12,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, sides),
    material(color),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeCanvasTexture(
  label: string,
  accent: string,
  options: { compact?: boolean; screen?: boolean } = {},
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = options.compact ? 128 : 256;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, options.screen ? "#071323" : "rgba(5,9,15,.94)");
  gradient.addColorStop(1, options.screen ? "#11102a" : "rgba(12,17,25,.9)");
  context.fillStyle = gradient;
  context.roundRect(5, 5, canvas.width - 10, canvas.height - 10, 22);
  context.fill();
  context.strokeStyle = accent;
  context.globalAlpha = 0.75;
  context.lineWidth = 4;
  context.stroke();
  context.globalAlpha = 1;

  if (options.screen) {
    context.strokeStyle = accent;
    context.lineWidth = 3;
    context.globalAlpha = 0.7;
    for (let row = 0; row < 5; row += 1) {
      context.beginPath();
      const y = 50 + row * 34;
      context.moveTo(34, y);
      for (let x = 34; x < 478; x += 22) {
        context.lineTo(x, y + Math.sin(x * 0.025 + row) * (8 + row * 2));
      }
      context.stroke();
    }
    context.globalAlpha = 1;
    context.font = "600 24px DM Mono, monospace";
    context.textAlign = "left";
    context.fillStyle = "#eaf7ff";
    context.fillText(label.toUpperCase(), 34, 32);
  } else {
    context.font = options.compact
      ? "600 34px Manrope, sans-serif"
      : "600 42px Manrope, sans-serif";
    context.fillStyle = "#f7f8fa";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function labelSprite(label: string, accent: string, scale: [number, number], compact = true) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeCanvasTexture(label, accent, { compact }),
      transparent: true,
      depthWrite: false,
    }),
  );
  sprite.scale.set(scale[0], scale[1], 1);
  return sprite;
}

function screen(label: string, accent: string, width = 1.05, height = 0.62) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: makeCanvasTexture(label, accent, { screen: true }),
      toneMapped: false,
    }),
  );
  return mesh;
}

function createLamp(x: number, y: number, z: number, height = 1.5) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.add(cylinder(0.045, height, 0x202326, [0, height / 2, 0], 8));
  group.add(box([0.28, 0.3, 0.28], palette.amber, [0, height, 0], new THREE.MeshStandardMaterial({
    color: 0xffb452,
    emissive: 0xff7b1f,
    emissiveIntensity: 3,
    roughness: 0.35,
  })));
  const light = new THREE.PointLight(0xffa33e, 2.2, 5, 2);
  light.position.set(0, height, 0);
  group.add(light);
  return group;
}

function createPlant(x: number, y: number, z: number, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  group.add(cylinder(0.24, 0.34, 0x513523, [0, 0.17, 0], 10));
  for (let index = 0; index < 7; index += 1) {
    const leaf = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.22 + (index % 3) * 0.05, 0),
      material(index % 2 ? 0x1b5a3d : 0x24704b, 0.95),
    );
    const angle = (index / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 0.24, 0.48 + (index % 2) * 0.16, Math.sin(angle) * 0.24);
    leaf.scale.set(0.65, 1.45, 0.65);
    leaf.rotation.z = Math.cos(angle) * 0.5;
    leaf.castShadow = true;
    group.add(leaf);
  }
  return group;
}

function createWorkstation(
  position: [number, number, number],
  rotation: number,
  accent: number,
  label: string,
) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotation;
  group.add(box([1.45, 0.1, 0.72], palette.wood, [0, 0.61, 0]));
  for (const x of [-0.58, 0.58]) {
    for (const z of [-0.23, 0.23]) group.add(box([0.07, 0.6, 0.07], palette.stoneDark, [x, 0.3, z]));
  }
  const display = screen(label, `#${accent.toString(16).padStart(6, "0")}`);
  display.position.set(0, 1.15, -0.28);
  group.add(display);
  group.add(box([0.07, 0.42, 0.07], palette.stoneDark, [0, 0.87, -0.28]));
  group.add(box([0.44, 0.04, 0.18], accent, [0, 0.68, 0.05], new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 1.4,
  })));
  group.add(box([0.48, 0.08, 0.48], 0x171a1e, [0, 0.29, 0.66]));
  group.add(box([0.08, 0.46, 0.08], 0x171a1e, [0, 0.11, 0.66]));
  return group;
}

function createShelf(position: [number, number, number], rotation = 0) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotation;
  group.add(box([1.55, 0.08, 0.28], palette.wood, [0, 0.15, 0]));
  group.add(box([1.55, 0.08, 0.28], palette.wood, [0, 0.78, 0]));
  group.add(box([1.55, 0.08, 0.28], palette.wood, [0, 1.4, 0]));
  group.add(box([0.08, 1.48, 0.28], palette.stoneDark, [-0.73, 0.7, 0]));
  group.add(box([0.08, 1.48, 0.28], palette.stoneDark, [0.73, 0.7, 0]));
  for (let index = 0; index < 13; index += 1) {
    const color = [0xb66545, 0x496e8f, 0xd2a74d, 0x6d4c8f][index % 4];
    group.add(box(
      [0.07 + (index % 3) * 0.025, 0.24 + (index % 2) * 0.08, 0.2],
      color,
      [-0.6 + (index % 7) * 0.19, 0.31 + Math.floor(index / 7) * 0.63, -0.03],
    ));
  }
  return group;
}

function createRoom(
  id: StudioFocus,
  name: string,
  position: THREE.Vector3,
  size: [number, number],
  accent: number,
  levelHeight = 2.55,
) {
  const [width, depth] = size;
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData = { type: "room", id };

  const floor = box([width, 0.3, depth], palette.stone, [0, 0, 0]);
  floor.userData = { type: "room", id };
  group.add(floor);
  group.add(box([width, levelHeight, 0.24], palette.stoneDark, [0, levelHeight / 2, -depth / 2]));
  group.add(box([0.24, levelHeight, depth], 0x1b2022, [-width / 2, levelHeight / 2, 0]));
  group.add(box([width + 0.35, 0.18, 0.18], accent, [0, 0.2, depth / 2], new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.65,
  })));

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x82bbcd,
    transparent: true,
    opacity: 0.16,
    roughness: 0.08,
    metalness: 0.4,
    side: THREE.DoubleSide,
  });
  group.add(box([0.06, levelHeight - 0.35, depth], 0, [width / 2, levelHeight / 2, 0], glassMaterial));
  for (let z = -depth / 2; z <= depth / 2; z += 1.05) {
    group.add(box([0.055, levelHeight, 0.055], palette.trim, [width / 2 + 0.02, levelHeight / 2, z]));
  }
  group.add(box([0.07, 0.07, depth], palette.trim, [width / 2 + 0.02, levelHeight - 0.18, 0]));
  group.add(box([0.07, 0.07, depth], palette.trim, [width / 2 + 0.02, 0.2, 0]));

  for (let x = -width / 2; x <= width / 2; x += 1.15) {
    group.add(box([0.07, 0.07, depth + 0.16], palette.trim, [x, levelHeight + 0.03, 0]));
  }
  group.add(box([width + 0.25, 0.1, 0.1], palette.trim, [0, levelHeight + 0.03, -depth / 2]));
  group.add(box([width + 0.25, 0.1, 0.1], palette.trim, [0, levelHeight + 0.03, depth / 2]));

  const roomLabel = labelSprite(name, `#${accent.toString(16).padStart(6, "0")}`, [3.7, 0.82]);
  roomLabel.position.set(0, levelHeight - 0.45, -depth / 2 + 0.15);
  group.add(roomLabel);

  const warmLight = new THREE.PointLight(0xffb05a, 3.2, 6, 2);
  warmLight.position.set(0, 2.1, 0.4);
  group.add(warmLight);
  return group;
}

function createRailing(length: number, position: [number, number, number], rotation = 0) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotation;
  group.add(box([length, 0.05, 0.05], 0x252d31, [0, 0.74, 0]));
  group.add(box([length, 0.04, 0.04], 0x252d31, [0, 0.35, 0]));
  const posts = Math.max(2, Math.floor(length / 0.55));
  for (let index = 0; index <= posts; index += 1) {
    group.add(box([0.04, 0.78, 0.04], 0x252d31, [-length / 2 + (index / posts) * length, 0.38, 0]));
  }
  return group;
}

function createStairs(
  start: [number, number, number],
  steps: number,
  direction: [number, number],
  rise: number,
) {
  const group = new THREE.Group();
  const [dx, dz] = direction;
  group.position.set(...start);
  for (let index = 0; index < steps; index += 1) {
    group.add(box(
      [1.15, 0.18, 0.48],
      index % 2 ? 0x353431 : 0x2e302f,
      [dx * index * 0.42, rise * index, dz * index * 0.42],
    ));
  }
  return group;
}

function createTree(position: [number, number, number], scale = 1) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.scale.setScalar(scale);
  group.add(cylinder(0.16, 1.45, 0x4c3120, [0, 0.72, 0], 9));
  for (let index = 0; index < 9; index += 1) {
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.52 + (index % 3) * 0.08, 1),
      material(index % 2 ? 0x173c2c : 0x1e4932, 0.95),
    );
    const angle = (index / 9) * Math.PI * 2;
    crown.position.set(Math.cos(angle) * 0.4, 1.55 + (index % 3) * 0.3, Math.sin(angle) * 0.4);
    crown.castShadow = true;
    group.add(crown);
  }
  const light = new THREE.PointLight(0xff9f3d, 1.5, 4, 2);
  light.position.set(0, 1.1, 0);
  group.add(light);
  return group;
}

function createArchitecture(scene: THREE.Scene) {
  const world = new THREE.Group();
  world.position.x = 1.25;
  scene.add(world);

  const rockMaterial = material(0x18201f, 0.98);
  world.add(box([18, 0.7, 13], 0, [0, -0.55, 0.2], rockMaterial));
  world.add(box([11, 1.15, 7.8], 0, [0, -0.25, -2.4], material(0x202523, 0.94)));
  world.add(box([5.9, 1.1, 4.8], 0, [-5.15, -0.16, 2.65], material(0x272825, 0.94)));
  world.add(box([5.9, 1.1, 4.8], 0, [5.15, -0.16, 2.65], material(0x272825, 0.94)));

  const radar = createRoom("radar", "RADARPRO / MOBILITY", new THREE.Vector3(-5.2, 0.55, 2.6), [5.4, 4.35], palette.red);
  const design = createRoom("vektr", "VEKTR / CREATIVE STUDIO", new THREE.Vector3(-3.7, 2.85, -1.35), [5.5, 4.15], palette.violet);
  const coreRoom = createRoom("studio", "AGENT ORCHESTRATION", new THREE.Vector3(1.2, 2.85, -1.35), [4.2, 4.15], palette.green);
  const development = createRoom("studio", "PRODUCT ENGINEERING", new THREE.Vector3(4.8, 2.1, -1.15), [3.4, 3.7], palette.cyan);
  const lab = createRoom("lab", "EXPERIMENTAL LAB", new THREE.Vector3(5.2, 0.55, 2.7), [5.25, 4.1], palette.cyan);
  world.add(radar, design, coreRoom, development, lab);

  radar.add(createWorkstation([-1.2, 0.18, -0.45], 0.15, palette.red, "LIVE MAP"));
  radar.add(createWorkstation([1.15, 0.18, 0.6], Math.PI, palette.amber, "ROUTE AI"));
  radar.add(createShelf([-1.75, 0.16, -1.93]));
  radar.add(createPlant(2.1, 0.16, -1.55, 0.72));

  design.add(createWorkstation([-1.15, 0.18, -0.5], 0, palette.violet, "BRAND"));
  design.add(createWorkstation([1.15, 0.18, 0.65], Math.PI, 0xff79c6, "CANVAS"));
  design.add(createShelf([-1.85, 0.16, -1.82]));
  design.add(createPlant(2.15, 0.16, -1.55, 0.8));

  coreRoom.add(createWorkstation([-1.15, 0.18, -0.65], 0, palette.green, "PLANNER"));
  coreRoom.add(createWorkstation([1.15, 0.18, -0.65], 0, palette.cyan, "MEMORY"));
  const table = cylinder(1.05, 0.12, 0x54402f, [0, 0.68, 0.78], 16);
  coreRoom.add(table);
  const holo = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.45, 1),
    new THREE.MeshStandardMaterial({
      color: palette.violet,
      emissive: palette.violet,
      emissiveIntensity: 3,
      transparent: true,
      opacity: 0.86,
    }),
  );
  holo.position.set(0, 1.25, 0.78);
  holo.name = "core";
  coreRoom.add(holo);

  development.add(createWorkstation([0, 0.18, -0.6], 0, palette.cyan, "BUILD"));
  development.add(createWorkstation([0, 0.18, 0.85], Math.PI, palette.green, "DEPLOY"));
  lab.add(createWorkstation([-1.2, 0.18, -0.45], 0.05, palette.cyan, "GEN LAB"));
  lab.add(createWorkstation([1.1, 0.18, 0.6], Math.PI, palette.violet, "SPATIAL"));
  lab.add(createShelf([-1.8, 0.16, -1.78]));
  lab.add(createPlant(2, 0.16, -1.55, 0.8));

  // Terraces and circulation tie every volume into one traversable compound.
  world.add(box([5.1, 0.24, 1.15], palette.stone, [-2.55, 1.35, 0.72]));
  world.add(box([4.2, 0.24, 1.15], palette.stone, [2.7, 1.35, 0.72]));
  world.add(createRailing(5, [-2.55, 1.47, 1.28]));
  world.add(createRailing(4.2, [2.7, 1.47, 1.28]));
  world.add(createStairs([-2.4, 0.18, 1.3], 9, [0.28, -0.35], 0.145));
  world.add(createStairs([3.25, 0.18, 1.35], 9, [-0.26, -0.36], 0.145));
  world.add(createStairs([3.1, 1.43, -0.25], 6, [0.3, -0.2], 0.13));
  world.add(box([1.35, 0.2, 4.1], palette.stone, [0.3, 2.7, -3.75]));
  world.add(createRailing(4, [-0.4, 2.82, -3.75], Math.PI / 2));

  // Courtyard water physically runs through the lower levels.
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x1887ae,
    emissive: 0x0c5674,
    emissiveIntensity: 1.8,
    transparent: true,
    opacity: 0.72,
    roughness: 0.08,
    metalness: 0.15,
  });
  world.add(box([3.9, 0.12, 1.45], 0, [0, 0.07, 3.1], waterMaterial));
  world.add(box([1.2, 0.12, 4.3], 0, [0, 0.07, 5.25], waterMaterial));
  const waterfall = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.4), waterMaterial);
  waterfall.position.set(0, -0.55, 7.35);
  world.add(waterfall);
  const waterLight = new THREE.PointLight(0x25c9ff, 3.2, 5);
  waterLight.position.set(0, 0.5, 4);
  world.add(waterLight);
  world.add(createRailing(3.8, [0, 0.2, 2.34]));
  world.add(createRailing(3.8, [0, 0.2, 3.86]));

  // Architectural details: rooftop gardens, service structures, lamps and planted courtyards.
  for (const [x, y, z, scale] of [
    [-7.7, 0, 0.8, 0.8], [-7.4, 0, 5.1, 1], [7.65, 0, 0.85, 0.82],
    [7.6, 0, 5.2, 1], [-5.5, 3.02, -2.5, 0.55], [2.3, 3.02, -2.8, 0.55],
    [5.9, 2.28, -2.5, 0.48],
  ] as [number, number, number, number][]) world.add(createTree([x, y, z], scale));

  for (const [x, y, z] of [
    [-8, 0, 2], [-8, 0, 4.8], [-3, 0, 5.9], [3, 0, 5.9], [8, 0, 2],
    [8, 0, 4.8], [-3.5, 1.5, 1.4], [3.5, 1.5, 1.4],
  ] as [number, number, number][]) world.add(createLamp(x, y, z, y > 0 ? 1 : 1.35));

  for (let index = 0; index < 12; index += 1) {
    world.add(createPlant(-7.3 + index * 1.3, 0.02, index % 2 ? 6.1 : -4.8, 0.42 + (index % 3) * 0.1));
  }

  world.add(box([2.4, 0.14, 1.15], palette.stone, [-1.9, 0.25, 3.1]));
  world.add(box([2.4, 0.14, 1.15], palette.stone, [1.9, 0.25, 3.1]));
  world.add(createRailing(2.3, [-1.9, 0.34, 2.55]));
  world.add(createRailing(2.3, [1.9, 0.34, 2.55]));

  // A compact RadarPro vehicle anchors the mobility room.
  const vehicle = new THREE.Group();
  vehicle.position.set(-6.3, 0.25, 5.5);
  vehicle.add(box([1.8, 0.48, 0.95], 0x252a30, [0, 0.42, 0]));
  vehicle.add(box([0.95, 0.38, 0.82], 0x17212a, [-0.12, 0.78, 0]));
  for (const x of [-0.62, 0.62]) {
    for (const z of [-0.48, 0.48]) {
      const wheel = cylinder(0.21, 0.12, 0x080a0b, [x, 0.24, z], 12);
      wheel.rotation.x = Math.PI / 2;
      vehicle.add(wheel);
    }
  }
  const tail = box([0.08, 0.15, 0.65], palette.red, [-0.93, 0.46, 0], new THREE.MeshStandardMaterial({
    color: palette.red, emissive: palette.red, emissiveIntensity: 3,
  }));
  vehicle.add(tail);
  world.add(vehicle);

  return world;
}

function createAgent(name: string, accent: number, route: Stop[], phase: number) {
  const group = new THREE.Group();
  group.position.copy(route[0].point);
  group.userData = { type: "agent", name };
  const shell = material(phase % 2 ? 0xece8df : 0xd9e2e5, 0.32, 0.26);
  const dark = material(0x0b1119, 0.2, 0.65);
  const glow = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 3 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.3, 5, 9), shell);
  body.position.y = 0.42;
  body.castShadow = true;
  group.add(body);
  const head = box([0.53, 0.39, 0.4], 0, [0, 0.88, 0], dark);
  group.add(head);
  group.add(box([0.34, 0.14, 0.022], 0, [0, 0.89, 0.212], glow));
  for (const x of [-0.085, 0.085]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eye.position.set(x, 0.9, 0.226);
    group.add(eye);
  }
  group.add(box([0.1, 0.32, 0.1], 0x131921, [-0.13, 0.13, 0], dark));
  group.add(box([0.1, 0.32, 0.1], 0x131921, [0.13, 0.13, 0], dark));
  group.add(box([0.09, 0.3, 0.09], 0xdadbd5, [-0.28, 0.46, 0], shell));
  group.add(box([0.09, 0.3, 0.09], 0xdadbd5, [0.28, 0.46, 0], shell));

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.39, 24),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  group.add(ring);

  const badge = labelSprite(route[0].activity, `#${accent.toString(16).padStart(6, "0")}`, [1.3, 0.32]);
  badge.position.set(0, 1.45, 0);
  badge.visible = false;
  group.add(badge);

  group.traverse((object) => {
    object.userData = { type: "agent", name };
  });
  return {
    group,
    route,
    stop: 1,
    speed: 0.55 + (phase % 3) * 0.07,
    phase,
    waiting: phase * 0.22,
    ring,
    badge,
    activity: route[0].activity,
    accent,
  } satisfies Agent;
}

function addLandscape(scene: THREE.Scene) {
  const ground = box([42, 0.7, 34], 0x07100f, [0, -1.1, 0], material(0x07100f, 1));
  scene.add(ground);
  for (let index = 0; index < 78; index += 1) {
    const angle = (index / 78) * Math.PI * 2;
    const radius = 11.5 + (index % 8) * 0.72;
    const x = Math.cos(angle) * radius + 1;
    const z = Math.sin(angle) * radius * 0.76;
    const tree = createTree([x, -0.75, z], 0.45 + (index % 5) * 0.08);
    scene.add(tree);
  }
  for (let index = 0; index < 26; index += 1) {
    const angle = index * 2.3;
    const radius = 12 + (index % 5) * 1.9;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.5 + (index % 4) * 0.22, 0),
      material(0x101918, 1),
    );
    rock.position.set(Math.cos(angle) * radius, -0.55, Math.sin(angle) * radius * 0.72);
    rock.scale.y = 0.6 + (index % 3) * 0.3;
    scene.add(rock);
  }
}

function route(...stops: [number, number, number, Stop["activity"], number?, number?][]) {
  return stops.map(([x, y, z, activity, wait, face]) => ({
    point: new THREE.Vector3(x + 1.25, y, z),
    activity,
    wait,
    face,
  }));
}

export default function StudioWorld({ focus, onFocus, onAgentSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef(focus);

  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07111d);
    scene.fog = new THREE.FogExp2(0x07111d, 0.021);
    const camera = new THREE.PerspectiveCamera(36, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(18.5, 14.5, 19);
    camera.lookAt(1, 1.4, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.minDistance = 12;
    controls.maxDistance = 34;
    controls.minPolarAngle = Math.PI / 5;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.target.set(1, 1.6, 0);

    scene.add(new THREE.HemisphereLight(0x91b8ff, 0x07100f, 1.5));
    const moon = new THREE.DirectionalLight(0xa9c2ff, 3.1);
    moon.position.set(-9, 16, 10);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -18;
    moon.shadow.camera.right = 18;
    moon.shadow.camera.top = 18;
    moon.shadow.camera.bottom = -18;
    scene.add(moon);
    const sunset = new THREE.DirectionalLight(0xff8c5a, 1.2);
    sunset.position.set(12, 5, -10);
    scene.add(sunset);

    addLandscape(scene);
    const world = createArchitecture(scene);

    const routes = [
      route(
        [-6.25, 0.72, 2.1, "working", 4, 0], [-4.2, 0.72, 3.2, "researching", 3],
        [-2.5, 1.52, 0.85, "walking"], [-3.1, 3.02, -0.7, "collaborating", 5, Math.PI],
        [-2.55, 1.52, 0.85, "walking"],
      ),
      route(
        [-4, 0.72, 3.35, "reviewing", 4, Math.PI], [-2.4, 1.52, 0.8, "walking"],
        [-4.65, 3.02, -1.1, "working", 4, 0], [-2.7, 1.52, 0.8, "walking"],
        [-5.8, 0.72, 2.2, "collaborating", 4],
      ),
      route(
        [-4.7, 3.02, -0.8, "working", 5, 0], [-2.5, 3.02, -0.6, "reviewing", 3],
        [-0.3, 3.02, -1.4, "collaborating", 5, Math.PI / 2], [-2.4, 3.02, -2.1, "researching", 3],
      ),
      route(
        [-2.6, 3.02, -2, "working", 4, Math.PI], [-0.45, 3.02, -0.55, "collaborating", 5],
        [1.65, 3.02, -1.8, "reviewing", 3], [-0.1, 3.02, -2.15, "researching", 3],
      ),
      route(
        [0.2, 3.02, -0.5, "working", 4, 0], [1.2, 3.02, -0.2, "collaborating", 5],
        [3.3, 2.28, -0.2, "walking"], [4.9, 2.28, -1.55, "working", 4, 0],
        [2.9, 2.28, 0.6, "reviewing", 3],
      ),
      route(
        [4.75, 2.28, -0.6, "working", 4, Math.PI], [3.1, 1.52, 0.9, "walking"],
        [4.25, 0.72, 2.15, "researching", 3], [5.9, 0.72, 3.25, "working", 4, Math.PI],
        [3, 1.52, 0.85, "walking"],
      ),
      route(
        [4.2, 0.72, 2.2, "working", 5, 0], [5.8, 0.72, 3.2, "collaborating", 4],
        [3.2, 1.52, 0.9, "walking"], [1.2, 3.02, -0.35, "reviewing", 4],
        [3, 1.52, 0.9, "walking"],
      ),
      route(
        [5.9, 0.72, 3.15, "researching", 4, Math.PI], [3, 1.52, 0.9, "walking"],
        [1.3, 3.02, -0.2, "collaborating", 6], [-0.3, 3.02, -0.5, "collaborating", 6],
        [3.2, 1.52, 0.9, "walking"],
      ),
    ];
    const names = ["Rover", "Scout", "Muse", "Pixel", "Vector", "Nova", "Atlas", "Relay"];
    const colors = [palette.red, 0xff8b5c, palette.violet, 0xcf70ff, palette.green, palette.cyan, 0x5ea0ff, 0x75f1d0];
    const agents = routes.map((agentRoute, index) => createAgent(names[index], colors[index], agentRoute, index));
    agents.forEach((agent) => scene.add(agent.group));

    // Collaboration links appear only when agents are stationed near each other.
    const collaborationMaterial = new THREE.LineBasicMaterial({
      color: palette.violet,
      transparent: true,
      opacity: 0,
    });
    const collaborationGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const collaborationLine = new THREE.Line(collaborationGeometry, collaborationMaterial);
    scene.add(collaborationLine);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered = false;
    let dragging = false;
    let downPosition = new THREE.Vector2();
    const updatePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(scene.children, true).find((item) => item.object.userData.type);
      const nextHovered = Boolean(hit);
      if (nextHovered !== hovered) {
        hovered = nextHovered;
        renderer.domElement.style.cursor = hovered ? "pointer" : "grab";
      }
    };
    const pointerDown = (event: PointerEvent) => {
      dragging = false;
      downPosition.set(event.clientX, event.clientY);
    };
    const pointerMove = (event: PointerEvent) => {
      if (downPosition.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) dragging = true;
      updatePointer(event);
    };
    const handleClick = (event: PointerEvent) => {
      if (dragging) return;
      updatePointer(event);
      const hit = raycaster.intersectObjects(scene.children, true).find((item) => item.object.userData.type);
      if (!hit) return;
      const data = hit.object.userData;
      if (data.type === "agent") onAgentSelect(data.name);
      if (data.type === "room") onFocus(data.id);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("click", handleClick);

    const clock = new THREE.Clock();
    let frame = 0;
    let last = performance.now();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - last) / 1000, 0.04);
      last = now;
      const elapsed = clock.getElapsedTime();

      agents.forEach((agent) => {
        const current = agent.route[(agent.stop - 1 + agent.route.length) % agent.route.length];
        agent.badge.visible = agent.waiting > 1.2 && current.activity !== "walking";
        agent.ring.material.opacity = 0.28 + Math.sin(elapsed * 2 + agent.phase) * 0.16;
        if (agent.waiting > 0) {
          agent.waiting -= delta;
          agent.group.position.y += Math.sin(elapsed * 2.2 + agent.phase) * 0.0007;
          if (current.face !== undefined) agent.group.rotation.y = THREE.MathUtils.lerp(agent.group.rotation.y, current.face, 0.06);
          const armSwing = Math.sin(elapsed * 3 + agent.phase) * 0.13;
          const arm = agent.group.children[8];
          if (arm) arm.rotation.x = current.activity === "working" ? -0.7 + armSwing : armSwing;
          return;
        }
        const destination = agent.route[agent.stop];
        const offset = destination.point.clone().sub(agent.group.position);
        const distance = offset.length();
        if (distance < 0.13) {
          agent.group.position.copy(destination.point);
          if (agent.activity !== destination.activity) {
            agent.activity = destination.activity;
            const badgeMaterial = agent.badge.material;
            badgeMaterial.map?.dispose();
            badgeMaterial.map = makeCanvasTexture(
              destination.activity,
              `#${agent.accent.toString(16).padStart(6, "0")}`,
              { compact: true },
            );
            badgeMaterial.needsUpdate = true;
          }
          agent.stop = (agent.stop + 1) % agent.route.length;
          agent.waiting = destination.wait ?? 0.15;
        } else {
          offset.normalize();
          agent.group.position.addScaledVector(offset, agent.speed * delta);
          agent.group.rotation.y = Math.atan2(offset.x, offset.z);
          agent.group.position.y += Math.abs(Math.sin(elapsed * 7 + agent.phase)) * 0.002;
          const stride = Math.sin(elapsed * 7 + agent.phase) * 0.5;
          agent.group.children[5].rotation.x = stride;
          agent.group.children[6].rotation.x = -stride;
          agent.group.children[7].rotation.x = -stride * 0.75;
          agent.group.children[8].rotation.x = stride * 0.75;
        }
      });

      const collaborators = agents.filter((agent) => {
        const previous = agent.route[(agent.stop - 1 + agent.route.length) % agent.route.length];
        return agent.waiting > 0 && previous.activity === "collaborating";
      });
      if (collaborators.length >= 2) {
        const positions = collaborationLine.geometry.attributes.position as THREE.BufferAttribute;
        positions.setXYZ(0, collaborators[0].group.position.x, collaborators[0].group.position.y + 1.1, collaborators[0].group.position.z);
        positions.setXYZ(1, collaborators[1].group.position.x, collaborators[1].group.position.y + 1.1, collaborators[1].group.position.z);
        positions.needsUpdate = true;
        collaborationMaterial.opacity = 0.28 + Math.sin(elapsed * 4) * 0.16;
      } else {
        collaborationMaterial.opacity = 0;
      }

      const core = world.getObjectByName("core");
      if (core) {
        core.rotation.y += delta * 0.55;
        core.rotation.x = Math.sin(elapsed * 0.55) * 0.2;
        core.position.y = 1.25 + Math.sin(elapsed * 1.5) * 0.12;
      }

      const desired = focusTargets[focusRef.current].clone();
      desired.x += 1.25;
      controls.target.lerp(desired, 0.035);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    };
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("click", handleClick);
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((item) => item.dispose());
        }
      });
      container.removeChild(renderer.domElement);
    };
  }, [onFocus, onAgentSelect]);

  return <div className="studio-world" ref={containerRef} aria-label="Interactive living 3D agentic studio" />;
}
