const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

// Configuration
const TARGET_KODE_SATKER = '7503'; // BPS Kab. Pohuwato

async function deletePohuwatoSpm() {
  console.log(`🔍 Finding Satker ID for Kode: ${TARGET_KODE_SATKER}...`);

  const satker = await prisma.satker.findUnique({
    where: { kodeSatker: TARGET_KODE_SATKER },
  });

  if (!satker) {
    console.error(`❌ Satker with kode ${TARGET_KODE_SATKER} not found!`);
    return;
  }

  console.log(`✅ Found Satker: ${satker.nama} (ID: ${satker.id})`);
  console.log(`⚠️  WARNING: This will delete ALL SPM data for ${satker.nama}.`);
  console.log(`⏳ Starting deletion...`);

  // Delete ALL SPMs for this Satker
  const result = await prisma.spm.deleteMany({
    where: {
      satkerId: satker.id,
    },
  });

  console.log(`\n===========================================`);
  console.log(`🗑️  DELETION COMPLETE`);
  console.log(`===========================================`);
  console.log(`Deleted ${result.count} SPMs from ${satker.nama}.`);
}

deletePohuwatoSpm()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
