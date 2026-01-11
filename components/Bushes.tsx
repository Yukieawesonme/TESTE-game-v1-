
import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getTerrainHeight, SeededRandom } from './WorldUtils';

// OTIMIZAÇÃO: Reduzido de 6000 para 1500
const BUSH_COUNT = 1500; 
const WORLD_RADIUS = 1000;
const WORLD_SEED = 987654321;
const TREE_COUNT = 450; 

// OTIMIZAÇÃO: Reduzido de 120 para 60 folhas por arbusto
const LEAVES_PER_BUSH = 60; 
const BUSH_RADIUS = 1.4;

export default function Bushes() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const { geometry, material } = useMemo(() => {
    // --- GEOMETRIA DA FOLHA 3D ---
    const singleLeafGeo = new THREE.BufferGeometry();
    const w = 0.35; 
    const h = 0.8;  
    const d = 0.1;  

    const vertices = new Float32Array([
        0.0, 0.0, 0.0,       
        w, h * 0.4, d,       
        0.0, h * 0.45, -0.05,
       -w, h * 0.4, d,       
        0.0, h, 0.05         
    ]);
    
    const indices = [
        0, 1, 2, 
        0, 2, 3, 
        2, 1, 4, 
        2, 4, 3  
    ];
    
    singleLeafGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    singleLeafGeo.setIndex(indices);
    singleLeafGeo.computeVertexNormals();

    // Paleta de cores
    const colorDeep = new THREE.Color("#0a1f0a");
    const colorBase = new THREE.Color("#1f4d15");
    const colorTip = new THREE.Color("#6ba832");
    
    const tempColor = new THREE.Color();
    const tempPos = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();

    const combinedGeo = new THREE.BufferGeometry();
    const allPositions: number[] = [];
    const allNormals: number[] = [];
    const allColors: number[] = [];
    const allIndices: number[] = [];
    const allUvs: number[] = []; 
    
    let indexOffset = 0;

    for (let i = 0; i < LEAVES_PER_BUSH; i++) {
        const u = Math.random();
        const v = Math.random();
        const phi = Math.acos(2 * u - 1); 
        const theta = 2 * Math.PI * v;
        const r = BUSH_RADIUS * Math.pow(Math.random(), 0.3); 
        
        let py = r * Math.cos(phi);
        if (py < -0.3) py = -0.3 + Math.random() * 0.2; 
        
        position.set(
            r * Math.sin(phi) * Math.cos(theta),
            py + 0.5, 
            r * Math.sin(phi) * Math.sin(theta)
        );

        const lookAtPos = position.clone().add(position.clone().normalize().multiplyScalar(2));
        matrix.lookAt(position, lookAtPos, new THREE.Vector3(0, 1, 0));
        quaternion.setFromRotationMatrix(matrix);
        
        const randomRot = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(
                (Math.random() - 0.5) * 1.0, 
                (Math.random() - 0.5) * 1.0, 
                (Math.random() - 0.5) * 3.0
            )
        );
        quaternion.multiply(randomRot);
        
        const s = 0.5 + Math.random() * 0.8;
        scale.set(s, s, s);

        matrix.compose(position, quaternion, scale);

        const posAttr = singleLeafGeo.attributes.position;
        const normalAttr = singleLeafGeo.attributes.normal;
        const indexAttr = singleLeafGeo.index;

        const distFromCenter = position.length() / BUSH_RADIUS;
        const heightFactor = (position.y + 0.5) / (BUSH_RADIUS * 1.5);
        
        tempColor.lerpColors(colorDeep, colorBase, Math.pow(distFromCenter, 0.5));
        tempColor.lerp(colorTip, Math.pow(heightFactor, 1.5) * 0.9);
        tempColor.offsetHSL(0.01 * (Math.random() - 0.5), 0, 0.02 * (Math.random() - 0.5));

        for (let j = 0; j < posAttr.count; j++) {
            tempPos.fromBufferAttribute(posAttr, j);
            const uvX = (tempPos.x / w) * 0.5 + 0.5;
            const uvY = tempPos.y / h;
            allUvs.push(uvX, uvY);

            tempPos.applyMatrix4(matrix);
            allPositions.push(tempPos.x, tempPos.y, tempPos.z);
            
            const sphereNormal = tempPos.clone().normalize();
            const geoNormal = new THREE.Vector3().fromBufferAttribute(normalAttr, j).applyQuaternion(quaternion);
            const blendedNormal = new THREE.Vector3().addVectors(sphereNormal.multiplyScalar(0.5), geoNormal.multiplyScalar(0.5)).normalize();
            
            allNormals.push(blendedNormal.x, blendedNormal.y, blendedNormal.z);
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
    combinedGeo.setAttribute('uv', new THREE.Float32BufferAttribute(allUvs, 2));
    combinedGeo.setIndex(allIndices);
    
    // Set bounding sphere to World Radius for proper culling behaviour with InstancedMesh
    combinedGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), WORLD_RADIUS * 1.1);

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6, 
      metalness: 0.0,
      side: THREE.DoubleSide, 
      flatShading: false,    
      defines: { 'USE_UV': '' }
    });

    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.vertexShader = `
          uniform float uTime;
          #ifndef USE_UV
          varying vec2 vUv;
          attribute vec2 uv;
          #endif
          varying float vWindIntensity;
          ${shader.vertexShader}
        `.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          #ifndef USE_UV
          vUv = uv;
          #endif
          float time = uTime * 1.2;
          float globalWind = sin(time + transformed.x * 0.3 + transformed.z * 0.3);
          float localTurbulence = sin(time * 3.0 + transformed.y * 4.0) * 0.2;
          float heightMask = smoothstep(0.0, 1.5, transformed.y);
          vec3 windOffset = vec3(
            (globalWind * 0.15 + localTurbulence * 0.05) * heightMask,
            sin(time * 2.0 + transformed.x) * 0.05 * heightMask,
            (globalWind * 0.05 + localTurbulence * 0.05) * heightMask
          );
          transformed += windOffset;
          vWindIntensity = heightMask * 0.5;
          `
        );
        shader.fragmentShader = `
          float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
          }
          varying float vWindIntensity;
          #ifndef USE_UV
          varying vec2 vUv;
          #endif
          ${shader.fragmentShader}
        `.replace(
          '#include <map_fragment>',
          `
          #include <map_fragment>
          float vein = smoothstep(0.05, 0.0, abs(vUv.x - 0.5));
          float ribs = smoothstep(0.4, 0.6, sin(vUv.y * 30.0 + abs(vUv.x - 0.5) * 10.0));
          float surfaceNoise = noise(vUv * 15.0);
          vec3 texColor = diffuseColor.rgb;
          texColor = mix(texColor, texColor * 0.7, vein * 0.5);
          texColor = mix(texColor, texColor * 0.9, ribs * 0.15);
          texColor *= (0.9 + 0.2 * surfaceNoise);
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = 1.0 - dot(vNormal, viewDir);
          fresnel = pow(clamp(fresnel, 0.0, 1.0), 3.0);
          vec3 rimColor = vec3(0.6, 0.8, 0.4); 
          texColor += rimColor * fresnel * 0.3;
          diffuseColor.rgb = texColor;
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
      if (i < BUSH_COUNT * 0.7) {
        const treeIdx = Math.floor(prng.next() * TREE_COUNT);
        const treePos = treePositions[treeIdx];
        const offsetAngle = prng.next() * Math.PI * 2;
        const offsetDist = 2.0 + prng.next() * 6; 
        x = treePos.x + Math.cos(offsetAngle) * offsetDist;
        z = treePos.z + Math.sin(offsetAngle) * offsetDist;
      } else {
        const r = Math.sqrt(prng.next()) * (WORLD_RADIUS - 20);
        const theta = prng.next() * 2 * Math.PI;
        x = r * Math.cos(theta);
        z = r * Math.sin(theta);
      }
      
      const terrainH = getTerrainHeight(x, z);
      const scaleBase = 0.9 + prng.next() * 1.3;
      
      dummy.position.set(x, terrainH - 0.2, z);
      
      dummy.scale.set(
          scaleBase * (0.9 + prng.next() * 0.2), 
          scaleBase * (0.8 + prng.next() * 0.4), 
          scaleBase * (0.9 + prng.next() * 0.2)
      );
      dummy.rotation.set(prng.next() * 0.2, prng.next() * Math.PI * 2, prng.next() * 0.2);
      
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
    <instancedMesh ref={meshRef} args={[geometry, material, BUSH_COUNT]} castShadow receiveShadow />
  );
}
