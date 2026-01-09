
import React, { useState, useRef } from 'react';
import { inputState } from './InputState';

interface MobileControlsProps {
  inverted?: boolean;
}

const MobileControls: React.FC<MobileControlsProps> = ({ inverted = false }) => {
  // Estados locais para visual dos sticks
  const [moveStickPos, setMoveStickPos] = useState({ x: 0, y: 0 });
  const [lookStickPos, setLookStickPos] = useState({ x: 0, y: 0 });

  // Refs para rastrear IDs de ponteiros ativos (dedos específicos)
  const movePointerId = useRef<number | null>(null);
  const lookPointerId = useRef<number | null>(null);

  const moveBaseRef = useRef<HTMLDivElement>(null);
  const lookBaseRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent, type: 'move' | 'look') => {
    const target = e.currentTarget as HTMLDivElement;
    target.setPointerCapture(e.pointerId);
    
    if (type === 'move') {
      movePointerId.current = e.pointerId;
    } else {
      lookPointerId.current = e.pointerId;
    }
    
    updateJoystick(e, type);
  };

  const handlePointerMove = (e: React.PointerEvent, type: 'move' | 'look') => {
    if (type === 'move' && movePointerId.current === e.pointerId) {
      updateJoystick(e, type);
    } else if (type === 'look' && lookPointerId.current === e.pointerId) {
      updateJoystick(e, type);
    }
  };

  const handlePointerUp = (e: React.PointerEvent, type: 'move' | 'look') => {
    if (type === 'move') {
      movePointerId.current = null;
      setMoveStickPos({ x: 0, y: 0 });
      inputState.joystick = { x: 0, y: 0 };
    } else {
      lookPointerId.current = null;
      setLookStickPos({ x: 0, y: 0 });
      inputState.cameraJoystick = { x: 0, y: 0 };
    }
  };

  const updateJoystick = (e: React.PointerEvent, type: 'move' | 'look') => {
    const baseRef = type === 'move' ? moveBaseRef : lookBaseRef;
    if (!baseRef.current) return;

    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = rect.width / 2;

    const limitedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(dy, dx);
    
    const nx = Math.cos(angle) * (limitedDistance / maxDistance);
    const ny = Math.sin(angle) * (limitedDistance / maxDistance);

    const visualLimit = 35;
    if (type === 'move') {
      setMoveStickPos({ x: nx * visualLimit, y: ny * visualLimit });
      inputState.joystick = { x: nx, y: ny };
    } else {
      setLookStickPos({ x: nx * visualLimit, y: ny * visualLimit });
      inputState.cameraJoystick = { x: nx, y: ny };
    }
  };

  const leftStickClass = inverted ? "right-[30%]" : "left-8";
  const rightStickClass = inverted ? "left-8" : "right-8";
  const buttonsClass = inverted ? "left-8 items-start bottom-48" : "right-8 items-end bottom-48";

  return (
    <div className="fixed inset-0 pointer-events-none z-40 select-none touch-none">
      {/* Joystick de Movimentação */}
      <div 
        className={`absolute bottom-8 ${leftStickClass} w-40 h-40 flex items-center justify-center pointer-events-auto`}
        onPointerDown={(e) => handlePointerDown(e, 'move')}
        onPointerMove={(e) => handlePointerMove(e, 'move')}
        onPointerUp={(e) => handlePointerUp(e, 'move')}
        onPointerCancel={(e) => handlePointerUp(e, 'move')}
      >
        <div ref={moveBaseRef} className="w-28 h-28 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center">
          <div 
            className="w-14 h-14 bg-green-500/60 rounded-full border border-green-400/80 shadow-lg pointer-events-none"
            style={{ 
              transform: `translate(${moveStickPos.x}px, ${moveStickPos.y}px)`,
              transition: movePointerId.current === null ? 'transform 0.15s ease-out' : 'none'
            }}
          />
        </div>
      </div>

      {/* Joystick de Câmera (Direita) */}
      <div 
        className={`absolute bottom-8 ${rightStickClass} w-40 h-40 flex items-center justify-center pointer-events-auto`}
        onPointerDown={(e) => handlePointerDown(e, 'look')}
        onPointerMove={(e) => handlePointerMove(e, 'look')}
        onPointerUp={(e) => handlePointerUp(e, 'look')}
        onPointerCancel={(e) => handlePointerUp(e, 'look')}
      >
        <div ref={lookBaseRef} className="w-28 h-28 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center">
          <div 
            className="w-14 h-14 bg-blue-500/60 rounded-full border border-blue-400/80 shadow-lg pointer-events-none"
            style={{ 
              transform: `translate(${lookStickPos.x}px, ${lookStickPos.y}px)`,
              transition: lookPointerId.current === null ? 'transform 0.15s ease-out' : 'none'
            }}
          />
        </div>
      </div>

      {/* Botões de Ação */}
      <div className={`absolute ${buttonsClass} flex flex-col gap-6 pointer-events-auto`}>
        <button
          className="w-16 h-16 bg-green-500/30 active:bg-green-500/60 backdrop-blur-xl rounded-full border border-white/30 shadow-2xl flex items-center justify-center text-white font-black text-xs transition-transform active:scale-90"
          onPointerDown={() => { inputState.jump = true; }}
          onPointerUp={() => { inputState.jump = false; }}
          onPointerLeave={() => { inputState.jump = false; }}
        >
          PULAR
        </button>
        <button
          className="w-16 h-16 bg-orange-500/30 active:bg-orange-500/60 backdrop-blur-xl rounded-full border border-white/30 shadow-2xl flex items-center justify-center text-white font-black text-[10px] transition-transform active:scale-90"
          onPointerDown={() => { inputState.sprint = true; }}
          onPointerUp={() => { inputState.sprint = false; }}
          onPointerLeave={() => { inputState.sprint = false; }}
        >
          CORRER
        </button>
      </div>
    </div>
  );
};

export default MobileControls;
