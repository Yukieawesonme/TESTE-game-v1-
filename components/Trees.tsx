import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { inputState } from './InputState';

const TREE_COUNT = 150; 
const BRANCHES_PER_TREE = 3; 
const LEAF_CLUSTERS_PER_BRANCH = 2;
const ROOTS_PER_TREE = 3;

export default function Trees() {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const branchRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const rootRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

  const { trunkGeo, trunkMat, branchGeo, leafGeo, leafMat, rootGeo, treeTransforms } = useMemo(() => {
    const tGeo = new THREE.CylinderGeometry(0.35, 1.3, 8, 5);
    tGeo.translate(0, 4, 0);
    
    const bGeo = new THREE.CylinderGeometry(0.08, 0.3, 4, 4);
    bGeo.translate(0, 2, 0);
    
    const rGeo = new THREE.CylinderGeometry(0.15, 0.5, 2.5, 4);
    rGeo.rotateZ(Math.PI * 0.4);
    rGeo.translate(0.9, 0, 0);

    const tMat = new THREE.MeshStandardMaterial({
        color: "#4a3c2a",
        roughness: 0.9
    });

    const lGeo = new THREE.IcosahedronGeometry(1.5, 0); 
    const lMat = new THREE.MeshStandardMaterial({
        color: "#2d6a4f",
        roughness: 0.8,
        flatShading: true
    });

    const transforms = [];
    const collisionSolids = [];
    const radiusMax = 980; 
    for (let i = 0; i < TREE_COUNT; i++) {
      const radius = 15 + Math.sqrt(Math.random()) * radiusMax;
      const angle = Math.random() * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 2.0 + Math.random() * 2.5;
      transforms.push({ x, z, scale, rot: Math.random() * Math.PI, gnarl: Math.random() });
      collisionSolids.push({ x, z, r: 1.0 * scale });
    }
    inputState.worldData.solids = collisionSolids;
    return { trunkGeo: tGeo, trunkMat: tMat, branchGeo: bGeo, leafGeo: lGeo, leafMat: lMat, rootGeo: rGeo, treeTransforms: transforms };
  }, []);

  useEffect(() => {
    if (!trunkRef.current || !branchRef.current || !leafRef.current || !rootRef.current) return;
    const dummy = new THREE.Object3D();
    const branchDummy = new THREE.Object3D();
    const leafDummy = new THREE.Object3D();
    const rootDummy = new THREE.Object3D();
    let branchIdx = 0, leafIdx = 0, rootIdx = 0;

    treeTransforms.forEach((tree, i) => {
      // Trunk
      dummy.position.set(tree.x, 0, tree.z);
      dummy.scale.setScalar(tree.scale);
      dummy.rotation.y = tree.rot;
      dummy.updateMatrix();
      trunkRef.current!.setMatrixAt(i, dummy.matrix);

      // Roots
      for (let r = 0; r < ROOTS_PER_TREE; r++) {
        const rootAngle = (r / ROOTS_PER_TREE) * Math.PI * 2 + tree.gnarl;
        rootDummy.position.set(tree.x, 0.2, tree.z);
        rootDummy.scale.set(tree.scale * 0.9, tree.scale * 0.5, tree.scale * 0.9);
        rootDummy.rotation.set(0, rootAngle, 0);
        rootDummy.updateMatrix();
        rootRef.current!.setMatrixAt(rootIdx++, rootDummy.matrix);
      }

      // Branches & Leaves
      for (let b = 0; b < BRANCHES_PER_TREE; b++) {
        const hPercent = b / BRANCHES_PER_TREE;
        const h = (3.5 + hPercent * 6) * tree.scale;
        const bAngle = (b * 1.618 * Math.PI * 2) + (tree.gnarl * Math.PI); 
        const tilt = 0.6 + (1.0 - hPercent) * 0.8;
        const len = (1.0 - hPercent * 0.3) * tree.scale;
        
        branchDummy.position.set(tree.x, h, tree.z);
        branchDummy.scale.set(0.6 * tree.scale, len, 0.6 * tree.scale);
        branchDummy.rotation.set(tilt, bAngle, 0);
        branchDummy.updateMatrix();
        branchRef.current!.setMatrixAt(branchIdx++, branchDummy.matrix);
        
        // Leaf Clusters per branch
        if (b > 0) {
          for(let l=0; l<LEAF_CLUSTERS_PER_BRANCH; l++) {
             const clusterOffset = l / LEAF_CLUSTERS_PER_BRANCH;
             const lR = (3.0 * len) * (0.5 + clusterOffset * 0.5);
             const lx = Math.sin(bAngle) * lR;
             const lz = Math.cos(bAngle) * lR;
             const ly = h + (1.0 + clusterOffset) * 2.0 * Math.cos(tilt);

             leafDummy.position.set(tree.x + lx, ly, tree.z + lz);
             leafDummy.scale.setScalar((1.8 + Math.random()) * tree.scale * (1.0 - clusterOffset * 0.3));
             leafDummy.rotation.set(Math.random(), Math.random(), Math.random());
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

  const totalBranches = TREE_COUNT * BRANCHES_PER_TREE;
  const totalLeaves = totalBranches * LEAF_CLUSTERS_PER_BRANCH; 

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[trunkGeo, trunkMat, TREE_COUNT]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={rootRef} args={[rootGeo, trunkMat, TREE_COUNT * ROOTS_PER_TREE]} receiveShadow frustumCulled={false} />
      <instancedMesh ref={branchRef} args={[branchGeo, trunkMat, totalBranches]} castShadow frustumCulled={false} />
      <instancedMesh ref={leafRef} args={[leafGeo, leafMat, totalLeaves]} castShadow frustumCulled={false} />
    </group>
  );
}