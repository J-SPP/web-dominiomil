import { PrismaClient } from '@prisma/client';

const globalForPrisma = global;

const baseDb = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = baseDb;

export const db = baseDb.$extends({
  client: {
    async withTenant(websiteId, callback) {
      if (!websiteId) {
        throw new Error('withTenant requires a websiteId');
      }
      return await baseDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.bypass_rls = 'off';`);
        await tx.$executeRawUnsafe(`SET LOCAL app.current_website_id = '${websiteId}';`);
        return await callback(tx);
      });
    },
    async withAdmin(callback) {
      return await baseDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.bypass_rls = 'on';`);
        await tx.$executeRawUnsafe(`SET LOCAL app.current_website_id = '';`);
        return await callback(tx);
      });
    }
  }
});

