import Link from "next/link";
import { ArrowLeft, ShieldCheck, Rocket, Link as LinkIcon, EyeOff, Globe } from "lucide-react";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { redirect } from "next/navigation";

export default async function GodOnboardingDocsPage() {
    // Fail-closed : réservé aux super-admins (le layout accepte désormais les sub-gods)
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");
    const inviteLink = "https://discord.com/oauth2/authorize?client_id=1458259008355045519&permissions=8&integration_type=0&scope=bot";

    return (
        <div className="space-y-8 py-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-6 pb-6 border-b border-white/5">
                <Link
                    href="/god"
                    className="p-3 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-widest text-white">
                        Protocoles d'Onboarding (B2B)
                    </h1>
                    <p className="text-zinc-500 mt-1">Documentation des procédures d'intégration de nouvelles guildes clientes.</p>
                </div>
            </div>

            {/* Lien Maître */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3 text-blue-400 font-black uppercase tracking-widest">
                    <LinkIcon className="w-5 h-5" />
                    <h2>Lien d'invitation maître SigilOS</h2>
                </div>
                <code className="bg-black/40 p-4 rounded-xl text-blue-300 text-sm font-mono break-all border border-blue-500/10">
                    {inviteLink}
                </code>
                <p className="text-xs text-blue-400/70">Ce lien représente l'identité unique de ton bot. Il ne change jamais, peu importe le protocole utilisé.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* SCÉNARIO A : PRIVÉ */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[50px] -translate-y-1/2 translate-x-1/2" />

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                        <EyeOff className="w-3 h-3" />
                        Scénario A : Sur Mesure
                    </div>

                    <h2 className="text-2xl font-black text-white">Le protocole "Privé"</h2>
                    <p className="text-sm text-zinc-400">Contrôle absolu, géré manuellement par l'Architecte (Toi). Aucun client ne peut inviter le bot lui-même.</p>

                    <div className="space-y-4 pt-4">
                        <div className="p-4 bg-black/20 rounded-xl border border-white/5 space-y-2">
                            <h4 className="font-bold text-amber-500 text-sm uppercase tracking-widest">Pré-requis Discord</h4>
                            <p className="text-xs text-zinc-400">Dans le portail développeur Discord, l'option <strong className="text-white">Public Bot</strong> doit être sur <strong className="text-red-400">OFF</strong>.</p>
                        </div>

                        <ol className="space-y-4 text-sm text-zinc-300 list-decimal pl-5 marker:text-amber-500 font-medium">
                            <li className="pl-2">Le client (Meneur de la guilde) te communique l'ID de son serveur Discord.</li>
                            <li className="pl-2">Tu vas dans le <strong>God Panel</strong> &gt; <em>Whitelist New Guild</em> et tu ajoutes son ID.</li>
                            <li className="pl-2">Le client te nomme temporairement <strong>Administrateur</strong> sur son serveur Discord.</li>
                            <li className="pl-2 !text-white !font-bold">TOI SEUL ouvres le <span className="text-amber-500">Lien d'invitation maître</span> dans ton navigateur.</li>
                            <li className="pl-2">Discord te reconnaît comme le propriétaire du bot privé. Tu sélectionnes le serveur du client, et le bot atterrit chez eux.</li>
                            <li className="pl-2">Le Webhook SigilOS détecte le déploiement, valide l'autorisation et allume l'accès au site.</li>
                            <li className="pl-2">Le client se connecte sur <em>sigilos.fr</em>, voit la carte de sa guilde et clique sur <strong>Déployer</strong>. Ses salons et rôles sont configurés automatiquement.</li>
                        </ol>
                    </div>
                </div>

                {/* SCÉNARIO B : PUBLIC */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] -translate-y-1/2 translate-x-1/2" />

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                        <Globe className="w-3 h-3" />
                        Scénario B : Industrialisé (SaaS)
                    </div>

                    <h2 className="text-2xl font-black text-white">Le protocole "Autonome"</h2>
                    <p className="text-sm text-zinc-400">Automatisation maximale. Le client fait toutes les manipulations depuis le site web, mais la sécurité logicielle bloque les non-payeurs.</p>

                    <div className="space-y-4 pt-4">
                        <div className="p-4 bg-black/20 rounded-xl border border-white/5 space-y-2">
                            <h4 className="font-bold text-emerald-500 text-sm uppercase tracking-widest">Pré-requis Discord</h4>
                            <p className="text-xs text-zinc-400">Dans le portail développeur Discord, l'option <strong className="text-white">Public Bot</strong> doit être sur <strong className="text-emerald-400">ON</strong>.</p>
                        </div>

                        <ol className="space-y-4 text-sm text-zinc-300 list-decimal pl-5 marker:text-emerald-500 font-medium">
                            <li className="pl-2">Après accord financier/oral, tu vas dans le <strong>God Panel</strong> &gt; <em>Whitelist New Guild</em> et tu ajoutes l'ID de sa guilde.</li>
                            <li className="pl-2">Le client se connecte sur <em>sigilos.fr</em> avec son compte Discord.</li>
                            <li className="pl-2">SigilOS détecte qu'il est Administrateur de la guilde whitelistée, et lui affiche le bouton <strong>"Inviter le Bot"</strong> sur la carte de la guilde.</li>
                            <li className="pl-2">Il clique dessus, ce qui le redirige vers le <span className="text-emerald-500">Lien d'invitation maître</span>.</li>
                            <li className="pl-2">Il autorise lui-même l'ajout du bot sur son propre serveur Discord.</li>
                            <li className="pl-2">Il revient sur SigilOS. Le bouton est devenu <strong>"Déployer"</strong>. Il clique dessus et l'architecture s'installe.</li>
                        </ol>

                        {/* Security Notice for Public Bot */}
                        <div className="mt-8 p-4 border border-rose-500/20 bg-rose-500/5 rounded-xl">
                            <h4 className="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase tracking-widest mb-2">
                                <ShieldCheck className="w-4 h-4" />
                                Sécurité Anti-Fantômes (Bot Public)
                            </h4>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Dans ce scénario, si n'importe qui sur internet trouve ton lien maître, il pourra inviter SigilOS sur son serveur "CounterStrike".
                                <strong> Cependant, aucune interaction ne sera possible.</strong> SigilOS vérifiera que son ID de guilde n'est pas dans ta Whitelist, et lui bloquera l'accès à 100%.
                                Tu pourras voir ces serveurs illégitimes dans l'onglet <em>Radar Anti-Fantômes</em> et les expulser en un clic.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
