import type { WorkspaceRole } from "./db/workspaces";

interface WorkspaceAccessServices {
  getAccess: (
    actorUserId: string,
    workspaceId: string,
  ) => Promise<{ workspace: { id: string }; role: WorkspaceRole } | null>;
  getOrCreateDefault: (actorUserId: string) => Promise<{ id: string }>;
  hasWorkspaceRole: (role: WorkspaceRole, requiredRole: WorkspaceRole) => boolean;
}

/** An explicit workspace selection must never fall back to different books. */
export async function resolveWorkspaceAccess(
  actorUserId: string,
  headerWorkspaceId: string | null,
  requiredRole: WorkspaceRole,
  services: WorkspaceAccessServices,
): Promise<{ workspaceId: string; role: WorkspaceRole }> {
  if (headerWorkspaceId !== null) {
    if (!headerWorkspaceId.trim()) throw new Error("Unauthorized");
    const access = await services.getAccess(actorUserId, headerWorkspaceId);
    if (!access || !services.hasWorkspaceRole(access.role, requiredRole)) {
      throw new Error("Unauthorized");
    }
    return { workspaceId: access.workspace.id, role: access.role };
  }

  const workspace = await services.getOrCreateDefault(actorUserId);
  return { workspaceId: workspace.id, role: "owner" };
}
