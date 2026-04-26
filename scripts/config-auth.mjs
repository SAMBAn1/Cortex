// Set Supabase Auth Site URL + redirect allow-list
const ref = "ehosnrvyrzlmaicyvftd";
const token = process.env.SUPABASE_PAT;
const site = "https://cortex-psi.vercel.app";
const allow = [
  site, `${site}/**`,
  "https://cortex-samban1s-projects.vercel.app", "https://cortex-samban1s-projects.vercel.app/**",
  "https://cortex-samban1-samban1s-projects.vercel.app", "https://cortex-samban1-samban1s-projects.vercel.app/**",
  "http://localhost:5173", "http://localhost:5173/**",
].join(",");

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
  body: JSON.stringify({ site_url: site, uri_allow_list: allow }),
});
console.log(`status ${res.status}`);
const text = await res.text();
console.log(text.slice(0, 600));
