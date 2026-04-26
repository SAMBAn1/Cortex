// Read Vercel auth token from local CLI store
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const candidates = [
  join(homedir(), "AppData", "Roaming", "com.vercel.cli", "Data", "auth.json"),
  join(homedir(), "AppData", "Roaming", "com.vercel.cli", "auth.json"),
  join(homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
];
const path = candidates.find(p => existsSync(p));
if (!path) { console.error("no auth.json"); process.exit(1); }
const auth = JSON.parse(readFileSync(path, "utf8"));
const token = auth.token;

const res = await fetch("https://api.vercel.com/v9/projects/cortex?slug=samban1s-projects", {
  headers: { authorization: `Bearer ${token}` },
});
const data = await res.json();
console.log("link:", JSON.stringify(data.link, null, 2));
console.log("autoExposeSystemEnvs:", data.autoExposeSystemEnvs);
console.log("framework:", data.framework);
