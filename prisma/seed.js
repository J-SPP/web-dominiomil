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

  const crypto = require('crypto');
  const rawApiKey = 'spp_live_' + crypto.randomBytes(24).toString('hex');
  const hashedApiKey = crypto.createHash('sha256').update(rawApiKey).digest('hex');

  await prisma.websiteApiKey.upsert({
    where: {
      websiteId_name: {
        websiteId: adminUser.id,
        name: 'Default API Key'
      }
    },
    update: {
      keyHash: hashedApiKey,
    },
    create: {
      websiteId: adminUser.id,
      name: 'Default API Key',
      keyHash: hashedApiKey,
    }
  });

  console.log(`Admin account seeded successfully:`);
  console.log(`- Domain: ${adminUser.domain}`);
  console.log(`- Default Password: ${defaultPassword}`);
  console.log(`- Role: ${adminUser.role}`);
  console.log(`- Main website (spplabs.es) API Key: ${rawApiKey}`);
  console.log(`  (Note: Save this key in the .env of spplabs.es as API_KEY)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
