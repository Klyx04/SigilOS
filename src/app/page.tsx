import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
// import { GalacticHeader } from "@/components/layout/galactic-header"; // Not used on landing, but good for reference
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { SaasHero } from "@/components/landing/saas-hero";
import { SaasFeatures } from "@/components/landing/saas-features";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getPublicGuilds } from "@/server/actions/presentation-actions";
import { GuildDirectorySection } from "@/components/landing/guild-directory-section";
import { LandingHeader } from "@/components/landing/landing-header";
import { ChangelogWidget } from "@/components/changelog/changelog-widget";

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
      <div className="min-h-screen bg-zinc-950 text-white selection:bg-purple-500/30 font-sans flex flex-col">



        <LandingHeader user={session?.user} />

        <main className="flex-1 w-full relative z-10 flex flex-col">
          <SaasHero user={session?.user} />
          <SaasFeatures />
          <div className="bg-zinc-900/30 border-t border-white/5 py-24">
            <div className="container mx-auto px-4 text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">Ils nous font confiance</h2>
              <p className="text-zinc-500">Rejoignez l'élite des guildes Dofus.</p>
            </div>
            <GuildDirectorySection guilds={guilds} />
          </div>

          {/* Changelog Widget Section */}
          <div className="bg-zinc-950/50 border-t border-white/5 py-16">
            <div className="container mx-auto px-4 max-w-4xl">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">Nouveautés</h2>
                <p className="text-zinc-500">Découvrez les dernières fonctionnalités et améliorations</p>
              </div>
              <ChangelogWidget />
            </div>
          </div>
        </main>

        <GalacticFooter />
      </div>
    </NebulaClientWrapper >
  );
}

