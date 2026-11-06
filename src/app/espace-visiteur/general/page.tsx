import { getClass } from "@/lib/dofus-assets";
import { resolveDofusServerName } from "@/lib/presentation-constants";
import { loadPublicProfileView, requirePublicSession } from "@/server/public-account";
import { CreateProfileForm } from "../_components/create-profile-form";
import { IdentityForm } from "../_components/identity-form";
import { MetamobForm } from "../_components/metamob-form";

export const metadata = {
    title: "Général — espace visiteur | SigilOS",
    description: "Ton serveur, ton pseudo, ta classe et ton nom de guilde déclaré.",
};

/** Onglet Général : la **seule** page qui accepte l'absence de profil (écran de création). */
export default async function GeneralPage() {
    const { userId } = await requirePublicSession();
    const profile = await loadPublicProfileView(userId);

    if (!profile) return <CreateProfileForm />;

    const className = profile.classe ? getClass(profile.classe)?.name ?? profile.classe : "Classe non renseignée";
    const serverName = resolveDofusServerName(null, String(profile.dofusServerId));

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <h1 className="text-xl font-semibold text-foreground">Général</h1>
                <p className="text-sm text-muted-foreground">
                    {profile.pseudoDofus ?? "Pseudo non renseigné"} · {className} · {serverName}
                    {profile.declaredGuildName ? ` · Guilde déclarée : ${profile.declaredGuildName}` : ""}
                </p>
            </header>

            <IdentityForm
                serverId={profile.dofusServerId}
                pseudoDofus={profile.pseudoDofus}
                classe={profile.classe}
                declaredGuildName={profile.declaredGuildName}
            />

            <MetamobForm
                metamobPseudo={profile.metamobPseudo}
                hasKey={profile.hasMetamobApiKey}
                verified={profile.metamobVerified}
            />
        </div>
    );
}
