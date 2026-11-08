import React from 'react';
import { Crop, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n';

// Crops a photo to a square around the scar, in the browser, before anything is uploaded. Drag the frame to move
// it; the slider sets its size. The output is a fresh JPEG drawn on a canvas, so no EXIF or GPS data survives.

const OUT_PX = 1024;

export default function PhotoCropper({ file, onCropped, onCancel, busy }: { file: File; onCropped: (blob: Blob) => void; onCancel: () => void; busy: boolean }) {
  const t = useI18n().t;
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const [url, setUrl] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState({ x: 0, y: 0, size: 0 });
  const boxRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  React.useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    const i = new Image();
    i.onload = () => {
      setImg(i);
      const size = Math.round(Math.min(i.naturalWidth, i.naturalHeight) * 0.6);
      setCrop({ x: Math.round((i.naturalWidth - size) / 2), y: Math.round((i.naturalHeight - size) / 2), size });
    };
    i.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  if (!img || !url) return <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {t('Loading…')}</p>;

  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const minSize = Math.round(Math.min(W, H) * 0.15);
  const maxSize = Math.min(W, H);
  const clamp = (c: { x: number; y: number; size: number }) => ({
    size: c.size,
    x: Math.min(Math.max(0, c.x), W - c.size),
    y: Math.min(Math.max(0, c.y), H - c.size),
  });
  const scale = () => (boxRef.current ? boxRef.current.clientWidth / W : 1);

  const done = () => {
    const canvas = document.createElement('canvas');
    const out = Math.min(OUT_PX, crop.size);
    canvas.width = out;
    canvas.height = out;
    canvas.getContext('2d')!.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, out, out);
    canvas.toBlob((b) => b && onCropped(b), 'image/jpeg', 0.9);
  };

  return (
    <div className="space-y-3">
      <div className="mx-auto max-w-full" style={{ width: `min(100%, calc((100dvh - 22rem) * ${W / H}))` }}>
        <div
          ref={boxRef}
          className="relative w-full select-none touch-none overflow-hidden rounded-xl bg-black"
          style={{ aspectRatio: `${W} / ${H}` }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const s = scale();
            setCrop((c) => clamp({ ...c, x: d.x + (e.clientX - d.px) / s, y: d.y + (e.clientY - d.py) / s }));
          }}
          onPointerUp={() => (drag.current = null)}
        >
          <img src={url} alt={t('Your photo')} className="absolute inset-0 w-full h-full object-contain pointer-events-none" draggable={false} />
          <div
            className="absolute border-2 border-rose-300 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] cursor-move"
            style={{ left: `${(crop.x / W) * 100}%`, top: `${(crop.y / H) * 100}%`, width: `${(crop.size / W) * 100}%`, height: `${(crop.size / H) * 100}%` }}
          />
        </div>
      </div>
      <label className="flex items-center gap-3 text-sm text-slate-300">
        <span className="shrink-0">{t('Frame size')}</span>
        <input
          type="range"
          min={minSize}
          max={maxSize}
          value={crop.size}
          onChange={(e) => {
            const size = Number(e.target.value);
            setCrop((c) => clamp({ x: c.x + (c.size - size) / 2, y: c.y + (c.size - size) / 2, size }));
          }}
          className="flex-1 h-12 accent-rose-400"
        />
      </label>
      <p className="text-xs text-slate-400">{t('Drag the frame so that it holds only the scar and a little skin around it — no face, no tattoo of anyone else, nothing intimate.')}</p>
      <div className="flex gap-2">
        <button type="button" onClick={done} disabled={busy} className="h-12 px-5 rounded-xl bg-rose-400 text-black font-semibold text-sm flex items-center gap-2 disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Crop size={16} />} {t('Crop and upload')}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="h-12 px-4 rounded-xl border border-white/10 text-slate-300 text-sm">{t('Cancel')}</button>
      </div>
    </div>
  );
}
