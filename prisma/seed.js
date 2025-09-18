const fs = require('fs');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs'); // Impor bcryptjs untuk hashing
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

// Fungsi ini tetap sama
function normalizeFlagValue(value) {
  if (!value) return null;
  const val = value.trim().toLowerCase();
  if (val === 'ya') return 'IYA';
  if (val === 'tidak') return 'TIDAK';
  if (val === 'ya/tidak') return 'IYA_TIDAK';
  return null;
}

// Fungsi ini tetap sama
async function seedFromCSV() {
  // ... (kode untuk seed dari CSV tidak perlu diubah)
  const filePath = 'prisma/flags.csv';
  const rows = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
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
              continue;
            }
            const kodeAkun = await prisma.kodeAkun.upsert({
              where: { kode: kode.toString() },
              update: {},
              create: {
                kode: kode.toString(),
                nama: nama,
              },
            });
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

// FUNGSI BARU UNTUK SEEDING PENGGUNA
async function seedUsers() {
  console.log('Seeding users...');

  // 1. Hash password default. Jangan simpan password plain text!
  const hashedPassword = bcrypt.hashSync('password123', 10);

  // 2. Buat pengguna op_prov (tanpa satkerId)
  await prisma.user.upsert({
    where: { email: 'prov@bps.go.id' },
    update: {},
    create: {
      email: 'prov@bps.go.id',
      name: 'Operator Provinsi',
      password: hashedPassword,
      role: 'op_prov',
      // satkerId dibiarkan kosong (null) karena ini user provinsi
    },
  });
  console.log('Created op_prov user.');

  // 3. Buat pengguna op_satker (dengan satkerId)
  // Ambil data salah satu satker untuk dihubungkan
  const satkerGorontalo = await prisma.satker.findUnique({
    where: { kodeSatker: '7502' }, // BPS Kab. Gorontalo
  });

  if (satkerGorontalo) {
    await prisma.user.upsert({
      where: { email: 'satker7502@bps.go.id' },
      update: {},
      create: {
        email: 'satker7502@bps.go.id',
        name: 'Operator BPS Kab. Gorontalo',
        password: hashedPassword,
        role: 'op_satker',
        satkerId: satkerGorontalo.id, // Hubungkan ke Satker yang sudah ada
      },
    });
    console.log('Created op_satker user for BPS Kab. Gorontalo.');
  } else {
    console.warn('⚠️ Could not find Satker 7502 to create op_satker user.');
  }

  console.log('✅ User seeding complete!');
}

async function main() {
  console.log('Start seeding ...');

  // // 1. Seed Satker terlebih dahulu (DIKOMENTARI AGAR TIDAK JALAN)
  // await prisma.satker.createMany({
  //   data: [
  //     { kodeSatker: '7501', nama: 'BPS Kab. Boalemo', eselon: '3' },
  //     { kodeSatker: '7502', nama: 'BPS Kab. Gorontalo', eselon: '3' },
  //     { kodeSatker: '7503', nama: 'BPS Kab. Pohuwato', eselon: '3' },
  //     { kodeSatker: '7504', nama: 'BPS Kab. Bone Bolango', eselon: '3' },
  //     { kodeSatker: '7505', nama: 'BPS Kab. Gorontalo Utara', eselon: '3' },
  //     { kodeSatker: '7571', nama: 'BPS Kota Gorontalo', eselon: '3' },
  //   ],
  //   skipDuplicates: true,
  // });
  // console.log('Satker seeding skipped.');

  // 2. Panggil fungsi seedUsers yang baru
  await seedUsers();

  // // 3. Seed dari CSV (DIKOMENTARI AGAR TIDAK JALAN)
  // await seedFromCSV();

  console.log('Seeding finished.');
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
