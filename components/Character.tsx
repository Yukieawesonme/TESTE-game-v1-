
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { inputState } from './InputState';
import { getTerrainHeight } from './WorldUtils';

// Materiais atualizados
const materials = {
  // Armadura: Prata Bem Clara e Brilhante
  armor: new THREE.MeshStandardMaterial({ 
    color: "#ffffff",   // Branco Puro
    roughness: 0.15,    // Muito polido para brilho
    metalness: 0.6,     // Prata clara
    envMapIntensity: 2.5, 
    emissive: "#111111" 
  }),
  // Detalhes cinza médio
  armorDark: new THREE.MeshStandardMaterial({ 
    color: "#444444", 
    roughness: 0.5, 
    metalness: 0.5 
  }), 
  // Ouro para ornamentos
  gold: new THREE.MeshStandardMaterial({ 
    color: "#ffdb4d", 
    roughness: 0.15, 
    metalness: 0.8 
  }),
  // CAPA: Vermelho Fosco
  cloth: new THREE.MeshStandardMaterial({ 
    color: "#8a0303", // Vermelho sangue profundo
    roughness: 1.0,   // Totalmente fosco (sem brilho)
    side: THREE.DoubleSide,
    flatShading: false 
  }),
  
  // --- NOVOS MATERIAIS SHARINGAN AZUL ---
  
  // Anel Externo (A íris do Sharingan) - Azul Profundo
  eyeRing: new THREE.MeshStandardMaterial({ 
    color: "#0022ff", 
    emissive: "#0044ff", 
    emissiveIntensity: 6.0, 
    toneMapped: false
  }),

  // Pupila Central - Energia Pura/Branco Azulado
  eyePupil: new THREE.MeshStandardMaterial({ 
    color: "#aaddff", 
    emissive: "#ffffff", 
    emissiveIntensity: 15.0, // Brilho estourado no centro
    toneMapped: false
  })
};

