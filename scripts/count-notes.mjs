const ref = "ehosnrvyrzlmaicyvftd";
const token = process.env.SUPABASE_PAT;
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
  body: JSON.stringify({
    query: "select count(*) as notes, (select count(*) from edits) as edits, (select count(*) from versions) as versions, (select count(distinct user_id) from notes) as users from notes;",
  }),
});
console.log(await res.text());
