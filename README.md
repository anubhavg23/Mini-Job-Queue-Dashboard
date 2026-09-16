# Mini Job Queue Management Dashboard

A lightweight, concurrency-safe job queue dashboard built with **NestJS**, **SQLite (TypeORM)**, and **React (Vite)**. Designed strictly around minimal complexity, zero redundant dependencies, and rock-solid correctness.

---

## Tech Stack

- **Backend**: NestJS, TypeORM, SQLite3, `class-validator`
- **Frontend**: React 18, TypeScript, Vite, Vanilla CSS (no heavy UI libraries or global state overhead)

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### 1. Backend Setup
```bash
cd backend
npm install
npm run build
npm run start
```
The backend server runs at `http://localhost:3000`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The frontend dashboard runs at `http://localhost:5173`.

### 3. Run Automated Tests
Run the comprehensive test suite (including the 15 required test scenarios and the critical concurrency race-condition test):
```bash
node test-all.js
```

---

## Environment Variables

| Variable | Location | Default | Description |
|---|---|---|---|
| `PORT` | Backend | `3000` | Port for the NestJS HTTP server |
| `VITE_API_BASE_URL` | Frontend | `http://localhost:3000` | Backend API base URL |

---

## API Endpoints

| Method | Endpoint | Status Codes | Description |
|---|---|---|---|
| `POST` | `/jobs` | `201`, `400` | Creates a new job with initial status `pending`. Body: `{ "title": string, "type": string }` |
| `GET` | `/jobs` | `200` | Retrieves all jobs (sorted newest first). Optional query: `?status=pending\|running\|completed\|failed` |
| `PATCH` | `/jobs/:id/status` | `200`, `400`, `404`, `409` | Updates job status. Body: `{ "status": string }` |
| `DELETE` | `/jobs/:id` | `200`, `404` | Deletes a job by ID. |

---

## Status Transition Rules

Valid state machine:
```
[pending] ───> [running] ───┬───> [completed] (terminal)
                            └───> [failed]    (terminal)
```

- `pending` can only transition to `running`.
- `running` can transition to `completed` or `failed`.
- `completed` and `failed` are terminal states and can **never** transition again.
- Any invalid transition attempt returns **`409 Conflict`**.

---

## Concurrency Handling (Critical Requirement)

### The Problem
If two browser tabs or simultaneous API calls send `PATCH /jobs/:id/status` with `status: "running"` for a `pending` job at the exact same millisecond, an unprotected check-then-act pattern (`find` then `save`) causes a race condition.

### The Solution: Database-Level Atomic Conditional Update
Instead of in-memory locks or distributed locking mechanisms (Redis, Redlock), the transition is executed as a single atomic SQL update:

```sql
UPDATE jobs 
SET status = :newStatus 
WHERE id = :id AND status IN (:allowedPreviousStatuses);
```

### How It Works Under Race Conditions
1. In SQLite / PostgreSQL, write operations serialize at the database layer.
2. **Request A** executes: the row status is `'pending'` (allowed). The row is updated to `'running'`. **`affected = 1`** → Returns **`200 OK`**.
3. **Request B** executes immediately after: the row status is now `'running'` (not in allowed previous statuses). **`affected = 0`** rows updated.
4. The service inspects `affected === 0`: it queries the current job state and throws a **`409 Conflict`** (`"Cannot transition job from 'running' to 'running'"`).
5. **Safety Guarantee**: Direct API calls that bypass the UI cannot violate state invariants. Data integrity is enforced where it belongs: at the database transaction layer.

---

## Bonus Production-Ready Improvements

1. **SQLite Write-Ahead Logging (WAL) Mode**:
   - Initialized at startup via `PRAGMA journal_mode = WAL;`.
   - Default SQLite rollback journals block concurrent readers during write queries. WAL mode allows concurrent readers alongside writers, dramatically improving concurrency throughput in real-world environments.
2. **Database Index on `status`**:
   - Accelerates status-based filtering and atomic conditional update lookups.
3. **Frontend Real-Time Auto-Refresh Toggle**:
   - Dashboard includes an optional 4-second poll toggle to easily test and observe multi-tab or concurrent background transitions in real time without WebSockets.

---

## Assumptions & Trade-offs

- **SQLite vs PostgreSQL**: SQLite with WAL mode was chosen for simplicity, zero-setup developer experience, and atomic transactional integrity. In a multi-instance containerized deployment (e.g. Kubernetes), PostgreSQL with row-level locking or the identical atomic conditional update pattern would be used.
- **Minimal State**: Used native React `useState` and `useEffect` with clear loading and error feedback instead of heavy state libraries (Redux/Zustand), keeping bundle size tiny and code directly explainable.

---

## Deployment URLs

- **Frontend**: `https://assignment-juspay-v5gl.vercel.app`
- **Backend**: `https://mini-job-queue-dashboard-voux.onrender.com`
