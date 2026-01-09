import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const CLOUD_COUNT = 20;

export default function Clouds() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const { geometry, material, cloudData } = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 12, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: "white",
      transparent: true,
      opacity: 0.5,
      flatShading: true
    });
    
    const data = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      data.push({
        x: (Math.random() - 0.5) * 800,
        y: 40 + Math.random() * 20,
        z: (Math.random() - 0.5) * 800,
        scale: 10 + Math.random() * 15,
        speed: 0.05 + Math.random() * 0.1
      });
    }
    return { geometry: geo, material: mat, cloudData: data };
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    
    cloudData.forEach((cloud, i) => {
      cloud.x += cloud.speed;
      if (cloud.x > 500) cloud.x = -500;
      
      dummy.position.set(cloud.x, cloud.y, cloud.z);
      dummy.scale.set(cloud.scale, cloud.scale * 0.5, cloud.scale * 0.8);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, CLOUD_COUNT]} />;
}