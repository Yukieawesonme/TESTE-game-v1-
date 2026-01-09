import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

const TWIG_COUNT = 100; 
const DIRT_MOUND_COUNT = 50; 
const LEAF_DEBRIS_COUNT = 200; 
const FALLEN_LOG_COUNT = 20; 
const ROCK_COUNT = 30;
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

  useEffect(() => {
    if (!twigRef.current) return;
    const dummy = new THREE.Object3D();
    
    for (let i = 0; i < TWIG_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 5 + Math.sqrt(Math.random()) * DEBRIS_RADIUS;
      dummy.position.set(Math.cos(angle) * r, 0.03, Math.sin(angle) * r);
      dummy.rotation.set(Math.random()*0.2, Math.random() * Math.PI * 2, Math.random()*0.2);
      dummy.scale.setScalar(0.8 + Math.random());
      dummy.updateMatrix();
      twigRef.current.setMatrixAt(i, dummy.matrix);
    }

    for (let i = 0; i < DIRT_MOUND_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 4 + Math.sqrt(Math.random()) * DEBRIS_RADIUS;
      dummy.position.set(Math.cos(angle) * r, 0.0, Math.sin(angle) * r);
      dummy.scale.set(1.5, 0.4, 1.5);
      dummy.updateMatrix();
      moundRef.current!.setMatrixAt(i, dummy.matrix);
    }

    for (let i = 0; i < LEAF_DEBRIS_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 3 + Math.sqrt(Math.random()) * DEBRIS_RADIUS;
      dummy.position.set(Math.cos(angle) * r, 0.02, Math.sin(angle) * r);
      dummy.rotation.set(Math.random()*0.5, Math.random()*Math.PI, Math.random()*0.5);
      dummy.updateMatrix();
      leafRef.current!.setMatrixAt(i, dummy.matrix);
    }

    for (let i = 0; i < FALLEN_LOG_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 15 + Math.sqrt(Math.random()) * DEBRIS_RADIUS;
      dummy.position.set(Math.cos(angle) * r, 0.15, Math.sin(angle) * r);
      dummy.rotation.set(0, Math.random() * Math.PI, Math.PI * 0.05);
      dummy.scale.setScalar(1.0 + Math.random() * 0.5);
      dummy.updateMatrix();
      logRef.current!.setMatrixAt(i, dummy.matrix);
    }

    for (let i = 0; i < ROCK_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = 10 + Math.sqrt(Math.random()) * DEBRIS_RADIUS;
        dummy.position.set(Math.cos(angle) * r, 0.1, Math.sin(angle) * r);
        dummy.rotation.set(Math.random(), Math.random(), Math.random());
        dummy.scale.set(1 + Math.random(), 0.5 + Math.random(), 1 + Math.random());
        dummy.updateMatrix();
        rockRef.current!.setMatrixAt(i, dummy.matrix);
    }

    [twigRef, moundRef, leafRef, logRef, rockRef].forEach(ref => {
      if (ref.current) {
        ref.current.instanceMatrix.needsUpdate = true;
        ref.current.computeBoundingSphere();
      }
    });
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