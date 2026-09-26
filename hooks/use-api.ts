"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { requireBoundWorkspaceId } from "@/lib/workspace-runtime";

// ─── Generic fetch helpers ───────────────────────────────────────────────────

export function useWorkspaceCurrency() {
  return useWorkspace().activeWorkspace?.currency ?? "GBP";
}

async function apiFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const workspaceId = requireBoundWorkspaceId();
  const headers = new Headers(init?.headers);
  headers.set("x-workspace-id", workspaceId);

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Request failed (${res.status})`,
    );
  }
  return res.json() as Promise<T>;
}

export async function apiFetchBlob(url: string): Promise<Blob> {
  const workspaceId = requireBoundWorkspaceId();
  const headers = new Headers();
  headers.set("x-workspace-id", workspaceId);
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Request failed (${response.status})`,
    );
  }
  return response.blob();
}

// ─── useApiQuery ─────────────────────────────────────────────────────────────
// Drop-in replacement for Convex useQuery.
// Returns `undefined` while loading, the data when ready.
// Call `refresh()` to re-fetch.

interface UseApiQueryResult<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

export function useApiQuery<T>(
  url: string | null,
): UseApiQueryResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const versionRef = useRef(0);

  const load = useCallback(() => {
    if (!url) {
      setData(undefined);
      setLoading(false);
      return;
    }

    const version = ++versionRef.current;
    setLoading(true);
    setError(null);

    apiFetch<T>(url)
      .then((result) => {
        if (version === versionRef.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (version === versionRef.current) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        }
      });
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-fetch when workspace changes
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("workspace-changed", handler);
    return () => window.removeEventListener("workspace-changed", handler);
  }, [load]);

  return { data, error, loading, refresh: load };
}

// ─── useApiMutation ──────────────────────────────────────────────────────────
// Wraps a POST / PATCH / DELETE call. Returns a trigger function + loading state.

interface UseApiMutationResult<TInput, TOutput> {
  mutate: (input: TInput) => Promise<TOutput>;
  loading: boolean;
}

export function useApiMutation<
  TInput = unknown,
  TOutput = unknown,
>(
  urlOrFn: string | ((input: TInput) => { url: string; method?: string }),
  method: string = "POST",
): UseApiMutationResult<TInput, TOutput> {
  const [loading, setLoading] = useState(false);

  const mutate = useCallback(
    async (input: TInput): Promise<TOutput> => {
      setLoading(true);
      try {
        let url: string;
        let httpMethod: string;

        if (typeof urlOrFn === "function") {
          const resolved = urlOrFn(input);
          url = resolved.url;
          httpMethod = resolved.method ?? method;
        } else {
          url = urlOrFn;
          httpMethod = method;
        }

        const result = await apiFetch<TOutput>(url, {
          method: httpMethod,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        return result;
      } finally {
        setLoading(false);
      }
    },
    [urlOrFn, method],
  );

  return { mutate, loading };
}

export { apiFetch };
