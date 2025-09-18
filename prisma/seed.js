const fs = require('fs');
const csv = require('csv-parser');
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

function normalizeFlagValue(value) {
  if (!value) return null;
  const val = value.trim().toLowerCase();
  if (val === 'ya') return 'IYA';
  if (val === 'tidak') return 'TIDAK';
  if (val === 'ya/tidak') return 'IYA_TIDAK';
  return null;
}

async function seedFromCSV() {
  const filePath = 'prisma/flags.csv';
  const rows = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      // 👇 PERUBAHAN DI SINI: Tambahkan mapHeaders untuk membersihkan nama kolom
      .pipe(
        csv({
          separator: ',',
          mapHeaders: ({ header }) => header.trim(),
        })
      )
      .on('data', (row) => rows.push(row))
      .on('end', async () => {
        try {
          console.log(
            `✅ CSV file read successfully. Found ${rows.length} rows.`
          );
          for (const r of rows) {
            const kode = r['Kode Akun'];
            const nama = r['Jenis'];
            if (!kode || !nama) {
              console.warn('⚠️ Skipping row with missing data:', r);
              // Untuk debugging, Anda bisa melihat kunci yang sebenarnya seperti ini:
              // console.log('Actual keys found:', Object.keys(r));
              continue;
            }

            // 1️⃣ Sisipkan atau dapatkan kodeAkun
            const kodeAkun = await prisma.kodeAkun.upsert({
              where: { kode: kode.toString() },
              update: {},
              create: {
                kode: kode.toString(),
                nama: nama,
              },
            });

            // 2️⃣ Sisipkan flag (loop melalui semua kolom lainnya)
            for (const [colName, value] of Object.entries(r)) {
              if (colName === 'Kode Akun' || colName === 'Jenis') continue;

              const tipe = normalizeFlagValue(value);
              if (!tipe) continue;

              await prisma.flag.upsert({
                where: {
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

          console.log('✅ CSV seeding complete!');
          resolve();
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}

async function main() {
  // Example: Satker seeding
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

  await seedFromCSV();
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
