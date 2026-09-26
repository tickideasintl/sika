"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { bindWorkspace, resolveWorkspace } from "@/lib/workspace-runtime";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  type: "personal" | "business";
  currency: string;
  envelope_budgeting_enabled: boolean;
  role: "owner" | "editor" | "viewer";
  is_default: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (id: string) => void;
  loading: boolean;
  refreshWorkspaces: () => void;
  createWorkspace: (name: string, type: "personal" | "business", currency?: string) => Promise<void>;
  updateWorkspace: (
    id: string,
    input: Partial<
      Pick<Workspace, "name" | "type" | "currency" | "envelope_budgeting_enabled">
    >,
  ) => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

const STORAGE_KEY = "activeWorkspaceId";

function getStoredWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredWorkspaceId(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Persistence is optional; this tab's resolved selection is authoritative.
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [readyScope, setReadyScope] = useState<string | null>(null);
  const scope = activeWorkspace ? `${activeWorkspace.id}:${activeWorkspace.currency}` : null;
  const selectedId = useRef<string | null | undefined>(undefined);
  const requestVersion = useRef(0);

  // Bind only committed UI, before descendants' passive request effects run.
  useLayoutEffect(() => {
    bindWorkspace(activeWorkspace);
    setReadyScope(scope);
    return () => bindWorkspace(null);
  }, [activeWorkspace, scope]);

  const fetchWorkspaces = useCallback(async () => {
    const version = ++requestVersion.current;
    if (selectedId.current === undefined) selectedId.current = getStoredWorkspaceId();
    try {
      // eslint-disable-next-line no-restricted-syntax -- /api/workspaces is user-scoped (requireAuth), and this call is what decides the active workspace, so it cannot depend on it.
      const res = await fetch("/api/workspaces");
      if (!res.ok) return;
      const data = await res.json();
      if (version !== requestVersion.current) return;
      const ws: Workspace[] = data.workspaces ?? [];
      setWorkspaces(ws);

      const resolved = resolveWorkspace(ws, selectedId.current ?? null);
      selectedId.current = resolved?.id ?? null;
      setActiveWorkspaceState(resolved);
      if (resolved) setStoredWorkspaceId(resolved.id);
    } catch {
      // Silently fail on first load
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
    return () => { requestVersion.current += 1; };
  }, [fetchWorkspaces]);

  const setActiveWorkspace = useCallback(
    (id: string) => {
      const ws = workspaces.find((w) => w.id === id);
      if (!ws) return;
      selectedId.current = id;
      setStoredWorkspaceId(id);
      setActiveWorkspaceState(ws);
    },
    [workspaces],
  );

  const createWorkspace = useCallback(
    async (name: string, type: "personal" | "business", currency = "GBP") => {
      // eslint-disable-next-line no-restricted-syntax -- user-scoped (requireAuth); creates a workspace rather than acting inside one.
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, currency }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to create workspace");
      }
      await fetchWorkspaces();
    },
    [fetchWorkspaces],
  );

  const updateWorkspace = useCallback(
    async (
      id: string,
      input: Partial<
        Pick<Workspace, "name" | "type" | "currency" | "envelope_budgeting_enabled">
      >,
    ) => {
      // eslint-disable-next-line no-restricted-syntax -- user-scoped (requireAuth); the target workspace is the path segment, not the header.
      const res = await fetch(`/api/workspaces/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to update workspace");
      }
      await fetchWorkspaces();
    },
    [fetchWorkspaces],
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        setActiveWorkspace,
        loading,
        refreshWorkspaces: fetchWorkspaces,
        createWorkspace,
        updateWorkspace,
      }}
    >
      {activeWorkspace && readyScope === scope ? (
        <Fragment key={activeWorkspace.id}>{children}</Fragment>
      ) : (
        <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground" role="status">
          {loading || activeWorkspace ? "Loading workspace…" : (
            <div className="space-y-3 text-center">
              <p>Could not load a workspace.</p>
              <button type="button" className="underline" onClick={() => void fetchWorkspaces()}>Try again</button>
            </div>
          )}
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
