import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const legendaryItems = [
  { name: "Clairvoyance de Mériana", category: "Bottes", jobRequired: "Cordonnier", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6691.png" },
  { name: "Ponctualité d'Henual", category: "Anneau", jobRequired: "Bijoutier", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6690.png" },
  { name: "Amour d'Helséphine", category: "Amulette", jobRequired: "Bijoutier", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6689.png" },
  { name: "Bouclier Miroir", category: "Bouclier", jobRequired: "Façonneur", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6688.png" },
  { name: "Ardeur d'Oto Mustam", category: "Chapeau", jobRequired: "Tailleur", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6687.png" },
  { name: "Étreinte de Servitude", category: "Ceinture", jobRequired: "Cordonnier", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6686.png" },
  { name: "Pestilence de Corruption", category: "Cape", jobRequired: "Tailleur", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6685.png" },
  { name: "Courage de Dame Jhessica", category: "Ceinture", jobRequired: "Cordonnier", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6179.png" },
  { name: "Audace de Dodge", category: "Ceinture", jobRequired: "Cordonnier", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6178.png" },
  { name: "Bottes du Cul Botté", category: "Bottes", jobRequired: "Cordonnier", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6177.png" },
  { name: "Bottes de Mille Lieues", category: "Bottes", jobRequired: "Cordonnier", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6176.png" },
  { name: "Noblesse de Jahash Jurgen", category: "Cape", jobRequired: "Tailleur", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6175.png" },
  { name: "Bravoure de Rykke Errel", category: "Cape", jobRequired: "Tailleur", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6174.png" },
  { name: "Diadème de Ganymède", category: "Chapeau", jobRequired: "Tailleur", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6173.png" },
  { name: "Couronne de Brâm Barbe-Monde", category: "Chapeau", jobRequired: "Tailleur", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/6172.png" },
  { name: "Trompe-la-Mort", category: "Bouclier", jobRequired: "Façonneur", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/5475.png" },
  { name: "Droiture de Fallanster", category: "Bouclier", jobRequired: "Façonneur", imageUrl: "https://static.dofusbook.net/fr/encyclopedie/items/5474.png" }
];

async function main() {
  console.log('Seeding legendary items...');
  for (const item of legendaryItems) {
    await prisma.legendaryItem.upsert({
      where: { name: item.name },
      update: item,
      create: item,
    });
  }
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
