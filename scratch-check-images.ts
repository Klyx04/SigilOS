import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing images in OptimizedGuideStep descriptions...");
  const steps = await prisma.optimizedGuideStep.findMany({
    select: {
      id: true,
      title: true,
      description: true
    }
  });

  const imgRegex = /<img[^>]+src=["']?([^"']+)["']?/gi;
  const imageCount: Record<string, number> = {};
  const sampleUrls: string[] = [];

  for (const step of steps) {
    if (!step.description) continue;
    let match;
    while ((match = imgRegex.exec(step.description)) !== null) {
      const src = match[1];
      try {
        const parsed = new URL(src);
        const host = parsed.hostname;
        imageCount[host] = (imageCount[host] || 0) + 1;
        if (sampleUrls.length < 20) {
          sampleUrls.push(`${step.title}: ${src}`);
        }
      } catch (e) {
        imageCount["relative/invalid"] = (imageCount["relative/invalid"] || 0) + 1;
        if (sampleUrls.length < 20) {
          sampleUrls.push(`${step.title} (invalid): ${src}`);
        }
      }
    }
  }

  console.log("\nImage Hosts Count:");
  console.log(JSON.stringify(imageCount, null, 2));

  console.log("\nSample Image URLs:");
  console.log(sampleUrls.join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
