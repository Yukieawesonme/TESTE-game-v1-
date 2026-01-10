
import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getTerrainHeight } from './WorldUtils';

// Aumentado quantidade e ESCALA para serem visíveis
const BIRD_COUNT = 150;
const SPAWN_RADIUS = 450; 
const SPAWN_RADIUS_SQ = SPAWN_RADIUS * SPAWN_RADIUS;
// Escala aumentada significativamente (de 0.08 para 0.5+)
const BIRD_SCALE_MIN = 0.5; 
const BIRD_SCALE_MAX = 0.9; 

// Estados da IA do Pássaro
enum BirdState {
  FLYING = 0,
  LANDING = 1,
  PERCHED = 2,
  TAKEOFF = 3
}

interface BirdData {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  target: THREE.Vector3;
  state: BirdState;
  timer: number;
  speed: number;
  scale: number;
}

export default function Birds() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const birds = useMemo(() => {
    const data: BirdData[] = [];
    for (let i = 0; i < BIRD_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * SPAWN_RADIUS; 
      
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const groundH = getTerrainHeight(x, z);
      const height = groundH + 5 + Math.random() * 20;

      data.push({
        position: new THREE.Vector3(x, height, z),
        velocity: new THREE.Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5)).normalize(),
        target: new THREE.Vector3(),
        state: BirdState.FLYING,
        timer: Math.random() * 5,
        speed: 6 + Math.random() * 8, // Mais rápidos
        scale: BIRD_SCALE_MIN + Math.random() * (BIRD_SCALE_MAX - BIRD_SCALE_MIN)
      });
    }
    return data;
  }, []);

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    
    // Geometria Low Poly (Asas abertas)
    const vertices = new Float32Array([
      0, 0, 0.4,    // 0: Cabeça
      0, 0, -0.4,   // 1: Cauda
      0.8, 0, -0.1, // 2: Asa Esq (Mais larga)
      -0.8, 0, -0.1,// 3: Asa Dir (Mais larga)
      0, -0.2, 0,   // 4: Barriga
    ]);

    const indices = [
      0, 1, 4, // Corpo
      0, 4, 1, 
      0, 2, 1, // Asa E
      2, 4, 1, 
      0, 1, 3, // Asa D
      3, 1, 4 
    ];

    const wingFactors = new Float32Array([
      0.0, 0.2, 1.0, 1.0, 0.0 // 1.0 = Ponta da asa que bate mais
    ]);
    
    const normals = new Float32Array([
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, -1, 0
    ]);

    // Importante: Atributo aleatório fixo para estabilizar a animação
    const randoms = new Float32Array(BIRD_COUNT * 5); // 5 vertices por pássaro
    for(let i=0; i<BIRD_COUNT; i++) {
        const r = Math.random();
        // Repete o mesmo valor aleatório para todos os vértices do mesmo pássaro
        for(let v=0; v<5; v++) {
            randoms[i*5 + v] = r;
        }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.setAttribute('wingFactor', new THREE.BufferAttribute(wingFactors, 1));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1)); // Novo atributo
    geo.setIndex(indices);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        // Cores mais brilhantes para visibilidade
        uColor1: { value: new THREE.Color("#ffffff") }, // Garça/Branco
        uColor2: { value: new THREE.Color("#ff5555") }, // Arara Vermelha
        uColor3: { value: new THREE.Color("#4488ff") }, // Arara Azul
        uSunDir: { value: new THREE.Vector3(0.5, 1.0, 0.5).normalize() }
      },
      vertexShader: `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        uniform vec3 uSunDir;
        
        attribute float wingFactor;
        attribute float aRandom; // ID Estável
        
        varying vec3 vColor;
        varying float vLighting;

        void main() {
          float flapSpeed = 15.0 + aRandom * 10.0; 
          float flapAmp = 0.45;
          
          // Animação baseada no tempo e no ID aleatório fixo
          float flap = sin(uTime * flapSpeed + aRandom * 100.0) * flapAmp * wingFactor;
          
          vec3 pos = position;
          pos.y += flap; 
          
          vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
          
          // Definição de cor baseada no ID fixo
          if(aRandom < 0.33) vColor = uColor1;
          else if(aRandom < 0.66) vColor = uColor2;
          else vColor = uColor3;

          vec3 worldNormal = normalize(mat3(instanceMatrix) * normal);
          // Iluminação simples mas forte
          float diff = max(dot(worldNormal, uSunDir), 0.5); 
          vLighting = diff;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vLighting;
        
        void main() {
          vec3 finalColor = vColor * vLighting;
          // Adiciona um pouco de emissão para não sumir no escuro
          gl_FragColor = vec4(finalColor + vColor * 0.1, 1.0); 
        }
      `,
      side: THREE.DoubleSide
    });

    return { geometry: geo, material: mat };
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);
  const upAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const center = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    material.uniforms.uTime.value = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    for(let i = 0; i < BIRD_COUNT; i++) {
      const bird = birds[i];
      const terrainH = getTerrainHeight(bird.position.x, bird.position.z);

      switch (bird.state) {
        case BirdState.FLYING:
          bird.timer -= dt;
          
          if (bird.timer <= 0) {
            bird.timer = 1 + Math.random() * 4;
            
            if (Math.random() < 0.08) { // Chance de pousar
              bird.state = BirdState.LANDING;
              const angle = Math.random() * Math.PI * 2;
              const dist = 5 + Math.random() * 15;
              const tx = bird.position.x + Math.cos(angle) * dist;
              const tz = bird.position.z + Math.sin(angle) * dist;
              const targetGroundH = getTerrainHeight(tx, tz);
              const targetY = targetGroundH; // Pousar no chão/arvore (simplificado pro chão)

              bird.target.set(tx, targetY, tz);
            } else {
              const angle = (Math.random() - 0.5) * 3.0;
              tempQuat.setFromAxisAngle(upAxis, angle * dt);
              bird.velocity.applyQuaternion(tempQuat).normalize();
            }
          }

          const distSq = bird.position.x * bird.position.x + bird.position.z * bird.position.z;
          if (distSq > SPAWN_RADIUS_SQ) {
            center.set(0, 0, 0).sub(bird.position).normalize();
            bird.velocity.lerp(center, dt * 1.5);
          }

          bird.velocity.y = Math.sin(state.clock.elapsedTime * 2.0 + i) * 0.2;
          
          // Colisão com chão suave
          if (bird.position.y < terrainH + 2.0) { 
             bird.velocity.y += 1.0; 
             bird.position.y += dt * 3;
          }
          
          bird.position.addScaledVector(bird.velocity, bird.speed * dt);
          break;

        case BirdState.LANDING:
          const dx = bird.target.x - bird.position.x;
          const dy = bird.target.y - bird.position.y;
          const dz = bird.target.z - bird.position.z;
          const distToTargetSq = dx*dx + dy*dy + dz*dz;
          
          if (distToTargetSq < 1.0) {
            bird.position.copy(bird.target);
            bird.state = BirdState.PERCHED;
            bird.timer = 2 + Math.random() * 4;
          } else {
            const dist = Math.sqrt(distToTargetSq);
            bird.velocity.x += ((dx/dist) - bird.velocity.x) * dt * 2.0;
            bird.velocity.y += ((dy/dist) - bird.velocity.y) * dt * 2.0;
            bird.velocity.z += ((dz/dist) - bird.velocity.z) * dt * 2.0;
            
            bird.position.addScaledVector(bird.velocity, bird.speed * dt);
          }
          break;

        case BirdState.PERCHED:
          bird.timer -= dt;
          if (bird.timer <= 0) {
            bird.state = BirdState.TAKEOFF;
            const randAngle = Math.random() * Math.PI * 2;
            bird.velocity.set(Math.cos(randAngle), 0.8, Math.sin(randAngle)).normalize();
            bird.target.y = bird.position.y + 10 + Math.random() * 5;
          }
          break;

        case BirdState.TAKEOFF:
          bird.position.y += 6.0 * dt;
          bird.position.addScaledVector(bird.velocity, bird.speed * 0.5 * dt);
          if (bird.position.y > bird.target.y) {
            bird.state = BirdState.FLYING;
            bird.timer = 1.0;
          }
          break;
      }

      dummy.position.copy(bird.position);
      
      // Orientação
      if (bird.state !== BirdState.PERCHED) {
          const tx = bird.position.x + bird.velocity.x;
          const ty = bird.position.y + bird.velocity.y;
          const tz = bird.position.z + bird.velocity.z;
          dummy.lookAt(tx, ty, tz);
      }

      dummy.scale.setScalar(bird.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, BIRD_COUNT]} frustumCulled={false} />
  );
}
