import { DocContent } from "@/components/doc/doc-content";
import Link from "next/link";

const INTRO_CONTENT = `
# 🚧 Documentation en cours de rédaction...

Ah... Tu as trouvé une page vide ! 

C'est normal, SigilOS évolue très vite et la rédaction de cette documentation officielle est encore en cours. 

**Ce qui est prévu ici :**
- Explications détaillées sur le fonctionnement de chaque module
- Cas d'usage pratiques pour les membres et officiers
- Configuration avancée 

En attendant que cette page soit finalisée, n'hésite pas à demander de l'aide sur le Discord officiel de SigilOS. On se fera un plaisir de t'accompagner en direct.

*Merci pour ta patience !* ⏳
`;

export default function IntroPage() {
    return (
        <div className="max-w-4xl">
            <DocContent content={INTRO_CONTENT} />
        </div>
    );
}
