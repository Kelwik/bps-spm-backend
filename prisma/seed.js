const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function main() {
  await prisma.satker.createMany({
    data: [
      { kodeSatker: 7501, nama: 'BPS Kab. Boalemo' },
      { kodeSatker: 7502, nama: 'BPS Kab. Gorontalo' },
      { kodeSatker: 7503, nama: 'BPS Kab. Pohuwato' },
      { kodeSatker: 7504, nama: 'BPS Kab. Bone Bolango' },
      { kodeSatker: 7505, nama: 'BPS Kab. Gorontalo Utara' },
      { kodeSatker: 7571, nama: 'BPS Kota Gorontalo' },
    ],
    skipDuplicates: true,
  });

  console.log('Seeding Complete');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
