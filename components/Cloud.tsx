import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CloudData } from '../types';

const Cloud: React.FC<CloudData> = ({ position, speed }) => {
  const meshRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.x += speed;
      if (meshRef.current.position.x > 60) meshRef.current.position.x = -60;
    }
  });

  return (
    <group ref={meshRef} position={position}>
      <mesh castShadow>
        <sphereGeometry args={[2, 16, 16]} />
        <meshStandardMaterial color="white" opacity={0.8} transparent />
      </mesh>
      <mesh position={[1.5, 0, 0]} castShadow>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshStandardMaterial color="white" opacity={0.8} transparent />
      </mesh>
    </group>
  );
};

export default Cloud;