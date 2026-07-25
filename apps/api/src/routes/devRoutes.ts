import express, { Request, Response } from "express";
import pool from "../db";

const router = express.Router();
const TEST_USER_ID = 7; // John End User from seed

router.get("/departments", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, name FROM departments ORDER BY id`,
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

router.get("/users", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, name, role, department_id FROM users ORDER BY department_id, id`,
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/ticket-types", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, key, label FROM ticket_types ORDER BY id`,
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ticket types" });
  }
});

router.get("/tickets", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.title, t.description, t.status, t.created_at, t.current_step_order,
        tt.id AS ticket_type_id, tt.label AS ticket_type,
        d.id AS department_id, d.name AS department_name,
        creator.id AS creator_id, creator.name AS creator_name,
        assignee.id AS assignee_id, assignee.name AS assignee_name
      FROM tickets t
      JOIN ticket_types tt ON t.ticket_type_id = tt.id
      JOIN departments d ON t.current_department_id = d.id
      JOIN users creator ON t.created_by = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

router.post("/tickets", async (req: Request, res: Response) => {
  const { title, description, ticket_type_id } = req.body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  if (!ticket_type_id) {
    return res.status(400).json({ error: "ticket_type_id is required" });
  }

  try {
    await pool.query("BEGIN");

    const stepResult = await pool.query(
      `SELECT department_id FROM pipeline_steps WHERE ticket_type_id = $1 AND step_order = 1`,
      [ticket_type_id],
    );
    if (stepResult.rows.length === 0)
      throw new Error("No pipeline configured for this ticket type");
    const firstDeptId = stepResult.rows[0].department_id;

    const ticketResult = await pool.query(
      `INSERT INTO tickets (ticket_type_id, title, description, created_by, current_department_id, current_step_order)
       VALUES ($1, $2, $3, $4, $5, 1) RETURNING *`,
      [ticket_type_id, title, description, TEST_USER_ID, firstDeptId],
    );
    const newTicket = ticketResult.rows[0];

    await pool.query(
      `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, to_department_id, message)
       VALUES ($1, 'created', $2, $3, 'Ticket submitted by end user')`,
      [newTicket.id, TEST_USER_ID, firstDeptId],
    );

    await pool.query("COMMIT");
    res.json(newTicket);
  } catch (error: any) {
    await pool.query("ROLLBACK");
    res.status(500).json({ error: error.message });
  }
});

router.put("/tickets/:id/status", async (req: Request, res: Response) => {
  const { status, actor_id } = req.body;
  const ticketId = req.params.id;

  try {
    await pool.query("BEGIN");

    const currentResult = await pool.query(
      `SELECT status FROM tickets WHERE id = $1`,
      [ticketId],
    );
    if (currentResult.rows.length === 0) throw new Error("Ticket not found");
    const oldStatus = currentResult.rows[0].status;

    const result = await pool.query(
      `UPDATE tickets SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, ticketId],
    );

    await pool.query(
      `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, old_status, new_status)
       VALUES ($1, 'status_changed', $2, $3, $4)`,
      [ticketId, actor_id || TEST_USER_ID, oldStatus, status],
    );

    await pool.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await pool.query("ROLLBACK");
    res.status(500).json({ error: error.message });
  }
});

router.put("/tickets/:id/assign", async (req: Request, res: Response) => {
  const { assignee_id, actor_id } = req.body;
  const ticketId = req.params.id;

  try {
    await pool.query("BEGIN");

    const result = await pool.query(
      `UPDATE tickets SET assigned_to = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [assignee_id, ticketId],
    );
    if (result.rows.length === 0) throw new Error("Ticket not found");

    await pool.query(
      `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, message)
       VALUES ($1, 'assigned', $2, $3)`,
      [ticketId, actor_id || TEST_USER_ID, `Assigned to user ${assignee_id}`],
    );

    await pool.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await pool.query("ROLLBACK");
    res.status(500).json({ error: error.message });
  }
});

router.put("/tickets/:id/escalate", async (req: Request, res: Response) => {
  const { message, actor_id } = req.body;
  const ticketId = req.params.id;

  try {
    await pool.query("BEGIN");

    const ticketResult = await pool.query(
      `SELECT ticket_type_id, current_step_order, current_department_id FROM tickets WHERE id = $1`,
      [ticketId],
    );
    if (ticketResult.rows.length === 0) throw new Error("Ticket not found");
    const { ticket_type_id, current_step_order, current_department_id } =
      ticketResult.rows[0];

    const nextStepResult = await pool.query(
      `SELECT department_id FROM pipeline_steps WHERE ticket_type_id = $1 AND step_order = $2`,
      [ticket_type_id, current_step_order + 1],
    );
    if (nextStepResult.rows.length === 0)
      throw new Error(
        "Ticket is already at the final department in its pipeline",
      );
    const nextDeptId = nextStepResult.rows[0].department_id;

    const result = await pool.query(
      `UPDATE tickets
       SET current_department_id = $1, current_step_order = current_step_order + 1,
           assigned_to = NULL, status = 'Escalated', updated_at = now()
       WHERE id = $2 RETURNING *`,
      [nextDeptId, ticketId],
    );

    await pool.query(
      `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, from_department_id, to_department_id, message)
       VALUES ($1, 'escalated', $2, $3, $4, $5)`,
      [
        ticketId,
        actor_id || TEST_USER_ID,
        current_department_id,
        nextDeptId,
        message || null,
      ],
    );

    await pool.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await pool.query("ROLLBACK");
    res.status(500).json({ error: error.message });
  }
});

router.get("/ticket-types", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, key, label FROM ticket_types ORDER BY id`,
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ticket types" });
  }
});

export default router;
