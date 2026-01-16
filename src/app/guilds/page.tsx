import { getPublicGuilds } from "@/server/actions/presentation-actions";
import Link from "next/link";
import Image from "next/image";
import { Users, Gamepad2, MessageCircle } from "lucide-react";

export const metadata = {
    title: "Annuaire des Guildes | SigilOS",
    description: "Découvrez les guildes Dofus utilisant SigilOS",
};

export default async function GuildsDirectoryPage() {
    const guilds = await getPublicGuilds();

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
            {/* Hero Header */}
            <header className="relative py-20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10" />
                <div className="container mx-auto px-6 relative z-10">
                    <h1 className="text-5xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                        Annuaire des Guildes
                    </h1>
                    <p className="text-center text-zinc-400 mt-4 text-lg max-w-2xl mx-auto">
                        Découvrez les guildes Dofus qui utilisent SigilOS pour gérer leur communauté
                    </p>
                    <div className="flex justify-center mt-8 gap-6 text-sm text-zinc-500">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-400" />
                            <span>{guilds.length} guilde{guilds.length > 1 ? "s" : ""}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Guild Grid */}
            <main className="container mx-auto px-6 pb-20">
                {guilds.length === 0 ? (
                    <div className="text-center py-20">
                        <Gamepad2 className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-zinc-400">Aucune guilde pour le moment</h2>
                        <p className="text-zinc-600 mt-2">
                            Les guildes apparaîtront ici une fois qu&apos;elles auront activé leur présentation publique.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {guilds.map((guild) => (
                            <Link
                                key={guild.id}
                                href={`/guilds/${guild.discordGuildId}`}
                                className="group relative overflow-hidden rounded-2xl bg-zinc-900/50 border border-white/5 hover:border-indigo-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10"
                            >
                                {/* Banner */}
                                <div className="h-32 relative bg-gradient-to-br from-indigo-600/20 via-purple-600/20 to-pink-600/20">
                                    {guild.bannerType === "custom" && guild.bannerUrl ? (
                                        <Image
                                            src={guild.bannerUrl}
                                            alt={`${guild.name} banner`}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-20 h-20 rounded-full bg-zinc-800 border-4 border-zinc-900 flex items-center justify-center overflow-hidden">
                                                {guild.iconUrl ? (
                                                    <Image
                                                        src={guild.iconUrl}
                                                        alt={guild.name}
                                                        width={80}
                                                        height={80}
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-3xl font-bold text-zinc-500">
                                                        {guild.name.charAt(0)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-5">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">
                                                {guild.name}
                                            </h3>
                                            {guild.server && (
                                                <p className="text-xs text-zinc-500 mt-1">
                                                    {guild.server}
                                                </p>
                                            )}
                                        </div>
                                        {guild.isRecruiting && (
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                Recrute
                                            </span>
                                        )}
                                    </div>

                                    {/* Tagline removed - no longer in schema */}

                                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-zinc-500">
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        <span>Voir la présentation</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Back to Home */}
                <div className="text-center mt-16">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
                    >
                        ← Retour à l&apos;accueil
                    </Link>
                </div>
            </main>
        </div>
    );
}
