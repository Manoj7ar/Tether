#!/usr/bin/env node
/**
 * Reads project_id from supabase/config.toml, fetches keys via Supabase CLI,
 * and merges VITE_SUPABASE_* into the repo-root .env (marker-delimited block).
 *
 * Requires: `npx supabase login` and network access.
 * Does not write the service role key (keep server secrets out of routine .env).
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const configPath = resolve(root, "supabase/config.toml");
const envPath = resolve(root, ".env");

const MARKER_START = "# --- Supabase (synced by npm run env:supabase) ---";
const MARKER_END = "# --- End Supabase sync ---";

function readProjectRef() {
  const raw = readFileSync(configPath, "utf8");
  const m = raw.match(/project_id\s*=\s*"([^"]+)"/);
  if (!m) {
    throw new Error(`Could not find project_id in ${configPath}`);
  }
  return m[1];
}

function fetchApiKeysJson(projectRef) {
  const out = execFileSync(
    "npx",
    ["supabase", "projects", "api-keys", "--project-ref", projectRef, "-o", "json"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const trimmed = out.trim();
  const start = trimmed.indexOf("[");
  if (start === -1) {
    throw new Error("Supabase CLI did not return JSON array of API keys.");
  }
  return JSON.parse(trimmed.slice(start));
}

function pickPublishableKey(keys) {
  const publishable = keys.find((k) => k.type === "publishable" && k.api_key);
  if (publishable?.api_key) {
    return publishable.api_key;
  }
  const anon = keys.find((k) => k.id === "anon" || k.name === "anon");
  if (anon?.api_key) {
    return anon.api_key;
  }
  throw new Error("No publishable or anon API key found in CLI output.");
}

function buildBlock(projectRef, publishableKey) {
  const url = `https://${projectRef}.supabase.co`;
  return [
    MARKER_START,
    `VITE_SUPABASE_URL=${url}`,
    `VITE_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
    `VITE_SUPABASE_PROJECT_ID=${projectRef}`,
    MARKER_END,
    "",
  ].join("\n");
}

function upsertBlock(envContent, block) {
  const pattern = new RegExp(
    `${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`,
  );
  if (pattern.test(envContent)) {
    return envContent.replace(pattern, block);
  }
  const base = envContent.replace(/\s*$/, "");
  return base ? `${base}\n\n${block}` : block;
}

const projectRef = readProjectRef();
const keys = fetchApiKeysJson(projectRef);
const publishableKey = pickPublishableKey(keys);
const block = buildBlock(projectRef, publishableKey);

let envContent = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
envContent = upsertBlock(envContent, block);
writeFileSync(envPath, envContent, "utf8");

console.log(`Updated ${envPath} with Supabase project ${projectRef} (URL + publishable/anon key).`);
console.log("Add Auth0 VITE_* variables yourself (see .env.example).");
