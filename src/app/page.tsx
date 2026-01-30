import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
import { GalacticHeader } from "@/components/layout/galactic-header"; // Not used on landing, but good for reference
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { HeroSection } from "@/components/landing/hero-section";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getPublicGuilds } from "@/server/actions/presentation-actions";
import { GuildDirectorySection } from "@/components/landing/guild-directory-section";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const info = await searchParams;
  const guilds = await getPublicGuilds();

  // Handle Auth Errors (redirect to custom error page)
  if (info.error) {
    redirect(`/auth/error?error=${info.error}`);
  }



  return (
    <NebulaClientWrapper>
      <div className="min-h-screen bg-[#020202] text-white selection:bg-indigo-500/30 font-sans flex flex-col">

        <header className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-center bg-transparent pointer-events-auto">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative w-8 h-8">
                <img src="/assets/ui/logo_sigilos_v2.png" alt="SigilOS" className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
              </div>
              <div className="text-xl font-black tracking-widest text-white font-heading mix-blend-difference">
                SIGIL<span className="text-purple-400">OS</span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/guilds"
                className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 hover:text-white transition-colors flex items-center gap-2 group"
              >
                <div className="w-1 h-1 rounded-full bg-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                Annuaire
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 w-full relative z-10">
          <HeroSection />
          <FeatureShowcase />
          <GuildDirectorySection guilds={guilds} />
        </main>

        <GalacticFooter />
      </div>
    </NebulaClientWrapper >
  );
}

