import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Preview } from '@/game/preview';
import { Look } from '@/game/runner';
import { QualityLevel } from '@/game/env';

export interface PreviewHandle { emote: () => void; }

const PreviewCanvas = forwardRef<PreviewHandle, { look: Look; mode: 'menu' | 'locker'; quality: QualityLevel; className?: string }>(
  function PreviewCanvas({ look, mode, quality, className = '' }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const prev = useRef<Preview | null>(null);
    const drag = useRef<{ x: number; yaw: number } | null>(null);
    const lookKey = JSON.stringify(look);

    useEffect(() => {
      if (!canvas.current) return;
      let p: Preview | null = null;
      try { p = new Preview(canvas.current, look, mode, quality); prev.current = p; } catch (e) { console.error('3D preview failed', e); }
      return () => { p?.dispose(); prev.current = null; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, quality]);

    useEffect(() => { prev.current?.setLook(look); // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lookKey]);

    useImperativeHandle(ref, () => ({ emote: () => prev.current?.playEmote() }));

    return (
      <div
        className={`relative ${className}`}
        onPointerDown={(e) => { if (mode !== 'locker' || !prev.current) return; drag.current = { x: e.clientX, yaw: prev.current.dragYaw }; prev.current.orbit = false; }}
        onPointerMove={(e) => { if (!drag.current || !prev.current) return; prev.current.dragYaw = drag.current.yaw + (e.clientX - drag.current.x) * 0.012; }}
        onPointerUp={() => { drag.current = null; if (prev.current) window.setTimeout(() => { if (prev.current && !drag.current) prev.current.orbit = true; }, 2500); }}
        onPointerLeave={() => { drag.current = null; }}
        style={{ touchAction: mode === 'locker' ? 'pan-y' : 'auto' }}
      >
        <canvas ref={canvas} className="absolute inset-0 w-full h-full block" aria-label="3D runner preview" />
      </div>
    );
  }
);
export default PreviewCanvas;
