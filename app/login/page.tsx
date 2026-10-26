import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { getOwnerSession } from "@/lib/auth";

export const metadata = { title: "Owner Login — InkTelligence" };

export default async function LoginPage() {
  if (await getOwnerSession()) redirect("/studio");
  return (
    <main className="login-page">
      <Link className="login-back" href="/">← Back to InkTelligence</Link>
      <section className="login-panel">
        <div className="login-mark" aria-hidden="true">I</div>
        <span className="eyebrow">Private atelier</span>
        <h1>Welcome back,<br /><em>Inkseer.</em></h1>
        <p>The consultation studio, historical archive, and living style compendium are reserved for the owner while the public platform is being prepared.</p>
        <LoginForm />
      </section>
    </main>
  );
}
