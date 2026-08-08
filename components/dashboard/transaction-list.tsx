"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, FileText, Pencil, Search, Trash2, TrendingUp } from "lucide-react";
import type { TransactionType, ApiTransaction } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiFetch } from "@/hooks/use-api";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionForm } from "./transaction-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const PAGE_SIZE = 20;

type TypeFilter = "all" | TransactionType;

const typeFilterOptions: { label: string; value: TypeFilter }[] = [
  { label: "All", value: "all" },
  { label: "Income", value: "income" },
  { label: "Expense", value: "expense" },
  { label: "Giving", value: "giving" },
];

interface TransactionsResponse {
  transactions: ApiTransaction[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface TransactionListProps {
  /** Increment to force a re-fetch from page 0 */
  refreshKey?: number;
}

export function TransactionList({ refreshKey = 0 }: TransactionListProps) {
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);

  const [selectedTransaction, setSelectedTransaction] = useState<ApiTransaction | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [tagFilter, setTagFilter] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 250);

  const buildUrl = useCallback(
    (pageNum: number) => {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("pageSize", String(PAGE_SIZE));
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (tagFilter.trim()) params.set("tag", tagFilter.trim());
      if (debouncedSearch) params.set("search", debouncedSearch);
      return `/api/transactions?${params.toString()}`;
    },
    [typeFilter, tagFilter, debouncedSearch],
  );

  const loadPage = useCallback(
    async (pageNum: number, isFirstPage = false) => {
      if (isFirstPage) setLoadingFirst(true);
      else setLoadingPage(true);

      try {
        const data = await apiFetch<TransactionsResponse>(buildUrl(pageNum));
        setTransactions(data.transactions);
        setPage(data.page);
        setHasMore(data.hasMore);
      } catch (error) {
        console.error("Failed to load transactions:", error);
      } finally {
        setLoadingFirst(false);
        setLoadingPage(false);
      }
    },
    [buildUrl],
  );

  useEffect(() => {
    setPage(0);
    loadPage(0, true);
  }, [typeFilter, tagFilter, debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (refreshKey > 0) {
      loadPage(0, true);
    }
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdit = (transaction: ApiTransaction) => {
    setSelectedTransaction(transaction);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      await apiFetch(`/api/transactions/${deleteId}`, { method: "DELETE" });
      toast({ title: "Success", description: "Transaction deleted" });
      const targetPage = transactions.length <= 1 && page > 0 ? page - 1 : page;
      loadPage(targetPage);
    } catch {
      toast({ title: "Error", description: "Failed to delete transaction", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const handlePrev = () => {
    if (page > 0) {
      loadPage(page - 1);
    }
  };

  const handleNext = () => {
    if (hasMore) {
      loadPage(page + 1);
    }
  };

  const getIcon = (type: TransactionType) => {
    if (type === "expense") return <ArrowDownRight className="size-4 text-expense" />;
    if (type === "income") return <TrendingUp className="size-4 text-income" />;
    return <ArrowUpRight className="size-4 text-giving" />;
  };

  const getIconBg = (type: TransactionType) => {
    if (type === "expense") return "bg-expense-surface";
    if (type === "income") return "bg-income-surface";
    return "bg-giving-surface";
  };

  const getAmountColor = (type: TransactionType) => {
    if (type === "expense") return "text-expense";
    if (type === "income") return "text-income";
    return "text-giving";
  };

  const displayPage = page + 1;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">All transactions</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="mb-5 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search category, notes, or tags"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-10"
              />
            </div>

            <Input
              placeholder="Filter by exact tag"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="h-11"
            />

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {typeFilterOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={typeFilter === option.value ? "default" : "outline"}
                  onClick={() => setTypeFilter(option.value)}
                  className="h-10"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {loadingFirst ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border/50 p-3.5">
                  <Skeleton className="size-10 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-14 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
                <FileText className="size-5 text-muted-foreground" />
              </div>
              <p className="font-medium">No transactions found</p>
              <p className="mt-1 text-sm text-muted-foreground">Try another filter or search term.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="rounded-xl border border-border/50 p-3.5 transition-colors hover:bg-accent/30 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl", getIconBg(transaction.type))}>
                        {getIcon(transaction.type)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium sm:text-base">{transaction.category}</p>
                        <p className="text-xs text-muted-foreground sm:text-sm">
                          {transaction.type} · {new Date(transaction.date).toLocaleDateString("en-GB")}
                        </p>
                        {transaction.notes && (
                          <p
                            className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:text-sm"
                            title={transaction.notes}
                          >
                            {transaction.notes}
                          </p>
                        )}
                        {transaction.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {transaction.tags.map((tag) => (
                              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <p className={cn("shrink-0 text-sm font-semibold tabular-nums sm:text-base", getAmountColor(transaction.type))}>
                      {transaction.type === "expense" ? "-" : "+"}
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>

                  <div className="mt-3 flex gap-2 sm:justify-end">
                    <Button type="button" size="sm" variant="outline" className="h-9 flex-1 sm:flex-none" onClick={() => handleEdit(transaction)}>
                      <Pencil className="mr-2 size-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 flex-1 border-rose-200 text-expense hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30 sm:flex-none"
                      onClick={() => handleDelete(transaction.id)}
                    >
                      <Trash2 className="mr-2 size-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loadingPage && <p className="mt-3 text-xs text-muted-foreground">Loading...</p>}

          {(transactions.length > 0 || loadingPage) && (
            <div className="mt-5 flex items-center justify-between">
              <Button variant="outline" size="sm" className="h-9" onClick={handlePrev} disabled={page <= 0 || loadingFirst || loadingPage}>
                Prev
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                Page {displayPage}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={handleNext}
                disabled={!hasMore || loadingFirst || loadingPage}
              >
                {loadingPage ? "Loading..." : "Next"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
        onSuccess={() => loadPage(page)}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete transaction"
        description="Are you sure you want to delete this transaction? This action cannot be undone."
        onConfirm={confirmDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
