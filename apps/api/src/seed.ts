import fs from "fs";
import path from "path";
import pool from "./db"; // Adjust the import path as necessary

async function seedDatabase() {
  try {
    // 1. Read and execute the schema.sql file
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath).toString();
    await pool.query(schemaSql);
    console.log("Tables created successfully.");

    // 2. Insert Departments (The 3 required + Sales for End Users)
    await pool.query(`
      INSERT INTO departments (id, name) VALUES 
      (1, 'Help Desk'), (2, 'Software Engineering'), 
      (3, 'Infrastructure'), (4, 'Sales')
    `);

    // 3. Insert Ticket Types & Pipelines
    await pool.query(`
      INSERT INTO ticket_types (id, name) VALUES 
      (1, 'Hardware'), (2, 'Software')
    `);

    // Pipeline for Hardware: Help Desk (1) -> Infrastructure (3)
    await pool.query(`
      INSERT INTO pipeline_steps (ticket_type_id, department_id, step_order) VALUES 
      (1, 1, 1), (1, 3, 2)
    `);

    console.log("Seed data inserted successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Error seeding database:", err);
    process.exit(1);
  }
}

seedDatabase();
