# FlowDocs Foundation

FlowDocs is a real-time, team-based document collaboration platform.  
This repository contains the production-grade foundation architecture for backend and frontend.

## Project Structure

```text
flowdocs/
├─ backend/                 # NestJS API, Prisma, Socket.IO foundation
│  ├─ prisma/               # Prisma schema and migrations
│  └─ src/
│     ├─ auth/
│     ├─ users/
│     ├─ workspaces/
│     ├─ documents/
│     ├─ collaborators/
│     ├─ media/
│     ├─ realtime/
│     ├─ presence/
│     ├─ activity/
│     ├─ health/
│     ├─ common/
│     ├─ config/
│     └─ prisma/
├─ frontend/                # React + Vite + Mantine client foundation
│  └─ src/
│     ├─ app/               # providers + router
│     ├─ components/        # reusable ui/navigation
│     ├─ features/          # page-level modules
│     ├─ layouts/           # app shell layout
│     ├─ shared/            # api client + config + styles
│     └─ store/             # Zustand stores
└─ docker-compose.yml       # PostgreSQL + MinIO services
```

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop

## Installation

1. Install monorepo dependencies:

   ```bash
   npm install
   ```

2. Copy environment templates:

   - `copy .env.example .env`
   - `copy backend\\.env.example backend\\.env`
   - `copy frontend\\.env.example frontend\\.env`

3. Start infrastructure services:

   ```bash
   docker compose up -d
   ```

4. Generate Prisma client:

   ```bash
   npm run prisma:generate --workspace backend
   ```

## Run Commands

- Backend (dev): `npm run dev:backend`
- Frontend (dev): `npm run dev:frontend`
- Build all: `npm run build`
- Lint all: `npm run lint`

## Day 2 Auth And Workspace Flow

- `POST /api/auth/register` creates a user and returns a JWT session payload.
- `POST /api/auth/login` signs in with email and password.
- `GET /api/auth/me` restores the current session from the access token.
- `GET /api/users/me` and `PATCH /api/users/me` provide basic profile read/update flows.
- `POST /api/workspaces`, `GET /api/workspaces`, and `GET /api/workspaces/:id` power the initial workspace onboarding flow.
- The frontend restores sessions from the stored access token and redirects protected routes automatically.

## Docker Services

`docker-compose.yml` provisions:

- **postgres** (`postgres:16-alpine`)
  - Port: `5432`
  - DB/User/Password configurable via root `.env`
- **minio** (`minio/minio:latest`)
  - API Port: `9000`
  - Console Port: `9001`
  - Root credentials configurable via root `.env`

## Foundation Notes

- Backend includes:
  - global validation pipe (`class-validator`)
  - global exception filter
  - environment validation (`Joi`)
  - modular architecture with compile-ready placeholder modules
  - Prisma service + health endpoint
  - JWT and Socket.IO base wiring
  - document foundation config via `DOCUMENT_SNAPSHOT_INTERVAL`
- Frontend includes:
  - app providers (Mantine + Query Client)
  - protected/public routing split
  - dark premium global layout (sidebar/topbar/page container)
  - page skeletons for login/register/dashboard/documents/editor/profile
  - central API client and auth store
- Day 1 document architecture decisions are summarized in `backend/ARCHITECTURE_NOTES.md`
