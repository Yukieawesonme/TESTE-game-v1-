import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { inputState } from './InputState';

const Character: React.FC<{ isPaused?: boolean }> = ({ isPaused = false }) => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  
  const smoothedLookAt = useRef(new THREE.Vector3());
  
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const pos = useRef(new THREE.Vector3(0, 0, 0));
  const velocityY = useRef(0);
  const isGrounded = useRef(true);
  const walkTime = useRef(0);
  const currentRotation = useRef(0);
  
  const MAP_LIMIT = 995;
  const gravity = -35;
  const jumpForce = 13;
  const COLLISION_RADIUS = 0.6; // Raio do personagem

  const materials = useMemo(() => ({
    steel: new THREE.MeshStandardMaterial({ color: "#a1a1aa", metalness: 0.8, roughness: 0.2 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: "#27272a", metalness: 0.9, roughness: 0.3 }),
    gold: new THREE.MeshStandardMaterial({ color: "#fbbf24", metalness: 1, roughness: 0.1 }),
    plume: new THREE.MeshStandardMaterial({ color: "#ef4444", roughness: 0.9 }),
    visor: new THREE.MeshStandardMaterial({ color: "#22d3ee", emissive: "#22d3ee", emissiveIntensity: 2.5 })
  }), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => setKeys(k => ({ ...k, [e.code]: true }));
    const up = (e: KeyboardEvent) => setKeys(k => ({ ...k, [e.code]: false }));
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current || isPaused) return;
    const dt = Math.min(delta, 0.05);

    inputState.look.theta -= inputState.cameraJoystick.x * 0.05;
    inputState.look.phi = Math.max(0.05, Math.min(Math.PI / 2.05, inputState.look.phi + inputState.cameraJoystick.y * 0.05));

    const { theta, phi } = inputState.look;
    const camDist = 8.8;

    const move = new THREE.Vector3(0, 0, 0);
    if (keys['KeyW'] || keys['ArrowUp'] || inputState.joystick.y < -0.1) move.z -= 1;
    if (keys['KeyS'] || keys['ArrowDown'] || inputState.joystick.y > 0.1) move.z += 1;
    if (keys['KeyA'] || keys['ArrowLeft'] || inputState.joystick.x < -0.1) move.x -= 1;
    if (keys['KeyD'] || keys['ArrowRight'] || inputState.joystick.x > 0.1) move.x += 1;

    const isSprint = keys['ShiftLeft'] || inputState.sprint;
    const isMoving = move.lengthSq() > 0.01;
    
    if (isMoving) {
      move.normalize();
      const targetAngle = Math.atan2(move.x, move.z) + theta;
      const speed = isSprint ? 15.5 : 7.8;
      
      const velocity = new THREE.Vector3(Math.sin(targetAngle), 0, Math.cos(targetAngle)).multiplyScalar(speed * dt);
      const nextPos = pos.current.clone().add(velocity);
      
      // Detecção de Colisão com Árvores
      let canMove = true;
      if (nextPos.length() >= MAP_LIMIT) {
        canMove = false;
        inputState.characterData.isAtBoundary = true;
      } else {
        inputState.characterData.isAtBoundary = false;
        
        // Checar apenas sólidos próximos (otimização)
        for (const solid of inputState.worldData.solids) {
          const dx = nextPos.x - solid.x;
          const dz = nextPos.z - solid.z;
          const distSq = dx * dx + dz * dz;
          const minDist = COLLISION_RADIUS + solid.r;
          
          if (distSq < minDist * minDist) {
            canMove = false;
            break;
          }
        }
      }

      if (canMove) {
        pos.current.copy(nextPos);
      }

      let diff = targetAngle - currentRotation.current;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      currentRotation.current += diff * (1 - Math.exp(-14 * dt));
      groupRef.current.rotation.y = currentRotation.current;
      
      walkTime.current += dt * (speed * 1.5);
    }

    if ((keys['Space'] || inputState.jump) && isGrounded.current) {
      velocityY.current = jumpForce;
      isGrounded.current = false;
    }
    velocityY.current += gravity * dt;
    pos.current.y += velocityY.current * dt;
    if (pos.current.y <= 0) { 
      pos.current.y = 0; 
      velocityY.current = 0; 
      isGrounded.current = true; 
    }

    groupRef.current.position.copy(pos.current);
    inputState.characterData.x = pos.current.x;
    inputState.characterData.z = pos.current.z;

    const targetCamPos = new THREE.Vector3(
      pos.current.x + camDist * Math.sin(theta) * Math.cos(phi),
      pos.current.y + camDist * Math.sin(phi) + 2.8,
      pos.current.z + camDist * Math.cos(theta) * Math.cos(phi)
    );
    
    const camFollowSpeed = isSprint ? 14 : 10;
    state.camera.position.lerp(targetCamPos, 1 - Math.exp(-camFollowSpeed * dt));

    const lookAtTarget = new THREE.Vector3(pos.current.x, pos.current.y + 1.8, pos.current.z);
    smoothedLookAt.current.lerp(lookAtTarget, 1 - Math.exp(-18 * dt));
    state.camera.lookAt(smoothedLookAt.current);

    const cycle = walkTime.current;
    if (leftLegRef.current) leftLegRef.current.rotation.x = isMoving ? Math.sin(cycle) * 0.7 : 0;
    if (rightLegRef.current) rightLegRef.current.rotation.x = isMoving ? -Math.sin(cycle) * 0.7 : 0;
    if (leftArmRef.current) leftArmRef.current.rotation.x = isMoving ? -Math.sin(cycle) * 0.5 : 0;
    if (rightArmRef.current) rightArmRef.current.rotation.x = isMoving ? Math.sin(cycle) * 0.5 : 0;
    if (bodyRef.current) bodyRef.current.position.y = isMoving ? Math.abs(Math.sin(cycle * 2)) * 0.05 : 0;
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[0.8, 32]} />
        <meshBasicMaterial color="black" transparent opacity={0.4} />
      </mesh>

      <group ref={bodyRef}>
        <group position={[-0.22, 0.7, 0]} ref={leftLegRef}>
          <mesh position={[0, -0.35, 0]} material={materials.steel} castShadow><boxGeometry args={[0.22, 0.7, 0.22]} /></mesh>
          <mesh position={[0, -0.7, 0.05]} material={materials.darkSteel}><boxGeometry args={[0.26, 0.15, 0.3]} /></mesh>
        </group>
        <group position={[0.22, 0.7, 0]} ref={rightLegRef}>
          <mesh position={[0, -0.35, 0]} material={materials.steel} castShadow><boxGeometry args={[0.22, 0.7, 0.22]} /></mesh>
          <mesh position={[0, -0.7, 0.05]} material={materials.darkSteel}><boxGeometry args={[0.26, 0.15, 0.3]} /></mesh>
        </group>
        <mesh position={[0, 1.4, 0]} material={materials.steel} castShadow><boxGeometry args={[0.65, 0.9, 0.45]} /></mesh>
        <mesh position={[0, 1.5, 0.22]} material={materials.gold}><boxGeometry args={[0.12, 0.4, 0.1]} /></mesh>
        <mesh position={[-0.42, 1.75, 0]} material={materials.steel} castShadow><sphereGeometry args={[0.24, 12, 12]} /></mesh>
        <mesh position={[0.42, 1.75, 0]} material={materials.steel} castShadow><sphereGeometry args={[0.24, 12, 12]} /></mesh>
        <group position={[-0.45, 1.7, 0]} ref={leftArmRef}>
          <mesh position={[0, -0.35, 0]} material={materials.steel} castShadow><boxGeometry args={[0.2, 0.75, 0.2]} /></mesh>
        </group>
        <group position={[0.45, 1.7, 0]} ref={rightArmRef}>
          <mesh position={[0, -0.35, 0]} material={materials.steel} castShadow><boxGeometry args={[0.2, 0.75, 0.2]} /></mesh>
        </group>
        <group position={[0, 2.1, 0]}>
          <mesh material={materials.steel} castShadow><sphereGeometry args={[0.3, 16, 16]} /></mesh>
          <mesh position={[0, 0.05, 0.2]} material={materials.darkSteel}><boxGeometry args={[0.38, 0.18, 0.12]} /></mesh>
          <mesh position={[0, 0.05, 0.25]} material={materials.visor}><boxGeometry args={[0.32, 0.04, 0.05]} /></mesh>
          <mesh position={[0, 0.45, -0.1]} material={materials.plume} rotation={[0.5, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.12, 0.6]} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

export default Character;