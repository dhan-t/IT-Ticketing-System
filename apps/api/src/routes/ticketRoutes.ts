import express, { Request, Response } from "express";
import pool from "../db";
import { requireDeptMember } from "../middleware/auth";

const router = express.Router();

const TICKET_SELECT = `
  SELECT t.id, t.title, t.status, tt.label AS ticket_type_label,
         d.name AS current_department_name,
         au.name AS assigned_to_name, t.created_at
  FROM tickets t
  JOIN ticket_types tt ON tt.id = t.ticket_type_id
  JOIN departments d ON d.id = t.current_department_id
  LEFT JOIN users au ON au.id = t.assigned_to
`;

// ---- Create a new ticket (any authenticated user) ----
router.post("/", async (req: Request, res: Response) => {
  const { ticketTypeId, title, description } = req.body;
  const userId = req.user!.userId;

  if (!ticketTypeId || !title || !description) {
    return res
      .status(400)
      .json({ error: "ticketTypeId, title, and description are required" });
  }

  try {
    const stepRes = await pool.query<{ department_id: number }>(
      `SELECT department_id FROM pipeline_steps WHERE ticket_type_id = $1 AND step_order = 1`,
      [ticketTypeId],
    );

    if (stepRes.rows.length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid ticketTypeId or no pipeline defined" });
    }

    const firstDepartmentId = stepRes.rows[0].department_id;

    const result = await pool.query(
      `INSERT INTO tickets (ticket_type_id, title, description, created_by, current_step_order, current_department_id, status)
       VALUES ($1, $2, $3, $4, 1, $5, 'Open')
       RETURNING id`,
      [ticketTypeId, title, description, userId, firstDepartmentId],
    );

    const ticketId = result.rows[0].id;

    await pool.query(
      `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, to_department_id, message)
       VALUES ($1, 'created', $2, $3, 'Ticket submitted.')`,
      [ticketId, userId, firstDepartmentId],
    );

    res.status(201).json({ id: ticketId });
  } catch (error) {
    console.error("Create ticket error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// ---- End user's own tickets ----
router.get("/mine", async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const result = await pool.query(
      `${TICKET_SELECT} WHERE t.created_by = $1 ORDER BY t.created_at DESC`,
      [userId],
    );
    res.json({ tickets: result.rows });
  } catch (error) {
    console.error("Fetch my tickets error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// ---- Department queue: active unassigned / assigned tickets only ----
router.get(
  "/department",
  requireDeptMember,
  async (req: Request, res: Response) => {
    const departmentId = req.user!.departmentId;

    try {
      const [unassignedRes, assignedRes] = await Promise.all([
        pool.query(
          `${TICKET_SELECT} WHERE t.current_department_id = $1 AND t.status IN ('Open', 'In Progress', 'Escalated') AND t.assigned_to IS NULL ORDER BY t.created_at ASC`,
          [departmentId],
        ),
        pool.query(
          `${TICKET_SELECT} WHERE t.current_department_id = $1 AND t.status IN ('Open', 'In Progress', 'Escalated') AND t.assigned_to IS NOT NULL ORDER BY t.created_at ASC`,
          [departmentId],
        ),
      ]);

      res.json({ unassigned: unassignedRes.rows, assigned: assignedRes.rows });
    } catch (error) {
      console.error("Fetch department tickets error:", error);
      res.status(500).json({ error: "Database error" });
    }
  },
);

// ---- Ticket detail + pipeline + activity log ----
router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const requester = req.user!;

  try {
    const ticketRes = await pool.query(
      `SELECT t.id, t.title, t.description, t.status, t.created_by, t.current_step_order,
              t.current_department_id, t.assigned_to, t.created_at,
              tt.id AS ticket_type_id, tt.label AS ticket_type_label,
              d.name AS current_department_name,
              cu.name AS created_by_name,
              au.name AS assigned_to_name
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN departments d ON d.id = t.current_department_id
       JOIN users cu ON cu.id = t.created_by
       LEFT JOIN users au ON au.id = t.assigned_to
       WHERE t.id = $1`,
      [id],
    );

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const ticket = ticketRes.rows[0];

    const isCreator = ticket.created_by === requester.userId;
    const isCurrentDeptMember =
      requester.role === "dept_member" &&
      requester.departmentId === ticket.current_department_id;
    const canView = isCreator || isCurrentDeptMember;

    if (!canView) {
      return res
        .status(403)
        .json({ error: "You do not have access to this ticket" });
    }

    const pipelineRes = await pool.query(
      `SELECT ps.step_order, d.name AS department_name
       FROM pipeline_steps ps JOIN departments d ON d.id = ps.department_id
       WHERE ps.ticket_type_id = $1 ORDER BY ps.step_order ASC`,
      [ticket.ticket_type_id],
    );

    const activityRes = await pool.query(
      `SELECT al.id, al.event_type, al.old_status, al.new_status, al.message, al.created_at,
              actor.name AS actor_name,
              fd.name AS from_department_name,
              tdp.name AS to_department_name
       FROM ticket_activity_log al
       JOIN users actor ON actor.id = al.actor_id
       LEFT JOIN departments fd ON fd.id = al.from_department_id
       LEFT JOIN departments tdp ON tdp.id = al.to_department_id
       WHERE al.ticket_id = $1 ORDER BY al.created_at ASC`,
      [id],
    );

    res.json({
      ticket,
      pipeline: pipelineRes.rows,
      activity: activityRes.rows,
      canAct: isCurrentDeptMember,
    });
  } catch (error) {
    console.error("Fetch ticket detail error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// ---- Assign / reassign ----
router.post(
  "/:id/assign",
  requireDeptMember,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { assigneeId } = req.body;
    const requester = req.user!;

    if (!assigneeId) {
      return res.status(400).json({ error: "assigneeId is required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const ticketRes = await client.query(
        `SELECT current_department_id FROM tickets WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (ticketRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Ticket not found" });
      }
      if (ticketRes.rows[0].current_department_id !== requester.departmentId) {
        await client.query("ROLLBACK");
        return res
          .status(403)
          .json({ error: "Ticket is not in your department" });
      }

      const assigneeRes = await client.query(
        `SELECT id, department_id FROM users WHERE id = $1`,
        [assigneeId],
      );
      if (
        assigneeRes.rows.length === 0 ||
        assigneeRes.rows[0].department_id !== requester.departmentId
      ) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "assigneeId must be a member of this department" });
      }

      await client.query(
        `UPDATE tickets SET assigned_to = $1, status = CASE WHEN status = 'Open' THEN 'In Progress' ELSE status END
       WHERE id = $2`,
        [assigneeId, id],
      );

      await client.query(
        `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, message)
       VALUES ($1, 'assigned', $2, $3)`,
        [id, requester.userId, `Assigned to user ${assigneeId}.`],
      );

      await client.query("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Assign ticket error:", error);
      res.status(500).json({ error: "Database error" });
    } finally {
      client.release();
    }
  },
);

// ---- Escalate to next pipeline step ----
router.post(
  "/:id/escalate",
  requireDeptMember,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { message } = req.body;
    const requester = req.user!;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const ticketRes = await client.query(
        `SELECT ticket_type_id, current_step_order, current_department_id FROM tickets WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (ticketRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Ticket not found" });
      }

      const ticket = ticketRes.rows[0];
      if (ticket.current_department_id !== requester.departmentId) {
        await client.query("ROLLBACK");
        return res
          .status(403)
          .json({ error: "Ticket is not in your department" });
      }

      const nextStepRes = await client.query(
        `SELECT department_id FROM pipeline_steps WHERE ticket_type_id = $1 AND step_order = $2`,
        [ticket.ticket_type_id, ticket.current_step_order + 1],
      );

      if (nextStepRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Ticket is already at the final pipeline step" });
      }

      const nextDepartmentId = nextStepRes.rows[0].department_id;

      await client.query(
        `UPDATE tickets
       SET current_step_order = current_step_order + 1, current_department_id = $1,
           assigned_to = NULL, status = 'Escalated'
       WHERE id = $2`,
        [nextDepartmentId, id],
      );

      await client.query(
        `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, from_department_id, to_department_id, message)
       VALUES ($1, 'escalated', $2, $3, $4, $5)`,
        [
          id,
          requester.userId,
          ticket.current_department_id,
          nextDepartmentId,
          message || null,
        ],
      );

      await client.query("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Escalate ticket error:", error);
      res.status(500).json({ error: "Database error" });
    } finally {
      client.release();
    }
  },
);

// ---- Status update ----
const VALID_STATUSES = [
  "Open",
  "In Progress",
  "Escalated",
  "Resolved",
  "Closed",
];

router.post(
  "/:id/status",
  requireDeptMember,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, remark } = req.body;
    const requester = req.user!;

    if (!VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const ticketRes = await client.query(
        `SELECT status, current_department_id FROM tickets WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (ticketRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Ticket not found" });
      }
      if (ticketRes.rows[0].current_department_id !== requester.departmentId) {
        await client.query("ROLLBACK");
        return res
          .status(403)
          .json({ error: "Ticket is not in your department" });
      }

      const oldStatus = ticketRes.rows[0].status;

      await client.query(`UPDATE tickets SET status = $1 WHERE id = $2`, [
        status,
        id,
      ]);

      await client.query(
        `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, old_status, new_status, message)
       VALUES ($1, 'status_changed', $2, $3, $4, $5)`,
        [id, requester.userId, oldStatus, status, remark || null],
      );

      await client.query("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Status update error:", error);
      res.status(500).json({ error: "Database error" });
    } finally {
      client.release();
    }
  },
);

router.get(
  "/department/history",
  requireDeptMember,
  async (req: Request, res: Response) => {
    const departmentId = req.user!.departmentId;

    try {
      const result = await pool.query(
        `${TICKET_SELECT}
       WHERE t.current_department_id = $1
          OR t.id IN (
            SELECT DISTINCT ticket_id
            FROM ticket_activity_log
            WHERE to_department_id = $1
          )
       ORDER BY t.created_at DESC`,
        [departmentId],
      );
      res.json({ tickets: result.rows });
    } catch (error) {
      console.error("Fetch department history error:", error);
      res.status(500).json({ error: "Database error" });
    }
  },
);

export default router;
