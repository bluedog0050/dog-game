import type * as THREE from 'three';
import { useMemo } from 'react';
import { mat } from './materials';

/** 淡黃暖色的低多邊形房間 */
export function Room() {
  const m = useMemo(
    () => ({
      floor: mat('#efd6a6'),
      plank: mat('#e6c993'),
      wall: mat('#fbeec1'),
      wallSide: mat('#f7e4ad'),
      skirting: mat('#f3d79b'),
      rug: mat('#f7c6a3'),
      rugInner: mat('#fbd9bd'),
      frame: mat('#ffffff'),
      glass: mat('#cfe9f5', { emissive: '#dff3ff', emissiveIntensity: 0.5 }),
      pot: mat('#e08f6a'),
      leaf: mat('#8cc28a'),
      leafDark: mat('#6fab72'),
      bed: mat('#f5b3a4'),
      bedInner: mat('#fde0d3'),
      picture: mat('#f8c977'),
      sun: mat('#f39c6b'),
    }),
    [],
  );

  return (
    <group>
      {/* 地板與木紋 */}
      <mesh material={m.floor} position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[10, 0.1, 10]} />
      </mesh>
      {[-3, -1.8, -0.6, 0.6, 1.8, 3].map((x) => (
        <mesh key={x} material={m.plank} position={[x, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[0.04, 10]} />
        </mesh>
      ))}

      {/* 牆 */}
      <mesh material={m.wall} position={[0, 2.5, -3]} receiveShadow>
        <boxGeometry args={[10, 5, 0.1]} />
      </mesh>
      <mesh material={m.skirting} position={[0, 0.1, -2.93]}>
        <boxGeometry args={[10, 0.2, 0.06]} />
      </mesh>
      <mesh material={m.wallSide} position={[-3.6, 2.5, 0]} receiveShadow>
        <boxGeometry args={[0.1, 5, 10]} />
      </mesh>
      <mesh material={m.wallSide} position={[3.6, 2.5, 0]} receiveShadow>
        <boxGeometry args={[0.1, 5, 10]} />
      </mesh>

      {/* 窗戶 */}
      <group position={[0.9, 2.3, -2.93]}>
        <mesh material={m.frame}>
          <boxGeometry args={[1.5, 1.3, 0.06]} />
        </mesh>
        {[
          [-0.36, 0.3],
          [0.36, 0.3],
          [-0.36, -0.3],
          [0.36, -0.3],
        ].map(([x, y]) => (
          <mesh key={`${x}${y}`} material={m.glass} position={[x, y, 0.04]}>
            <planeGeometry args={[0.62, 0.52]} />
          </mesh>
        ))}
      </group>

      {/* 掛畫 */}
      <group position={[-1.6, 2.4, -2.93]}>
        <mesh material={m.frame}>
          <boxGeometry args={[0.8, 0.65, 0.05]} />
        </mesh>
        <mesh material={m.picture} position={[0, 0, 0.03]}>
          <planeGeometry args={[0.66, 0.5]} />
        </mesh>
        <mesh material={m.sun} position={[0.12, 0.06, 0.04]}>
          <circleGeometry args={[0.1, 7]} />
        </mesh>
      </group>

      {/* 地毯 */}
      <mesh material={m.rug} position={[0, 0.012, 0.1]} receiveShadow>
        <cylinderGeometry args={[1.6, 1.6, 0.02, 12]} />
      </mesh>
      <mesh material={m.rugInner} position={[0, 0.024, 0.1]} receiveShadow>
        <cylinderGeometry args={[1.2, 1.2, 0.02, 12]} />
      </mesh>

      {/* 盆栽 */}
      <group position={[2.4, 0, -2.2]}>
        <mesh material={m.pot} position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.22, 0.6, 7]} />
        </mesh>
        {[
          [0, 0.9, 0, 0.35, m.leaf],
          [-0.2, 1.15, 0.05, 0.26, m.leafDark],
          [0.18, 1.2, -0.05, 0.28, m.leaf],
          [0, 1.4, 0, 0.22, m.leafDark],
        ].map(([x, y, z, r, mm], i) => (
          <mesh key={i} material={mm as THREE.Material} position={[x as number, y as number, z as number]} scale={r as number} castShadow>
            <icosahedronGeometry args={[1, 0]} />
          </mesh>
        ))}
      </group>

      {/* 狗窩 */}
      <group position={[-2.2, 0, -1.9]}>
        <mesh material={m.bed} position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <torusGeometry args={[0.55, 0.18, 6, 12]} />
        </mesh>
        <mesh material={m.bedInner} position={[0, 0.06, 0]} receiveShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.1, 12]} />
        </mesh>
      </group>
    </group>
  );
}
