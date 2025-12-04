// cleanup_dummy.js

// Adjust the path if your generated client is elsewhere
// Based on your seed.js, it seems to be in generated/prisma
const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting cleanup of Dummy SPMs...');

  try {
    // 1. Count them first (Optional, just for info)
    const countDemo = await prisma.spm.count({
      where: {
        OR: [
          { nomorSpm: { startsWith: 'SPM/TEST/' } },
          { nomorSpm: { startsWith: 'SPM/RANDOM/' } },
        ],
      },
    });

    console.log(`Found ${countDemo} dummy/random SPMs to delete.`);

    if (countDemo === 0) {
      console.log('No dummy data found. Exiting.');
      return;
    }

    // 2. Delete them
    const deleted = await prisma.spm.deleteMany({
      where: {
        OR: [
          // Matches the format from seedSpecificSpmsForValidation()
          { nomorSpm: { startsWith: 'SPM/TEST/' } },
          // Matches the format from seedRandomSpmsForPagination()
          { nomorSpm: { startsWith: 'SPM/RANDOM/' } },
        ],
      },
    });

    console.log(`✅ Successfully deleted ${deleted.count} SPMs.`);
    console.log(
      'Real user data (SPMs not starting with SPM/TEST or SPM/RANDOM) remains untouched.'
    );
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
