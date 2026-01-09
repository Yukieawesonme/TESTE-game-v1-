import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

const BUSH_COUNT = 600; 
const WORLD_RADIUS = 1000;

const Bushes: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(0.8, 0); 
    const mat = new THREE.ShaderMaterial({
      uniforms: { 
        uTime: { value: 0 },
        uCameraPos: { value: new THREE.Vector3() },
        uFogColor: { value: new THREE.Color("#dce6d9") },
        uColorA: { value: new THREE.Color("#1a331a") },
        uColorB: { value: new THREE.Color("#3d7a4d") }
      },
      vertexShader: `
        uniform float uTime;
        uniform vec3 uCameraPos;
        varying float vDist;
        void main() {
          vec4 worldPos = instanceMatrix * vec4(position, 1.0);
          vDist = distance(worldPos.xyz, uCameraPos);
          float scale = 1.0 - smoothstep(600.0, 1000.0, vDist);
          vec3 pos = position * scale;
          gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uFogColor;
        varying float vDist;
        void main() {
          if (vDist > 1005.0) discard;
          vec3 color = mix(uColorA, uColorB, 0.5);
          float distFog = smoothstep(100.0, 800.0, vDist);
          color = mix(color, uFogColor, distFog * 0.7);
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    return { geometry: geo, material: mat };
  }, []);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < BUSH_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 5 + Math.sqrt(Math.random()) * WORLD_RADIUS;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const scale = 0.7 + Math.random() * 1.5;
      dummy.position.set(x, 0.1, z);
      dummy.scale.setScalar(scale);
      dummy.rotation.set(Math.random(), Math.random(), Math.random());
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.computeBoundingSphere();
  }, []);

  useFrame((state) => {
    if (material) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
      material.uniforms.uCameraPos.value.copy(camera.position);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, BUSH_COUNT]} frustumCulled={false} />
  );
};

export default Bushes;