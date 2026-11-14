import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Room } from './Room';
import { Pet } from './Pet';
import { Effects } from './Effects';
import { AimHandler } from './AimHandler';
import { useGameStore } from '../store/useGameStore';

/** 依螢幕比例調整視角，直式手機也看得到整隻寵物與丟球範圍 */
function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const dist = 4.7;
    const wantWidth = 3.0; // 至少看得到的水平寬度
    const fovForWidth = THREE.MathUtils.radToDeg(2 * Math.atan(wantWidth / 2 / (aspect * dist)));
    cam.fov = THREE.MathUtils.clamp(fovForWidth, 38, 62);
    cam.position.set(0, 1.9, dist);
    cam.lookAt(0, 0.62, -0.2);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

/** 燈光：白天暖光，睡覺時變暗偏藍 */
function Lights() {
  const sun = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const day = new THREE.Color('#fff3d6');
  const night = new THREE.Color('#8f9bd6');
  useFrame((_, dt) => {
    const sleeping = useGameStore.getState().pet.sleeping;
    const k = Math.min(1, dt * 2);
    sun.current.intensity += ((sleeping ? 0.35 : 1.9) - sun.current.intensity) * k;
    hemi.current.intensity += ((sleeping ? 0.5 : 1.35) - hemi.current.intensity) * k;
    sun.current.color.lerp(sleeping ? night : day, k);
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={['#fff8e6', '#e8c592', 1.35]} />
      <directionalLight
        ref={sun}
        position={[2.5, 5, 3.5]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={15}
        shadow-bias={-0.0008}
        shadow-radius={4}
      />
    </>
  );
}

export function PetScene() {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      camera={{ fov: 50, near: 0.1, far: 50, position: [0, 2.3, 5.2] }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        scene.background = new THREE.Color('#fbeec1');
      }}
    >
      <CameraRig />
      <AimHandler />
      <Lights />
      <Room />
      <Pet />
      <Effects />
    </Canvas>
  );
}
