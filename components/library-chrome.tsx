import { LockKeyhole, PenTool } from "lucide-react";
import Link from "next/link";

/** Public navigation shared by the library reading room. */
export function LibraryNav() {
  return (
    <nav className="landing-nav" aria-label="Primary navigation">
      <Link className="landing-brand" href="/" aria-label="InkTelligence home">
        <span><PenTool size={20} /></span><strong>InkTelligence</strong><small>stories written in skin</small>
      </Link>
      <div className="library-nav-links">
        <Link href="/blog">The Library</Link>
        <Link className="landing-login" href="/login"><LockKeyhole size={15} /> Login</Link>
      </div>
    </nav>
  );
}

/** Public footer shared by the library reading room. */
export function LibraryFooter() {
  return (
    <footer className="library-footer">
      <div>
        <span className="landing-brand"><span><PenTool size={18} /></span><strong>InkTelligence</strong></span>
        <p>The library is the factual basis of the compendium. Alexei shapes the editorial voice — the evidence comes from the papers.</p>
      </div>
      <small>© 2026 InkTelligence · Private alpha</small>
    </footer>
  );
}

const moduleLabels: Record<string, string> = {
  styles: "Styles",
  techniques: "Techniques",
  history: "History & Anthropology",
};

export function moduleLabel(value: string): string {
  return moduleLabels[value] || value;
}
