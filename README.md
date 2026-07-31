# AI Tourist Assistant

## Local development

```bash
# Terminal 1 – backend (port 5005)
cd backend
cp .env.example .env   # then edit MONGO_URI and JWT_SECRET
npm install
npm run dev            # or: node server.js from repo root: npm run dev:backend

# Terminal 2 – frontend (port 5173)
cd frontend
npm install
npm run dev
```

Frontend proxies `/api` to `http://localhost:5005` via Vite.

## Deploy on Vercel (one backend, one project)

1. **Root Directory** in Vercel: use **`.`** (repo root) **or** `frontend` — both work. There is only **one** backend in `backend/`.
2. Environment variables (Production + Preview):

| Name | Required | Example |
|------|----------|---------|
| `MONGO_URI` | Yes | Atlas connection string (include DB name or set `MONGO_DB_NAME`) |
| `JWT_SECRET` | Yes | long random string |
| `GEMINI_API_KEY` | For AI chat | from Google AI Studio |
| `RAZORPAY_KEY_ID` | For payments | optional |
| `RAZORPAY_KEY_SECRET` | For payments | optional |
| `FRONTEND_URL` | Optional | `http://localhost:5173` locally; production URL on Vercel |
| `MONGO_DB_NAME` | Optional | default `tourist_assistant` if URI has no database |

3. **MongoDB Atlas** → Network Access → allow `0.0.0.0/0` (required for Vercel).
4. Push to GitHub and redeploy.

Check: `https://your-app.vercel.app/api/health` → `{"ok":true,"database":"connected"}`

## Project layout

```
backend/     ← single API (Express + MongoDB)
frontend/    ← React (Vite)
api/         ← Vercel serverless entry (imports backend/app.js)
vercel.json  ← deploy config at repo root
```
