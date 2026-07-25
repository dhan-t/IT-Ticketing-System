import { Router, Request, Response } from "express";
import pool from "../db";
import { hashPassword, comparePassword, signToken } from "../auth";

const router = Router();

router.post("/register", async (req: Request, res: Response) => {
  const { name, email, password, departmentId, role } = req.body;

  if (!name || !email || !password || !departmentId || !role) {
    return res.status(400).json({
      error: "name, email, password, departmentId, and role are required",
    });
  }

  if (!["end_user", "dept_member"].includes(role)) {
    return res
      .status(400)
      .json({ error: "role must be 'end_user' or 'dept_member'" });
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const deptCheck = await pool.query(
      "SELECT id FROM departments WHERE id = $1",
      [departmentId],
    );
    if (deptCheck.rows.length === 0) {
      return res.status(400).json({ error: "Invalid departmentId" });
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query<{
      id: number;
      name: string;
      email: string;
      role: string;
      department_id: number;
    }>(
      `INSERT INTO users (name, email, password_hash, role, department_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, department_id`,
      [name, email, passwordHash, role, departmentId],
    );
    const deptNameRes = await pool.query<{ name: string }>(
      "SELECT name FROM departments WHERE id = $1",
      [departmentId],
    );
    const departmentName = deptNameRes.rows[0].name;

    const user = result.rows[0];

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role as "end_user" | "dept_member",
      departmentId: user.department_id,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.department_id,
        departmentName,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const result = await pool.query<{
      id: number;
      name: string;
      email: string;
      password_hash: string;
      role: string;
      department_id: number;
      department_name: string;
    }>(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.department_id, d.name AS department_name
   FROM users u
   JOIN departments d ON d.id = u.department_id
   WHERE u.email = $1`,
      [email],
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role as "end_user" | "dept_member",
      departmentId: user.department_id,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.department_id,
        departmentName: user.department_name,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
