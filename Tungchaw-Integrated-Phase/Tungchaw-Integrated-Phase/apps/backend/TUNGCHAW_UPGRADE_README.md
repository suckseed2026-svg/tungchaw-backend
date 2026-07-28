# Tungchaw integrated backend update

This package is based on the uploaded `Tungchaw(3).zip` backend and excludes `.env`, `.git`, `node_modules`, and `dist`.

## Included changes

- Business industry selection during business creation.
- One-to-one business inventory configuration with industry defaults.
- Product tracking options for batch, expiry, FEFO, expired-sale blocking, purchase requirements, and serial numbers.
- New products inherit the selected business defaults while allowing per-product overrides.
- Tenant-scoped Expense Categories module.
- Tenant-scoped Expenses module with branch/category validation, filtering, pagination, Swagger, RBAC, and soft deactivation.
- New expense permissions and idempotent seed data.
- Backward-compatible Prisma migration with configuration backfill for existing businesses.

## Apply

1. Back up the database.
2. Copy `.env.example` to `.env` and fill local values.
3. Run:

```powershell
npm install
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
npm run build
```

## Important

The migration uses PostgreSQL `gen_random_uuid()` for the existing-business configuration backfill. PostgreSQL 13+ includes this function in standard installations. Test the migration on a non-production database first.
