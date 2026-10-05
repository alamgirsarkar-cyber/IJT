#!/usr/bin/env node
/**
 * Claude Code SessionStart convenience. Not access control.
 * Canonical procedure: .agent/rules/governance.md
 */
const { execSync } = require("child_process");

function gitUserName() {
  try {
    return execSync("git config user.name", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const name = gitUserName();
const lower = name.toLowerCase();
// G2-F12: the Gate 2 reviewer is Subhajit Mukherjee (reassigned from Tapas/Tapash Dutta in
// commits e9fb376, 7b94bd3, 0fa4aae). Match the current reviewer's name.
const isSubhajitMukherjee =
  lower.includes("subhajit") || lower.includes("mukherjee");

if (lower.includes("abhijit") && lower.includes("adhikari")) {
  process.stdout.write(
    "Welcome Abhijit Adhikari. Gate 1 reviewer. Read .agent/rules/governance.md " +
      "§ Reviewer self-identification. Ask Artifact vs Manual — do not infer.\n"
  );
} else if (isSubhajitMukherjee) {
  process.stdout.write(
    "Welcome Subhajit Mukherjee. Gate 2 reviewer. Read .agent/rules/governance.md " +
      "§ Reviewer self-identification. Ask Artifact vs Manual — do not infer.\n"
  );
} else if (lower.includes("alamgir") && lower.includes("sarkar")) {
  process.stdout.write(
    "Session author of record: Alamgir Sarkar. Cannot also be Gate 1 or Gate 2 " +
      "reviewer for this work (.agent/rules/governance.md).\n"
  );
} else if (name) {
  process.stdout.write(
    "Session git user.name is \"" +
      name +
      "\". If this is not Abhijit Adhikari, Subhajit Mukherjee, or Alamgir Sarkar, " +
      "treat this name as author of record for this session " +
      "(.agent/rules/governance.md step 4).\n"
  );
}
