import pool from "./db";

async function seedDatabase() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("Seeding data...");

    // Departments
    const deptRes = await client.query<{ id: number; name: string }>(
      `INSERT INTO departments (name) VALUES
        ('General Operations'), ('Help Desk'), ('Software Engineering'), ('Infrastructure')
       RETURNING id, name`,
    );
    const dept = Object.fromEntries(deptRes.rows.map((d) => [d.name, d.id]));
    console.log("✓ Departments seeded.");

    // Ticket types
    const typeRes = await client.query<{ id: number; key: string }>(
      `INSERT INTO ticket_types (key, label) VALUES
        ('hardware_prob', 'Hardware Problem'),
        ('software_prob', 'Software Problem'),
        ('network_prob', 'Network Problem')
       RETURNING id, key`,
    );
    const type = Object.fromEntries(typeRes.rows.map((t) => [t.key, t.id]));
    console.log("✓ Ticket types seeded.");

    // Pipelines:
    // hardware_prob:  Help Desk -> Infrastructure
    // software_prob:  Help Desk -> Software Engineering
    // network_prob:   Help Desk -> Software Engineering -> Infrastructure
    await client.query(
      `INSERT INTO pipeline_steps (ticket_type_id, step_order, department_id) VALUES
        ($1, 1, $4), ($1, 2, $6),
        ($2, 1, $4), ($2, 2, $5),
        ($3, 1, $4), ($3, 2, $5), ($3, 3, $6)`,
      [
        type.hardware_prob,
        type.software_prob,
        type.network_prob,
        dept["Help Desk"],
        dept["Software Engineering"],
        dept["Infrastructure"],
      ],
    );
    console.log("✓ Pipelines seeded.");

    // Users — dept_members in the 3 working departments
    const userRows: [string, string, number][] = [
      ["Alice Helpdesk", "alice@company.com", dept["Help Desk"]],
      ["Bob Helpdesk", "bob@company.com", dept["Help Desk"]],
      ["Carla Diaz", "carla@company.com", dept["Software Engineering"]],
      ["Dave Santos", "dave@company.com", dept["Software Engineering"]],
      ["Elena Torres", "elena@company.com", dept["Infrastructure"]],
      ["Feye Lim", "feye@company.com", dept["Infrastructure"]],
    ];
    const userId: Record<string, number> = {};
    for (const [name, email, department_id] of userRows) {
      const r = await client.query<{ id: number }>(
        `INSERT INTO users (name, email, password_hash, role, department_id)
         VALUES ($1, $2, 'password_placeholder', 'dept_member', $3) RETURNING id`,
        [name, email, department_id],
      );
      userId[email] = r.rows[0].id;
    }

    // End user — lives in General Operations
    const endUserRes = await client.query<{ id: number }>(
      `INSERT INTO users (name, email, password_hash, role, department_id)
       VALUES ('John End User', 'john@example.com', 'password_placeholder', 'end_user', $1)
       RETURNING id`,
      [dept["General Operations"]],
    );
    const endUserId = endUserRes.rows[0].id;
    console.log("✓ Users seeded.");

    // Sample tickets across lifecycle stages
    const t1 = await client.query<{ id: number }>(
      `INSERT INTO tickets (ticket_type_id, title, description, created_by, current_step_order, current_department_id, status)
       VALUES ($1, 'Laptop will not boot', 'Laptop will not boot.', $2, 1, $3, 'Open') RETURNING id`,
      [type.hardware_prob, endUserId, dept["Help Desk"]],
    );

    const t2 = await client.query<{ id: number }>(
      `INSERT INTO tickets (ticket_type_id, title, description, created_by, current_step_order, current_department_id, assigned_to, status)
       VALUES ($1, 'Cannot login to portal', 'Unable to login to company portal.', $2, 1, $3, $4, 'In Progress') RETURNING id`,
      [
        type.software_prob,
        endUserId,
        dept["Help Desk"],
        userId["alice@company.com"],
      ],
    );

    const t3 = await client.query<{ id: number }>(
      `INSERT INTO tickets (ticket_type_id, title, description, created_by, current_step_order, current_department_id, status)
       VALUES ($1, 'Office network unavailable', 'Office network is unavailable.', $2, 2, $3, 'Escalated') RETURNING id`,
      [type.network_prob, endUserId, dept["Software Engineering"]],
    );

    const t4 = await client.query<{ id: number }>(
      `INSERT INTO tickets (ticket_type_id, title, description, created_by, current_step_order, current_department_id, assigned_to, status)
       VALUES ($1, 'Monitor flickers', 'Monitor flickers intermittently.', $2, 2, $3, $4, 'Resolved') RETURNING id`,
      [
        type.hardware_prob,
        endUserId,
        dept["Infrastructure"],
        userId["elena@company.com"],
      ],
    );
    console.log("✓ Tickets seeded.");

    // Activity logs matching the states above
    await client.query(
      `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, to_department_id, message) VALUES
        ($1, 'created', $2, $3, 'Ticket submitted.')`,
      [t1.rows[0].id, endUserId, dept["Help Desk"]],
    );
    await client.query(
      `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, to_department_id, message) VALUES
        ($1, 'created', $2, $3, 'Ticket submitted.')`,
      [t2.rows[0].id, endUserId, dept["Help Desk"]],
    );
    await client.query(
      `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id) VALUES ($1, 'assigned', $2)`,
      [t2.rows[0].id, userId["alice@company.com"]],
    );
    await client.query(
      `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, from_department_id, to_department_id, message) VALUES
        ($1, 'escalated', $2, $3, $4, 'Requires software engineering support.')`,
      [
        t3.rows[0].id,
        userId["alice@company.com"],
        dept["Help Desk"],
        dept["Software Engineering"],
      ],
    );
    await client.query(
      `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, old_status, new_status, message) VALUES
        ($1, 'status_changed', $2, 'In Progress', 'Resolved', 'Issue resolved.')`,
      [t4.rows[0].id, userId["elena@company.com"]],
    );
    console.log("✓ Activity logs seeded.");

    await client.query("COMMIT");
    console.log("Database seeded successfully.");
    process.exit(0);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    client.release();
  }
}

seedDatabase();
