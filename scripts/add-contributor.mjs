// Reads the handle from an issue body, validates it, and adds it to contributors.json.
// The issue body is untrusted input: it arrives via an environment variable, is never
// interpolated into a shell, and is accepted only if it matches a strict handle pattern.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const FILE = "contributors.json";
const BSKY_HOST = "https://bsky.social";
const HANDLE_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$/;

const body = process.env.ISSUE_BODY || "";
const outFile = process.env.GITHUB_OUTPUT;

function setOutput(key, value) {
  if (outFile) appendFileSync(outFile, `${key}=${value}\n`);
  console.log(`${key}=${value}`);
}

// Issue forms render the field as "### Bluesky handle" followed by the answer.
const match = body.match(/###\s*Bluesky handle\s*\n+\s*([^\n]+)/i);
const handle = (match?.[1] || "").trim().replace(/^@/, "").toLowerCase();

setOutput("handle", handle);

if (!HANDLE_RE.test(handle)) {
  setOutput("status", "invalid");
  process.exit(0);
}

// Confirm the account exists before listing it.
const res = await fetch(
  `${BSKY_HOST}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
);
if (!res.ok) {
  setOutput("status", "unresolvable");
  process.exit(0);
}

const list = JSON.parse(readFileSync(FILE, "utf8"));
if (list.map(h => h.toLowerCase()).includes(handle)) {
  setOutput("status", "exists");
  process.exit(0);
}

list.push(handle);
list.sort((a, b) => a.localeCompare(b));
writeFileSync(FILE, JSON.stringify(list, null, 2) + "\n");
setOutput("status", "added");
