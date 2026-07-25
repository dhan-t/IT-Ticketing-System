import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import { requireAuth } from "./middleware/auth";
import ticketRoutes from "./routes/ticketRoutes";
import devRoutes from "./routes/devRoutes";
import pool from "./db";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Public: login/register only
app.use("/auth", authRoutes);

// Everything else requires a valid token per spec
app.get("/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));
app.use("/tickets", requireAuth, ticketRoutes);
app.use("/dev", requireAuth, devRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

app.get("/departments", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM departments ORDER BY name",
    );
    res.json({ departments: result.rows });
  } catch (err) {
    console.error("Fetch departments error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Public: ticket types for the "new ticket" form
app.get("/ticket-types", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, key, label FROM ticket_types ORDER BY label",
    );
    res.json({ ticketTypes: result.rows });
  } catch (err) {
    console.error("Fetch ticket types error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Authenticated: department roster, used to populate the assignee dropdown
app.get("/departments/:id/members", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM users WHERE department_id = $1 AND role = 'dept_member' ORDER BY name",
      [req.params.id],
    );
    res.json({ members: result.rows });
  } catch (err) {
    console.error("Fetch department members error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
