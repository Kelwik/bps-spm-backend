const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  await prisma.satKer.createmany({
    data: [
      { kodeSatker: 7501, nama: 'BPS Kab. Boalemo' },
      { kodeSatker: 7501, nama: 'BPS Kab. Gorontalo' },
      { kodeSatker: 7501, nama: 'BPS Kab. Pohuwato' },
      { kodeSatker: 7501, nama: 'BPS Kab. Bone Bolango' },
      { kodeSatker: 7501, nama: 'BPS Kab. Gorontalo Utara' },
      { kodeSatker: 7501, nama: 'BPS Kota Gorontalo' },
    ],
  });
}
