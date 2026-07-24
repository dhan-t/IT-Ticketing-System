CREATE TYPE user_role AS ENUM ('end_user', 'dept_member');
CREATE TYPE ticket_status AS ENUM ('Open', 'In Progress', 'Escalated', 'Resolved', 'Closed');

CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_types (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL
);

CREATE TABLE pipeline_steps (
  id SERIAL PRIMARY KEY,
  ticket_type_id INTEGER NOT NULL REFERENCES ticket_types(id),
  step_order INTEGER NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  UNIQUE (ticket_type_id, step_order)
);

CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  ticket_type_id INTEGER NOT NULL REFERENCES ticket_types(id),
  title TEXT NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  current_step_order INTEGER NOT NULL DEFAULT 1,
  current_department_id INTEGER NOT NULL REFERENCES departments(id),
  assigned_to INTEGER REFERENCES users(id),
  status ticket_status NOT NULL DEFAULT 'Open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_activity_log (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  event_type TEXT NOT NULL,
  actor_id INTEGER NOT NULL REFERENCES users(id),
  from_department_id INTEGER REFERENCES departments(id),
  to_department_id INTEGER REFERENCES departments(id),
  old_status ticket_status,
  new_status ticket_status,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);