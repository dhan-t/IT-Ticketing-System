import express, { Request, Response } from "express";
import pool from "../db"; // Import your database connection

const router = express.Router();

// Define the shape of the data you expect back
interface TicketRow {
  id: number;
  description: string;
  status: string;
  creator_name: string;
}

router.get(
  "/departments/:deptId/tickets",
  async (req: Request, res: Response) => {
    const { deptId } = req.params;

    try {
      // Use parameterized queries ($1) to prevent SQL injection attacks!
      const result = await pool.query<TicketRow>(
        `
            SELECT t.id, t.description, t.status, u.name as creator_name
            FROM tickets t
            JOIN users u ON t.creator_id = u.id
            WHERE t.current_department_id = $1
        `,
        [deptId],
      );

      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  },
);

export default router;
