const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function main() {
  const adminDomain = 'spplabs.es';
  const defaultPassword = 'adminpassword123';
  
  // Hash the default admin password
  const passwordHash = await argon2.hash(defaultPassword, {
    type: argon2.argon2id,
  });

  console.log(`Seeding database...`);

  const adminUser = await prisma.website.upsert({
    where: { domain: adminDomain },
    update: {
      displayName: 'SPP Labs Admin',
      passwordHash: passwordHash,
      role: 'ADMIN',
    },
    create: {
      domain: adminDomain,
      displayName: 'SPP Labs Admin',
      passwordHash: passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`Admin account seeded successfully:`);
  console.log(`- Domain: ${adminUser.domain}`);
  console.log(`- Default Password: ${defaultPassword}`);
  console.log(`- Role: ${adminUser.role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
