-- Drop tables if they exist to allow for easy database resets during testing
DROP TABLE IF EXISTS activity_logs, tickets, pipeline_steps, users, departments, ticket_types CASCADE;

CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE ticket_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'END_USER',
    department_id INT REFERENCES departments(id)
);

CREATE TABLE pipeline_steps (
    id SERIAL PRIMARY KEY,
    ticket_type_id INT REFERENCES ticket_types(id),
    department_id INT REFERENCES departments(id),
    step_order INT NOT NULL
);

CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    ticket_type_id INT REFERENCES ticket_types(id),
    status VARCHAR(50) DEFAULT 'Open',
    creator_id INT REFERENCES users(id),
    current_department_id INT REFERENCES departments(id),
    assignee_id INT REFERENCES users(id) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    ticket_id INT REFERENCES tickets(id),
    user_id INT REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    old_value VARCHAR(100),
    new_value VARCHAR(100),
    message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);