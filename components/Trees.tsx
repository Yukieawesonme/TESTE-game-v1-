
import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { inputState } from './InputState';
import { getTerrainHeight, SeededRandom } from './WorldUtils';

// Mantendo contagem segura de árvores para performance
const TREE_COUNT = 300; 
const BRANCHES_PER_TREE = 3; 
const LEAF_CLUSTERS_PER_BRANCH = 5; 
const ROOTS_PER_TREE = 3;
const WORLD_SEED = 987654321; 

export default function Trees() {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const branchRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const rootRef = useRef<THREE.InstancedMesh>(null);

  const { trunkGeo, trunkMat, branchGeo, leafGeo, leafMat, rootGeo, treeTransforms } = useMemo(() => {
    const prng = new SeededRandom(WORLD_SEED);

    // Geometria Tronco
    const tGeo = new THREE.CylinderGeometry(0.35, 1.4, 9, 7);
    tGeo.translate(0, 4.5, 0); 
    
    // Geometria Galhos
    const bGeo = new THREE.CylinderGeometry(0.08, 0.3, 4, 5);
    bGeo.translate(0, 2, 0);
    
    // Geometria Raízes
    const rGeo = new THREE.CylinderGeometry(0.15, 0.5, 2.5, 5);
    rGeo.rotateZ(Math.PI * 0.4);
    rGeo.translate(0.9, 0, 0);

    const tMat = new THREE.MeshStandardMaterial({
        color: "#3e2723", 
        roughness: 0.9,
        metalness: 0.1
    });

    // --- CONFIGURAÇÃO DE FOLHAGEM ---
    // Aumentado a densidade (de 45 para 64) pois as folhas agora são mais finas
    const LEAVES_PER_CLUSTER = 64; 
    
    // GEOMETRIA NOVA: Folha fina e pontuda (Lanceolada)
    const singleLeafGeo = new THREE.BufferGeometry();
    
    // Vértices ajustados: Largura reduzida (0.25) mantendo altura (2.4)
    const leafVertices = new Float32Array([
        0.0, 0.0, 0.0,    // 0: Base
        0.25, 0.6, 0.05,  // 1: Esquerda (Estreitada de 0.5 para 0.25)
       -0.25, 0.6, -0.05, // 2: Direita (Estreitada de -0.5 para -0.25)
        0.0, 2.4, 0.0     // 3: Ponta (Alta e afiada)
    ]);
    
    const leafIndices = [
        0, 1, 2, // Base triangular
        1, 3, 2  // Ponta triangular alongada
    ];

    singleLeafGeo.setAttribute('position', new THREE.BufferAttribute(leafVertices, 3));
    singleLeafGeo.setIndex(leafIndices);
    singleLeafGeo.computeVertexNormals();

    const colorInside = new THREE.Color("#0a2615"); 
    const colorOutside = new THREE.Color("#52b848"); 
    const tempColor = new THREE.Color();
    const tempPos = new THREE.Vector3();
    const tempNormal = new THREE.Vector3();
    
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();

    const combinedLeafGeo = new THREE.BufferGeometry();
    const allPositions: number[] = [];
    const allNormals: number[] = [];
    const allColors: number[] = [];
    const allIndices: number[] = [];
    
    let indexOffset = 0;

    for (let i = 0; i < LEAVES_PER_CLUSTER; i++) {
        // Raio do cluster
        const r = Math.pow(Math.random(), 0.5) * 2.5; 
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );

        // Rotação aleatória
        rotation.set(
            Math.random() * Math.PI * 2, 
            Math.random() * Math.PI * 2, 
            Math.random() * Math.PI * 2
        );
        quaternion.setFromEuler(rotation);
        
        // --- VARIAÇÃO DE TAMANHO (Ajuste Solicitado) ---
        // Range grande: De 0.4 (muito pequena) até 2.2 (gigante/pendente)
        // Math.pow(..., 2) faz com que existam mais folhas médias/pequenas e algumas raras gigantes
        const sizeVariation = Math.random();
        const s = 0.4 + (sizeVariation * sizeVariation) * 1.8; 
        
        // Variação de proporção: Algumas mais magras, outras mais largas
        scale.set(s * (0.8 + Math.random() * 0.4), s, s * (0.8 + Math.random() * 0.4));

        matrix.compose(position, quaternion, scale);

        const posAttr = singleLeafGeo.attributes.position;
        const normAttr = singleLeafGeo.attributes.normal;
        const indexAttr = singleLeafGeo.index;

        const distRatio = position.length() / 2.5;
        // Folhas menores tendem a ser mais claras (novas), maiores mais escuras
        const colorMix = Math.min(1, distRatio + (1.0 - sizeVariation) * 0.3);
        tempColor.lerpColors(colorInside, colorOutside, Math.pow(colorMix, 1.2));
        tempColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);

        for (let j = 0; j < posAttr.count; j++) {
            tempPos.fromBufferAttribute(posAttr, j);
            tempPos.applyMatrix4(matrix);
            allPositions.push(tempPos.x, tempPos.y, tempPos.z);
            
            tempNormal.fromBufferAttribute(normAttr, j);
            tempNormal.applyQuaternion(quaternion);
            
            const sphereNormal = tempPos.clone().normalize();
            tempNormal.lerp(sphereNormal, 0.6).normalize(); 
            
            allNormals.push(tempNormal.x, tempNormal.y, tempNormal.z);
            allColors.push(tempColor.r, tempColor.g, tempColor.b);
        }

        if (indexAttr) {
            for (let j = 0; j < indexAttr.count; j++) {
                allIndices.push(indexAttr.getX(j) + indexOffset);
            }
            indexOffset += posAttr.count;
        }
    }

    combinedLeafGeo.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
    combinedLeafGeo.setAttribute('normal', new THREE.Float32BufferAttribute(allNormals, 3));
    combinedLeafGeo.setAttribute('color', new THREE.Float32BufferAttribute(allColors, 3));
    combinedLeafGeo.setIndex(allIndices);

    const lMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.7, 
        metalness: 0.0,
        side: THREE.DoubleSide,
        flatShading: false 
    });

    lMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.vertexShader = `
          uniform float uTime;
          ${shader.vertexShader}
        `.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          // Vento procedural
          float wind = sin(uTime * 1.0 + transformed.x * 0.1 + transformed.z * 0.1) * 0.2;
          float flutter = sin(uTime * 4.0 + transformed.y) * 0.08;
          
          float tipInfluence = smoothstep(0.0, 2.0, transformed.y);
          
          transformed.x += (wind + flutter) * tipInfluence;
          transformed.z += (wind + flutter) * 0.5 * tipInfluence;
          `
        );
        lMat.userData.shader = shader;
    };

    const transforms = [];
    const collisionSolids = [];
    const radiusMax = 980; 
    
    for (let i = 0; i < TREE_COUNT; i++) {
      const radius = 20 + Math.sqrt(prng.next()) * radiusMax;
      const angle = prng.next() * Math.PI * 2;
      
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      const terrainHeight = getTerrainHeight(x, z);
      
      const scale = 3.5 + prng.next() * 4.0;
      
      const fixedY = terrainHeight - 0.5;
      
      transforms.push({ x, y: fixedY, z, scale, rot: prng.next() * Math.PI, gnarl: prng.next() });
      collisionSolids.push({ x, z, r: 0.9 * scale });
    }
    
    inputState.worldData.solids = collisionSolids;
    
    return { trunkGeo: tGeo, trunkMat: tMat, branchGeo: bGeo, leafGeo: combinedLeafGeo, leafMat: lMat, rootGeo: rGeo, treeTransforms: transforms };
  }, []);

  useEffect(() => {
    if (!trunkRef.current || !branchRef.current || !leafRef.current || !rootRef.current) return;
    const dummy = new THREE.Object3D();
    const branchDummy = new THREE.Object3D();
    const leafDummy = new THREE.Object3D();
    const rootDummy = new THREE.Object3D();
    let branchIdx = 0, leafIdx = 0, rootIdx = 0;

    treeTransforms.forEach((tree, i) => {
      // Tronco
      dummy.position.set(tree.x, tree.y, tree.z);
      dummy.scale.setScalar(tree.scale);
      dummy.rotation.y = tree.rot;
      dummy.updateMatrix();
      trunkRef.current!.setMatrixAt(i, dummy.matrix);

      // Raízes
      for (let r = 0; r < ROOTS_PER_TREE; r++) {
        const rootAngle = (r / ROOTS_PER_TREE) * Math.PI * 2 + tree.gnarl;
        rootDummy.position.set(tree.x, tree.y + 0.5, tree.z);
        rootDummy.scale.set(tree.scale * 0.9, tree.scale * 0.5, tree.scale * 0.9);
        rootDummy.rotation.set(0, rootAngle, 0);
        rootDummy.updateMatrix();
        rootRef.current!.setMatrixAt(rootIdx++, rootDummy.matrix);
      }

      // Galhos e Folhas
      for (let b = 0; b < BRANCHES_PER_TREE; b++) {
        const hPercent = b / BRANCHES_PER_TREE;
        const h = (4.0 + hPercent * 6) * tree.scale;
        const bAngle = (b * 1.618 * Math.PI * 2) + (tree.gnarl * Math.PI); 
        const tilt = 0.6 + (1.0 - hPercent) * 0.8;
        const len = (1.0 - hPercent * 0.3) * tree.scale;
        
        branchDummy.position.set(tree.x, tree.y + h, tree.z);
        branchDummy.scale.set(0.6 * tree.scale, len, 0.6 * tree.scale);
        branchDummy.rotation.set(tilt, bAngle, 0);
        branchDummy.updateMatrix();
        branchRef.current!.setMatrixAt(branchIdx++, branchDummy.matrix);
        
        if (b > 0) {
          for(let l=0; l<LEAF_CLUSTERS_PER_BRANCH; l++) {
             const clusterOffset = l / LEAF_CLUSTERS_PER_BRANCH;
             
             // Conexão
             const lR = (0.5 * len) * (0.3 + clusterOffset * 0.7); 
             
             const lx = Math.sin(bAngle) * lR;
             const lz = Math.cos(bAngle) * lR;
             const ly = h + (0.5 + clusterOffset * 1.5) * 2.0 * Math.cos(tilt);

             leafDummy.position.set(tree.x + lx, tree.y + ly, tree.z + lz);
             
             // Escala do cluster ajustada para a nova escala das folhas
             const leafScale = (1.0 + Math.random() * 0.6) * tree.scale * (1.0 - clusterOffset * 0.1);
             leafDummy.scale.setScalar(leafScale);
             
             leafDummy.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
             leafDummy.updateMatrix();
             leafRef.current!.setMatrixAt(leafIdx++, leafDummy.matrix);
          }
        }
      }
    });

    trunkRef.current.instanceMatrix.needsUpdate = true;
    branchRef.current.instanceMatrix.needsUpdate = true;
    leafRef.current.instanceMatrix.needsUpdate = true;
    rootRef.current.instanceMatrix.needsUpdate = true;
  }, [treeTransforms]);

  useFrame((state) => {
      if (leafMat.userData.shader) {
          leafMat.userData.shader.uniforms.uTime.value = state.clock.elapsedTime;
      }
  });

  const totalBranches = TREE_COUNT * BRANCHES_PER_TREE;
  const totalLeaves = totalBranches * LEAF_CLUSTERS_PER_BRANCH; 

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[trunkGeo, trunkMat, TREE_COUNT]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={rootRef} args={[rootGeo, trunkMat, TREE_COUNT * ROOTS_PER_TREE]} receiveShadow frustumCulled={false} />
      <instancedMesh ref={branchRef} args={[branchGeo, trunkMat, totalBranches]} castShadow frustumCulled={false} />
      <instancedMesh ref={leafRef} args={[leafGeo, leafMat, totalLeaves]} castShadow receiveShadow frustumCulled={false} />
    </group>
  );
}
