# IT Ticketing System

A full-stack IT ticketing system built as a monorepo with a TypeScript/Express backend and a Next.js frontend. The project uses PostgreSQL for persistence, JWT-based authentication for protected routes, and Docker Compose for local database setup.

## Overview

This system supports:

- User registration and login with JWT-based authentication
- Ticket submission by end users
- Department-based queues for department members
- Ticket assignment and reassignment
- Pipeline-based escalation between departments
- Activity logging for each ticket lifecycle event

## Tech Stack

- Backend: Express + TypeScript
- Frontend: Next.js + TypeScript
- Database: PostgreSQL
- Authentication: JWT-based auth
- Local infrastructure: Docker Compose

## Project Structure

This project is organized as a monorepo with clearly separated application folders:

- `apps/api`: Express + TypeScript backend
- `apps/web`: Next.js frontend
- `db`: PostgreSQL initialization scripts and schema setup

## Prerequisites

Before you begin, make sure you have:

- Git
- Docker Desktop (or Docker Engine) with Docker Compose
- Node.js 20+ and npm (optional if you want to run the app locally outside Docker)

## Setup and run instructions

### 1. Clone or download the project

```bash
git clone <repository-url>
cd csp-it-ticketing-system
```

### 2. Create an environment file (optional)

If you want to override the defaults, create a file named `.env` in the project root:

```env
POSTGRES_DB=csp_it_ticketing
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DB_PORT=5432
API_PORT=4000
WEB_PORT=3000
JWT_SECRET=replace_with_a_real_secret
NEXT_PUBLIC_API_URL=http://localhost:4000
```

> If you do not create a `.env` file, the app will use the built-in defaults from the Docker Compose configuration.

### 3. Start the full stack

Run the following from the project root:

```bash
docker compose up -d --build
```

This will start:

- PostgreSQL on port `5432`
- The API on port `4000`
- The web app on port `3000`

### 4. Verify the services

- API health check:

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{ "status": "ok" }
```

- Web UI:
  Open http://localhost:3000 in your browser.

## Seed instructions

The database is initialized by the SQL scripts in the `db/init` folder, and the demo data is loaded through the API seed script.

Run this after the containers are up:

```bash
docker compose exec api npx ts-node src/seed.ts
```

This seeds the database with the required sample data for the take-home prompt:

- 4 departments, including Help Desk, Software Engineering, Infrastructure, and General Operations
- 8 department members plus 2 end users
- 3 ticket types with distinct routing pipelines
- A set of sample tickets in different lifecycle stages, including open, active, escalated, resolved, and closed cases

### Default seeded credentials

All seeded users share the same password:

```text
password123
```

Example accounts:

- `john@example.com`
- `maria@example.com`
- `alice@company.com`
- `ben@company.com`
- `dave@company.com`
- `george@company.com`

## Local development alternative

If you prefer to run the API and web app outside Docker, you can still use the database container:

```bash
docker compose up -d db
npm install
npm run dev:api
npm run dev:web
```

## Key design decisions

### Schema

The database uses PostgreSQL and is organized around a small set of core tables:

- `departments`: organizational units such as Help Desk or Infrastructure
- `users`: employees and customers with role-based access
- `ticket_types`: categories such as hardware, software, and network issues
- `pipeline_steps`: ordered department routing for each ticket type
- `tickets`: the main record for each request
- `ticket_activity_log`: audit trail for events such as creation, assignment, escalation, and status changes

This structure keeps ticket state, workflow routing, and historical activity separated in a way that is easy to extend.

### Pipeline model

Each ticket type has an ordered pipeline defined in `pipeline_steps`. When a ticket is created, it starts at the first department in that pipeline. A department member can escalate the ticket to the next step, moving the ticket to the next department and updating its state accordingly.

This model allows the system to represent multi-step workflows without hard-coding department logic into the application layer.

### Authentication approach

Authentication is handled with JWTs on the API side:

- Users log in or register through the API
- The server issues a signed JWT containing the user identity and role
- Protected routes validate the token using middleware
- Department-member-only actions are guarded separately so end users cannot perform internal workflow actions

This keeps the frontend stateless while still enforcing access rules on the server.

## Notes

- The API is exposed at `http://localhost:4000`
- The frontend is exposed at `http://localhost:3000`
- The seed script is useful for demos and local testing, but should be rerun carefully if you want to reset the sample data.
