"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CheckCheck, FileText, Pencil, Search, Trash2, TrendingUp } from "lucide-react";
import type {
  ApiFinancialAccount,
  ApiGivingRecipient,
  ApiTransaction,
  TransactionStatus,
  TransactionType,
} from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiFetch, useApiQuery } from "@/hooks/use-api";
import { formatCurrency, cn } from "@/lib/utils";
import { formatSignedAmount, moneyTypeTone } from "@/lib/money-type";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionForm } from "./transaction-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const PAGE_SIZE = 20;

type TypeFilter = "all" | TransactionType;
type StatusFilter = "all" | TransactionStatus;
type ReviewFilter = "all" | "needs_review" | "reviewed";
type AssigneeFilter = "all" | "mine" | "unassigned";
type Reviewer = { userId: string; name: string; role: "owner" | "editor" | "viewer" };

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

/**
 * Shared by the column head and every row so the two cannot drift apart.
 * Passed as a custom property rather than interpolated into the class name:
 * Tailwind scans source for literal class strings, so a built-up
 * `grid-cols-[...]` would never be compiled.
 */
const TX_COLUMNS = "minmax(0,1fr) 130px 100px 110px 84px";

export function TransactionList({ refreshKey = 0 }: TransactionListProps) {
  const { toast } = useToast();
  const { data: accountData } = useApiQuery<{ accounts: ApiFinancialAccount[] }>(
    "/api/financial-accounts",
  );
  const accounts = useMemo(() => accountData?.accounts ?? [], [accountData?.accounts]);
  const accountNames = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts],
  );
  const { data: givingData } = useApiQuery<{ recipients: ApiGivingRecipient[] }>(
    "/api/giving-recipients",
  );
  const givingNames = useMemo(() => {
    const recipients = givingData?.recipients ?? [];
    return {
      recipients: new Map(recipients.map((recipient) => [recipient.id, recipient.name])),
      designations: new Map(
        recipients.flatMap((recipient) =>
          recipient.designations.map((designation) => [designation.id, designation.name] as const),
        ),
      ),
    };
  }, [givingData?.recipients]);
  const { data: reviewerData } = useApiQuery<{ reviewers: Reviewer[] }>("/api/workspace-reviewers");
  const reviewers = reviewerData?.reviewers ?? [];
  const reviewerNames = new Map(reviewers.map((reviewer) => [reviewer.userId, reviewer.name]));

  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);

  const [selectedTransaction, setSelectedTransaction] = useState<ApiTransaction | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all");
  const [locationFilterReady, setLocationFilterReady] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkPayee, setBulkPayee] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 250);

  const buildUrl = useCallback(
    (pageNum: number) => {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("pageSize", String(PAGE_SIZE));
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (accountFilter !== "all") params.set("accountId", accountFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (reviewFilter !== "all") {
        params.set("needsReview", reviewFilter === "needs_review" ? "true" : "false");
      }
      if (assigneeFilter !== "all") params.set("assignee", assigneeFilter);
      if (tagFilter.trim()) params.set("tag", tagFilter.trim());
      if (debouncedSearch) params.set("search", debouncedSearch);
      return `/api/transactions?${params.toString()}`;
    },
    [typeFilter, accountFilter, statusFilter, reviewFilter, assigneeFilter, tagFilter, debouncedSearch],
  );

  const loadPage = useCallback(
    async (pageNum: number, isFirstPage = false) => {
      if (isFirstPage) setLoadingFirst(true);
      else setLoadingPage(true);

      try {
        const data = await apiFetch<TransactionsResponse>(buildUrl(pageNum));
        setTransactions(data.transactions);
        setSelectedIds(new Set());
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
    if (!locationFilterReady) return;
    setPage(0);
    loadPage(0, true);
  }, [typeFilter, accountFilter, statusFilter, reviewFilter, assigneeFilter, tagFilter, debouncedSearch, locationFilterReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (refreshKey > 0) {
      loadPage(0, true);
    }
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get("needsReview") === "true") {
      setReviewFilter("needs_review");
    }
    // Arriving from a money figure elsewhere in the app — a dashboard stat tile,
    // a report — lands on that type already filtered rather than on everything.
    const type = search.get("type");
    if (typeFilterOptions.some((option) => option.value === type)) {
      setTypeFilter(type as TypeFilter);
    }
    setLocationFilterReady(true);
    if (window.location.hash === "#transaction-search") {
      requestAnimationFrame(() => {
        document.getElementById("transaction-search")?.focus();
      });
    }
  }, []);

  /**
   * The list is already date-ordered, so grouping only has to break it where
   * the day changes — a running date header reads faster than repeating the
   * date on every row.
   */
  const groupedByDay = useMemo(() => {
    const groups: { key: string; label: string; items: ApiTransaction[] }[] = [];
    for (const tx of transactions) {
      const date = new Date(tx.date);
      const key = date.toISOString().slice(0, 10);
      const last = groups[groups.length - 1];
      if (last?.key === key) {
        last.items.push(tx);
      } else {
        groups.push({
          key,
          label: date.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }),
          items: [tx],
        });
      }
    }
    return groups;
  }, [transactions]);

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

  const applyBulkUpdate = async (changes: {
    needsReview?: boolean;
    assignedToUserId?: string | null;
    category?: string;
    payee?: string | null;
  }) => {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      const result = await apiFetch<{ updated: number }>("/api/transactions/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds], ...changes }),
      });
      toast({ title: "Transactions updated", description: `${result.updated} transaction${result.updated === 1 ? "" : "s"} changed` });
      setBulkCategory("");
      setBulkPayee("");
      await loadPage(page);
    } catch (error) {
      toast({
        title: "Bulk update failed",
        description: error instanceof Error ? error.message : "Unable to update transactions",
        variant: "destructive",
      });
    } finally {
      setBulkSaving(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Glyph is the one thing that varies by direction; colour comes from the
   *  shared map, so a tile and its amount can never disagree. */
  const getIcon = (type: TransactionType) => {
    const cls = `size-3.5 ${moneyTypeTone(type).text}`;
    if (type === "expense") return <ArrowDownRight className={cls} />;
    if (type === "income") return <TrendingUp className={cls} />;
    return <ArrowUpRight className={cls} />;
  };

  const displayPage = page + 1;

  return (
    <>
      <div className="flex flex-col gap-2.5 min-[860px]:flex-row min-[860px]:items-center">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="transaction-search"
            placeholder="Search payee, category, notes, or tags"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-[38px] scroll-mt-6 bg-card pl-9"
          />
        </div>

        <Input
          placeholder="Exact tag"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="h-[38px] bg-card min-[860px]:w-[190px]"
        />

        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="h-[38px] min-[860px]:w-[190px]" aria-label="Filter by account">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger className="h-[38px] min-[860px]:w-[150px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cleared">Cleared</SelectItem>
            <SelectItem value="reconciled">Reconciled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={reviewFilter} onValueChange={(value) => setReviewFilter(value as ReviewFilter)}>
          <SelectTrigger className="h-[38px] min-[860px]:w-[160px]" aria-label="Filter by review state">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All review states</SelectItem>
            <SelectItem value="needs_review">Needs review</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={assigneeFilter} onValueChange={(value) => setAssigneeFilter(value as AssigneeFilter)}>
          <SelectTrigger className="h-[38px] min-[860px]:w-[150px]" aria-label="Filter by reviewer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reviewers</SelectItem>
            <SelectItem value="mine">Assigned to me</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>

        <div className="grid grid-cols-4 gap-1.5">
          {typeFilterOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={typeFilter === option.value ? "default" : "outline"}
              onClick={() => setTypeFilter(option.value)}
              className="h-[38px]"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 sm:flex-row sm:items-center">
          <span className="text-sm font-medium tabular-nums">{selectedIds.size} selected</span>
          <Input
            value={bulkCategory}
            onChange={(event) => setBulkCategory(event.target.value)}
            placeholder="Set category"
            maxLength={100}
            className="h-9 sm:max-w-[190px]"
          />
          <Button type="button" size="sm" variant="outline" disabled={bulkSaving || !bulkCategory.trim()} onClick={() => void applyBulkUpdate({ category: bulkCategory.trim() })}>
            Apply category
          </Button>
          <Input
            value={bulkPayee}
            onChange={(event) => setBulkPayee(event.target.value)}
            placeholder="Set payee"
            maxLength={200}
            className="h-9 sm:max-w-[190px]"
          />
          <Button type="button" size="sm" variant="outline" disabled={bulkSaving || !bulkPayee.trim()} onClick={() => void applyBulkUpdate({ payee: bulkPayee.trim() })}>
            Apply payee
          </Button>
          <Button type="button" size="sm" disabled={bulkSaving} onClick={() => void applyBulkUpdate({ needsReview: false })}>
            <CheckCheck className="size-4" /> Mark reviewed
          </Button>
          <Select
            onValueChange={(value) => void applyBulkUpdate({
              assignedToUserId: value === "unassigned" ? null : value,
              ...(value !== "unassigned" && { needsReview: true }),
            })}
          >
            <SelectTrigger className="h-9 sm:w-[170px]" aria-label="Assign selected transactions">
              <SelectValue placeholder="Assign reviewer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {reviewers.map((reviewer) => (
                <SelectItem key={reviewer.userId} value={reviewer.userId}>{reviewer.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loadingFirst ? (
            <div className="space-y-2 p-5 sm:p-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3.5">
                  <Skeleton className="size-7 rounded-[9px]" />
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
            <div>
              {/* Column head, desktop only: below sm the row restates its own
                  fields, so a header would label columns that are not there. */}
              <div
                className="hidden gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground sm:grid sm:grid-cols-[var(--cols)] sm:px-6"
                style={{ "--cols": TX_COLUMNS } as React.CSSProperties}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label="Select all transactions on this page"
                    checked={transactions.length > 0 && transactions.every((transaction) => selectedIds.has(transaction.id))}
                    onChange={(event) => setSelectedIds(event.target.checked ? new Set(transactions.map((transaction) => transaction.id)) : new Set())}
                    className="size-4 accent-primary"
                  />
                  Payee / category
                </span>
                <span>Tags</span>
                <span>Date</span>
                <span className="text-right">Amount</span>
                <span className="sr-only">Actions</span>
              </div>

              {groupedByDay.map((group) => (
                <div key={group.key}>
                  <p className="border-y border-border/60 bg-sunken px-5 py-2.5 text-[11.5px] font-semibold text-muted-foreground sm:px-6">
                    {group.label}
                  </p>

                  {group.items.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-border/60 px-5 py-3.5 transition-colors hover:bg-secondary/40 sm:grid-cols-[var(--cols)] sm:px-6"
                      style={{ "--cols": TX_COLUMNS } as React.CSSProperties}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${transaction.payee || transaction.category}`}
                          checked={selectedIds.has(transaction.id)}
                          onChange={() => toggleSelected(transaction.id)}
                          className="size-4 shrink-0 accent-primary"
                        />
                        <div
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-[9px]",
                            moneyTypeTone(transaction.type).surface
                          )}
                        >
                          {getIcon(transaction.type)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium">
                            {transaction.payee || transaction.category}
                            {transaction.needs_review && (
                              <span className="ml-2 rounded-full bg-obligation-surface px-2 py-0.5 text-[10px] font-semibold text-obligation">Review</span>
                            )}
                            {transaction.assigned_to_user_id && (
                              <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                                {reviewerNames.get(transaction.assigned_to_user_id) ?? "Assigned"}
                              </span>
                            )}
                          </p>
                          {(transaction.payee ||
                            transaction.account_id ||
                            transaction.status !== "cleared" ||
                            transaction.giving_recipient_id ||
                            transaction.giving_designation_id ||
                            transaction.notes) && (
                            <p
                              className="truncate text-xs text-muted-foreground"
                              title={transaction.notes ?? undefined}
                            >
                              {[
                                transaction.payee ? transaction.category : null,
                                transaction.account_id
                                  ? accountNames.get(transaction.account_id) ?? "Archived account"
                                  : null,
                                transaction.status !== "cleared" ? transaction.status : null,
                                transaction.giving_recipient_id
                                  ? givingNames.recipients.get(transaction.giving_recipient_id) ??
                                    "Archived recipient"
                                  : null,
                                transaction.giving_designation_id
                                  ? givingNames.designations.get(transaction.giving_designation_id) ??
                                    "Archived fund"
                                  : null,
                                transaction.notes,
                              ].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="hidden flex-wrap gap-1.5 sm:flex">
                        {transaction.tags.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          transaction.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))
                        )}
                      </div>

                      <span className="hidden text-[13px] text-muted-foreground sm:block">
                        {new Date(transaction.date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>

                      <span
                        className={cn(
                          "text-right text-sm font-semibold tabular-nums",
                          moneyTypeTone(transaction.type).text
                        )}
                      >
                        {formatSignedAmount(transaction.type, transaction.amount)}
                      </span>

                      <span className="col-span-2 flex items-center justify-end gap-1 sm:col-auto">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label={`Edit ${transaction.category}`}
                          onClick={() => handleEdit(transaction)}
                          disabled={transaction.status === "reconciled"}
                          title={transaction.status === "reconciled" ? "Reconciled transactions are locked" : undefined}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive hover:text-destructive"
                          aria-label={`Delete ${transaction.category}`}
                          onClick={() => handleDelete(transaction.id)}
                          disabled={transaction.status === "reconciled"}
                          title={transaction.status === "reconciled" ? "Reconciled transactions are locked" : undefined}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {(transactions.length > 0 || loadingPage) && (
            <div className="flex items-center justify-between border-t border-border/60 bg-sunken px-5 py-3.5 sm:px-6">
              <span className="text-[12.5px] text-muted-foreground tabular-nums">
                Page {displayPage}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8" onClick={handlePrev} disabled={page <= 0 || loadingFirst || loadingPage}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={handleNext}
                  disabled={!hasMore || loadingFirst || loadingPage}
                >
                  {loadingPage ? "Loading..." : "Next"}
                </Button>
              </div>
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
