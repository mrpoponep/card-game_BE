import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "poker_db",
    password: "0000",
    port: 5432
});

export default pool;
