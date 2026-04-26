const ref = process.argv[2];
const token = process.env.SUPABASE_PAT;
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
  body: JSON.stringify({ query: "select tablename from pg_tables where schemaname='public' order by tablename;" }),
});
console.log(await res.text());
