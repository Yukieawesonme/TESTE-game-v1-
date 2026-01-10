
import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { getTerrainHeight } from './WorldUtils';

const TWIG_COUNT = 60; 
const DIRT_MOUND_COUNT = 30; 
const LEAF_DEBRIS_COUNT = 100; 
const FALLEN_LOG_COUNT = 15; 
const ROCK_COUNT = 20;
const DEBRIS_RADIUS = 980;

const GroundDebris: React.FC = () => {
  const twigRef = useRef<THREE.InstancedMesh>(null);
  const moundRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const logRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);

  const { twigGeo, twigMat, moundGeo, moundMat, leafGeo, leafMat, logGeo, logMat, rockGeo, rockMat } = useMemo(() => {
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

    const rGeo = new THREE.DodecahedronGeometry(0.4, 0);
    const rMat = new THREE.MeshStandardMaterial({ color: "#555", roughness: 0.7 });

    return { twigGeo: tGeo, twigMat: tMat, moundGeo: mGeo, moundMat: mMat, leafGeo: lGeo, leafMat: lMat, logGeo: lgGeo, logMat: lgMat, rockGeo: rGeo, rockMat: rMat };
  }, []);

  const spawnDebris = (count: number, ref: React.RefObject<THREE.InstancedMesh>, yOffset: number = 0, scaleFn?: () => THREE.Vector3) => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 5 + Math.sqrt(Math.random()) * DEBRIS_RADIUS;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      
      const y = getTerrainHeight(x, z);
      
      // Ajuste fino para colar no chão (y puro = chão puro)
      dummy.position.set(x, y + yOffset, z);
      dummy.rotation.set(Math.random()*0.2, Math.random() * Math.PI * 2, Math.random()*0.2);
      
      if (scaleFn) {
        dummy.scale.copy(scaleFn());
      } else {
        dummy.scale.setScalar(0.8 + Math.random());
      }
      
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    // Galhos: Quase zero de offset, só pra não z-fight
    spawnDebris(TWIG_COUNT, twigRef, 0.02);

    // Montes: Enterrados
    spawnDebris(DIRT_MOUND_COUNT, moundRef, -0.15, () => new THREE.Vector3(1.5, 0.4, 1.5));

    // Folhas: Coladas
    spawnDebris(LEAF_DEBRIS_COUNT, leafRef, 0.01);

    // Troncos: Offset = raio aprox
    spawnDebris(FALLEN_LOG_COUNT, logRef, 0.2, () => new THREE.Vector3(1, 1, 1).multiplyScalar(1.0 + Math.random() * 0.5));

    // Pedras: Enterradas
    spawnDebris(ROCK_COUNT, rockRef, -0.1, () => new THREE.Vector3(1 + Math.random(), 0.5 + Math.random(), 1 + Math.random()));

  }, []);

  return (
    <group>
      <instancedMesh ref={twigRef} args={[twigGeo, twigMat, TWIG_COUNT]} frustumCulled={false} />
      <instancedMesh ref={moundRef} args={[moundGeo, moundMat, DIRT_MOUND_COUNT]} frustumCulled={false} />
      <instancedMesh ref={leafRef} args={[leafGeo, leafMat, LEAF_DEBRIS_COUNT]} frustumCulled={false} />
      <instancedMesh ref={logRef} args={[logGeo, logMat, FALLEN_LOG_COUNT]} castShadow frustumCulled={false} />
      <instancedMesh ref={rockRef} args={[rockGeo, rockMat, ROCK_COUNT]} castShadow frustumCulled={false} />
    </group>
  );
};

export default GroundDebris;
