import { PenLine, Palette, PersonStanding, Bandage } from 'lucide-react';
import type { OutputKind } from '../../account';

/** The four output kinds as shown in packages and the generator (English; rendered through t()). */
export const KIND_INFO: Record<OutputKind, { label: string; note: string; icon: typeof PenLine }> = {
  stencil: { label: 'Line stencils (PNG)', note: 'Black linework on a transparent background, ready to print or transfer.', icon: PenLine },
  colour: { label: 'Colour designs', note: 'The finished design in its palette, as tattoo flash on paper.', icon: Palette },
  mannequin: { label: 'Mannequin previews', note: 'The design on a neutral grey mannequin, on the chosen body area.', icon: PersonStanding },
  scar: { label: 'Scar cover-up service', note: 'Private and anonymous: a cover-up drawn over a cropped photo of the scar.', icon: Bandage },
};
