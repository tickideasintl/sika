"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import {
  DashboardMobileHeader,
  DashboardTabBar,
} from "@/components/dashboard/dashboard-mobile-nav";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { apiFetch } from "@/hooks/use-api";
import { authClient } from "@/lib/auth-client";
import { NotificationsProvider } from "@/hooks/use-notifications";

function WorkspaceSeed() {
  // Mounted inside the resolved, workspace-keyed subtree, never before binding.
  useEffect(() => {
    apiFetch("/api/categories/seed", { method: "POST" }).catch((error) => {
      console.error("Failed to seed default categories", error);
    });
  }, []);
  return null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/auth/login");
      return;
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };

  return (
    <WorkspaceProvider>
      <WorkspaceSeed />
      <NotificationsProvider>
        <div className="flex min-h-screen bg-background">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[11px] focus:bg-primary focus:px-3.5 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <DashboardSidebar user={user} />
          <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-5 pt-4.5 lg:max-w-[1240px] lg:gap-[26px] lg:px-8 lg:pb-14 lg:pt-6">
            <DashboardMobileHeader user={user} />
            <div id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
              <Suspense
                fallback={
                  <div
                    className="flex min-h-[320px] items-center justify-center"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="size-7 animate-spin text-muted-foreground" />
                    <span className="sr-only">Loading dashboard</span>
                  </div>
                }
              >
                {children}
              </Suspense>
            </div>
            <DashboardTabBar />
          </main>
        </div>
      </NotificationsProvider>
    </WorkspaceProvider>
  );
}
