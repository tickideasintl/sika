import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesGlob } from "node:path";
import { describe, it } from "node:test";

const patterns = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

// These exclusions use only literal directory names and ** globs.
function excluded(path: string) {
  return patterns.some((pattern) =>
    pattern.endsWith("/")
      ? matchesGlob(path, `${pattern}**`)
      : matchesGlob(path, pattern),
  );
}

describe("Docker build privacy exclusions", () => {
  it("excludes default backups and archives in custom output directories", () => {
    for (const path of [
      "backups/sika.dump",
      "backups/custom-name",
      "operations/backups/custom-name",
      "sika.dump",
      "exports/sika.dump",
      "exports/sika.backup",
      "exports/sika.sql.gz",
      "exports/sika.sql.bz2",
      "exports/sika.sql.xz",
      "exports/.sika.dump.123.partial",
    ]) {
      assert.ok(excluded(path), `${path} must not enter the build context`);
    }
  });

  it("excludes private local stores without excluding migration source", () => {
    for (const path of [
      ".factory/session.json",
      ".kotadb/local.db",
      "memory/session.md",
      "user-plugins/private-config",
      "keys/local.pem",
    ]) {
      assert.ok(excluded(path), `${path} must not enter the build context`);
    }
    assert.equal(excluded("db/migrations/0001_schema.sql"), false);
    assert.equal(excluded("scripts/auto-migrate.mjs"), false);
    assert.equal(excluded("app/dashboard/page.tsx"), false);
  });
});
