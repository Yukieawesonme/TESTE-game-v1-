
import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, BakeShadows, useProgress } from '@react-three/drei';
import * as THREE from 'three';

import Scene from './components/Scene';
import UIOverlay from './components/UIOverlay';
import EnvironmentController from './components/EnvironmentController';
import MobileControls from './components/MobileControls';

type GameState = 'menu' | 'loading' | 'playing';
type GraphicsQuality = 'low' | 'high';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [quality, setQuality] = useState<GraphicsQuality>('high');
  const [enableAA, setEnableAA] = useState(true); // Estado do Anti-aliasing
  const [isPaused, setIsPaused] = useState(false);
  const [isInverted, setIsInverted] = useState(false);
  
  // Estado para a barra de progresso visual
  const [visualProgress, setVisualProgress] = useState(0);

  // Hook do Drei para monitorar assets reais
  const { progress, active } = useProgress();
  
  // Lógica de Carregamento Híbrido
  useEffect(() => {
    if (gameState === 'loading') {
      const interval = setInterval(() => {
        setVisualProgress((prev) => {
          const target = active ? progress : 100;
          const diff = target - prev;
          const inc = diff > 0 ? Math.ceil(diff * 0.1) + 1 : 1; 
          const next = prev + inc;
          return next > 100 ? 100 : next;
        });
      }, 30);

      return () => clearInterval(interval);
    } else if (gameState === 'menu') {
      setVisualProgress(0);
    }
  }, [gameState, active, progress]);

  // Gatilho para iniciar o jogo quando chegar em 100%
  useEffect(() => {
    if (gameState === 'loading' && visualProgress >= 100) {
      const timer = setTimeout(() => {
        setGameState('playing');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [visualProgress, gameState]);

  const handleStart = () => {
    setGameState('loading');
  };

  return (
    <div className="w-full h-screen relative bg-[#050a0e] overflow-hidden touch-none select-none">
      
      {/* MENU INICIAL */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 transition-opacity duration-500">
          <div className="text-center p-8 bg-zinc-900 rounded-[3rem] border border-green-500/30 w-full max-w-sm shadow-2xl mx-4 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-[0_0_50px_rgba(22,163,74,0.4)]">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
            </div>
            <h1 className="text-5xl font-black text-white italic mb-2 tracking-tighter">VERDE</h1>
            <p className="text-zinc-500 text-[10px] mb-6 uppercase tracking-[0.3em] font-bold">Engine 2.3 (SMAA)</p>
            
            {/* Seletor de Qualidade */}
            <div className="bg-black/40 p-1 rounded-xl flex mb-4 border border-white/5">
              <button 
                onClick={() => setQuality('low')}
                className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all ${quality === 'low' ? 'bg-white/10 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
              >
                DESEMPENHO
              </button>
              <button 
                onClick={() => setQuality('high')}
                className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all ${quality === 'high' ? 'bg-green-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
              >
                ALTA FIDELIDADE
              </button>
            </div>

            {/* Seletor de Anti-aliasing no Menu Inicial */}
            <div className="bg-black/40 p-1 rounded-xl flex mb-8 border border-white/5">
              <button 
                onClick={() => setEnableAA(false)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${!enableAA ? 'bg-red-500/20 text-red-400 shadow-lg border border-red-500/20' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                SEM SUAVIZAÇÃO
              </button>
              <button 
                onClick={() => setEnableAA(true)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${enableAA ? 'bg-blue-500/20 text-blue-400 shadow-lg border border-blue-500/20' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                ANTI-ALIASING ON
              </button>
            </div>

            <button 
              onClick={handleStart}
              className="w-full bg-white text-black py-5 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all hover:bg-zinc-200"
            >
              INICIAR JORNADA
            </button>
          </div>
        </div>
      )}

      {/* TELA DE CARREGAMENTO */}
      {gameState === 'loading' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-700">
           <div className="w-64 mb-4">
             <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-green-500 transition-all duration-100 ease-out" 
                 style={{ width: `${visualProgress}%` }}
               />
             </div>
           </div>
           <p className="text-green-500 font-mono text-xs animate-pulse">
             GERANDO BIOMA... {Math.round(visualProgress)}%
           </p>
        </div>
      )}

      {/* MUNDO 3D */}
      {(gameState === 'loading' || gameState === 'playing') && (
        <>
          <Canvas 
            shadows={quality === 'high'}
            dpr={quality === 'high' ? [1, 1.2] : [0.8, 1]}
            gl={{ 
              // Lógica de AA: Se low quality e AA ativado, usa o nativo do browser.
              // Se high quality, desligamos o nativo para usar o SMAA do pós-processamento.
              antialias: quality === 'low' && enableAA,
              powerPreference: "high-performance",
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 0.85,
              stencil: false,
              depth: true
            }}
          >
            <Suspense fallback={null}>
              <PerspectiveCamera makeDefault fov={50} far={2000} />
              <EnvironmentController />
              <Scene isPaused={isPaused} quality={quality} enableAA={enableAA} />
              <BakeShadows />
            </Suspense>
          </Canvas>

          {/* Interface do Jogo */}
          <div className={`transition-opacity duration-1000 ${gameState === 'playing' ? 'opacity-100' : 'opacity-0'}`}>
            <MobileControls inverted={isInverted} />
            <UIOverlay 
              isPaused={isPaused} 
              togglePause={() => setIsPaused(!isPaused)} 
              isInverted={isInverted} 
              toggleInvert={() => setIsInverted(!isInverted)}
              enableAA={enableAA}
              toggleAA={() => setEnableAA(!enableAA)}
              quality={quality}
              setQuality={setQuality}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default App;
