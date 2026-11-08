import { Home, MessagesSquare, Wand2, Images, BookOpen, Library, Bandage, Users, Settings, LogOut, type LucideIcon } from 'lucide-react';
import { canConsult, hasScarService, type PublicUser } from '../account';

// The app's views (the menu). Adding a view: add its id to ViewId, an entry to SECTIONS (English label and
// subtitle — translated at render time — lucide icon, colour tone, who sees it), and a <ViewSlot> in App.tsx.

export type ViewId = 'studio' | 'consult' | 'generator' | 'projects' | 'atlas' | 'library' | 'scar' | 'clients';

// Full class names (not built dynamically) so Tailwind can see them.
export interface Tone {
  text: string;
  soft: string;
  border: string;
  solid: string;
}

export const TONES = {
  cyan: { text: 'text-cyan-400', soft: 'bg-cyan-400/15', border: 'border-cyan-400/40', solid: 'bg-cyan-400' },
  sky: { text: 'text-sky-400', soft: 'bg-sky-400/15', border: 'border-sky-400/40', solid: 'bg-sky-400' },
  amber: { text: 'text-amber-400', soft: 'bg-amber-400/15', border: 'border-amber-400/40', solid: 'bg-amber-400' },
  emerald: { text: 'text-emerald-400', soft: 'bg-emerald-400/15', border: 'border-emerald-400/40', solid: 'bg-emerald-400' },
  pink: { text: 'text-pink-400', soft: 'bg-pink-400/15', border: 'border-pink-400/40', solid: 'bg-pink-400' },
  violet: { text: 'text-violet-400', soft: 'bg-violet-400/15', border: 'border-violet-400/40', solid: 'bg-violet-400' },
  rose: { text: 'text-rose-400', soft: 'bg-rose-400/15', border: 'border-rose-400/40', solid: 'bg-rose-400' },
  indigo: { text: 'text-indigo-400', soft: 'bg-indigo-400/15', border: 'border-indigo-400/40', solid: 'bg-indigo-400' },
  orange: { text: 'text-orange-400', soft: 'bg-orange-400/15', border: 'border-orange-400/40', solid: 'bg-orange-400' },
} satisfies Record<string, Tone>;

export interface SectionDef {
  id: ViewId;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  tone: Tone;
  visible: (user: PublicUser) => boolean;
}

const everyone = () => true;

export const SECTIONS: SectionDef[] = [
  { id: 'studio', label: 'Studio', subtitle: 'Your package, your designs and where to start', icon: Home, tone: TONES.orange, visible: everyone },
  { id: 'consult', label: 'Consultation', subtitle: 'Talk your idea through with Ötzi, from feeling to design', icon: MessagesSquare, tone: TONES.amber, visible: canConsult },
  { id: 'generator', label: 'Generator', subtitle: 'Choose the options, then make a stencil, a colour design or a mannequin preview', icon: Wand2, tone: TONES.pink, visible: everyone },
  { id: 'projects', label: 'My designs', subtitle: 'Every design with its pictures and studio brief', icon: Images, tone: TONES.violet, visible: everyone },
  { id: 'atlas', label: 'Style atlas', subtitle: 'Styles, techniques and fusions from the compendium', icon: BookOpen, tone: TONES.sky, visible: everyone },
  { id: 'library', label: 'History & library', subtitle: 'Marks through time and the research library', icon: Library, tone: TONES.emerald, visible: everyone },
  { id: 'scar', label: 'Scar cover-up', subtitle: 'Private and anonymous: a cover-up designed over a cropped photo of the scar', icon: Bandage, tone: TONES.rose, visible: hasScarService },
  { id: 'clients', label: 'Clients & packages', subtitle: 'Client accounts, packages and everyone’s designs', icon: Users, tone: TONES.cyan, visible: (u) => u.role === 'admin' },
];

export const VIEW_IDS = SECTIONS.map((s) => s.id);

export function sectionsFor(user: PublicUser): SectionDef[] {
  return SECTIONS.filter((s) => s.visible(user));
}

export const SETTINGS_ITEM = { label: 'Settings', icon: Settings as LucideIcon, tone: TONES.violet };
export const LOGOUT_ITEM = { label: 'Sign out', icon: LogOut as LucideIcon, tone: TONES.rose };

export function getSection(id: ViewId): SectionDef {
  return SECTIONS.find((s) => s.id === id)!;
}
