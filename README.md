# FreelanceFlow

A full-stack B2B SaaS app for freelancers to manage clients, projects, tasks, time tracking, and PDF invoicing.


Live at: https://freelance-flow-ten.vercel.app

## Tech Stack

**Frontend:** React + TypeScript + Tailwind CSS + Vite + Recharts  
**Backend:** Node.js + Express + MongoDB + Mongoose  
**Auth:** JWT (stored in localStorage)  
**PDF:** PDFKit (server-side)

---

## Quick Start

### 1. Install MongoDB
Make sure MongoDB is running locally on port 27017, or use MongoDB Atlas (update `MONGODB_URI` in `.env`).

### 2. Setup Backend

```bash
cd server
npm install
```

Create a `.env` file in the `server/` folder:

```env
MONGODB_URI=mongodb://localhost:27017/freelanceflow
JWT_SECRET=your_super_secret_key_change_this
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

Start the backend:

```bash
npm run dev
# Server runs on http://localhost:5000
```

### 3. Setup Frontend

```bash
# In the root folder
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

---

## Project Structure

```
freelanceflow/
├── src/                     # React frontend
│   ├── components/
│   │   └── Layout.tsx        # Sidebar + persistent stopwatch
│   ├── pages/
│   │   ├── Auth.tsx          # Login + Register
│   │   ├── Dashboard.tsx     # Stats + Charts
│   │   ├── Clients.tsx       # Client CRUD
│   │   ├── Projects.tsx      # Project CRUD + Kanban tasks
│   │   ├── TimeTracker.tsx   # Manual time logging
│   │   ├── Invoices.tsx      # Invoice wizard + PDF
│   │   └── Settings.tsx      # Plan + seed data
│   ├── store.ts              # All API calls (fetch to backend)
│   ├── context.tsx           # Auth + Toast context
│   └── types.ts              # TypeScript interfaces
│
└── server/                  # Express backend
    ├── index.js             # Entry point
    ├── middleware/auth.js   # JWT verification
    ├── db/connection.js     # MongoDB connection
    ├── models/              # Mongoose schemas
    │   ├── User.js
    │   ├── Client.js
    │   ├── Project.js
    │   ├── Task.js
    │   ├── TimeLog.js
    │   └── Invoice.js
    ├── routes/              # API route handlers
    │   ├── auth.js          # Register, Login, Me
    │   ├── clients.js       # CRUD + free plan limit
    │   ├── projects.js      # CRUD + burn rate
    │   ├── tasks.js         # CRUD
    │   ├── timelogs.js      # Manual + stopwatch
    │   ├── invoices.js      # Create + PDF generation
    │   ├── dashboard.js     # Aggregated stats
    │   └── seed.js          # Demo data loader
    ├── utils/
    │   └── pdfGenerator.js  # PDFKit invoice template
    └── generated-invoices/  # PDF files saved here
```

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |
| GET | /api/clients | List clients |
| POST | /api/clients | Create client (free: max 2) |
| PUT | /api/clients/:id | Update client |
| DELETE | /api/clients/:id | Delete + cascade |
| GET | /api/projects | List projects |
| GET | /api/projects/:id/burn-rate | Budget usage % |
| GET | /api/tasks?projectId= | List tasks |
| GET | /api/timelogs | List time logs |
| POST | /api/timelogs/start | Start stopwatch |
| POST | /api/timelogs/stop/:id | Stop stopwatch |
| GET | /api/timelogs/active | Get running timer |
| POST | /api/invoices | Create invoice (Pro only) |
| GET | /api/invoices/preview | Preview unbilled logs |
| POST | /api/invoices/:id/generate-pdf | Generate PDF |
| GET | /api/dashboard/stats | Dashboard data |
| POST | /api/seed/demo | Load sample data |

---

## Key Features

- **Multi-tenancy** — every query scoped to `userId`, users never see each other's data
- **Freemium limits** — free plan: max 2 clients, no invoicing
- **Burn rate** — `(totalLoggedHours × hourlyRate) / budget × 100`
- **Invoice wizard** — 4-step: client → dates → preview unbilled logs → confirm
- **No double-billing** — time logs marked `isBilled=true` after PDF generation
- **Persistent stopwatch** — timer saved in `localStorage`, survives page refresh
- **Sample data** — Settings → Load Data seeds 20 time logs, 3 projects, 2 invoices
