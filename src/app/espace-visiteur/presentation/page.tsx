import { requirePublicAccount } from "@/server/public-account";
import { PresentationForm } from "../_components/presentation-form";

export const metadata = {
    title: "Présentation — espace visiteur | SigilOS",
    description: "Quelques lignes pour te présenter et dire ce que tu cherches en jeu.",
};

export default async function PresentationPage() {
    const { profile } = await requirePublicAccount();
    return (
        <PresentationForm
            introduction={profile.introduction}
            objectifs={profile.objectifs}
            preferredActivities={profile.preferredActivities}
        />
    );
}
