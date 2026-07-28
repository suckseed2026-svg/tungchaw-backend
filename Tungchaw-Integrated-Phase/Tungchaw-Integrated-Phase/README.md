# Tungchaw Integrated Phase Package

## Structure

- `apps/backend` — latest uploaded Tungchaw backend, upgraded with business-industry configuration, product tracking defaults, Expense Categories, and Expenses.
- `apps/frontend` — the uploaded frontend source, cleaned of dependencies and build output.
- `reference/flutter-barcode-billing-inspiration` — the uploaded Flutter project retained as a design/reference project; it is not compiled into the Tungchaw application.
- `docs` — architecture reference documents from the uploaded monorepo.

## Backend setup

```powershell
cd apps\backend
Copy-Item .env.example .env
npm install
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
npm run build
npm run start:dev
```

## Security cleanup

The package excludes `.env`, `.git`, `node_modules`, `dist`, and the uploaded frontend JSON database. Do not copy secrets from the original archive.

## Database changes

Migration: `20260727090000_add_business_configuration_and_expenses`

Always test the migration against a development database and back up production data first.
