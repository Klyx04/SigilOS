import { auth, signIn, signOut } from "@/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex h-screen w-full items-center justify-center bg-black text-white">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
          SigilOS
        </h1>
        <p className="text-muted-foreground">Operating System for Dofus Guilds</p>

        {session?.user ? (
          <div className="flex flex-col gap-4 items-center">
            <Link href="/dashboard">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700">
                Accéder au Dashboard ({session.user.name})
              </Button>
            </Link>
            <form action={async () => {
              "use server";
              await signOut();
            }}>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white">
                Se déconnecter
              </Button>
            </form>
          </div>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("discord", { redirectTo: "/dashboard" });
            }}
          >
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700">
              Connexion avec Discord
            </Button>
          </form>
        )}

        {/* Guild Directory Link */}
        <div className="pt-8 border-t border-white/10 mt-8">
          <Link href="/guilds" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
            <Users className="w-4 h-4" />
            Découvrir les guildes
          </Link>
        </div>
      </div>
    </div>
  );
}

