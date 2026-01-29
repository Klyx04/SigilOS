import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
import { GalacticHeader } from "@/components/layout/galactic-header"; // Not used on landing, but good for reference
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { HeroSection } from "@/components/landing/hero-section";
import { BentoGrid } from "@/components/landing/bento-grid";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const params = await searchParams;

  // Handle Auth Errors (redirect to custom error page)
  if (params.error) {
    redirect(`/auth/error?error=${params.error}`);
  }

  // If logged in, redirect to dashboard (or keep landing page accessible?)
  // For now, let's auto-redirect for convenience, but the "Elite" flow might want to show the landing first?
  // Let's stick to standard SaaS behavior: Login -> Dashboard.
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <NebulaClientWrapper>
      <div className="min-h-screen bg-[#020202] text-white selection:bg-indigo-500/30 font-sans flex flex-col">

        <header className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-center bg-transparent pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="relative w-8 h-8">
              <img src="/assets/ui/logo_sigilos_v2.png" alt="SigilOS" className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
            </div>
            <div className="text-xl font-black tracking-widest text-white font-heading mix-blend-difference">
              SIGIL<span className="text-purple-400">OS</span>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full relative z-10">
          <HeroSection />
          <BentoGrid />
        </main>

        <GalacticFooter />
      </div>
    </NebulaClientWrapper>
  );
}

