const fs = require('fs');
const csv = require('csv-parser');
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

// helper: map CSV values to enum
function mapFlagType(value) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'ya') return 'IYA';
  if (normalized === 'tidak') return 'TIDAK';
  if (normalized === 'ya/tidak') return 'IYA_TIDAK';
  return null;
}

async function seedSatker() {
  await prisma.satker.createMany({
    data: [
      { kodeSatker: '7501', nama: 'BPS Kab. Boalemo', eselon: '3' },
      { kodeSatker: '7502', nama: 'BPS Kab. Gorontalo', eselon: '3' },
      { kodeSatker: '7503', nama: 'BPS Kab. Pohuwato', eselon: '3' },
      { kodeSatker: '7504', nama: 'BPS Kab. Bone Bolango', eselon: '3' },
      { kodeSatker: '7505', nama: 'BPS Kab. Gorontalo Utara', eselon: '3' },
      { kodeSatker: '7571', nama: 'BPS Kota Gorontalo', eselon: '3' },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Satker seeding complete!');
}

async function seedKodeAkunFromCSV() {
  const filePath = 'prisma/data/flags.csv';
  const rows = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ separator: ',' })) // if fails, switch to '\t'
      .on('data', (row) => rows.push(row))
      .on('end', async () => {
        try {
          for (const row of rows) {
            const kode = row['Kode Akun'].toString().trim();
            const nama = row['Jenis'].trim();

            // create or fetch KodeAkun
            const kodeAkun = await prisma.kodeAkun.upsert({
              where: { kode },
              update: {},
              create: {
                kode,
                nama,
              },
            });

            // loop each column after Kode Akun / Jenis
            for (const [colName, rawValue] of Object.entries(row)) {
              if (colName === 'Kode Akun' || colName === 'Jenis') continue;

              const tipe = mapFlagType(rawValue);
              if (!tipe) continue;

              await prisma.flag.upsert({
                where: {
                  // requires @@unique([kodeAkunId, nama]) in schema
                  kodeAkunId_nama: {
                    kodeAkunId: kodeAkun.id,
                    nama: colName,
                  },
                },
                update: { tipe },
                create: {
                  nama: colName,
                  tipe,
                  kodeAkunId: kodeAkun.id,
                },
              });
            }
          }

          console.log('✅ KodeAkun + Flags seeding complete!');
          resolve();
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}

async function main() {
  await seedSatker();
  await seedKodeAkunFromCSV();
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
