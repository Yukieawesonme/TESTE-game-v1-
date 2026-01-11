
import React from 'react';
import { EffectComposer, Bloom, Vignette, Noise, SMAA } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

import Trees from './Trees';
import Bushes from './Bushes';
import Character from './Character';
import Ground from './Ground';
import GroundDebris from './GroundDebris';
import Clouds from './Clouds';
import Birds from './Birds';
import DustParticles from './DustParticles';

interface SceneProps {
  isPaused?: boolean;
  quality?: 'low' | 'high';
  enableAA?: boolean;
}

const Scene: React.FC<SceneProps> = ({ isPaused = false, quality = 'high', enableAA = true }) => {
  return (
    <group>
      <Ground />
      <GroundDebris />
      <Bushes />
      <Trees />
      <Clouds />
      <Birds />
      <DustParticles />
      <Character isPaused={isPaused} />

      {/* Gerenciamento de Shaders de Pós-Processamento */}
      {/* Só renderiza o EffectComposer se a qualidade for HIGH */}
      {quality === 'high' && (
        <EffectComposer disableNormalPass multisampling={0}>
          {/* SMAA: Subpixel Morphological Anti-Aliasing (Melhor que FXAA, mais leve que MSAA em deferred) */}
          {enableAA && <SMAA preset={2} />}

          {/* Bloom dá o brilho suave nas áreas iluminadas (sol, reflexos) */}
          <Bloom 
            luminanceThreshold={0.65} 
            luminanceSmoothing={0.9} 
            intensity={0.5} 
            mipmapBlur 
          />
          {/* Vignette escurece as bordas da tela para foco cinematográfico */}
          <Vignette eskil={false} offset={0.1} darkness={0.6} />
          {/* Noise adiciona textura de filme e reduz o banding de cores */}
          <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
        </EffectComposer>
      )}
    </group>
  );
};

export default Scene;
