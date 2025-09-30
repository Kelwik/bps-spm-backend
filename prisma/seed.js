const fs = require('fs');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

// Fungsi untuk menormalisasi nilai flag dari CSV
function normalizeFlagValue(value) {
  if (!value) return null;
  const val = value.trim().toLowerCase();
  if (val === 'ya') return 'IYA';
  if (val === 'tidak') return 'TIDAK'; // Dipertahankan untuk logika penyaringan
  if (val === 'ya/tidak') return 'IYA_TIDAK';
  return null;
}

// Fungsi untuk membaca CSV dan mengisi tabel KodeAkun & Flag
async function seedFromCSV() {
  console.log('Reading flags.csv and seeding KodeAkun and Flags...');
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
          for (const r of rows) {
            const kode = r['Kode Akun'];
            const nama = r['Jenis'];
            if (!kode || !nama) {
              console.warn('⚠️ Skipping row with missing data:', r);
              continue;
            }

            // Upsert KodeAkun menggunakan kunci unik komposit (kode + nama)
            const kodeAkun = await prisma.kodeAkun.upsert({
              where: {
                kode_nama: {
                  kode: kode.toString(),
                  nama: nama,
                },
              },
              update: {},
              create: {
                kode: kode.toString(),
                nama: nama,
              },
            });

            // Loop melalui setiap kolom flag untuk baris ini
            for (const [colName, value] of Object.entries(r)) {
              if (colName === 'Kode Akun' || colName === 'Jenis') continue;

              const tipe = normalizeFlagValue(value);

              // Logika optimisasi: Abaikan flag yang tipenya 'TIDAK'
              if (!tipe || tipe === 'TIDAK') {
                continue;
              }

              // Hanya upsert flag 'IYA' dan 'IYA_TIDAK'
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
          console.log('✅ KodeAkun & Flag seeding complete!');
          resolve();
        } catch (err) {
          console.error('Error during CSV seeding:', err);
          reject(err);
        }
      })
      .on('error', reject);
  });
}

// Fungsi untuk mengisi tabel User
async function seedUsers() {
  console.log('Seeding users...');
  const hashedPassword = bcrypt.hashSync('password123', 10);

  // Pengguna op_prov
  await prisma.user.upsert({
    where: { email: 'fitra' },
    update: {},
    create: {
      email: 'fitra',
      name: 'Operator Provinsi',
      password: hashedPassword,
      role: 'op_prov',
    },
  });

  // Pengguna op_satker
  const satkerGorontalo = await prisma.satker.findUnique({
    where: { kodeSatker: '7502' },
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
        satkerId: satkerGorontalo.id,
      },
    });
  } else {
    console.warn('⚠️ Could not find Satker 7502 to create op_satker user.');
  }
  console.log('✅ User seeding complete!');
}

// Fungsi utama untuk menjalankan semua seeder secara berurutan
async function main() {
  console.log('Start seeding ...');

  // 1. Seed Satker terlebih dahulu
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
  console.log('✅ Satker seeding complete.');

  // 2. Panggil fungsi seedUsers
  await seedUsers();

  // 3. Panggil fungsi seed dari CSV
  await seedFromCSV();

  console.log('🚀 Seeding finished.');
}

// Eksekusi fungsi main dan tangani error
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
