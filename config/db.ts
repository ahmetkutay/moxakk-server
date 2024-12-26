import { Pool } from 'pg';
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env file

// Create a new PostgreSQL connection pool
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
});

// Connect to PostgreSQL
const connectDB = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()'); // Simple query to test connection
    client.release();
    console.log("PostgreSQL connected successfully");
  } catch (error) {
    console.error("PostgreSQL connection error:", error);
    process.exit(1); // Exit the process with failure
  }
};

export default connectDB;
export { pool }; // Export pool for use in other files
