import React from 'react';
import { Download, ImageIcon } from 'lucide-react';
import type { DesignImage } from '../../design';
import { useI18n } from '../../i18n';
import { imageUrl } from '../../lib/appApi';
import { formatUsd } from '../../imageModels';
import { TONES } from '../../lib/sections';
import Sheet from '../ui/Sheet';
import { KIND_INFO } from './PackageCard';

/** Checkerboard behind stencils, so the transparent background is visible. */
export const CHECKER = {
  backgroundColor: '#f4f4f5',
  backgroundImage: 'linear-gradient(45deg,#d4d4d8 25%,transparent 25%),linear-gradient(-45deg,#d4d4d8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d4d4d8 75%),linear-gradient(-45deg,transparent 75%,#d4d4d8 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
} as React.CSSProperties;

export function DesignThumb({ projectId, image, className }: { projectId: string; image: DesignImage; className?: string }) {
  return (
    <span className={className} style={image.kind === 'stencil' ? CHECKER : { backgroundColor: '#0b0b0d' }}>
      <img src={imageUrl(projectId, image.id)} alt="" loading="lazy" draggable={false} className="w-full h-full object-contain" />
    </span>
  );
}

/** A picture at full size, with its details and a PNG download. */
export default function ImageSheet({ projectId, image, onClose }: { projectId: string; image: DesignImage | null; onClose: () => void }) {
  const { t, locale } = useI18n();
  return (
    <Sheet open={Boolean(image)} onClose={onClose} title={image ? t(KIND_INFO[image.kind].label) : ''} icon={ImageIcon} tone={TONES.pink} widthClass="max-w-3xl">
      {image && (
        <div className="space-y-3">
          <DesignThumb projectId={projectId} image={image} className="block w-full h-[min(60vh,36rem)] rounded-xl overflow-hidden" />
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
            <span>{image.model}</span>
            <span>· {new Date(image.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</span>
            {typeof image.costUsd === 'number' && <span>· {formatUsd(image.costUsd)}</span>}
            {image.fromPhoto && <span className="text-rose-300">· {t('made from the scar photo — deleted when the project is completed')}</span>}
          </div>
          <a href={imageUrl(projectId, image.id, true)} download className="inline-flex h-12 px-5 rounded-xl bg-orange-400 text-black font-semibold text-sm items-center gap-2">
            <Download size={18} /> {t('Download PNG')}
          </a>
          {image.prompt && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer h-10 flex items-center">{t('Prompt (admin only)')}</summary>
              <p className="font-mono leading-relaxed select-text">{image.prompt}</p>
            </details>
          )}
        </div>
      )}
    </Sheet>
  );
}
