import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';

const SceneSky: React.FC = () => {
  const skyRef = useRef<any>(null);
  const cycleDuration = 300;

  useFrame(({ clock }) => {
    const time = (clock.getElapsedTime() % cycleDuration) / cycleDuration;
    const angle = time * Math.PI * 2;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    if (skyRef.current && skyRef.current.material) {
      skyRef.current.material.uniforms.sunPosition.value.set(x, y, 0.3);
    }
  });

  return <Sky ref={skyRef} distance={450000} turbidity={8} rayleigh={6} mieCoefficient={0.005} mieDirectionalG={0.8} />;
};

export default function EnvironmentController() {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const { scene } = useThree();
  const cycleDuration = 300; 

  useMemo(() => {
    scene.fog = new THREE.FogExp2('#ccddcc', 0.003);
  }, [scene]);
  
  useFrame(({ clock }) => {
    const time = (clock.getElapsedTime() % cycleDuration) / cycleDuration;
    const angle = time * Math.PI * 2;
    const x = Math.cos(angle) * 200;
    const y = Math.sin(angle) * 200;
    const z = 100; 

    if (sunRef.current) {
      sunRef.current.position.set(x, y, z);
      const isDay = y > 0;
      
      if (isDay) {
        sunRef.current.intensity = 1.0;
        sunRef.current.color.set('#ffffff');
        
        if (ambientRef.current) {
            ambientRef.current.intensity = 0.5;
            ambientRef.current.color.set("#ffffff");
        }
        
        if (scene.fog) {
            (scene.fog as THREE.FogExp2).color.set('#ccddcc');
        }
      } else {
        sunRef.current.intensity = 0.1;
        sunRef.current.color.set('#112233');
        if (ambientRef.current) {
            ambientRef.current.intensity = 0.2;
            ambientRef.current.color.set("#0a151a");
        }
        if (scene.fog) (scene.fog as THREE.FogExp2).color.set('#050a0e');
      }
    }
  });

  return (
    <>
      <SceneSky />
      <Stars radius={200} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
      <ambientLight ref={ambientRef} intensity={0.5} />
      <directionalLight 
        ref={sunRef}
        position={[100, 150, 100]} 
        intensity={1} 
        castShadow 
        shadow-bias={-0.0005}
        shadow-mapSize={[1024, 1024]} 
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-camera-near={1}
        shadow-camera-far={400}
      />
    </>
  );
}