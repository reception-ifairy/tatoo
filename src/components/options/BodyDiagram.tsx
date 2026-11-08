import React from 'react';

// A neutral, sexless body outline (front and back) with the chosen placement highlighted. Drawn, so it costs
// nothing and never shows a real body. Zones match `zone` in src/tattooOptions.ts.

type Shape = { side: 'front' | 'back'; el: React.ReactNode };

const ZONES: Record<string, Shape[]> = {
  forearm: [{ side: 'front', el: <rect x="5" y="38" width="5" height="12" rx="2" /> }],
  upper_arm: [{ side: 'front', el: <rect x="6" y="24" width="5" height="13" rx="2" /> }],
  shoulder: [{ side: 'front', el: <circle cx="10" cy="22" r="4" /> }],
  arm: [{ side: 'front', el: <rect x="5" y="20" width="6" height="31" rx="2.5" /> }],
  wrist: [{ side: 'front', el: <rect x="4.5" y="49" width="5" height="3" rx="1" /> }],
  hand: [{ side: 'front', el: <ellipse cx="7" cy="56" rx="3" ry="4" /> }],
  collarbone: [{ side: 'front', el: <rect x="13" y="18" width="14" height="3" rx="1.5" /> }],
  ribs: [{ side: 'front', el: <rect x="13" y="28" width="4" height="12" rx="2" /> }],
  thigh: [{ side: 'front', el: <rect x="13" y="56" width="5" height="16" rx="2.5" /> }],
  shin: [{ side: 'front', el: <rect x="13.5" y="76" width="4" height="14" rx="2" /> }],
  ankle: [{ side: 'front', el: <circle cx="15.5" cy="92" r="2.2" /> }],
  neck: [{ side: 'front', el: <rect x="17.5" y="12" width="5" height="5" rx="1.5" /> }],
  ear: [{ side: 'front', el: <circle cx="24" cy="8" r="1.8" /> }],
  shoulder_blade: [{ side: 'back', el: <ellipse cx="16" cy="27" rx="4" ry="5" /> }],
  upper_back: [{ side: 'back', el: <rect x="12" y="19" width="16" height="10" rx="3" /> }],
  spine: [{ side: 'back', el: <rect x="18.5" y="18" width="3" height="30" rx="1.5" /> }],
  back: [{ side: 'back', el: <rect x="12" y="19" width="16" height="30" rx="4" /> }],
  calf: [{ side: 'back', el: <rect x="13.5" y="75" width="4.5" height="13" rx="2" /> }],
};

function Figure() {
  return (
    <g fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1" strokeLinejoin="round">
      <circle cx="20" cy="7" r="5" />
      <path d="M17.5 12v5h5v-5" />
      <path d="M11 19c3-2 15-2 18 0l1.5 4v28l-2 7h-3V40h-11v18h-3l-2-7V23z" />
      <path d="M11 20l-5 4-2 26 3 1 3-24M29 20l5 4 2 26-3 1-3-24" />
      <path d="M13 54l-0.5 40h5l1.5-38M27 54l0.5 40h-5L21 56" />
    </g>
  );
}

export default function BodyDiagram({ zone }: { zone: string }) {
  const shapes = ZONES[zone] ?? [];
  const side = (s: 'front' | 'back', dx: number) => (
    <g transform={`translate(${dx} 3)`}>
      <Figure />
      <g fill="currentColor" fillOpacity=".85">
        {shapes.filter((x) => x.side === s).map((x, i) => (
          <React.Fragment key={i}>{x.el}</React.Fragment>
        ))}
      </g>
    </g>
  );
  return (
    <svg aria-hidden="true" viewBox="0 0 88 100" className="w-full h-full">
      {side('front', 2)}
      {side('back', 46)}
    </svg>
  );
}
