import { redirect } from "next/navigation";

/** La racine de l'espace visiteur n'a pas d'écran : elle route vers le premier onglet. */
export default function VisitorRootPage() {
    redirect("/espace-visiteur/general");
}
