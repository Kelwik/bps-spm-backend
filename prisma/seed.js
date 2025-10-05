const fs = require('fs');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

// (This function does not need changes)
function normalizeFlagValue(value) {
  if (!value) return null;
  const val = value.trim().toLowerCase();
  if (val === 'ya') return 'IYA';
  if (val === 'tidak') return 'TIDAK';
  if (val === 'ya/tidak') return 'IYA_TIDAK';
  return null;
}

// (This function does not need changes)
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

// (This function does not need changes)
async function seedUsers() {
  console.log('Seeding all users...');
  const dummyPasswordHash = bcrypt.hashSync(
    'dummy-password-for-imap-users',
    10
  );
  const fallbackPasswordHash = bcrypt.hashSync('password123', 10);
  const createNameFromEmail = (email) => {
    return email
      .split('@')[0]
      .replace('-', ' ')
      .split('.')
      .map((namePart) => namePart.charAt(0).toUpperCase() + namePart.slice(1))
      .join(' ');
  };
  await prisma.user.deleteMany({});
  console.log('Deleted old users.');
  const usersToSeed = [
    { email: 'fitra', role: 'op_prov' },
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
    { email: 'prasaja@bps.go.id', role: 'op_satker', kodeSatker: '7501' },
    { email: 'riswan.kalai@bps.go.id', role: 'op_satker', kodeSatker: '7501' },
    { email: 'maryam.moito@bps.go.id', role: 'op_satker', kodeSatker: '7501' },
    { email: 'harim@bps.go.id', role: 'op_satker', kodeSatker: '7503' },
    {
      email: 'khumaidi.subkhi@bps.go.id',
      role: 'op_satker',
      kodeSatker: '7503',
    },
    { email: 'aurumnuranisa@bps.go.id', role: 'op_satker', kodeSatker: '7503' },
    { email: 'suparno@bps.go.id', role: 'viewer', kodeSatker: '7502' },
    { email: 'riane@bps.go.id', role: 'op_satker', kodeSatker: '7502' },
    { email: 'rahman.kue@bps.go.id', role: 'op_satker', kodeSatker: '7502' },
    { email: 'asaef@bps.go.id', role: 'viewer', kodeSatker: '7504' },
    {
      email: 'desilestariutami@bps.go.id',
      role: 'op_satker',
      kodeSatker: '7504',
    },
    { email: 'marlena.agus@bps.go.id', role: 'op_satker', kodeSatker: '7504' },
    { email: 'depit@bps.go.id', role: 'viewer', kodeSatker: '7505' },
    { email: 'aziz@bps.go.id', role: 'op_satker', kodeSatker: '7505' },
    { email: 'dewi.mono@bps.go.id', role: 'viewer', kodeSatker: '7571' },
    {
      email: 'nining.igirisa@bps.go.id',
      role: 'op_satker',
      kodeSatker: '7571',
    },
    { email: 'clara.aulia@bps.go.id', role: 'op_satker', kodeSatker: '7571' },
  ];
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
  await prisma.user.create({
    data: {
      email: 'prov.local@bps.go.id',
      name: 'Admin Provinsi (Lokal)',
      password: fallbackPasswordHash,
      role: 'op_prov',
    },
  });
  console.log(`Created local fallback user (op_prov): prov.local@bps.go.id`);
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

// Seeds SPM data specifically for testing the SAKTI validation feature
async function seedSpms() {
  console.log(
    'Seeding SPMs based on the SAKTI report for validation testing...'
  );

  await prisma.spm.deleteMany({});
  console.log('Deleted old SPMs.');

  const boalemoSatker = await prisma.satker.findUnique({
    where: { kodeSatker: '7501' },
  });
  const gorontaloSatker = await prisma.satker.findUnique({
    where: { kodeSatker: '7502' },
  });

  if (!boalemoSatker || !gorontaloSatker) {
    console.error(
      '⚠️ Cannot seed SPMs. Please ensure Satkers 7501 and 7502 exist.'
    );
    return;
  }

  // --- THE FIX IS HERE: Using the exact 'Jenis' names from flags.csv ---
  const kodeAkun521811 = await prisma.kodeAkun.findUnique({
    where: { kode_nama: { kode: '521811', nama: 'Barang Persediaan' } },
  });
  const kodeAkun524111 = await prisma.kodeAkun.findUnique({
    where: { kode_nama: { kode: '524111', nama: 'Perjadin Biasa' } },
  });
  // Using a different account for the "match" test that exists in flags.csv
  const kodeAkun522151 = await prisma.kodeAkun.findUnique({
    where: { kode_nama: { kode: '522151', nama: 'Jasa Profesi' } },
  });

  if (!kodeAkun521811 || !kodeAkun524111 || !kodeAkun522151) {
    console.error(
      '⚠️ Could not find one or more required KodeAkun records. Check the "Jenis" column in flags.csv and ensure the names match exactly.'
    );
    return;
  }

  // EXAMPLE 1: MISMATCH
  await prisma.spm.create({
    data: {
      nomorSpm: 'SPM/TEST/7501/001',
      tahunAnggaran: 2025,
      tanggal: new Date('2025-09-10'),
      totalAnggaran: 2500000,
      status: 'DITERIMA',
      satkerId: boalemoSatker.id,
      rincian: {
        create: [
          {
            kodeProgram: 'GG.2897',
            kodeKegiatan: 'BMA.004',
            kodeAkun: { connect: { id: kodeAkun521811.id } },
            jumlah: 2500000, // INTENTIONALLY DIFFERENT from SAKTI's 2,303,000
            kodeKRO: '054',
            kodeRO: '0A',
            kodeKomponen: '052',
            kodeSubkomponen: 'A',
            uraian: 'Pencetakan publikasi DDA dan BRS',
          },
        ],
      },
    },
  });
  console.log('✅ Created SPM/TEST/7501/001 (for mismatch test).');

  // EXAMPLE 2: PERFECT MATCH (Using a different, valid account)
  // SAKTI Report has a realization of 2,700,000 for "Honor Narasumber Eselon III"
  await prisma.spm.create({
    data: {
      nomorSpm: 'SPM/TEST/7502/002',
      tahunAnggaran: 2025,
      tanggal: new Date('2025-09-15'),
      totalAnggaran: 2700000,
      status: 'DITERIMA',
      satkerId: gorontaloSatker.id,
      rincian: {
        create: [
          {
            kodeProgram: 'WA.2886', // Matching program from SAKTI
            kodeKegiatan: 'EBD.961', // Matching kegiatan from SAKTI
            kodeAkun: { connect: { id: kodeAkun522151.id } }, // Use specific ID
            jumlah: 2700000, // PERFECT MATCH
            kodeKRO: '051',
            kodeRO: '0A',
            kodeKomponen: '051',
            kodeSubkomponen: 'A',
            uraian: 'Honor Narasumber Eselon III',
          },
        ],
      },
    },
  });
  console.log('✅ Created SPM/TEST/7502/002 (for perfect match test).');

  // EXAMPLE 3: ZERO REALIZATION MATCH
  await prisma.spm.create({
    data: {
      nomorSpm: 'SPM/TEST/7501/003',
      tahunAnggaran: 2025,
      tanggal: new Date('2025-09-20'),
      totalAnggaran: 0,
      status: 'MENUNGGU',
      satkerId: boalemoSatker.id,
      rincian: {
        create: [
          {
            kodeProgram: 'GG.2896',
            kodeKegiatan: 'BMA.004',
            kodeAkun: { connect: { id: kodeAkun524111.id } }, // Use specific ID
            jumlah: 0,
            kodeKRO: '052',
            kodeRO: '0A',
            kodeKomponen: '052',
            kodeSubkomponen: 'A',
            uraian: 'Perjalanan dinas supervisi ke Kabkot',
          },
        ],
      },
    },
  });
  console.log('✅ Created SPM/TEST/7501/003 (for zero-realization test).');
}

// Main function to run all seeders
async function main() {
  console.log('Start seeding ...');

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

  await seedUsers();
  await seedFromCSV();
  await seedSpms();

  console.log('🚀 Seeding finished.');
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

// const fs = require('fs');
// const csv = require('csv-parser');
// const bcrypt = require('bcryptjs');
// const { PrismaClient } = require('../generated/prisma');

// const prisma = new PrismaClient();

// // (Fungsi normalizeFlagValue dan seedFromCSV tidak berubah)
// function normalizeFlagValue(value) {
//   if (!value) return null;
//   const val = value.trim().toLowerCase();
//   if (val === 'ya') return 'IYA';
//   if (val === 'tidak') return 'TIDAK';
//   if (val === 'ya/tidak') return 'IYA_TIDAK';
//   return null;
// }

// async function seedFromCSV() {
//   console.log('Reading flags.csv and seeding KodeAkun and Flags...');
//   const filePath = 'prisma/flags.csv';
//   const rows = [];

//   return new Promise((resolve, reject) => {
//     fs.createReadStream(filePath)
//       .pipe(csv({ separator: ',', mapHeaders: ({ header }) => header.trim() }))
//       .on('data', (row) => rows.push(row))
//       .on('end', async () => {
//         try {
//           for (const r of rows) {
//             const kode = r['Kode Akun'];
//             const nama = r['Jenis'];
//             if (!kode || !nama) continue;

//             const kodeAkun = await prisma.kodeAkun.upsert({
//               where: { kode_nama: { kode: kode.toString(), nama } },
//               update: {},
//               create: { kode: kode.toString(), nama },
//             });

//             for (const [colName, value] of Object.entries(r)) {
//               if (['Kode Akun', 'Jenis'].includes(colName)) continue;
//               const tipe = normalizeFlagValue(value);
//               if (!tipe || tipe === 'TIDAK') continue;

//               await prisma.flag.upsert({
//                 where: {
//                   kodeAkunId_nama: { kodeAkunId: kodeAkun.id, nama: colName },
//                 },
//                 update: { tipe },
//                 create: { nama: colName, tipe, kodeAkunId: kodeAkun.id },
//               });
//             }
//           }
//           console.log('✅ KodeAkun & Flag seeding complete!');
//           resolve();
//         } catch (err) {
//           console.error('Error during CSV seeding:', err);
//           reject(err);
//         }
//       })
//       .on('error', reject);
//   });
// }

// // --- FUNGSI SEED USERS YANG DIPERBARUI SECARA TOTAL ---
// async function seedUsers() {
//   console.log('Seeding all users...');

//   // Password placeholder untuk akun IMAP (tidak akan pernah digunakan untuk login)
//   const dummyPasswordHash = bcrypt.hashSync(
//     'dummy-password-for-imap-users',
//     10
//   );
//   // Password asli untuk akun fallback lokal
//   const fallbackPasswordHash = bcrypt.hashSync('password123', 10);

//   // Helper untuk membuat nama dari email
//   const createNameFromEmail = (email) => {
//     return email
//       .split('@')[0]
//       .replace('-', ' ')
//       .split('.')
//       .map((namePart) => namePart.charAt(0).toUpperCase() + namePart.slice(1))
//       .join(' ');
//   };

//   // Hapus semua user lama untuk memastikan data bersih
//   await prisma.user.deleteMany({});
//   console.log('Deleted old users.');

//   const usersToSeed = [
//     // OP PROVINSI
//     { email: 'fitra', role: 'op_prov' },
//     { email: 'fahrudin.amir@bps.go.id', role: 'op_prov' },
//     { email: 'alwi@bps.go.id', role: 'op_prov' },
//     { email: 'ismail.duma@bps.go.id', role: 'op_prov' },
//     { email: 'Cindra.datau@bps.go.id', role: 'op_prov' },
//     { email: 'insen.kalay@bps.go.id', role: 'op_prov' },
//     { email: 'wahidin@bps.go.id', role: 'op_prov' },
//     { email: 'dwieyogo.ahmad@bps.go.id', role: 'op_prov' },
//     { email: 'deisy@bps.go.id', role: 'op_prov' },
//     { email: 'kasman@bps.go.id', role: 'op_prov' },
//     { email: 'azisr@bps.go.id', role: 'op_prov' },
//     { email: 'ismaildaud-pppk@bps.go.id', role: 'op_prov' },
//     { email: 'wirast@bps.go.id', role: 'op_prov' },
//     { email: 'sgani@bps.go.id', role: 'op_prov' },
//     { email: 'sity@bps.go.id', role: 'op_prov' },
//     { email: 'sri.sindika@bps.go.id', role: 'op_prov' },
//     { email: 'dewiaboka-pppk@bps.go.id', role: 'op_prov' },
//     { email: 'sulistia.pakaya@bps.go.id', role: 'op_prov' },
//     { email: 'adeiman@bps.go.id', role: 'op_prov' },
//     { email: 'nurlaila@bps.go.id', role: 'op_prov' },
//     { email: 'lia.rizky@bps.go.id', role: 'op_prov' },
//     { email: 'sri.wandari@bps.go.id', role: 'op_prov' },
//     { email: 'vivialida-pppk@bps.go.id', role: 'op_prov' },
//     { email: 'khusni.robiah@bps.go.id', role: 'op_prov' },
//     { email: 'rodyah.mulyani@bps.go.id', role: 'op_prov' },
//     // BPS BOALEMO 7501
//     { email: 'prasaja@bps.go.id', role: 'op_satker', kodeSatker: '7501' },
//     { email: 'riswan.kalai@bps.go.id', role: 'op_satker', kodeSatker: '7501' },
//     { email: 'maryam.moito@bps.go.id', role: 'op_satker', kodeSatker: '7501' },
//     // BPS POHUWATO 7503
//     { email: 'harim@bps.go.id', role: 'op_satker', kodeSatker: '7503' },
//     {
//       email: 'khumaidi.subkhi@bps.go.id',
//       role: 'op_satker',
//       kodeSatker: '7503',
//     },
//     { email: 'aurumnuranisa@bps.go.id', role: 'op_satker', kodeSatker: '7503' },
//     // BPS KABGOR 7502
//     { email: 'suparno@bps.go.id', role: 'viewer', kodeSatker: '7502' },
//     { email: 'riane@bps.go.id', role: 'op_satker', kodeSatker: '7502' },
//     { email: 'rahman.kue@bps.go.id', role: 'op_satker', kodeSatker: '7502' },
//     // BPS BONEBOLANGO 7504
//     { email: 'asaef@bps.go.id', role: 'viewer', kodeSatker: '7504' },
//     {
//       email: 'desilestariutami@bps.go.id',
//       role: 'op_satker',
//       kodeSatker: '7504',
//     },
//     { email: 'marlena.agus@bps.go.id', role: 'op_satker', kodeSatker: '7504' },
//     // BPS GORUT 7505
//     { email: 'depit@bps.go.id', role: 'viewer', kodeSatker: '7505' },
//     { email: 'aziz@bps.go.id', role: 'op_satker', kodeSatker: '7505' },
//     // BPS KOTA 7571
//     { email: 'dewi.mono@bps.go.id', role: 'viewer', kodeSatker: '7571' },
//     {
//       email: 'nining.igirisa@bps.go.id',
//       role: 'op_satker',
//       kodeSatker: '7571',
//     },
//     { email: 'clara.aulia@bps.go.id', role: 'op_satker', kodeSatker: '7571' },
//   ];

//   // Seed semua pengguna IMAP
//   for (const userData of usersToSeed) {
//     const username = userData.email.split('@')[0].toLowerCase();
//     let satkerId = null;
//     if (userData.kodeSatker) {
//       const satker = await prisma.satker.findUnique({
//         where: { kodeSatker: userData.kodeSatker },
//       });
//       if (satker) satkerId = satker.id;
//     }
//     await prisma.user.create({
//       data: {
//         email: username,
//         name: createNameFromEmail(username),
//         password: dummyPasswordHash,
//         role: userData.role,
//         satkerId,
//       },
//     });
//   }
//   console.log(`✅ Seeded ${usersToSeed.length} IMAP users.`);

//   // --- Seed Akun Fallback Lokal ---
//   // 1. Fallback OP PROV
//   await prisma.user.create({
//     data: {
//       email: 'prov.local@bps.go.id',
//       name: 'Admin Provinsi (Lokal)',
//       password: fallbackPasswordHash,
//       role: 'op_prov',
//     },
//   });
//   console.log(`Created local fallback user (op_prov): prov.local@bps.go.id`);

//   // 2. Fallback OP SATKER
//   const fallbackSatker = await prisma.satker.findUnique({
//     where: { kodeSatker: '7501' },
//   });
//   if (fallbackSatker) {
//     await prisma.user.create({
//       data: {
//         email: 'satker.local@bps.go.id',
//         name: 'Admin Satker (Lokal)',
//         password: fallbackPasswordHash,
//         role: 'op_satker',
//         satkerId: fallbackSatker.id,
//       },
//     });
//     console.log(
//       `Created local fallback user (op_satker): satker.local@bps.go.id`
//     );
//   }

//   console.log('✅ User seeding complete!');
// }

// async function seedSpms() {
//   console.log('Seeding many SPMs for pagination demo...');

//   // 1. Hapus semua SPM, Rincian, dan JawabanFlag yang lama
//   // onDelete: Cascade akan menghapus data terkait secara otomatis
//   await prisma.spm.deleteMany({});
//   console.log('Deleted old SPMs.');

//   // 2. Ambil data master yang dibutuhkan untuk membuat relasi
//   const satkers = await prisma.satker.findMany();
//   const kodeAkuns = await prisma.kodeAkun.findMany({
//     include: { templateFlags: true },
//   });

//   if (satkers.length === 0 || kodeAkuns.length === 0) {
//     console.error(
//       '⚠️ Cannot seed SPMs. Please seed Satkers and KodeAkuns first.'
//     );
//     return;
//   }

//   // 3. Loop untuk membuat 50 SPM
//   for (let i = 1; i <= 50; i++) {
//     const randomSatker = satkers[Math.floor(Math.random() * satkers.length)];
//     const randomStatus = ['MENUNGGU', 'DITOLAK', 'DITERIMA'][
//       Math.floor(Math.random() * 3)
//     ];
//     const randomDate = new Date(
//       2024,
//       Math.floor(Math.random() * 12),
//       Math.floor(Math.random() * 28) + 1
//     );

//     let rincianToCreate = [];
//     let totalAnggaranSpm = 0;

//     // Buat 1 sampai 5 rincian acak untuk setiap SPM
//     const rincianCount = Math.floor(Math.random() * 5) + 1;
//     for (let j = 0; j < rincianCount; j++) {
//       const randomKodeAkun =
//         kodeAkuns[Math.floor(Math.random() * kodeAkuns.length)];
//       const randomJumlah = Math.floor(Math.random() * 9500000) + 500000;
//       totalAnggaranSpm += randomJumlah;

//       // Buat jawaban flag acak untuk rincian ini
//       const jawabanFlagsToCreate = randomKodeAkun.templateFlags.map((flag) => {
//         const options = ['IYA', 'TIDAK'];
//         if (flag.tipe === 'IYA_TIDAK') options.push('IYA_TIDAK');
//         return {
//           nama: flag.nama,
//           tipe: options[Math.floor(Math.random() * options.length)],
//         };
//       });

//       rincianToCreate.push({
//         kodeProgram: `054.01.${String(
//           Math.floor(Math.random() * 90) + 10
//         ).padStart(2, '0')}`,
//         kodeKegiatan: String(Math.floor(Math.random() * 9000) + 1000),
//         kodeAkun: { connect: { id: randomKodeAkun.id } },
//         jumlah: randomJumlah,
//         kodeKRO: String(Math.floor(Math.random() * 900) + 100),
//         kodeRO: String(Math.floor(Math.random() * 900) + 100),
//         kodeKomponen: '002',
//         kodeSubkomponen: 'A',
//         uraian: `Pembayaran demo untuk rincian ke-${j + 1}`,
//         jawabanFlags: {
//           create: jawabanFlagsToCreate,
//         },
//       });
//     }

//     // 4. Buat SPM beserta semua rinciannya
//     await prisma.spm.create({
//       data: {
//         nomorSpm: `SPM/DEMO/${randomSatker.kodeSatker}/${String(i).padStart(
//           3,
//           '0'
//         )}`,
//         tahunAnggaran: 2024,
//         tanggal: randomDate,
//         totalAnggaran: totalAnggaranSpm,
//         status: randomStatus,
//         satker: { connect: { id: randomSatker.id } },
//         rincian: {
//           create: rincianToCreate,
//         },
//       },
//     });
//   }

//   console.log(`✅ Created 50 new demo SPMs.`);
// }

// // Fungsi utama untuk menjalankan semua seeder
// async function main() {
//   console.log('Start seeding ...');

//   // 1. Seed Satker
//   await prisma.satker.createMany({
//     data: [
//       { kodeSatker: '7501', nama: 'BPS Kab. Boalemo', eselon: '3' },
//       { kodeSatker: '7502', nama: 'BPS Kab. Gorontalo', eselon: '3' },
//       { kodeSatker: '7503', nama: 'BPS Kab. Pohuwato', eselon: '3' },
//       { kodeSatker: '7504', nama: 'BPS Kab. Bone Bolango', eselon: '3' },
//       { kodeSatker: '7505', nama: 'BPS Kab. Gorontalo Utara', eselon: '3' },
//       { kodeSatker: '7571', nama: 'BPS Kota Gorontalo', eselon: '3' },
//     ],
//     skipDuplicates: true,
//   });
//   console.log('✅ Satker seeding complete.');

//   // 2. Panggil fungsi seedUsers yang baru
//   await seedUsers();

//   // 3. Panggil fungsi seed dari CSV
//   await seedFromCSV();
//   await seedSpms();

//   console.log('🚀 Seeding finished.');
// }

// // Eksekusi
// main()
//   .then(async () => await prisma.$disconnect())
//   .catch(async (e) => {
//     console.error(e);
//     await prisma.$disconnect();
//     process.exit(1);
//   });
