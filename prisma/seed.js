const fs = require('fs');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

// (Fungsi normalizeFlagValue dan seedFromCSV tidak berubah)
function normalizeFlagValue(value) {
  if (!value) return null;
  const val = value.trim().toLowerCase();
  if (val === 'ya') return 'IYA';
  if (val === 'tidak') return 'TIDAK';
  if (val === 'ya/tidak') return 'IYA_TIDAK';
  return null;
}

async function seedFromCSV() {
  console.log('Reading flags.csv and seeding KodeAkun and Flags...');
  const filePath = 'prisma/flags.csv';
  const rows = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ separator: ',', mapHeaders: ({ header }) => header.trim() }))
      .on('data', (row) => rows.push(row))
      .on('end', async () => {
        try {
          for (const r of rows) {
            const kode = r['Kode Akun'];
            const nama = r['Jenis'];
            if (!kode || !nama) continue;

            const kodeAkun = await prisma.kodeAkun.upsert({
              where: { kode_nama: { kode: kode.toString(), nama } },
              update: {},
              create: { kode: kode.toString(), nama },
            });

            for (const [colName, value] of Object.entries(r)) {
              if (['Kode Akun', 'Jenis'].includes(colName)) continue;
              const tipe = normalizeFlagValue(value);
              if (!tipe || tipe === 'TIDAK') continue;

              await prisma.flag.upsert({
                where: {
                  kodeAkunId_nama: { kodeAkunId: kodeAkun.id, nama: colName },
                },
                update: { tipe },
                create: { nama: colName, tipe, kodeAkunId: kodeAkun.id },
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

// --- FUNGSI SEED USERS YANG DIPERBARUI SECARA TOTAL ---
async function seedUsers() {
  console.log('Seeding all users...');

  // Password placeholder untuk akun IMAP (tidak akan pernah digunakan untuk login)
  const dummyPasswordHash = bcrypt.hashSync(
    'dummy-password-for-imap-users',
    10
  );
  // Password asli untuk akun fallback lokal
  const fallbackPasswordHash = bcrypt.hashSync('password123', 10);

  // Helper untuk membuat nama dari email
  const createNameFromEmail = (email) => {
    return email
      .split('@')[0]
      .replace('-', ' ')
      .split('.')
      .map((namePart) => namePart.charAt(0).toUpperCase() + namePart.slice(1))
      .join(' ');
  };

  // Hapus semua user lama untuk memastikan data bersih
  await prisma.user.deleteMany({});
  console.log('Deleted old users.');

  const usersToSeed = [
    // OP PROVINSI
    { email: 'fahrudin.amir@bps.go.id', role: 'op_prov' },
    { email: 'alwi@bps.go.id', role: 'op_prov' },
    { email: 'ismail.duma@bps.go.id', role: 'op_prov' },
    { email: 'Cindra.datau@bps.go.id', role: 'op_prov' },
    { email: 'insen.kalay@bps.go.id', role: 'op_prov' },
    { email: 'wahidin@bps.go.id', role: 'op_prov' },
    { email: 'dwieyogo.ahmad@bps.go.id', role: 'op_prov' },
    { email: 'deisy@bps.go.id', role: 'op_prov' },
    { email: 'kasman@bps.go.id', role: 'op_prov' },
    { email: 'azisr@bps.go.id', role: 'op_prov' },
    { email: 'ismaildaud-pppk@bps.go.id', role: 'op_prov' },
    { email: 'wirast@bps.go.id', role: 'op_prov' },
    { email: 'sgani@bps.go.id', role: 'op_prov' },
    { email: 'sity@bps.go.id', role: 'op_prov' },
    { email: 'sri.sindika@bps.go.id', role: 'op_prov' },
    { email: 'dewiaboka-pppk@bps.go.id', role: 'op_prov' },
    { email: 'sulistia.pakaya@bps.go.id', role: 'op_prov' },
    { email: 'adeiman@bps.go.id', role: 'op_prov' },
    { email: 'nurlaila@bps.go.id', role: 'op_prov' },
    { email: 'lia.rizky@bps.go.id', role: 'op_prov' },
    { email: 'sri.wandari@bps.go.id', role: 'op_prov' },
    { email: 'vivialida-pppk@bps.go.id', role: 'op_prov' },
    { email: 'khusni.robiah@bps.go.id', role: 'op_prov' },
    { email: 'rodyah.mulyani@bps.go.id', role: 'op_prov' },
    // BPS BOALEMO 7501
    { email: 'prasaja@bps.go.id', role: 'op_satker', kodeSatker: '7501' },
    { email: 'riswan.kalai@bps.go.id', role: 'op_satker', kodeSatker: '7501' },
    { email: 'maryam.moito@bps.go.id', role: 'op_satker', kodeSatker: '7501' },
    // BPS POHUWATO 7503
    { email: 'harim@bps.go.id', role: 'op_satker', kodeSatker: '7503' },
    {
      email: 'khumaidi.subkhi@bps.go.id',
      role: 'op_satker',
      kodeSatker: '7503',
    },
    { email: 'aurumnuranisa@bps.go.id', role: 'op_satker', kodeSatker: '7503' },
    // BPS KABGOR 7502
    { email: 'suparno@bps.go.id', role: 'viewer', kodeSatker: '7502' },
    { email: 'riane@bps.go.id', role: 'op_satker', kodeSatker: '7502' },
    { email: 'rahman.kue@bps.go.id', role: 'op_satker', kodeSatker: '7502' },
    // BPS BONEBOLANGO 7504
    { email: 'asaef@bps.go.id', role: 'viewer', kodeSatker: '7504' },
    {
      email: 'desilestariutami@bps.go.id',
      role: 'op_satker',
      kodeSatker: '7504',
    },
    { email: 'marlena.agus@bps.go.id', role: 'op_satker', kodeSatker: '7504' },
    // BPS GORUT 7505
    { email: 'depit@bps.go.id', role: 'viewer', kodeSatker: '7505' },
    { email: 'aziz@bps.go.id', role: 'op_satker', kodeSatker: '7505' },
    // BPS KOTA 7571
    { email: 'dewi.mono@bps.go.id', role: 'viewer', kodeSatker: '7571' },
    {
      email: 'nining.igirisa@bps.go.id',
      role: 'op_satker',
      kodeSatker: '7571',
    },
    { email: 'clara.aulia@bps.go.id', role: 'op_satker', kodeSatker: '7571' },
  ];

  // Seed semua pengguna IMAP
  for (const userData of usersToSeed) {
    const username = userData.email.split('@')[0].toLowerCase();
    let satkerId = null;
    if (userData.kodeSatker) {
      const satker = await prisma.satker.findUnique({
        where: { kodeSatker: userData.kodeSatker },
      });
      if (satker) satkerId = satker.id;
    }
    await prisma.user.create({
      data: {
        email: username,
        name: createNameFromEmail(username),
        password: dummyPasswordHash,
        role: userData.role,
        satkerId,
      },
    });
  }
  console.log(`✅ Seeded ${usersToSeed.length} IMAP users.`);

  // --- Seed Akun Fallback Lokal ---
  // 1. Fallback OP PROV
  await prisma.user.create({
    data: {
      email: 'prov.local@bps.go.id',
      name: 'Admin Provinsi (Lokal)',
      password: fallbackPasswordHash,
      role: 'op_prov',
    },
  });
  console.log(`Created local fallback user (op_prov): prov.local@bps.go.id`);

  // 2. Fallback OP SATKER
  const fallbackSatker = await prisma.satker.findUnique({
    where: { kodeSatker: '7501' },
  });
  if (fallbackSatker) {
    await prisma.user.create({
      data: {
        email: 'satker.local@bps.go.id',
        name: 'Admin Satker (Lokal)',
        password: fallbackPasswordHash,
        role: 'op_satker',
        satkerId: fallbackSatker.id,
      },
    });
    console.log(
      `Created local fallback user (op_satker): satker.local@bps.go.id`
    );
  }

  console.log('✅ User seeding complete!');
}

// Fungsi utama untuk menjalankan semua seeder
async function main() {
  console.log('Start seeding ...');

  // 1. Seed Satker
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

  // 2. Panggil fungsi seedUsers yang baru
  await seedUsers();

  // 3. Panggil fungsi seed dari CSV
  await seedFromCSV();

  console.log('🚀 Seeding finished.');
}

// Eksekusi
main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
