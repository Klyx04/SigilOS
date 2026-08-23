import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const cleanEnv = (val: string | undefined) => {
    if (!val) return '';
    return val.replace(/^['"]|['"]$/g, '').trim();
};

const getConnectionString = () => {
    if (process.env.DATABASE_URL) {
        return cleanEnv(process.env.DATABASE_URL);
    }
    const user = cleanEnv(process.env.POSTGRES_USER) || 'sigiluser';
    const pwd = cleanEnv(process.env.POSTGRES_PASSWORD);
    const db_name = cleanEnv(process.env.POSTGRES_DB) || 'sigilos';
    const host = process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? 'db-beta' : 'localhost');
    const port = process.env.DB_PORT || '5432';
    const protocol = 'postgresql';
    return `${protocol}://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:${port}/${db_name}?schema=public`;
};

const connectionString = getConnectionString();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const docs = [
    {
        slug: 'introduction',
        title: 'Bienvenue sur SigilOS',
        category: 'Guides Utilisateurs',
        accessLevel: 'PUBLIC' as any,
        content: `
# Bienvenue sur SigilOS

SigilOS est l'interface ultime pour la gestion de votre guilde Dofus. Nous avons conçu cet outil pour vous faire gagner des dizaines d'heures de gestion chaque mois.

## Premier Pas : Se Connecter
Tout se passe via **Discord**. Un seul clic suffit pour lier votre compte. Une fois connecté, vous accéderez automatiquement au dashboard de votre guilde si celle-ci est déjà enregistrée.

<div class="callout callout-tip">
<strong>💡 Astuce</strong>
Si vous êtes sur mobile, l'interface est totalement responsive pour suivre vos missions même en plein combat.
</div>

## Le Dashboard
Votre tableau de bord centralise :
- Vos missions hebdomadaires
- Votre progression Ocre
- Les actualités de votre guilde
- Votre status d'activité
        `
    },
    {
        slug: 'quete-ocre',
        title: 'Gestion de la Quête Ocre',
        category: 'Guides Utilisateurs',
        accessLevel: 'MEMBER',
        content: `
# La Quête de l'Éternelle Moisson (Ocre)

SigilOS s'intègre parfaitement avec **Metamob** pour vous proposer une expérience de synchronisation fluide.

## Synchronisation Metamob
Pour voir vos archimonstres manquants :
1. Allez dans votre profil.
2. Renseignez votre pseudo Metamob et votre clé API.
3. Activez la synchronisation automatique.

## Le Matching Inter-Guilde
C'est la force de SigilOS. Le système analyse les doublons de tous les membres pour vous dire exactement **qui possède l'archimonstre que vous cherchez** et à qui vous pouvez donner les vôtres.

<div class="callout callout-important">
<strong>Attention</strong>
Seuls les monstres marqués comme "Disponibles à l'échange" sur Metamob apparaîtront dans les propositions.
</div>
        `
    },
    {
        slug: 'missions',
        title: 'Missions & Objectifs',
        category: 'Guides Utilisateurs',
        accessLevel: 'MEMBER',
        content: `
# Les Missions de Guilde

Chaque semaine, vos officiers définissent des objectifs pour faire progresser la guilde.

## Participer à une Mission
1. Consultez l'onglet **Missions**.
2. Choisissez une mission (Donjon, Métiers, Anomalie...).
3. Cliquez sur "Je suis intéressé" pour réserver un slot.

## Valider son passage
Pour prouver votre participation, vous devez uploader un screenshot de fin de combat ou une preuve métier.
L'**Intelligence Artificielle de SigilOS** (OCR) analysera automatiquement votre image pour vérifier la date, le lieu et les participants.

<div class="steps">
- **Prenez le screenshot** (Touche Impr. Écran ou F2).
- **Glissez-déposez** le fichier dans le formulaire.
- **Attendez la validation** automatique ou celle d'un officier.
</div>
        `
    },
    {
        slug: 'admin-governance',
        title: 'Guide de l\'Administrateur',
        category: 'Spécifications Techniques',
        accessLevel: 'ADMIN',
        content: `
# Gouvernance & Administration

En tant qu'administrateur, vous avez le contrôle total sur les modules actifs de votre guilde.

## Activation des Modules
Rendez-vous dans \`Configuration > Modules\`. Vous pouvez activer sélectivement :
- Le module Ocre (Synchronisation Metamob)
- Le module Missions (OCR & Quêtes hebdomadaires)
- Le module Calendrier (Événements & Sorties)

## Validation des Preuves
Si l'IA n'arrive pas à lire un screenshot (trop flou ou mal cadré), la mission arrive dans votre file d'attente. Vous pouvez alors la valider manuellement d'un clic.
        `
    }
];

async function main() {
    console.log('🌱 Seeding documentation...');
    for (const doc of docs) {
        await prisma.docPage.upsert({
            where: { slug: doc.slug },
            update: {
                title: doc.title,
                category: doc.category,
                content: doc.content,
                accessLevel: doc.accessLevel as any,
            },
            create: {
                slug: doc.slug,
                title: doc.title,
                category: doc.category,
                content: doc.content,
                accessLevel: doc.accessLevel as any,
            },
        });
        console.log(`✅ Doc: ${doc.slug} [${doc.accessLevel}]`);
    }
    console.log('🎉 Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
