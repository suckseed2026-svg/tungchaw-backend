# Tungchaw Frontend

Official responsive web frontend for the Tungchaw Business Suite.

## Run on Windows PowerShell

```powershell
npm install
Copy-Item .env.example .env
npm run build
npm run dev
```

Open the URL shown by Vite. The API defaults to `http://localhost:3000/api`.

## Backend alignment

The frontend is aligned with the uploaded NestJS backend routes for authentication, businesses, branches, products, categories, brands, units, sales, sales returns, customers, suppliers, purchases, purchase returns, expenses, inventory batches, adjustments, transfers and dashboard reports.

Employee invitation, device approval and role-management screens are included, but the uploaded backend does not expose those routes yet. Those pages therefore show local preview data until the backend modules are added.

## Mobile / APK

The interface is responsive and ready to wrap with Capacitor after web integration is verified. An APK is not included in this archive because Android signing and SDK compilation must happen after API testing.
