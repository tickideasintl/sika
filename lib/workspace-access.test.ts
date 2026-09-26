import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveWorkspaceAccess } from "./workspace-access";
import type { WorkspaceRole } from "./db/workspaces";

function services(role: WorkspaceRole | null = "editor") {
  const calls: string[] = [];
  return {
    calls,
    getAccess: async (actorUserId: string, workspaceId: string) => {
      calls.push(`access:${actorUserId}:${workspaceId}`);
      return role ? { workspace: { id: workspaceId }, role } : null;
    },
    getOrCreateDefault: async (actorUserId: string) => {
      calls.push(`default:${actorUserId}`);
      return { id: "personal" };
    },
    hasWorkspaceRole: (actual: WorkspaceRole, required: WorkspaceRole) =>
      ["viewer", "editor", "owner"].indexOf(actual) >=
      ["viewer", "editor", "owner"].indexOf(required),
  };
}

describe("request workspace selection", () => {
  it("uses the personal workspace only when the header is absent", async () => {
    const service = services();
    assert.deepEqual(
      await resolveWorkspaceAccess("member", null, "editor", service),
      { workspaceId: "personal", role: "owner" },
    );
    assert.deepEqual(service.calls, ["default:member"]);
  });

  it("keeps an authorized explicit selection and the member's role", async () => {
    const service = services();
    assert.deepEqual(
      await resolveWorkspaceAccess("member", "business", "editor", service),
      { workspaceId: "business", role: "editor" },
    );
    assert.deepEqual(service.calls, ["access:member:business"]);
  });

  it("rejects deleted or revoked workspaces without touching personal books", async () => {
    const service = services(null);
    await assert.rejects(
      resolveWorkspaceAccess("member", "unavailable", "viewer", service),
      /Unauthorized/,
    );
    assert.deepEqual(service.calls, ["access:member:unavailable"]);
  });

  it("rejects insufficient roles without falling back to owner privileges", async () => {
    const service = services("viewer");
    await assert.rejects(
      resolveWorkspaceAccess("member", "business", "editor", service),
      /Unauthorized/,
    );
    assert.deepEqual(service.calls, ["access:member:business"]);
  });

  it("allows a viewer to read an explicitly selected workspace", async () => {
    const service = services("viewer");
    assert.deepEqual(
      await resolveWorkspaceAccess("member", "business", "viewer", service),
      { workspaceId: "business", role: "viewer" },
    );
  });

  for (const header of ["", "   "]) {
    it(`rejects an explicitly empty header ${JSON.stringify(header)}`, async () => {
      const service = services();
      await assert.rejects(
        resolveWorkspaceAccess("member", header, "editor", service),
        /Unauthorized/,
      );
      assert.deepEqual(service.calls, []);
    });
  }

  it("propagates access lookup failures instead of selecting personal books", async () => {
    const service = services();
    service.getAccess = async () => {
      throw new Error("Database unavailable");
    };
    await assert.rejects(
      resolveWorkspaceAccess("member", "business", "editor", service),
      /Database unavailable/,
    );
    assert.deepEqual(service.calls, []);
  });
});
