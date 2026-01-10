
import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { getTerrainHeight, SeededRandom } from './WorldUtils';

const BUSH_COUNT = 6000; 
const WORLD_RADIUS = 1000;
const WORLD_SEED = 987654321;
const TREE_COUNT = 450; 

// Configuração de detalhe extremo
const LEAVES_PER_BUSH = 80; // Muito mais denso
const BUSH_RADIUS = 1.2;

export default function Bushes() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const { geometry, material } = useMemo(() => {
    // --- GERAÇÃO PROCEDURAL DE GEOMETRIA DE ARBUSTO ---
    // Cria um único arbusto feito de muitas folhas, que será instanciado 6000 vezes.
    
    const singleLeafGeo = new THREE.PlaneGeometry(0.5, 0.5);
    const geometryBuilder = [];
    const colorBuilder = [];
    
    // Paleta de cores para o arbusto
    const colorBottom = new THREE.Color("#1a2e12"); // Base escura (terra/sombra)
    const colorTop = new THREE.Color("#4f8c36");    // Topo iluminado
    
    const tempColor = new THREE.Color();
    const tempPos = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();

    const combinedGeo = new THREE.BufferGeometry();
    const allPositions: number[] = [];
    const allNormals: number[] = [];
    const allColors: number[] = [];
    const allIndices: number[] = [];
    
    let indexOffset = 0;

    for (let i = 0; i < LEAVES_PER_BUSH; i++) {
        // Distribuição em hemisfério (domo)
        // Mais folhas na parte de baixo para dar volume, espalhando para cima
        const r = Math.pow(Math.random(), 0.3) * BUSH_RADIUS; 
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.5; // Apenas hemisfério superior (0 a PI/2)
        
        position.set(
            r * Math.sin(phi) * Math.cos(theta),
            (r * Math.cos(phi)) * 0.6, // Achatado um pouco no Y
            r * Math.sin(phi) * Math.sin(theta)
        );

        // Rotação aleatória para cada folha
        rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        quaternion.setFromEuler(rotation);
        
        const s = 0.5 + Math.random() * 0.8;
        scale.set(s, s, s);

        matrix.compose(position, quaternion, scale);

        const posAttr = singleLeafGeo.attributes.position;
        const normalAttr = singleLeafGeo.attributes.normal;
        const indexAttr = singleLeafGeo.index;

        // Gradiente de cor baseado na altura da folha dentro do arbusto
        const heightPercent = (position.y + 0.2) / BUSH_RADIUS; // Normaliza aprox 0..1
        tempColor.lerpColors(colorBottom, colorTop, Math.min(1, Math.max(0, heightPercent + Math.random() * 0.2)));

        for (let j = 0; j < posAttr.count; j++) {
            // Vertex Position
            tempPos.fromBufferAttribute(posAttr, j);
            tempPos.applyMatrix4(matrix);
            allPositions.push(tempPos.x, tempPos.y, tempPos.z);
            
            // TRUQUE DE "NORMAL SPHERIZATION":
            // Em vez de usar a normal da face plana (que faz a folha parecer papel),
            // usamos um vetor que aponta do centro do arbusto (0,0,0) para a folha.
            // Isso faz o arbusto ser iluminado como uma "nuvem" suave.
            const centerToVertex = tempPos.clone().normalize();
            // Mistura um pouco da normal real para dar textura
            const realNormal = new THREE.Vector3().fromBufferAttribute(normalAttr, j).applyQuaternion(quaternion);
            const blendedNormal = new THREE.Vector3().addVectors(centerToVertex.multiplyScalar(0.8), realNormal.multiplyScalar(0.2)).normalize();
            
            allNormals.push(blendedNormal.x, blendedNormal.y, blendedNormal.z);
            
            // Vertex Color
            allColors.push(tempColor.r, tempColor.g, tempColor.b);
        }

        if (indexAttr) {
            for (let j = 0; j < indexAttr.count; j++) {
                allIndices.push(indexAttr.getX(j) + indexOffset);
            }
            indexOffset += posAttr.count;
        }
    }

    combinedGeo.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
    combinedGeo.setAttribute('normal', new THREE.Float32BufferAttribute(allNormals, 3));
    combinedGeo.setAttribute('color', new THREE.Float32BufferAttribute(allColors, 3));
    combinedGeo.setIndex(allIndices);

    // Material Standard para reagir à luz do sol e sombras
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
      flatShading: false // Suave graças às normais customizadas
    });

    // Adiciona lógica de vento customizada via onBeforeCompile
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.vertexShader = `
          uniform float uTime;
          ${shader.vertexShader}
        `.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          // Vento procedural simples
          float wind = sin(uTime * 1.5 + transformed.x * 0.5 + transformed.z * 0.5) * 0.15;
          // Balança mais o topo do que a base
          float heightFactor = smoothstep(0.0, 2.0, transformed.y);
          transformed.x += wind * heightFactor;
          transformed.z += wind * heightFactor * 0.5;
          `
        );
        mat.userData.shader = shader;
    };

    return { geometry: combinedGeo, material: mat };
  }, []);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    const prng = new SeededRandom(WORLD_SEED);
    
    // Recriar posições das árvores para agrupar arbustos perto delas
    const treePositions: {x: number, z: number}[] = [];
    const radiusMax = 980;
    for (let i = 0; i < TREE_COUNT; i++) {
        const radius = 20 + Math.sqrt(prng.next()) * radiusMax;
        const angle = prng.next() * Math.PI * 2;
        treePositions.push({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius });
        prng.next(); prng.next(); prng.next(); 
    }
    
    for (let i = 0; i < BUSH_COUNT; i++) {
      let x, z;
      // 70% dos arbustos perto de árvores para criar "biomas" densos
      if (i < BUSH_COUNT * 0.7) {
        const treeIdx = Math.floor(prng.next() * TREE_COUNT);
        const treePos = treePositions[treeIdx];
        const offsetAngle = prng.next() * Math.PI * 2;
        const offsetDist = 2.5 + prng.next() * 8;
        x = treePos.x + Math.cos(offsetAngle) * offsetDist;
        z = treePos.z + Math.sin(offsetAngle) * offsetDist;
      } else {
        const r = Math.sqrt(prng.next()) * (WORLD_RADIUS - 20);
        const theta = prng.next() * 2 * Math.PI;
        x = r * Math.cos(theta);
        z = r * Math.sin(theta);
      }
      
      const terrainH = getTerrainHeight(x, z);
      const scaleBase = 0.8 + prng.next() * 1.2;
      
      // Ajuste fino para o arbusto "sentar" no chão corretamente
      // Como o centro da geometria é (0,0,0), apenas colocamos no H
      dummy.position.set(x, terrainH, z);
      dummy.scale.set(scaleBase, scaleBase * (0.8 + prng.next() * 0.4), scaleBase);
      dummy.rotation.set(0, prng.next() * Math.PI * 2, 0);
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((state) => {
    if (material.userData.shader) {
      material.userData.shader.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, BUSH_COUNT]} castShadow receiveShadow frustumCulled={false} />
  );
}
