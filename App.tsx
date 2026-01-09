
import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, PerspectiveCamera } from '@react-three/drei';

import Scene from './components/Scene';
import UIOverlay from './components/UIOverlay';
import EnvironmentController from './components/EnvironmentController';
import MobileControls from './components/MobileControls';

const App: React.FC = () => {
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isInverted, setIsInverted] = useState(false);

  return (
    <div className="w-full h-screen relative bg-[#0a150a] overflow-hidden touch-none">
      {!isGameStarted ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95">
          <div className="text-center p-10 bg-zinc-900 rounded-[3.5rem] border border-green-500/30 max-w-xs shadow-2xl">
            <div className="w-20 h-20 bg-green-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-[0_0_50px_rgba(22,163,74,0.4)]">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
            </div>
            <h1 className="text-5xl font-black text-white italic mb-2 tracking-tighter">VERDE</h1>
            <p className="text-zinc-500 text-[10px] mb-10 uppercase tracking-[0.3em] font-bold">Nature Engine 3D</p>
            <button 
              onClick={() => setIsGameStarted(true)}
              className="w-full bg-green-600 py-5 rounded-2xl text-white font-black text-xl shadow-xl active:scale-95 transition-all"
            >
              INICIAR EXPLORAÇÃO
            </button>
          </div>
        </div>
      ) : (
        <>
          <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: "high-performance" }}>
            <Suspense fallback={null}>
              <PerspectiveCamera makeDefault fov={55} far={1500} />
              <EnvironmentController />
              <Scene isPaused={isPaused} />
              <Environment preset="forest" />
            </Suspense>
          </Canvas>
          <MobileControls inverted={isInverted} />
          <UIOverlay 
            isPaused={isPaused} 
            togglePause={() => setIsPaused(!isPaused)} 
            isInverted={isInverted} 
            toggleInvert={() => setIsInverted(!isInverted)}
          />
        </>
      )}
    </div>
  );
};

export default App;
