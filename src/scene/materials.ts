import * as THREE from 'three';

// 低多邊形風格：flatShading + 低細分的幾何體
export const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...extra });

export const FUR_CLEAN = new THREE.Color('#fffaf1');
export const FUR_DIRTY = new THREE.Color('#c8b08a');
export const FUR_SICK = new THREE.Color('#dfe3c4');
export const FUR_WET = new THREE.Color('#cfd6de');

export const M = {
  fur: mat('#fffaf1', { emissive: '#fff4e0', emissiveIntensity: 0.18 }),
  furShade: mat('#f3eadb', { emissive: '#fff4e0', emissiveIntensity: 0.12 }),
  cream: mat('#f7e2c4', { emissive: '#fff4e0', emissiveIntensity: 0.1 }),
  black: mat('#2a2220', { roughness: 0.4 }),
  shine: mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }),
  pink: mat('#f4a7a9'),
  blush: mat('#ffb9b9', { transparent: true, opacity: 0.55 }),
  tongue: mat('#ef7f8b'),
};

// 共用幾何體
export const GEO = {
  fluff: new THREE.IcosahedronGeometry(1, 1),
  fluffLow: new THREE.IcosahedronGeometry(1, 0),
  ball: new THREE.SphereGeometry(1, 10, 8),
  cone: new THREE.ConeGeometry(1, 1, 5),
  leg: new THREE.CylinderGeometry(1, 0.85, 1, 6),
};
