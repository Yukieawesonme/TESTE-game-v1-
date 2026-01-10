
import React from 'react';
import { EffectComposer, Bloom, Vignette, Noise, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

import Trees from './Trees';
import Bushes from './Bushes';
import Character from './Character';
import Ground from './Ground';
import GroundDebris from './GroundDebris';
import Clouds from './Clouds';
import Birds from './Birds';
import DustParticles from './DustParticles';

const Scene: React.FC<{ isPaused?: boolean }> = ({ isPaused = false }) => {
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

      {/* Pós-processamento para qualidade visual AAA */}
      <EffectComposer disableNormalPass>
        {/* Bloom dá o brilho suave nas áreas iluminadas (sol, reflexos) */}
        <Bloom 
          luminanceThreshold={0.65} // Apenas coisas muito brilhantes brilham
          luminanceSmoothing={0.9} 
          intensity={0.5} 
          mipmapBlur // Blur de alta qualidade
        />
        {/* Vignette escurece as bordas da tela para foco cinematográfico */}
        <Vignette eskil={false} offset={0.1} darkness={0.6} />
        {/* Noise adiciona textura de filme e reduz o banding de cores */}
        <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
      </EffectComposer>
    </group>
  );
};

export default Scene;
