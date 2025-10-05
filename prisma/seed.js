const fs = require('fs');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');
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
    // OP PROVINSI
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

// COMBINED SPM SEEDER
async function seedAllSpms() {
  await prisma.spm.deleteMany({});
  console.log('Deleted old SPMs.');
  await seedSpecificSpmsForValidation();
  await seedRandomSpmsForPagination();
}

async function seedSpecificSpmsForValidation() {
  console.log('Seeding specific SPMs for SAKTI validation testing...');

  const boalemoSatker = await prisma.satker.findUnique({
    where: { kodeSatker: '7501' },
  });
  const gorontaloSatker = await prisma.satker.findUnique({
    where: { kodeSatker: '7502' },
  });

  if (!boalemoSatker || !gorontaloSatker) {
    console.error(
      '⚠️ Cannot seed validation SPMs. Please ensure Satkers 7501 and 7502 exist.'
    );
    return;
  }

  const kodeAkun521811 = await prisma.kodeAkun.findUnique({
    where: { kode_nama: { kode: '521811', nama: 'Barang Persediaan' } },
  });
  const kodeAkun524111 = await prisma.kodeAkun.findUnique({
    where: { kode_nama: { kode: '524111', nama: 'Perjadin Biasa' } },
  });
  const kodeAkun522151 = await prisma.kodeAkun.findUnique({
    where: { kode_nama: { kode: '522151', nama: 'Jasa Profesi' } },
  });

  if (!kodeAkun521811 || !kodeAkun524111 || !kodeAkun522151) {
    console.error(
      '⚠️ Could not find one or more required KodeAkun records for validation seeding. Check flags.csv.'
    );
    return;
  }

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
            jumlah: 2500000,
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
            kodeProgram: 'WA.2886',
            kodeKegiatan: 'EBD.961',
            kodeAkun: { connect: { id: kodeAkun522151.id } },
            jumlah: 2700000,
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
            kodeAkun: { connect: { id: kodeAkun524111.id } },
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
  console.log('✅ Created 3 specific SPMs for validation.');
}

async function seedRandomSpmsForPagination() {
  console.log('Seeding 50 random SPMs for pagination demo...');

  const satkers = await prisma.satker.findMany();
  const kodeAkuns = await prisma.kodeAkun.findMany({
    include: { templateFlags: true },
  });

  if (satkers.length === 0 || kodeAkuns.length === 0) {
    console.error(
      '⚠️ Cannot seed random SPMs. Please seed Satkers and KodeAkuns first.'
    );
    return;
  }

  for (let i = 1; i <= 50; i++) {
    const randomSatker = satkers[Math.floor(Math.random() * satkers.length)];
    const randomStatus = ['MENUNGGU', 'DITOLAK', 'DITERIMA'][
      Math.floor(Math.random() * 3)
    ];
    const randomDate = new Date(
      2025,
      Math.floor(Math.random() * 12),
      Math.floor(Math.random() * 28) + 1
    );

    let rincianToCreate = [];
    let totalAnggaranSpm = 0;
    const rincianCount = Math.floor(Math.random() * 3) + 1;

    for (let j = 0; j < rincianCount; j++) {
      const randomKodeAkun =
        kodeAkuns[Math.floor(Math.random() * kodeAkuns.length)];
      const randomJumlah = Math.floor(Math.random() * 950000) + 50000;
      totalAnggaranSpm += randomJumlah;

      // --- THE FIX IS HERE: Introduce randomness for completeness percentage ---
      const jawabanFlagsToCreate = randomKodeAkun.templateFlags.map((flag) => {
        let tipeJawaban = 'IYA';
        // 10% chance to make a flag 'TIDAK' to create incomplete SPMs
        if (Math.random() < 0.1) {
          tipeJawaban = 'TIDAK';
        }
        return {
          nama: flag.nama,
          tipe: tipeJawaban,
        };
      });

      rincianToCreate.push({
        kodeProgram: `054.01.XX`,
        kodeKegiatan: `ABCD`,
        kodeAkun: { connect: { id: randomKodeAkun.id } },
        jumlah: randomJumlah,
        kodeKRO: 'XYZ',
        kodeRO: 'XX',
        kodeKomponen: '001',
        kodeSubkomponen: 'A',
        uraian: `Pembayaran demo acak #${i}-${j + 1}`,
        jawabanFlags: { create: jawabanFlagsToCreate },
      });
    }

    await prisma.spm.create({
      data: {
        nomorSpm: `SPM/RANDOM/${randomSatker.kodeSatker}/${String(i).padStart(
          3,
          '0'
        )}`,
        tahunAnggaran: 2025,
        tanggal: randomDate,
        totalAnggaran: totalAnggaranSpm,
        status: randomStatus,
        satker: { connect: { id: randomSatker.id } },
        rincian: { create: rincianToCreate },
      },
    });
  }

  console.log(`✅ Created 50 new random SPMs for pagination.`);
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
  await seedAllSpms();

  console.log('🚀 Seeding finished.');
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
