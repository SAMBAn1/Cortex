// One-off: send a SQL file to Supabase via the Management API.
// Usage: node scripts/run-sql.mjs <project-ref> <sql-file>
import { readFileSync } from "node:fs";

const [, , ref, file] = process.argv;
const token = process.env.SUPABASE_PAT;
if (!ref || !file || !token) {
  console.error("Usage: SUPABASE_PAT=... node scripts/run-sql.mjs <project-ref> <sql-file>");
  process.exit(1);
}
const query = readFileSync(file, "utf8");
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
  body: JSON.stringify({ query }),
});
const text = await res.text();
console.log(`status ${res.status}`);
console.log(text);
process.exit(res.ok ? 0 : 1);
