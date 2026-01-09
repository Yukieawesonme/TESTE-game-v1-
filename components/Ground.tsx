import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { inputState } from './InputState';

const CHUNKS_PER_SIDE = 5; 
const CHUNK_SIZE = 160; 
const GRASS_PER_CHUNK = 800; // Reverted density
const WORLD_RADIUS = 1000; 

const sharedGrassGeo = new THREE.PlaneGeometry(0.1, 0.35, 1, 1);
sharedGrassGeo.translate(0, 0.175, 0);

const sharedGrassMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uCameraPos: { value: new THREE.Vector3() },
    uPlayerPos: { value: new THREE.Vector3() },
    uColorBase: { value: new THREE.Color("#2d4c1e") },
    uColorTip: { value: new THREE.Color("#4ade80") },
    uFogColor: { value: new THREE.Color("#ccddcc") }
  },
  vertexShader: `
    uniform float uTime;
    uniform vec3 uCameraPos;
    uniform vec3 uPlayerPos;

    varying float vFade;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec4 worldBasePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float distToCamera = distance(worldBasePos.xyz, uCameraPos);
      
      vFade = 1.0 - smoothstep(250.0, 400.0, distToCamera);
      if (vFade < 0.001) {
        gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      vec3 dirToPlayer = worldBasePos.xyz - uPlayerPos;
      float distToPlayer = length(dirToPlayer.xz);
      float pushRadius = 1.2;
      float pushForce = smoothstep(pushRadius, 0.0, distToPlayer);
      vec2 pushDir = normalize(dirToPlayer.xz + 0.001) * pushForce;
      
      vec3 pos = position;
      
      // Simple wind
      float wind = sin(uTime * 2.0 + worldBasePos.x * 0.5 + worldBasePos.z * 0.5) * 0.1;
      pos.x += wind * uv.y;
      pos.x += pushDir.x * uv.y;
      pos.z += pushDir.y * uv.y;
      
      gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying float vFade;
    varying vec2 vUv;
    
    uniform vec3 uColorBase;
    uniform vec3 uColorTip;
    uniform vec3 uFogColor;

    void main() {
      if (vFade < 0.01) discard;
      
      vec3 color = mix(uColorBase, uColorTip, vUv.y);
      color = mix(color, uFogColor, 1.0 - vFade);
      
      gl_FragColor = vec4(color, vFade);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false
});

const GrassChunk: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < GRASS_PER_CHUNK; i++) {
      const x = (Math.random() - 0.5) * CHUNK_SIZE + position[0];
      const z = (Math.random() - 0.5) * CHUNK_SIZE + position[2];
      
      if (x*x + z*z > WORLD_RADIUS * WORLD_RADIUS) {
        dummy.position.set(0, -500, 0); 
        dummy.scale.setScalar(0);
      } else {
        dummy.position.set(x, 0, z);
        dummy.rotation.y = Math.random() * Math.PI;
        const s = 0.8 + Math.random() * 0.4;
        dummy.scale.set(s, s, s);
      }
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [position]);

  useFrame((state) => {
    if (sharedGrassMat) {
      sharedGrassMat.uniforms.uTime.value = state.clock.elapsedTime;
      sharedGrassMat.uniforms.uCameraPos.value.copy(camera.position);
      sharedGrassMat.uniforms.uPlayerPos.value.set(inputState.characterData.x, 0, inputState.characterData.z);
    }
  });

  return <instancedMesh ref={meshRef} args={[sharedGrassGeo, sharedGrassMat, GRASS_PER_CHUNK]} frustumCulled={false} />;
};

const Ground: React.FC = () => {
  const groundMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor1: { value: new THREE.Color("#365c28") }, 
        uColor2: { value: new THREE.Color("#4a6b38") }, 
        uPlayerPos: { value: new THREE.Vector3() },
        uCameraPos: { value: new THREE.Vector3() },
        uFogColor: { value: new THREE.Color("#ccddcc") }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec2 vUv;
        void main() {
          vUv = uv * 40.0; 
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uFogColor;
        uniform vec3 uCameraPos;
        varying vec3 vWorldPos;
        varying vec2 vUv;
        
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

        void main() {
          vec2 i = floor(vUv);
          vec2 f = fract(vUv);
          float n = mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
          
          vec3 baseColor = mix(uColor1, uColor2, n);
          
          float distToCam = distance(vWorldPos.xyz, uCameraPos);
          float distFog = smoothstep(200.0, 700.0, distToCam);
          
          gl_FragColor = vec4(mix(baseColor, uFogColor, distFog), 1.0);
        }
      `
    });
  }, []);

  useFrame((state) => {
    if (groundMat) {
      groundMat.uniforms.uPlayerPos.value.set(inputState.characterData.x, 0, inputState.characterData.z);
      groundMat.uniforms.uCameraPos.value.copy(state.camera.position);
    }
  });

  const chunks = useMemo(() => {
    const list = [];
    const offset = (CHUNKS_PER_SIDE - 1) * CHUNK_SIZE * 0.5;
    for (let x = 0; x < CHUNKS_PER_SIDE; x++) {
      for (let z = 0; z < CHUNKS_PER_SIDE; z++) {
        list.push([x * CHUNK_SIZE - offset, 0, z * CHUNK_SIZE - offset]);
      }
    }
    return list;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={groundMat}>
        <circleGeometry args={[WORLD_RADIUS + 200, 64]} />
      </mesh>
      {chunks.map((pos, i) => <GrassChunk key={i} position={pos as [number, number, number]} />)}
    </group>
  );
};

export default Ground;