'use client';

import React, { useEffect, useRef } from 'react';

interface SignatureCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onDrawnChange: (drawn: boolean) => void;
}

export default function SignatureCanvas({ canvasRef, onDrawnChange }: SignatureCanvasProps) {
  const drawing = useRef(false);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  useEffect(() => {
    initCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="w-full h-40 rounded-2xl border border-gray-200 bg-white touch-none shadow-inner cursor-crosshair"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const ctx = e.currentTarget.getContext('2d');
          if (!ctx) return;
          const { x, y } = pos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 0.1, y + 0.1);
          ctx.stroke();
          onDrawnChange(true);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext('2d');
          if (!ctx) return;
          const { x, y } = pos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerCancel={() => { drawing.current = false; }}
      />
      <button
        type="button"
        onClick={() => { initCanvas(); onDrawnChange(false); }}
        className="text-xs text-gray-500 font-bold hover:text-red-500 transition-colors cursor-pointer"
      >
        נקה חתימה
      </button>
    </div>
  );
}
