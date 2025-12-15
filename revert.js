const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

// Configuration
const TARGET_KODE_SATKER = '7501'; // Boalemo (The wrong satker)
const TAHUN_ANGGARAN = 2025;

// Data extracted from "SIPANDA RAW - NEWEST.xlsx"
// Format: { no: 'Nomor SPM', amount: Total Anggaran }
const spmDataToDelete = [
  { no: '00005A', amount: 1215450 },
  { no: '00006A', amount: 5953256 },
  { no: '00007A', amount: 37548700 },
  { no: '00008A', amount: 4745250 },
  { no: '00010A', amount: 12542387 },
  { no: '00011A', amount: 9650998 },
  { no: '00012A', amount: 9415000 },
  { no: '00013A', amount: 2146000 },
  { no: '00014A', amount: 2256000 },
  { no: '00015A', amount: 432000 },
  { no: '00016A', amount: 1452000 },
  { no: '00017A', amount: 855000 },
  { no: '00018A', amount: 5784000 },
  { no: '00019A', amount: 1696000 },
  { no: '00020A', amount: 960000 },
  { no: '00021A', amount: 370000 },
  { no: '00022A', amount: 1898100 },
  { no: '00023A', amount: 5225858 },
  { no: '00024A', amount: 1215450 },
  { no: '00029A', amount: 4252000 },
  { no: '00030A', amount: 1520000 },
  { no: '00032A', amount: 1992000 },
  { no: '00033A', amount: 1815000 },
  { no: '00034A', amount: 355000 },
  { no: '00035A', amount: 3163000 },
  { no: '00037A', amount: 9130000 },
  { no: '00039A', amount: 2256000 },
  { no: '00040A', amount: 2146000 },
  { no: '00043A', amount: 12542387 },
  { no: '00044A', amount: 9650998 },
  { no: '00045A', amount: 5784000 },
  { no: '00046A', amount: 6600000 },
  { no: '00047A', amount: 10234000 },
  { no: '00048A', amount: 72832000 },
  { no: '00049A', amount: 3712000 },
  { no: '00050A', amount: 371000 },
  { no: '00059A', amount: 1215450 },
  { no: '00060A', amount: 4644815 },
  { no: '00061A', amount: 14794000 },
  { no: '00062A', amount: 2142000 },
  { no: '00066A', amount: 9471889 },
  { no: '00067A', amount: 6314593 },
  { no: '00068A', amount: 2146000 },
  { no: '00069A', amount: 2256000 },
  { no: '00070A', amount: 437000 },
  { no: '00071A', amount: 2574000 },
  { no: '00072A', amount: 200000 },
  { no: '00074A', amount: 1140000 },
  { no: '00075A', amount: 7764000 },
  { no: '00076A', amount: 646000 },
  { no: '00077A', amount: 12542387 },
  { no: '00078A', amount: 9650998 },
  { no: '00079A', amount: 4553041 },
  { no: '00080A', amount: 1215450 },
  { no: '00087A', amount: 1452000 },
  { no: '00088A', amount: 3751500 },
  { no: '00089A', amount: 2146000 },
  { no: '00090A', amount: 2256000 },
  { no: '00091A', amount: 629000 },
  { no: '00093A', amount: 910000 },
  { no: '00095A', amount: 4455000 },
  { no: '00096A', amount: 7764000 },
  { no: '00097A', amount: 1660000 },
  { no: '00111A', amount: 2146000 },
  { no: '00112A', amount: 2256000 },
  { no: '00113A', amount: 1452000 },
  { no: '00119A', amount: 9650998 },
  { no: '00120A', amount: 12542387 },
  { no: '00121A', amount: 3728000 },
  { no: '00125A', amount: 1715000 },
  { no: '00126A', amount: 7764000 },
  { no: '00128A', amount: 3770000 },
  { no: '00129A', amount: 1390000 },
  { no: '00130A', amount: 949050 },
];

async function undoImportSafe() {
  console.log(`🔍 Verifying Satker ID for Kode: ${TARGET_KODE_SATKER}...`);

  const satker = await prisma.satker.findUnique({
    where: { kodeSatker: TARGET_KODE_SATKER },
  });

  if (!satker) {
    console.error(`❌ Satker with kode ${TARGET_KODE_SATKER} not found!`);
    return;
  }

  console.log(`✅ Target Satker: ${satker.nama} (ID: ${satker.id})`);
  console.log(
    `🎯 Processing ${spmDataToDelete.length} items for SAFE deletion...`
  );

  let deletedCount = 0;
  let skippedCount = 0;

  for (const item of spmDataToDelete) {
    // STRICT DELETION: Must match Satker + Tahun + Nomor + Amount
    const deleted = await prisma.spm.deleteMany({
      where: {
        satkerId: satker.id,
        tahunAnggaran: TAHUN_ANGGARAN,
        nomorSpm: item.no,
        totalAnggaran: item.amount, // <--- This is the safety key!
      },
    });

    if (deleted.count > 0) {
      deletedCount += deleted.count;
      console.log(`   Deleted: ${item.no} (Rp ${item.amount})`);
    } else {
      skippedCount++;
      // console.log(`   Skipped: ${item.no} (Not found or amount mismatch)`);
    }
  }

  console.log(`\n===========================================`);
  console.log(`🗑️  CLEANUP REPORT`);
  console.log(`===========================================`);
  console.log(`Successfully Deleted : ${deletedCount} SPMs`);
  console.log(`Skipped (Not Found)  : ${skippedCount} SPMs`);
  console.log(`Target Satker        : ${satker.nama}`);
  console.log(
    `\nNote: Any existing SPM with the same number but DIFFERENT amount was preserved.`
  );
}

undoImportSafe()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
