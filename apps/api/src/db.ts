import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ override: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;
