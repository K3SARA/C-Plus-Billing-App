# Deploy On Railway

This deployment uses one Railway Node.js service for the frontend and backend API, plus one Railway PostgreSQL database.

## What Runs Online

- Frontend: existing static app files served by `server.js`
- Backend: Express API at `/api`
- Database: Railway PostgreSQL storing the latest full app snapshot
- Local cache: browser IndexedDB still works as a local cache

## Local Test

```powershell
npm install
npm start
```

Open:

```text
http://localhost:3000
```

Without `DATABASE_URL`, local backend sync uses `.data/snapshot.json`.

## Railway Setup

1. Push this repository to GitHub.
2. In Railway, create a new project.
3. Choose `Deploy from GitHub repo`.
4. Select this repository.
5. Add a PostgreSQL database service.
6. On the app service, add this variable:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

7. Add these app protection variables:

```text
BASIC_AUTH_USER=admin
BASIC_AUTH_PASSWORD=use-a-strong-password
APP_SNAPSHOT_ID=default
```

8. Deploy the app service.
9. In the app service `Settings -> Networking`, generate a Railway domain.

## Deploy From CLI

```powershell
npm install -g @railway/cli
railway login
railway init
railway add -d postgres
railway add
railway variable set "DATABASE_URL=${{Postgres.DATABASE_URL}}"
railway variable set "BASIC_AUTH_USER=admin"
railway variable set "BASIC_AUTH_PASSWORD=use-a-strong-password"
railway up
railway domain
```

## API Check

After deploy, open:

```text
https://your-railway-domain.up.railway.app/api/health
```

Expected:

```json
{ "ok": true, "database": "postgres" }
```
