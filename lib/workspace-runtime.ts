/**
 * The workspace actually committed by this tab's provider. Storage is only an
 * initial preference; it must never choose the target of a request.
 */
let workspace: { id: string; currency: string } | null = null;

export function bindWorkspace(value: { id: string; currency: string } | null) {
  workspace = value;
}

export function getBoundWorkspace() {
  return workspace;
}

export function requireBoundWorkspaceId(): string {
  if (!workspace) throw new Error("Workspace is not ready. Please try again.");
  return workspace.id;
}

export function resolveWorkspace<T extends { id: string; is_default: boolean }>(
  workspaces: T[],
  preferredId: string | null,
): T | null {
  return workspaces.find((item) => item.id === preferredId)
    ?? workspaces.find((item) => item.is_default)
    ?? workspaces[0]
    ?? null;
}
