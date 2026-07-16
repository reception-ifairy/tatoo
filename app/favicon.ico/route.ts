const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#10100f"/>
  <circle cx="32" cy="32" r="22" fill="none" stroke="#c9815c" stroke-width="3"/>
  <path d="M22 40c8-1 16-8 18-18 5 8 0 20-12 23 3-6 6-10 12-16" fill="none" stroke="#e2a17d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export function GET() {
  return new Response(iconSvg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