const KnightModel: React.FC<{ isMoving: boolean, isSprint: boolean }> = ({ isMoving, isSprint }) => {
  const group = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  
  // Refs para física da capa
  const capeGroup = useRef<THREE.Group>(null); // Controla rotação geral (colisão)
  const capeMesh = useRef<THREE.Mesh>(null);   // Controla deformação dos vértices (tecido)
  const currentCapeAngle = useRef(0.05);

  // Buffer para armazenar posições originais dos vértices da capa
  const originalPositions = useRef<Float32Array | null>(null);

  // CRIAÇÃO DA GEOMETRIA DA CAPA COM PIVÔ AJUSTADO
  // Usamos useMemo para garantir que o translate só rode uma vez na criação
  const capeGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.90, 1.4, 16, 20);
    // Translada a geometria para baixo, fazendo o topo (Y=0) ser o pivô
    geo.translate(0, -0.7, 0); 
    return geo;
  }, []);

  useFrame((state, delta) => {
    if (!group.current) return;
    
    const t = state.clock.elapsedTime;
    const speed = isSprint ? 15 : 10;
    
    // Animação de Caminhada/Corrida (Membros)
    if (isMoving) {
      if (leftLeg.current) leftLeg.current.rotation.x = Math.sin(t * speed) * 0.5;
      if (rightLeg.current) rightLeg.current.rotation.x = Math.sin(t * speed + Math.PI) * 0.5;
      
      if (leftArm.current) leftArm.current.rotation.x = Math.sin(t * speed + Math.PI) * 0.5;
      if (rightArm.current) rightArm.current.rotation.x = Math.sin(t * speed) * 0.5;
      
      // Bobbing
      group.current.position.y = Math.abs(Math.sin(t * speed)) * 0.05;
    } else {
      // Idle
      if (leftLeg.current) leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, 0, 0.1);
      if (rightLeg.current) rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, 0, 0.1);
      if (leftArm.current) leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0, 0.1);
      if (rightArm.current) rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, 0.1);
      
      group.current.position.y = Math.sin(t * 2) * 0.02;
    }

    // --- FÍSICA DA CAPA PT.1: Rotação Rígida (Pêndulo) ---
    // Agora o pivô está no topo, então a rotação X balança a capa inteira a partir do pescoço
    if (capeGroup.current) {
        // Ângulo base: levemente para trás para não entrar na perna
        let targetAngle = 0.08; 
        
        if (isMoving) {
            // Se move, o vento levanta a capa
            targetAngle = isSprint ? 0.8 : 0.4; 
        }
        
        // Oscilação do vento
        const windSway = Math.sin(t * (isSprint ? 12 : 3)) * (isMoving ? 0.15 : 0.02);
        targetAngle += windSway;

        // Lerp para suavidade (Inércia)
        const inertia = isMoving ? 4.0 : 2.0; 
        currentCapeAngle.current = THREE.MathUtils.lerp(currentCapeAngle.current, targetAngle, delta * inertia);

        // Limite mínimo para não entrar na armadura das costas
        const COLLISION_LIMIT = 0.05;
        if (currentCapeAngle.current < COLLISION_LIMIT) {
            currentCapeAngle.current = COLLISION_LIMIT;
        }
        capeGroup.current.rotation.x = currentCapeAngle.current;
    }

    // --- FÍSICA DA CAPA PT.2: Deformação de Tecido (Vertex Animation) ---
    if (capeMesh.current && capeMesh.current.geometry) {
        const geo = capeMesh.current.geometry;
        const posAttribute = geo.attributes.position;
        
        if (!originalPositions.current) {
            originalPositions.current = posAttribute.array.slice() as Float32Array;
        }

        const positions = posAttribute.array;
        const originals = originalPositions.current;
        const count = posAttribute.count;

        // Parâmetros do Vento
        const windSpeed = isSprint ? 20.0 : (isMoving ? 12.0 : 2.0);
        const waveAmp = isSprint ? 0.2 : (isMoving ? 0.1 : 0.02);
        const flutterFreq = isSprint ? 25.0 : 8.0;

        for (let i = 0; i < count; i++) {
            const px = originals[i * 3];
            const py = originals[i * 3 + 1]; 
            // NOTA: Como usamos translate(0, -0.7, 0), py varia de 0 (topo) a -1.4 (base)

            // Rigidez: 0 no topo (fixo na armadura), 1 na base (livre)
            // py é negativo, então py / -1.4 vai de 0 a 1
            const fluidity = Math.min(1, Math.abs(py / 1.4)); 
            const loose = Math.pow(fluidity, 2); // Curva quadrática para o topo ficar bem rígido

            // 1. Dobras Naturais (Drapeamento)
            const pleat = Math.cos(px * 12.0) * 0.06 * loose;

            // 2. Onda Principal do Vento (Senoide percorrendo de cima para baixo)
            const windWave = Math.sin(py * 4.0 - t * windSpeed) * waveAmp * loose;

            // 3. Tremulação (Flutter) nas pontas
            const flutter = Math.sin(t * flutterFreq + px * 15.0) * 0.03 * loose;

            // 4. Curvatura "Abraçando" os ombros
            // Só aplica curvatura leve se estiver descendo pelas costas, topo fica reto
            const shoulderCurve = (px * px) * -0.6 * fluidity; 

            // Aplica no Z
            const newZ = pleat + windWave + flutter + shoulderCurve;

            positions[i * 3] = px + (Math.sin(py * 8) * 0.01 * loose); // Leve movimento X
            positions[i * 3 + 1] = py; // Y se mantém (esticamento ignorado para performance)
            positions[i * 3 + 2] = newZ;
        }

        posAttribute.needsUpdate = true;
        geo.computeVertexNormals();
    }
  });

  // Função auxiliar para renderLegArmor
  const renderLegArmor = (side: 'left' | 'right') => {
      const isLeft = side === 'left';
      const kneeWingRot = isLeft ? -0.2 : 0.2;
      const kneeWingPos = isLeft ? 0.12 : -0.12;
      return (
        <group>
            <mesh material={materials.armorDark}><sphereGeometry args={[0.09]} /></mesh>
            <mesh position={[0, -0.2, 0]} material={materials.armor} castShadow>
                <cylinderGeometry args={[0.11, 0.09, 0.45, 12]} />
            </mesh>
            <mesh position={[0, -0.2, 0.1]} material={materials.armorDark}>
                 <boxGeometry args={[0.04, 0.35, 0.02]} />
            </mesh>
            <mesh position={[0, -0.45, 0.04]} material={materials.armor} castShadow>
                 <dodecahedronGeometry args={[0.10, 0]} />
            </mesh>
            <mesh position={[kneeWingPos, -0.45, 0.02]} material={materials.armor} rotation={[0,0, kneeWingRot]}>
                 <cylinderGeometry args={[0.08, 0.08, 0.02, 6]} />
            </mesh>
            <mesh position={[0, -0.7, 0]} material={materials.armor} castShadow>
                 <cylinderGeometry args={[0.09, 0.07, 0.45, 12]} />
            </mesh>
            <mesh position={[0, -0.7, 0.08]} material={materials.armor} rotation={[0.05,0,0]}>
                 <boxGeometry args={[0.03, 0.4, 0.03]} />
            </mesh>
            <group position={[0, -0.95, 0.05]}>
                <mesh position={[0, 0.08, -0.05]} material={materials.armorDark}>
                     <cylinderGeometry args={[0.06, 0.07, 0.1, 8]} />
                </mesh>
                <mesh position={[0, 0, -0.08]} material={materials.armor} castShadow>
                    <boxGeometry args={[0.10, 0.09, 0.12]} />
                </mesh>
                <mesh position={[0, -0.02, 0.06]} material={materials.armor} castShadow>
                     <boxGeometry args={[0.10, 0.08, 0.14]} />
                     <group rotation={[0.1, 0, 0]} />
                </mesh>
                <mesh position={[0, -0.04, 0.18]} material={materials.armor} castShadow>
                     <boxGeometry args={[0.11, 0.06, 0.10]} />
                </mesh>
                <mesh position={[0, -0.075, 0.05]} material={materials.armorDark}>
                    <boxGeometry args={[0.105, 0.02, 0.36]} />
                </mesh>
                 <mesh position={[0, 0.02, -0.14]} material={materials.gold}>
                    <boxGeometry args={[0.02, 0.02, 0.04]} />
                </mesh>
            </group>
        </group>
      );
  }

  return (
    <group ref={group}>
      {/* --- CORPO (Peitoral Complexo em Camadas) --- */}
      <group position={[0, 1.35, 0]}>
        
        {/* 1. Base do Torso */}
        <mesh material={materials.armorDark} castShadow>
          <cylinderGeometry args={[0.24, 0.20, 0.65, 8]} />
        </mesh>

        {/* 2. Placa Peitoral Esquerda */}
        <mesh position={[0.14, 0.12, 0.15]} rotation={[0.05, -0.25, 0.05]} material={materials.armor} castShadow>
           <boxGeometry args={[0.24, 0.35, 0.12]} />
        </mesh>

        {/* 3. Placa Peitoral Direita */}
        <mesh position={[-0.14, 0.12, 0.15]} rotation={[0.05, 0.25, -0.05]} material={materials.armor} castShadow>
           <boxGeometry args={[0.24, 0.35, 0.12]} />
        </mesh>

        {/* 4. Placa Central */}
        <mesh position={[0, 0.1, 0.22]} material={materials.armor} castShadow>
            <boxGeometry args={[0.08, 0.38, 0.08]} />
        </mesh>
        {/* Detalhe Dourado */}
        <mesh position={[0, 0.22, 0.265]} material={materials.gold}> 
            <boxGeometry args={[0.04, 0.04, 0.01]} />
        </mesh>

        {/* 5. SISTEMA ABDOMINAL (Frente + Laterais) */}
        <group position={[0, -0.05, 0]}> 
            {/* Camada 1: Superior */}
            <mesh position={[0, 0, 0.17]} material={materials.armor} rotation={[0.1, 0, 0]} castShadow>
                <boxGeometry args={[0.32, 0.10, 0.08]} />
            </mesh>
            {/* Laterais Camada 1 (Flancos) */}
            <mesh position={[0.15, 0, 0.10]} material={materials.armor} rotation={[0.1, -0.4, 0]} castShadow>
                <boxGeometry args={[0.10, 0.09, 0.15]} />
            </mesh>
            <mesh position={[-0.15, 0, 0.10]} material={materials.armor} rotation={[0.1, 0.4, 0]} castShadow>
                <boxGeometry args={[0.10, 0.09, 0.15]} />
            </mesh>

            {/* Fresta Escura */}
            <mesh position={[0, -0.05, 0.16]} material={materials.armorDark}>
                 <boxGeometry args={[0.30, 0.02, 0.08]} />
            </mesh>

            {/* Camada 2: Médio */}
            <mesh position={[0, -0.10, 0.18]} material={materials.armor} rotation={[0.05, 0, 0]} castShadow>
                <boxGeometry args={[0.30, 0.10, 0.08]} />
            </mesh>
             {/* Laterais Camada 2 (Flancos) */}
             <mesh position={[0.14, -0.10, 0.12]} material={materials.armor} rotation={[0.05, -0.3, 0]} castShadow>
                <boxGeometry args={[0.10, 0.09, 0.14]} />
            </mesh>
            <mesh position={[-0.14, -0.10, 0.12]} material={materials.armor} rotation={[0.05, 0.3, 0]} castShadow>
                <boxGeometry args={[0.10, 0.09, 0.14]} />
            </mesh>

            {/* Fresta Escura */}
            <mesh position={[0, -0.15, 0.17]} material={materials.armorDark}>
                 <boxGeometry args={[0.28, 0.02, 0.08]} />
            </mesh>

            {/* Camada 3: Cintura */}
            <mesh position={[0, -0.20, 0.19]} material={materials.armor} rotation={[0, 0, 0]} castShadow>
                <boxGeometry args={[0.28, 0.10, 0.08]} />
            </mesh>
             {/* Laterais Camada 3 (Flancos) */}
             <mesh position={[0.13, -0.20, 0.14]} material={materials.armor} rotation={[0, -0.2, 0]} castShadow>
                <boxGeometry args={[0.08, 0.09, 0.12]} />
            </mesh>
            <mesh position={[-0.13, -0.20, 0.14]} material={materials.armor} rotation={[0, 0.2, 0]} castShadow>
                <boxGeometry args={[0.08, 0.09, 0.12]} />
            </mesh>

             {/* Camada 4: Placa Pélvica (Fauld Central) */}
            <mesh position={[0, -0.30, 0.20]} material={materials.armor} rotation={[-0.05, 0, 0]} castShadow>
                <boxGeometry args={[0.24, 0.12, 0.08]} />
            </mesh>
        </group>

        {/* 6. ARMADURA DAS COSTAS (Nova) */}
        <group position={[0, 0, -0.14]}>
            <mesh position={[0, 0, 0]} material={materials.armorDark} castShadow>
                 <boxGeometry args={[0.10, 0.65, 0.08]} />
            </mesh>
            <mesh position={[0.14, 0.15, -0.02]} material={materials.armor} rotation={[0.05, 0.2, 0]} castShadow>
                <boxGeometry args={[0.20, 0.35, 0.08]} />
            </mesh>
            <mesh position={[-0.14, 0.15, -0.02]} material={materials.armor} rotation={[0.05, -0.2, 0]} castShadow>
                <boxGeometry args={[0.20, 0.35, 0.08]} />
            </mesh>
            <mesh position={[0, -0.25, 0.02]} material={materials.armor} rotation={[-0.05, 0, 0]} castShadow>
                <boxGeometry args={[0.26, 0.20, 0.06]} />
            </mesh>
        </group>

        {/* Cinto Lateral */}
        <mesh position={[0, -0.40, 0]} material={materials.armorDark} castShadow>
             <cylinderGeometry args={[0.22, 0.21, 0.15, 8]} />
        </mesh>

        {/* Proteções Laterais de Quadril (Tassets) */}
        <group position={[0, -0.42, 0]}>
             <mesh position={[0.20, -0.05, 0.05]} material={materials.armor} rotation={[0, 0, -0.15]} castShadow>
                 <boxGeometry args={[0.10, 0.25, 0.18]} />
             </mesh>
             <mesh position={[-0.20, -0.05, 0.05]} material={materials.armor} rotation={[0, 0, 0.15]} castShadow>
                 <boxGeometry args={[0.10, 0.25, 0.18]} />
             </mesh>
        </group>

        {/* Colar/Pescoço */}
        <mesh position={[0, 0.38, 0]} material={materials.armor}>
            <cylinderGeometry args={[0.16, 0.26, 0.15, 8]} />
        </mesh>
      </group>

      {/* --- CABEÇA (Capacete Detalhado) --- */}
      <group position={[0, 1.85, 0]}>
        <mesh castShadow receiveShadow material={materials.armor}>
          <dodecahedronGeometry args={[0.22, 1]} />
          <group scale={[0.95, 1.3, 1.1]} /> 
        </mesh>
        <mesh position={[0, 0.32, -0.05]} castShadow material={materials.armor}>
          <boxGeometry args={[0.04, 0.2, 0.45]} />
          <group rotation={[0.2, 0, 0]} />
        </mesh>
        <mesh position={[0.20, 0.05, 0.05]} material={materials.armorDark} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.05, 8]} />
        </mesh>
        <mesh position={[-0.20, 0.05, 0.05]} material={materials.armorDark} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.05, 8]} />
        </mesh>
        <mesh position={[0, 0.14, 0.19]} material={materials.armor} castShadow>
             <boxGeometry args={[0.28, 0.08, 0.12]} />
             <group rotation={[0.15, 0, 0]} />
        </mesh>
        <mesh position={[0, 0.04, 0.17]} material={materials.cloth}>
            <boxGeometry args={[0.22, 0.08, 0.05]} />
        </mesh>
        <group position={[0.06, 0.04, 0.196]} rotation={[0, 0.15, 0]}>
            <mesh material={materials.eyeRing}>
                <torusGeometry args={[0.022, 0.005, 6, 16]} />
            </mesh>
            <mesh material={materials.eyePupil}>
                <circleGeometry args={[0.012, 12]} />
            </mesh>
        </group>
        <group position={[-0.06, 0.04, 0.196]} rotation={[0, -0.15, 0]}>
             <mesh material={materials.eyeRing}>
                <torusGeometry args={[0.022, 0.005, 6, 16]} />
            </mesh>
            <mesh material={materials.eyePupil}>
                <circleGeometry args={[0.012, 12]} />
            </mesh>
        </group>
        <mesh position={[0, -0.14, 0.20]} material={materials.armor} castShadow>
             <boxGeometry args={[0.26, 0.18, 0.15]} />
             <group rotation={[-0.1, 0, 0]} />
        </mesh>
        <group position={[0, -0.14, 0.28]}>
            <mesh position={[0, 0, 0]} material={materials.armorDark}>
              <boxGeometry args={[0.02, 0.12, 0.01]} />
            </mesh>
            <mesh position={[-0.05, 0.01, -0.01]} material={materials.armorDark} rotation={[0, 0, -0.2]}>
              <boxGeometry args={[0.015, 0.10, 0.01]} />
            </mesh>
            <mesh position={[0.05, 0.01, -0.01]} material={materials.armorDark} rotation={[0, 0, 0.2]}>
              <boxGeometry args={[0.015, 0.10, 0.01]} />
            </mesh>
        </group>
      </group>

      {/* --- OMBREIRAS --- */}
      <group ref={leftArm} position={[0.32, 1.55, 0]}>
        <mesh position={[0.1, 0.05, 0]} castShadow material={materials.armor}>
           <sphereGeometry args={[0.18, 8, 8]} />
           <group scale={[1, 1.2, 1]} />
        </mesh>
        <mesh position={[0.1, -0.25, 0]} castShadow material={materials.armorDark}>
          <cylinderGeometry args={[0.06, 0.05, 0.5, 6]} />
        </mesh>
        <mesh position={[0.1, -0.55, 0]} castShadow material={materials.armor}>
           <boxGeometry args={[0.12, 0.15, 0.12]} />
        </mesh>
      </group>

      <group ref={rightArm} position={[-0.32, 1.55, 0]}>
        <mesh position={[-0.1, 0.05, 0]} castShadow material={materials.armor}>
           <sphereGeometry args={[0.18, 8, 8]} />
           <group scale={[1, 1.2, 1]} />
        </mesh>
        <mesh position={[-0.1, -0.25, 0]} castShadow material={materials.armorDark}>
          <cylinderGeometry args={[0.06, 0.05, 0.5, 6]} />
        </mesh>
        <mesh position={[-0.1, -0.55, 0]} castShadow material={materials.armor}>
           <boxGeometry args={[0.12, 0.15, 0.12]} />
        </mesh>
      </group>

      {/* --- PERNAS COM ARMADURA COMPLETA --- */}
      <group ref={leftLeg} position={[0.12, 1.1, 0]}>
        {renderLegArmor('left')}
      </group>

      <group ref={rightLeg} position={[-0.12, 1.1, 0]}>
         {renderLegArmor('right')}
      </group>

      {/* --- CAPA (Simulação Dinâmica de Tecido) --- */}
      <group ref={capeGroup} position={[0, 1.58, -0.17]}>
        {/* Posição ajustada para colar nas costas, abaixo das ombreiras */}
        <mesh ref={capeMesh} geometry={capeGeometry} castShadow material={materials.cloth}>
           {/* Geometry criada e traduzida no useMemo acima */}
        </mesh>
      </group>
    </group>
  );
};

