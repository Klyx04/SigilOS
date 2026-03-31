import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DOFUS_ITEMS = [
    { slug: 'argent', name: 'Dofus Argenté', nameShort: 'Argenté', rarity: 'MAJEUR', levelRecommended: 40 },
    { slug: 'emeraude', name: 'Dofus Émeraude', nameShort: 'Émeraude', rarity: 'PRIMORDIAL', isPrimordial: true, levelRecommended: 100 },
    { slug: 'pourpre', name: 'Dofus Pourpre', nameShort: 'Pourpre', rarity: 'PRIMORDIAL', isPrimordial: true, levelRecommended: 120 },
    { slug: 'turquoise', name: 'Dofus Turquoise', nameShort: 'Turquoise', rarity: 'PRIMORDIAL', isPrimordial: true, levelRecommended: 160 },
    { slug: 'ivoire', name: 'Dofus Ivoire', nameShort: 'Ivoire', rarity: 'PRIMORDIAL', isPrimordial: true, levelRecommended: 180 },
    { slug: 'ebene', name: 'Dofus Ébène', nameShort: 'Ébène', rarity: 'PRIMORDIAL', isPrimordial: true, levelRecommended: 200 },
    { slug: 'ocre', name: 'Dofus Ocre', nameShort: 'Ocre', rarity: 'PRIMORDIAL', isPrimordial: true, levelRecommended: 160 },
    { slug: 'vulbis', name: 'Dofus Vulbis', nameShort: 'Vulbis', rarity: 'PRIMORDIAL', isPrimordial: true, levelRecommended: 200 },
    { slug: 'abyssal', name: 'Dofus Abyssal', nameShort: 'Abyssal', rarity: 'MAJEUR', levelRecommended: 180 },
    { slug: 'nebuleux', name: 'Dofus Nébuleux', nameShort: 'Nébuleux', rarity: 'MAJEUR', levelRecommended: 180 },
    { slug: 'cawotte', name: 'Dofus Cawotte', nameShort: 'Cawotte', rarity: 'MINEUR', levelRecommended: 60 },
    { slug: 'dokoko', name: 'Dokoko', nameShort: 'Dokoko', rarity: 'MINEUR', levelRecommended: 80 },
    { slug: 'dolmanax', name: 'Dolmanax', nameShort: 'Dolmanax', rarity: 'MAJEUR', levelRecommended: 100 },
    { slug: 'argent-scintillant', name: 'Dofus Argenté Scintillant', nameShort: 'Scintillant', rarity: 'MAJEUR', levelRecommended: 200 },
    { slug: 'sylvestre', name: 'Dofus Sylvestre', nameShort: 'Sylvestre', rarity: 'MAJEUR', levelRecommended: 200 },
    { slug: 'tachete', name: 'Dofus Tacheté', nameShort: 'Tacheté', rarity: 'MAJEUR', levelRecommended: 200 },
];

async function main() {
    console.log('🌱 Seeding initial Dofus items...');
    for (const item of DOFUS_ITEMS) {
        await prisma.dofusItem.upsert({
            where: { slug: item.slug },
            update: item,
            create: item,
        });
    }
    console.log('✅ Dofus items seeded successfully.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
