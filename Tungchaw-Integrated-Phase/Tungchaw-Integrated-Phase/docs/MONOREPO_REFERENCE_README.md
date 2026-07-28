# Tungchaw Business Suite Monorepo

One repository for the Tungchaw NestJS API, React/Vite web application, Expo mobile application, and shared TypeScript contracts.

## Structure

```text
apps/
  backend/   NestJS + Prisma + PostgreSQL
  web/       React + Vite desktop/web ERP
  mobile/    Expo React Native Android/iOS app
packages/
  shared/    Shared types, constants and permission codes
```

## Requirements

- Windows 10/11
- Node.js 20 or newer
- npm 10 or newer
- Docker Desktop
- Expo Go or Android Studio for mobile testing

## First setup (PowerShell)

```powershell
copy apps\backend\.env.example apps\backend\.env
copy apps\web\.env.example apps\web\.env
copy apps\mobile\.env.example apps\mobile\.env
npm install
npm run db:up
npm run db:generate
npm run db:migrate
npm run db:seed
```

Use three terminals:

```powershell
npm run dev:backend
npm run dev:web
npm run dev:mobile
```

- API: http://localhost:3000/api
- Swagger: http://localhost:3000/docs
- Web: http://localhost:5173
- Expo: shown in the Expo terminal

## Mobile backend URL

Android emulator uses `http://10.0.2.2:3000/api`. A physical phone must use the computer's LAN IPv4 address, for example `http://192.168.1.20:3000/api`. The phone and computer must be on the same network.

## Demo mode

The web and mobile apps include demo mode for UI review before all APIs are running. Set the corresponding demo environment variable to `false` for real API integration.

## Workspace commands

```powershell
npm run build
npm run test
npm run typecheck:mobile
npm run db:up
npm run db:down
```

## Important production work remaining

This is a scalable starter, not a finished ERP. Before production deployment, complete refresh-token sessions, branch authorization, rate limiting, configuration validation, audit logs, batch inventory, comprehensive tests, secure deployment secrets, and the remaining business modules.