const Character: React.FC<{ isPaused?: boolean }> = ({ isPaused = false }) => {
  const groupRef = useRef<THREE.Group>(null);
  const smoothedLookAt = useRef(new THREE.Vector3());
  
  // Controle de Física
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const pos = useRef(new THREE.Vector3(0, getTerrainHeight(0, 0), 0));
  const velocityY = useRef(0);
  const isGrounded = useRef(true);
  const currentRotation = useRef(0);
  const [isMoving, setIsMoving] = useState(false);
  const [isSprint, setIsSprint] = useState(false);

  const MAP_LIMIT = 995;
  const gravity = -35;
  const jumpForce = 13;
  const COLLISION_RADIUS = 0.6; 
  const FLOOR_OFFSET = 0.0;

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

    // --- CÂMERA ---
    inputState.look.theta -= inputState.cameraJoystick.x * 0.05;
    inputState.look.phi = Math.max(0.05, Math.min(Math.PI / 2.05, inputState.look.phi + inputState.cameraJoystick.y * 0.05));

    const { theta, phi } = inputState.look;
    const camDist = 8.8;

    // --- MOVIMENTO ---
    const move = new THREE.Vector3(0, 0, 0);
    if (keys['KeyW'] || keys['ArrowUp'] || inputState.joystick.y < -0.1) move.z -= 1;
    if (keys['KeyS'] || keys['ArrowDown'] || inputState.joystick.y > 0.1) move.z += 1;
    if (keys['KeyA'] || keys['ArrowLeft'] || inputState.joystick.x < -0.1) move.x -= 1;
    if (keys['KeyD'] || keys['ArrowRight'] || inputState.joystick.x > 0.1) move.x += 1;

    const sprint = keys['ShiftLeft'] || inputState.sprint;
    setIsSprint(sprint);

    const moving = move.lengthSq() > 0.01;
    setIsMoving(moving);

    // --- LÓGICA DE POSIÇÃO ---
    if (moving) {
      move.normalize();
      const targetAngle = Math.atan2(move.x, move.z) + theta;
      const speed = sprint ? 15.5 : 7.8;
      
      const velocity = new THREE.Vector3(Math.sin(targetAngle), 0, Math.cos(targetAngle)).multiplyScalar(speed * dt);
      const nextPos = pos.current.clone().add(velocity);
      
      let canMove = true;
      if (nextPos.length() >= MAP_LIMIT) {
        canMove = false;
        inputState.characterData.isAtBoundary = true;
      } else {
        inputState.characterData.isAtBoundary = false;
        
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
        pos.current.x = nextPos.x;
        pos.current.z = nextPos.z;
      }

      let diff = targetAngle - currentRotation.current;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      currentRotation.current += diff * (1 - Math.exp(-14 * dt));
      groupRef.current.rotation.y = currentRotation.current;
    }

    if ((keys['Space'] || inputState.jump) && isGrounded.current) {
      velocityY.current = jumpForce;
      isGrounded.current = false;
    }
    
    velocityY.current += gravity * dt;
    pos.current.y += velocityY.current * dt;
    
    const terrainH = getTerrainHeight(pos.current.x, pos.current.z);
    
    if (pos.current.y <= terrainH + FLOOR_OFFSET) { 
      pos.current.y = terrainH + FLOOR_OFFSET; 
      velocityY.current = 0; 
      isGrounded.current = true; 
    }

    groupRef.current.position.copy(pos.current);
    inputState.characterData.x = pos.current.x;
    inputState.characterData.z = pos.current.z;
    inputState.characterData.y = pos.current.y; 

    const targetCamPos = new THREE.Vector3(
      pos.current.x + camDist * Math.sin(theta) * Math.cos(phi),
      pos.current.y + camDist * Math.sin(phi) + 2.8,
      pos.current.z + camDist * Math.cos(theta) * Math.cos(phi)
    );
    
    const camFollowSpeed = sprint ? 14 : 10;
    state.camera.position.lerp(targetCamPos, 1 - Math.exp(-camFollowSpeed * dt));

    const lookAtTarget = new THREE.Vector3(pos.current.x, pos.current.y + 1.8, pos.current.z);
    smoothedLookAt.current.lerp(lookAtTarget, 1 - Math.exp(-18 * dt));
    state.camera.lookAt(smoothedLookAt.current);
  });

  return (
    <group ref={groupRef}>
      {/* Sombra Fake no chão para grounding */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[0.8, 32]} />
        <meshBasicMaterial color="black" transparent opacity={0.4} />
      </mesh>

      {/* Modelo Procedural do Cavaleiro */}
      <KnightModel isMoving={isMoving} isSprint={isSprint} />
    </group>
  );
};

export default Character;
