import { headers } from "next/headers";
import { auth } from "./auth";
import * as workspaceService from "./db/workspaces";
import type { WorkspaceRole } from "./db/workspaces";
import { resolveWorkspaceAccess } from "./workspace-access";

// ─── Core server helpers ─────────────────────────────────────────────────────

/**
 * Return the current Better Auth session (user + session), or null.
 * Uses the incoming request cookies via `next/headers`.
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Quick boolean check – does the current request have a valid session?
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

/**
 * Return the authenticated user's id, or throw 401.
 * Useful in API routes / server actions that require auth.
 */
export async function requireAuth(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

/**
 * Resolve the active Workspace and enforce its minimum role.
 * `actorUserId` is the signed-in Member. Isolation of the books is the
 * Workspace, not the Owner — callers must not treat anyone as the Owner's id.
 * Without an `x-workspace-id` header, use the Member's own default Workspace.
 */
export async function requireAuthWithWorkspace(
  requiredRole: WorkspaceRole = "editor",
): Promise<{
  actorUserId: string;
  workspaceId: string;
  role: WorkspaceRole;
}> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  const actorUserId = session.user.id;

  const h = await headers();
  const headerWorkspaceId = h.get("x-workspace-id");

  const access = await resolveWorkspaceAccess(
    actorUserId,
    headerWorkspaceId,
    requiredRole,
    workspaceService,
  );
  return {
    actorUserId,
    ...access,
  };
}
