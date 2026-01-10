
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { inputState } from './InputState';

const PARTICLE_COUNT = 60;

export default function DustParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  // Array para armazenar estado de cada partícula
  // [active(0/1), timer, velocityX, velocityY, velocityZ, scaleMult]
  const particlesData = useMemo(() => {
    return new Float32Array(PARTICLE_COUNT * 6).fill(0);
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const spawnTimer = useRef(0);

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.DodecahedronGeometry(0.1, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: "#6b5847", // Cor de terra seca
      transparent: true,
      opacity: 0.6,
      roughness: 1,
      depthWrite: false
    });
    return { geometry: geo, material: mat };
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const dt = Math.min(delta, 0.05);

    // Lógica de Spawn
    const isMoving = Math.abs(inputState.joystick.x) > 0.1 || Math.abs(inputState.joystick.y) > 0.1;
    const isSprint = inputState.sprint;
    const spawnRate = isSprint ? 0.05 : 0.15;

    if (isMoving) {
        spawnTimer.current -= dt;
        if (spawnTimer.current <= 0) {
            spawnTimer.current = spawnRate;
            
            // Encontra partícula inativa
            for(let i=0; i<PARTICLE_COUNT; i++) {
                if (particlesData[i * 6] === 0) {
                    particlesData[i * 6] = 1; // Ativa
                    particlesData[i * 6 + 1] = 1.0; // Life timer
                    
                    // Velocidade aleatória para cima e para os lados
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 0.5 + Math.random() * 0.5;
                    particlesData[i * 6 + 2] = Math.cos(angle) * speed; // VX
                    particlesData[i * 6 + 3] = 0.5 + Math.random() * 1.0; // VY (Up)
                    particlesData[i * 6 + 4] = Math.sin(angle) * speed; // VZ
                    particlesData[i * 6 + 5] = 0.5 + Math.random() * 1.5; // Scale

                    // Posiciona no pé do jogador
                    dummy.position.set(
                        inputState.characterData.x + (Math.random()-0.5)*0.5,
                        0.2, // Logo acima do chão
                        inputState.characterData.z + (Math.random()-0.5)*0.5
                    );
                    // Ajuste de altura do terreno
                    // Nota: Idealmente calcularia getTerrainHeight aqui, mas 0.2 relativo ao player funciona
                    // já que o player segue o terreno.
                    dummy.position.y += inputState.characterData.y || 0; 
                    
                    dummy.scale.setScalar(0);
                    dummy.updateMatrix();
                    meshRef.current.setMatrixAt(i, dummy.matrix);
                    break;
                }
            }
        }
    }

    // Atualização das Partículas
    for(let i=0; i<PARTICLE_COUNT; i++) {
        if (particlesData[i * 6] === 1) {
            // Timer vida
            particlesData[i * 6 + 1] -= dt * 1.5;
            
            if (particlesData[i * 6 + 1] <= 0) {
                particlesData[i * 6] = 0; // Morreu
                dummy.scale.setScalar(0);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(i, dummy.matrix);
                continue;
            }

            // Ler posição atual
            meshRef.current.getMatrixAt(i, dummy.matrix);
            dummy.position.setFromMatrixPosition(dummy.matrix);

            // Move
            dummy.position.x += particlesData[i * 6 + 2] * dt;
            dummy.position.y += particlesData[i * 6 + 3] * dt;
            dummy.position.z += particlesData[i * 6 + 4] * dt;

            // Escala (Cresce e depois encolhe)
            const life = particlesData[i * 6 + 1];
            const scaleBase = particlesData[i * 6 + 5];
            let scale = scaleBase;
            if (life > 0.8) scale = scaleBase * ((1.0 - life) / 0.2); // Fade in
            else scale = scaleBase * life; // Fade out

            dummy.scale.setScalar(scale);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, PARTICLE_COUNT]} frustumCulled={false} />
  );
}
