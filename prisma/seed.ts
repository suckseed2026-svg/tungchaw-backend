import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { permissionSeedData } from './data/permissions';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the database seed');
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

async function seedPermissions(): Promise<void> {
  console.log('Seeding permissions...');

  for (const permission of permissionSeedData) {
    await prisma.permission.upsert({
      where: {
        code: permission.code,
      },
      update: {
        name: permission.name,
        category: permission.category,
        description: permission.description,
        isActive: true,
      },
      create: {
        code: permission.code,
        name: permission.name,
        category: permission.category,
        description: permission.description,
        isActive: true,
      },
    });
  }

  console.log(
    `Seeded ${permissionSeedData.length} permission records successfully.`,
  );
}

async function assignPermissionsToExistingOwnerRoles(): Promise<void> {
  console.log('Assigning permissions to existing Owner roles...');

  const permissions = await prisma.permission.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  const ownerRoles = await prisma.role.findMany({
    where: {
      code: 'OWNER',
      isSystem: true,
      isActive: true,
    },
    select: {
      id: true,
      businessId: true,
    },
  });

  if (ownerRoles.length === 0) {
    console.log(
      'No existing Owner roles were found. New businesses will receive permissions during onboarding.',
    );
    return;
  }

  for (const ownerRole of ownerRoles) {
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: ownerRole.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });

    console.log(
      `Assigned ${permissions.length} permissions to Owner role for business ${ownerRole.businessId}.`,
    );
  }
}

async function main(): Promise<void> {
  await seedPermissions();
  await assignPermissionsToExistingOwnerRoles();
}

main()
  .catch((error: unknown) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });