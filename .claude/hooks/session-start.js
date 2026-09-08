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
const isTapasDutta =
  lower.includes("dutta") &&
  (lower.includes("tapas") || lower.includes("tapash"));

if (lower.includes("abhijit") && lower.includes("adhikari")) {
  process.stdout.write(
    "Welcome Abhijit Adhikari. Gate 1 reviewer. Read .agent/rules/governance.md " +
      "§ Reviewer self-identification. Ask Artifact vs Manual — do not infer.\n"
  );
} else if (isTapasDutta) {
  process.stdout.write(
    "Welcome Tapas Dutta. Gate 2 reviewer. Read .agent/rules/governance.md " +
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
      "\". If this is not Abhijit Adhikari, Tapas Dutta, or Alamgir Sarkar, " +
      "treat this name as author of record for this session " +
      "(.agent/rules/governance.md step 4).\n"
  );
}
