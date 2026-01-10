
import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { inputState } from './InputState';

// OTIMIZAÇÃO: 10x10 Chunks = 100 chunks (era 196). Suficiente para raio 1000.
const CHUNKS_PER_SIDE = 10; 
const CHUNK_SIZE = 200; 
// OTIMIZAÇÃO: Reduzido de 4500 para 2200.
const GRASS_PER_CHUNK = 2200; 
const WORLD_RADIUS = 1000; 

const HEIGHT_GLSL = `
  float getTerrainHeight(vec2 p) {
    float h = 0.0;
    h += sin(p.x * 0.015 + p.y * 0.008) * 2.5;
    h += sin(p.x * 0.005 - p.y * 0.012) * 3.0;
    h += sin(p.x * 0.03 + p.y * 0.03) * 0.4;
    return h;
  }
`;

// FBM (Fractal Brownian Motion) para textura detalhada
const NOISE_GLSL = `
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  
  // Fractal Noise para textura de terra/grama
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
    for (int i = 0; i < 4; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
  }
`;

// COMPENSAÇÃO: Grama mais larga (0.6) e mais alta (1.4)
const sharedGrassGeo = new THREE.PlaneGeometry(0.6, 1.4, 1, 2);
sharedGrassGeo.translate(0, 0.5, 0); 

const sharedGrassMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uCameraPos: { value: new THREE.Vector3() },
    uPlayerPos: { value: new THREE.Vector3() },
    uColorBase: { value: new THREE.Color("#1a120b") }, 
    uColorMid: { value: new THREE.Color("#166534") },  
    uColorTip: { value: new THREE.Color("#4ade80") },  
    uFogColor: { value: new THREE.Color("#050a0e") } 
  },
  vertexShader: `
    uniform float uTime;
    uniform vec3 uCameraPos;
    uniform vec3 uPlayerPos;

    varying float vFade;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    ${NOISE_GLSL}
    ${HEIGHT_GLSL}

    void main() {
      vUv = uv;
      vec4 worldBasePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      
      float terrainH = getTerrainHeight(worldBasePos.xz);
      worldBasePos.y += terrainH;
      
      vWorldPos = worldBasePos.xyz;

      float distToCamera = distance(worldBasePos.xyz, uCameraPos);
      vFade = 1.0 - smoothstep(60.0, 110.0, distToCamera); 
      
      if (vFade < 0.01) {
        gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      vec3 dirToPlayer = worldBasePos.xyz - uPlayerPos;
      float distToPlayer = length(vec2(dirToPlayer.x, dirToPlayer.z));
      float pushStrength = 1.0 - smoothstep(0.0, 1.5, distToPlayer);
      
      vec3 pos = position;
      float wind = sin(uTime * 1.2 + worldBasePos.x * 0.2 + worldBasePos.z * 0.2) * 0.15 * uv.y;
      pos.x += wind;
      
      if (pushStrength > 0.0) {
        vec2 pushDir = normalize(dirToPlayer.xz);
        float displacement = pushStrength * 0.8 * uv.y;
        pos.x += pushDir.x * displacement;
        pos.z += pushDir.y * displacement;
        pos.y *= (1.0 - pushStrength * 0.4); 
      }
      
      vec4 instancePos = instanceMatrix * vec4(pos, 1.0);
      instancePos.y += terrainH;
      
      gl_Position = projectionMatrix * viewMatrix * instancePos;
    }
  `,
  fragmentShader: `
    varying float vFade;
    varying vec2 vUv;
    
    uniform vec3 uColorBase;
    uniform vec3 uColorMid;
    uniform vec3 uColorTip;
    uniform vec3 uFogColor;

    void main() {
      if (vFade < 0.1) discard;
      
      vec3 color = mix(uColorBase, uColorMid, smoothstep(0.0, 0.6, vUv.y));
      color = mix(color, uColorTip, smoothstep(0.6, 1.0, vUv.y));
      color = mix(color, uFogColor, 1.0 - vFade);
      
      gl_FragColor = vec4(color, vFade);
    }
  `,
  side: THREE.DoubleSide,
  transparent: true,
  depthWrite: false 
});

const GrassChunk: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

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
        const s = 0.7 + Math.random() * 0.6;
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
      sharedGrassMat.uniforms.uCameraPos.value.copy(state.camera.position);
      sharedGrassMat.uniforms.uPlayerPos.value.set(inputState.characterData.x, 0, inputState.characterData.z);
    }
  });

  return <instancedMesh ref={meshRef} args={[sharedGrassGeo, sharedGrassMat, GRASS_PER_CHUNK]} frustumCulled={false} />;
};

const Ground: React.FC = () => {
  const groundMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColorDirt: { value: new THREE.Color("#2f2219") },
        uColorGrass: { value: new THREE.Color("#163011") },
        uColorGrassLight: { value: new THREE.Color("#254d1c") },
        uFogColor: { value: new THREE.Color("#050a0e") },
        uCameraPos: { value: new THREE.Vector3() }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vSlope;
        ${HEIGHT_GLSL}
        
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          float h = getTerrainHeight(worldPos.xz);
          worldPos.y += h;
          vWorldPos = worldPos.xyz;
          
          float eps = 0.1;
          float hRight = getTerrainHeight(worldPos.xz + vec2(eps, 0.0));
          float hDown = getTerrainHeight(worldPos.xz + vec2(0.0, eps));
          
          vec3 n = normalize(vec3(h - hRight, eps, h - hDown));
          vNormal = n;
          vSlope = n.y; 
          
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColorDirt;
        uniform vec3 uColorGrass;
        uniform vec3 uColorGrassLight;
        uniform vec3 uFogColor;
        uniform vec3 uCameraPos;
        
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vSlope;
        
        ${NOISE_GLSL}

        void main() {
          if (length(vWorldPos.xz) > ${WORLD_RADIUS}.0) discard;
          
          float grain = fbm(vWorldPos.xz * 0.8);
          float patches = fbm(vWorldPos.xz * 0.05); 
          
          vec3 grassColor = mix(uColorGrass, uColorGrassLight, grain);
          
          float dirtMix = smoothstep(0.95, 0.7, vSlope) + patches * 0.3;
          vec3 finalColor = mix(grassColor, uColorDirt, clamp(dirtMix, 0.0, 1.0));
          
          finalColor *= 0.8 + 0.4 * grain; 
          float light = dot(vNormal, normalize(vec3(0.5, 1.0, 0.5)));
          finalColor *= (0.4 + 0.6 * light); 

          float distToCam = distance(vWorldPos.xyz, uCameraPos);
          float distFog = smoothstep(200.0, 900.0, distToCam);
          
          gl_FragColor = vec4(mix(finalColor, uFogColor, distFog), 1.0);
        }
      `
    });
  }, []);

  useFrame((state) => {
      groundMat.uniforms.uCameraPos.value.copy(state.camera.position);
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
        <planeGeometry args={[WORLD_RADIUS * 2.1, WORLD_RADIUS * 2.1, 800, 800]} />
      </mesh>
      {chunks.map((pos, i) => <GrassChunk key={i} position={pos as [number, number, number]} />)}
    </group>
  );
};

export default Ground;
