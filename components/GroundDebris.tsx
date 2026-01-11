
import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { getTerrainHeight } from './WorldUtils';
import { inputState } from './InputState';

const TWIG_COUNT = 50; 
const DIRT_MOUND_COUNT = 20; 
const LEAF_DEBRIS_COUNT = 80; 
const FALLEN_LOG_COUNT = 10; 

// OTIMIZAÇÃO: Reduzido de 3500 para 2000
const PEBBLE_COUNT = 2000;  
// OTIMIZAÇÃO: Reduzido de 800 para 400
const ROCK_COUNT = 400;     
// OTIMIZAÇÃO: Reduzido de 120 para 50
const BOULDER_COUNT = 50;  

// --- NOVOS MÁRMORES (Grandes Quantidades) ---
const MARBLE_CHIP_COUNT = 2500; // Fragmentos pequenos
const MARBLE_ROCK_COUNT = 600;  // Pedras médias
const MARBLE_SLAB_COUNT = 80;   // Blocos grandes

const DEBRIS_RADIUS = 980;

const GroundDebris: React.FC = () => {
  const twigRef = useRef<THREE.InstancedMesh>(null);
  const moundRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const logRef = useRef<THREE.InstancedMesh>(null);
  
  const pebbleRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const boulderRef = useRef<THREE.InstancedMesh>(null);

  // Refs para Mármore
  const marbleChipRef = useRef<THREE.InstancedMesh>(null);
  const marbleRockRef = useRef<THREE.InstancedMesh>(null);
  const marbleSlabRef = useRef<THREE.InstancedMesh>(null);

  const { 
    twigGeo, twigMat, 
    moundGeo, moundMat, 
    leafGeo, leafMat, 
    logGeo, logMat, 
    pebbleGeo, pebbleMat,
    rockGeo, rockMat,
    boulderGeo, boulderMat,
    marbleGeo, marbleMat, // Geometria e Material de Mármore
    marbleSlabGeo
  } = useMemo(() => {
    const tGeo = new THREE.CylinderGeometry(0.015, 0.025, 1.2, 3);
    tGeo.rotateZ(Math.PI / 2); 
    const tMat = new THREE.MeshStandardMaterial({ color: "#2d1e14", roughness: 1 });
    
    const mGeo = new THREE.DodecahedronGeometry(0.25, 0);
    const mMat = new THREE.MeshStandardMaterial({ color: "#261a12", roughness: 1 });
    
    const lGeo = new THREE.PlaneGeometry(0.15, 0.1);
    lGeo.rotateX(-Math.PI / 2);
    const lMat = new THREE.MeshStandardMaterial({ color: "#2e3b22", side: THREE.DoubleSide, roughness: 1 });
    
    const lgGeo = new THREE.CylinderGeometry(0.2, 0.25, 2.5, 5);
    lgGeo.rotateZ(Math.PI / 2);
    const lgMat = new THREE.MeshStandardMaterial({ color: "#3a2a1a", roughness: 0.9 });

    const pGeo = new THREE.DodecahedronGeometry(0.12, 0);
    const pMat = new THREE.MeshStandardMaterial({ color: "#333333", roughness: 0.9 });

    const rGeo = new THREE.DodecahedronGeometry(0.4, 0);
    const rMat = new THREE.MeshStandardMaterial({ color: "#555252", roughness: 0.8 });

    const bGeo = new THREE.IcosahedronGeometry(1.5, 0);
    const bMat = new THREE.MeshStandardMaterial({ color: "#4a4a46", roughness: 0.95 });

    // --- SETUP MÁRMORE ---
    // Geometria facetada para brilhar nas arestas
    const mbGeo = new THREE.DodecahedronGeometry(0.3, 0); 
    const mbSlabGeo = new THREE.IcosahedronGeometry(1.2, 0);

    const mbMat = new THREE.MeshStandardMaterial({ 
        color: "#faf9f6", // Branco Off-white (Mármore)
        roughness: 0.3,    // Meio polido, meio bruto
        metalness: 0.1,    // Leve reflexão
        envMapIntensity: 1.2 
    });

    return { 
        twigGeo: tGeo, twigMat: tMat, 
        moundGeo: mGeo, moundMat: mMat, 
        leafGeo: lGeo, leafMat: lMat, 
        logGeo: lgGeo, logMat: lgMat,
        pebbleGeo: pGeo, pebbleMat: pMat,
        rockGeo: rGeo, rockMat: rMat,
        boulderGeo: bGeo, boulderMat: bMat,
        marbleGeo: mbGeo, marbleSlabGeo: mbSlabGeo, marbleMat: mbMat
    };
  }, []);

  const spawnDebris = (
      count: number, 
      ref: React.RefObject<THREE.InstancedMesh>, 
      yOffset: number = 0, 
      scaleFn?: () => THREE.Vector3,
      trackCollision: boolean = false
  ) => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 5 + Math.sqrt(Math.random()) * DEBRIS_RADIUS;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      
      const y = getTerrainHeight(x, z);
      
      dummy.position.set(x, y + yOffset, z);
      dummy.rotation.set(Math.random()*Math.PI, Math.random() * Math.PI * 2, Math.random()*Math.PI);
      
      const scale = scaleFn ? scaleFn() : new THREE.Vector3(1,1,1).multiplyScalar(0.8 + Math.random());
      dummy.scale.copy(scale);
      
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);

      if (trackCollision) {
          const avgScale = (scale.x + scale.z) / 2;
          inputState.worldData.solids.push({ x, z, r: avgScale * 1.0 }); 
      }
    }
    ref.current.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    // Detritos Originais
    spawnDebris(TWIG_COUNT, twigRef, 0.02);
    spawnDebris(DIRT_MOUND_COUNT, moundRef, -0.15, () => new THREE.Vector3(1.5, 0.4, 1.5));
    spawnDebris(LEAF_DEBRIS_COUNT, leafRef, 0.01);
    spawnDebris(FALLEN_LOG_COUNT, logRef, 0.2, () => new THREE.Vector3(1, 1, 1).multiplyScalar(1.0 + Math.random() * 0.5));

    spawnDebris(PEBBLE_COUNT, pebbleRef, 0.05, () => {
        const s = 0.5 + Math.random() * 0.8;
        return new THREE.Vector3(s, s * 0.6, s); 
    });

    spawnDebris(ROCK_COUNT, rockRef, -0.1, () => {
        const s = 0.8 + Math.random() * 1.2;
        return new THREE.Vector3(
            s * (0.8 + Math.random() * 0.4), 
            s * (0.7 + Math.random() * 0.3), 
            s * (0.8 + Math.random() * 0.4)
        );
    });

    spawnDebris(BOULDER_COUNT, boulderRef, -0.5, () => {
        const s = 1.2 + Math.random() * 1.5;
        return new THREE.Vector3(
            s * (0.9 + Math.random() * 0.2), 
            s * (0.8 + Math.random() * 0.4), 
            s * (0.9 + Math.random() * 0.2)
        );
    }, true); 

    // --- SPAWN DE MÁRMORE ---
    
    // 1. Fragmentos Pequenos (Chips)
    spawnDebris(MARBLE_CHIP_COUNT, marbleChipRef, 0.05, () => {
        const s = 0.2 + Math.random() * 0.3; // Pequenos: 0.2 a 0.5
        return new THREE.Vector3(s, s * 0.7, s);
    });

    // 2. Pedras Médias
    spawnDebris(MARBLE_ROCK_COUNT, marbleRockRef, 0.1, () => {
        const s = 0.8 + Math.random() * 0.8; // Médios: 0.8 a 1.6
        return new THREE.Vector3(s, s * 0.8, s);
    });

    // 3. Blocos Grandes (Slabs)
    spawnDebris(MARBLE_SLAB_COUNT, marbleSlabRef, -0.3, () => {
        const s = 1.5 + Math.random() * 1.5; // Grandes: 1.5 a 3.0
        // Mais achatados/quadrados
        return new THREE.Vector3(
            s * (0.8 + Math.random() * 0.4), 
            s * (0.5 + Math.random() * 0.4), 
            s * (0.8 + Math.random() * 0.4)
        );
    }, true); // Com Colisão

  }, []);

  return (
    <group>
      <instancedMesh ref={twigRef} args={[twigGeo, twigMat, TWIG_COUNT]} frustumCulled={false} />
      <instancedMesh ref={moundRef} args={[moundGeo, moundMat, DIRT_MOUND_COUNT]} frustumCulled={false} />
      <instancedMesh ref={leafRef} args={[leafGeo, leafMat, LEAF_DEBRIS_COUNT]} frustumCulled={false} />
      <instancedMesh ref={logRef} args={[logGeo, logMat, FALLEN_LOG_COUNT]} castShadow frustumCulled={false} />
      
      <instancedMesh ref={pebbleRef} args={[pebbleGeo, pebbleMat, PEBBLE_COUNT]} frustumCulled={false} />
      <instancedMesh ref={rockRef} args={[rockGeo, rockMat, ROCK_COUNT]} castShadow frustumCulled={false} />
      <instancedMesh ref={boulderRef} args={[boulderGeo, boulderMat, BOULDER_COUNT]} castShadow receiveShadow frustumCulled={false} />
      
      {/* Camadas de Mármore */}
      <instancedMesh ref={marbleChipRef} args={[marbleGeo, marbleMat, MARBLE_CHIP_COUNT]} frustumCulled={false} />
      <instancedMesh ref={marbleRockRef} args={[marbleGeo, marbleMat, MARBLE_ROCK_COUNT]} castShadow frustumCulled={false} />
      <instancedMesh ref={marbleSlabRef} args={[marbleSlabGeo, marbleMat, MARBLE_SLAB_COUNT]} castShadow receiveShadow frustumCulled={false} />
    </group>
  );
};

export default GroundDebris;
