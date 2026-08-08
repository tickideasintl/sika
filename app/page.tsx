import Link from "next/link";
import { redirect } from "next/navigation";
import { Wallet, CheckCircle2, ArrowRight, TrendingUp, Receipt, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth-server";

export default async function Home() {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-primary p-2">
              <Wallet className="size-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Sika</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/auth/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="container mx-auto max-w-5xl px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Simple money tracking for everyday life
          </h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg max-w-2xl mx-auto">
            Track your income, expenses, and giving in one place. No clutter, no noise —
            just the numbers you need to stay consistent.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/auth/signup">
              <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base">
                Create free account
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 text-base">
                I already have an account
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: TrendingUp,
              title: "Quick entry",
              description: "Add income, expenses, or giving in seconds.",
            },
            {
              icon: Receipt,
              title: "Clear overview",
              description: "See this month's totals and your current balance at a glance.",
            },
            {
              icon: ScanLine,
              title: "Optional receipt scan",
              description: "Use AI receipt scanning when you need it.",
            },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-2xl border border-border/50 p-6 transition-colors hover:bg-accent/30">
                <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="size-5 text-primary" />
                </div>
                <h2 className="font-medium">{feature.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-border/40 bg-muted/30 p-5 text-sm text-muted-foreground">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              Personal finance focused
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              Built for daily use
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              Income · Expense · Giving
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
