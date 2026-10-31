import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  recurringMoneySettlements,
  recurringMoneyOccurrences,
  recurringOutgoings,
  transactions,
} from "@/db/schema";
import {
  amountSchema,
  boundedDateSchema,
  idSchema,
  periodMonthSchema,
  workspaceIdSchema,
} from "@/lib/db/validation";
import { lockWorkspaceLedger, type LedgerReader } from "@/lib/db/ledger-lock";
import { assertInWorkspace, assertDateIsOpen } from "@/lib/db/financial-accounts";
import { ownerUserId } from "@/lib/db/workspaces";
import { formatUtcDate, getPeriodMonthFromDate } from "@/lib/outgoings-date";

export type MoneyType = "income" | "expense" | "giving";
export type OccurrenceStatus = "unsettled" | "partial" | "settled" | "overpaid";
export type SettlementProvenance = "lifecycle-created" | "externally-created";
export type OccurrenceId = string;

type Executor = Pick<typeof db, "select" | "insert" | "update" | "delete">;
type RecordedRow = typeof recurringMoneyOccurrences.$inferSelect;
type ScheduleRow = typeof recurringOutgoings.$inferSelect;

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export function fixedClock(value: Date | string): Clock {
  const instant = new Date(value).getTime();
  if (!Number.isFinite(instant)) {
    throw new RecurringMoneyOccurrenceError("Fixed clock requires a valid instant");
  }
  return { now: () => new Date(instant) };
}

export interface OccurrenceSettlement {
  id: string;
  transactionId: string;
  amount: number;
  date: string;
  payee: string | null;
  provenance: SettlementProvenance;
  createdAt: Date;
}

export interface RecurringMoneyOccurrence {
  id: OccurrenceId;
  recurringMoneyId: string;
  periodMonth: string;
  state: "projected" | "recorded";
  name: string;
  dueDate: string;
  expectedAmount: number;
  type: MoneyType;
  category: string | null;
  payee: string | null;
  clientId: string | null;
  givingRecipientId: string | null;
  givingDesignationId: string | null;
  notes: string | null;
  rebillMode: "none" | "at_cost" | "fixed" | "bundled";
  rebillAmount: number | null;
  status: OccurrenceStatus;
  recordedAmount: number;
  outstandingAmount: number;
  overpaidAmount: number;
  settlements: OccurrenceSettlement[];
}

export interface OccurrenceMonth {
  periodMonth: string;
  occurrences: RecurringMoneyOccurrence[];
}

export type SettlementRequest =
  | {
      action: "mark-paid";
      occurrenceId: OccurrenceId;
      paidAt: string;
    }
  | {
      action: "match";
      occurrenceId: OccurrenceId;
      transactionId: string;
    }
  | {
      action: "unmatch";
      occurrenceId: OccurrenceId;
      transactionId: string;
    };

export interface SettlementResult {
  occurrence: RecurringMoneyOccurrence;
  transactionId: string;
}

export interface OccurrenceRevision {
  occurrenceId: OccurrenceId;
  expectedAmount: number;
}

export interface ValidatedImportCandidate {
  fingerprint: string;
  lineNumber: number;
  amount: number;
  date: string;
  type: MoneyType;
  category: string;
  payee: string | null;
  notes: string | null;
  tags: string[];
  clientId?: string | null;
  givingRecipientId?: string | null;
  givingDesignationId?: string | null;
  needsReview?: boolean;
}

export type ImportRequest =
  | {
      mode: "preview";
      accountId: string | null;
      candidates: ValidatedImportCandidate[];
    }
  | {
      mode: "commit";
      accountId: string | null;
      candidates: ValidatedImportCandidate[];
    };

export interface ImportPreviewResult {
  mode: "preview";
  ready: number;
  duplicateLineNumbers: number[];
  matchedLineNumbers: number[];
}

export interface ImportCommitResult {
  mode: "commit";
  importedIds: string[];
  duplicateLineNumbers: number[];
  matchedLineNumbers: number[];
}

export type ImportResult = ImportPreviewResult | ImportCommitResult;

export type RelatedChange =
  | {
      kind: "transaction-type";
      transactionId: string;
      nextType: MoneyType;
    }
  | {
      kind: "schedule-deletion";
      recurringMoneyId: string;
    };

export interface RecurringMoneyOccurrences {
  month(workspaceId: string, periodMonth: string): Promise<OccurrenceMonth>;
  settle(workspaceId: string, request: SettlementRequest): Promise<SettlementResult>;
  revise(
    workspaceId: string,
    request: OccurrenceRevision,
  ): Promise<RecurringMoneyOccurrence>;
  importTransactions(
    workspaceId: string,
    request: Extract<ImportRequest, { mode: "preview" }>,
  ): Promise<ImportPreviewResult>;
  importTransactions(
    workspaceId: string,
    request: Extract<ImportRequest, { mode: "commit" }>,
  ): Promise<ImportCommitResult>;
  assertChange(workspaceId: string, request: RelatedChange, executor?: LedgerReader): Promise<void>;
}

export class RecurringMoneyOccurrenceError extends Error {}
export class RecurringMoneySettlementError extends RecurringMoneyOccurrenceError {}
export class RecurringMoneyConstraintError extends RecurringMoneyOccurrenceError {}

interface OccurrenceReference {
  recurringMoneyId: string;
  periodMonth: string;
}

interface MatchCandidate {
  key: string;
  amount: number;
  occurrenceId: OccurrenceId;
  recurringMoneyId: string;
  periodMonth: string;
  category: string | null;
  clientId: string | null;
  givingRecipientId: string | null;
  givingDesignationId: string | null;
}

function occurrenceId(recurringMoneyId: string, periodMonth: string): OccurrenceId {
  return `recurring-money:${recurringMoneyId}:${periodMonth}`;
}

function occurrenceReference(id: OccurrenceId): OccurrenceReference {
  idSchema.parse(id);
  const prefix = "recurring-money:";
  if (!id.startsWith(prefix) || id.length <= prefix.length + 11) {
    throw new RecurringMoneyOccurrenceError("Invalid Recurring money occurrence id");
  }
  const separator = id.length - 11;
  if (id[separator] !== ":") {
    throw new RecurringMoneyOccurrenceError("Invalid Recurring money occurrence id");
  }
  const recurringMoneyId = id.slice(prefix.length, separator);
  const periodMonth = id.slice(separator + 1);
  idSchema.parse(recurringMoneyId);
  periodMonthSchema.parse(periodMonth);
  return { recurringMoneyId, periodMonth };
}

function dateForPeriod(periodMonth: string, dayOfMonth: number) {
  const [year, month] = periodMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${periodMonth.slice(0, 8)}${String(Math.min(dayOfMonth, lastDay)).padStart(2, "0")}`;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDate(date);
}

function monthsBetween(firstDate: string, lastDate: string) {
  const first = new Date(`${getPeriodMonthFromDate(firstDate)}T00:00:00.000Z`);
  const last = getPeriodMonthFromDate(lastDate);
  const months: string[] = [];
  while (formatUtcDate(first) <= last) {
    months.push(formatUtcDate(first));
    first.setUTCMonth(first.getUTCMonth() + 1);
  }
  return months;
}

function dateDistance(left: string, right: string) {
  return Math.abs(
    (Date.parse(`${left}T00:00:00.000Z`) - Date.parse(`${right}T00:00:00.000Z`)) /
      86_400_000,
  );
}

function moneyInPence(value: number | string) {
  return Math.round(Number(value) * 100);
}

function normalizedPayee(value: string | null) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, "").trim() ?? "";
}

function payeesMatch(expected: string | null, actual: string | null) {
  const expectedValue = normalizedPayee(expected);
  if (!expectedValue) return true;
  const actualValue = normalizedPayee(actual);
  return Boolean(
    actualValue &&
      (actualValue.includes(expectedValue) || expectedValue.includes(actualValue)),
  );
}

function statusFor(expectedAmount: number, recordedAmount: number): OccurrenceStatus {
  const expected = moneyInPence(expectedAmount);
  const recorded = moneyInPence(recordedAmount);
  if (recorded === 0) return "unsettled";
  if (recorded < expected) return "partial";
  if (recorded === expected) return "settled";
  return "overpaid";
}

function projectedOccurrence(schedule: ScheduleRow, periodMonth: string): RecurringMoneyOccurrence {
  const expectedAmount = Number(schedule.amount);
  return {
    id: occurrenceId(schedule.id, periodMonth),
    recurringMoneyId: schedule.id,
    periodMonth,
    state: "projected",
    name: schedule.name,
    dueDate: dateForPeriod(periodMonth, schedule.dayOfMonth),
    expectedAmount,
    type: schedule.type,
    category: schedule.category,
    payee: schedule.vendor,
    clientId: schedule.clientId,
    givingRecipientId: schedule.givingRecipientId,
    givingDesignationId: schedule.givingDesignationId,
    notes: schedule.notes,
    rebillMode: schedule.rebillMode,
    rebillAmount: schedule.rebillAmount === null ? null : Number(schedule.rebillAmount),
    status: "unsettled",
    recordedAmount: 0,
    outstandingAmount: expectedAmount,
    overpaidAmount: 0,
    settlements: [],
  };
}

async function settlementsFor(
  executor: Executor,
  workspaceId: string,
  recordedIds: string[],
) {
  if (recordedIds.length === 0) return new Map<string, OccurrenceSettlement[]>();
  const rows = await executor
    .select({
      id: recurringMoneySettlements.id,
      occurrenceRowId: recurringMoneySettlements.occurrenceId,
      transactionId: transactions.id,
      amount: transactions.amount,
      date: transactions.date,
      payee: transactions.payee,
      provenance: recurringMoneySettlements.provenance,
      createdAt: recurringMoneySettlements.createdAt,
    })
    .from(recurringMoneySettlements)
    .innerJoin(transactions, eq(recurringMoneySettlements.transactionId, transactions.id))
    .where(
      and(
        eq(recurringMoneySettlements.workspaceId, workspaceId),
        inArray(recurringMoneySettlements.occurrenceId, recordedIds),
      ),
    );
  const grouped = new Map<string, OccurrenceSettlement[]>();
  for (const row of rows) {
    const settlement: OccurrenceSettlement = {
      id: row.id,
      transactionId: row.transactionId,
      amount: Number(row.amount),
      date: row.date,
      payee: row.payee,
      provenance: row.provenance as SettlementProvenance,
      createdAt: row.createdAt,
    };
    const existing = grouped.get(row.occurrenceRowId);
    if (existing) existing.push(settlement);
    else grouped.set(row.occurrenceRowId, [settlement]);
  }
  return grouped;
}

function recordedOccurrence(
  row: RecordedRow,
  settlements: OccurrenceSettlement[],
): RecurringMoneyOccurrence {
  const expectedAmount = Number(row.expectedAmount);
  const recordedAmount = settlements.reduce((sum, settlement) => sum + settlement.amount, 0);
  return {
    id: occurrenceId(row.recurringMoneyId, row.periodMonth),
    recurringMoneyId: row.recurringMoneyId,
    periodMonth: row.periodMonth,
    state: "recorded",
    name: row.name,
    dueDate: row.dueDate,
    expectedAmount,
    type: row.type,
    category: row.category,
    payee: row.payee,
    clientId: row.clientId,
    givingRecipientId: row.givingRecipientId,
    givingDesignationId: row.givingDesignationId,
    notes: row.notes,
    rebillMode: row.rebillMode,
    rebillAmount: row.rebillAmount === null ? null : Number(row.rebillAmount),
    status: statusFor(expectedAmount, recordedAmount),
    recordedAmount,
    outstandingAmount: Math.max(0, moneyInPence(expectedAmount) - moneyInPence(recordedAmount)) / 100,
    overpaidAmount: Math.max(0, moneyInPence(recordedAmount) - moneyInPence(expectedAmount)) / 100,
    settlements,
  };
}

async function loadRecordedMonth(
  executor: Executor,
  workspaceId: string,
  periodMonth: string,
) {
  const rows = await executor
    .select()
    .from(recurringMoneyOccurrences)
    .where(
      and(
        eq(recurringMoneyOccurrences.workspaceId, workspaceId),
        eq(recurringMoneyOccurrences.periodMonth, periodMonth),
      ),
    );
  const grouped = await settlementsFor(executor, workspaceId, rows.map((row) => row.id));
  return rows.map((row) => recordedOccurrence(row, grouped.get(row.id) ?? []));
}

async function loadRecordedOccurrence(
  executor: Executor,
  workspaceId: string,
  reference: OccurrenceReference,
) {
  const [row] = await executor
    .select()
    .from(recurringMoneyOccurrences)
    .where(
      and(
        eq(recurringMoneyOccurrences.workspaceId, workspaceId),
        eq(recurringMoneyOccurrences.recurringMoneyId, reference.recurringMoneyId),
        eq(recurringMoneyOccurrences.periodMonth, reference.periodMonth),
      ),
    )
    .limit(1);
  if (!row) return null;
  const grouped = await settlementsFor(executor, workspaceId, [row.id]);
  return recordedOccurrence(row, grouped.get(row.id) ?? []);
}

async function lockOccurrence(
  executor: Executor,
  workspaceId: string,
  reference: OccurrenceReference,
) {
  const [recorded] = await executor
    .select({ id: recurringMoneyOccurrences.id })
    .from(recurringMoneyOccurrences)
    .where(
      and(
        eq(recurringMoneyOccurrences.workspaceId, workspaceId),
        eq(recurringMoneyOccurrences.recurringMoneyId, reference.recurringMoneyId),
        eq(recurringMoneyOccurrences.periodMonth, reference.periodMonth),
      ),
    )
    .limit(1)
    .for("update");
  if (recorded) return;

  const [schedule] = await executor
    .select({ id: recurringOutgoings.id })
    .from(recurringOutgoings)
    .where(
      and(
        eq(recurringOutgoings.id, reference.recurringMoneyId),
        eq(recurringOutgoings.workspaceId, workspaceId),
        eq(recurringOutgoings.isActive, true),
        eq(recurringOutgoings.frequency, "monthly"),
      ),
    )
    .limit(1)
    .for("update");
  if (!schedule) {
    throw new RecurringMoneyOccurrenceError(
      "Inactive or missing Recurring money cannot create a new occurrence",
    );
  }
}

async function materializeOccurrence(
  executor: Executor,
  workspaceId: string,
  userId: string,
  reference: OccurrenceReference,
  now: Date,
) {
  const [existing] = await executor
    .select()
    .from(recurringMoneyOccurrences)
    .where(
      and(
        eq(recurringMoneyOccurrences.workspaceId, workspaceId),
        eq(recurringMoneyOccurrences.recurringMoneyId, reference.recurringMoneyId),
        eq(recurringMoneyOccurrences.periodMonth, reference.periodMonth),
      ),
    )
    .limit(1)
    .for("update");
  if (existing) return existing;
  if (reference.periodMonth < getPeriodMonthFromDate(formatUtcDate(now))) {
    throw new RecurringMoneyOccurrenceError(
      "A past Recurring money occurrence must already be recorded",
    );
  }

  const [schedule] = await executor
    .select()
    .from(recurringOutgoings)
    .where(
      and(
        eq(recurringOutgoings.id, reference.recurringMoneyId),
        eq(recurringOutgoings.workspaceId, workspaceId),
        eq(recurringOutgoings.isActive, true),
        eq(recurringOutgoings.frequency, "monthly"),
      ),
    )
    .limit(1)
    .for("update");
  if (!schedule) {
    throw new RecurringMoneyOccurrenceError(
      "Inactive or missing Recurring money cannot create a new occurrence",
    );
  }

  await executor
    .insert(recurringMoneyOccurrences)
    .values({
      id: crypto.randomUUID(),
      userId,
      workspaceId,
      recurringMoneyId: schedule.id,
      name: schedule.name,
      periodMonth: reference.periodMonth,
      dueDate: dateForPeriod(reference.periodMonth, schedule.dayOfMonth),
      expectedAmount: schedule.amount,
      type: schedule.type,
      category: schedule.category,
      payee: schedule.vendor,
      clientId: schedule.clientId,
      givingRecipientId: schedule.givingRecipientId,
      givingDesignationId: schedule.givingDesignationId,
      notes: schedule.notes,
      rebillMode: schedule.rebillMode,
      rebillAmount: schedule.rebillAmount,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [recurringMoneyOccurrences.recurringMoneyId, recurringMoneyOccurrences.periodMonth],
    });

  const [recorded] = await executor
    .select()
    .from(recurringMoneyOccurrences)
    .where(
      and(
        eq(recurringMoneyOccurrences.workspaceId, workspaceId),
        eq(recurringMoneyOccurrences.recurringMoneyId, reference.recurringMoneyId),
        eq(recurringMoneyOccurrences.periodMonth, reference.periodMonth),
      ),
    )
    .limit(1)
    .for("update");
  if (!recorded) throw new RecurringMoneyOccurrenceError("Failed to record occurrence");
  return recorded;
}

async function recordedTotals(executor: Executor, recordedIds: string[]) {
  if (recordedIds.length === 0) return new Map<string, number>();
  const rows = await executor
    .select({
      occurrenceRowId: recurringMoneySettlements.occurrenceId,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(recurringMoneySettlements)
    .innerJoin(transactions, eq(recurringMoneySettlements.transactionId, transactions.id))
    .where(inArray(recurringMoneySettlements.occurrenceId, recordedIds))
    .groupBy(recurringMoneySettlements.occurrenceId);
  return new Map(rows.map((row) => [row.occurrenceRowId, Number(row.total)]));
}

async function importMatchPool(
  executor: Executor,
  workspaceId: string,
  candidates: ValidatedImportCandidate[],
  currentPeriodMonth: string,
) {
  if (candidates.length === 0) return [];
  const dates = candidates.map((candidate) => candidate.date).sort();
  const firstDate = shiftDate(dates[0], -7);
  const lastDate = shiftDate(dates.at(-1)!, 7);

  const recordedRows = await executor
    .select()
    .from(recurringMoneyOccurrences)
    .where(
      and(
        eq(recurringMoneyOccurrences.workspaceId, workspaceId),
        gte(recurringMoneyOccurrences.dueDate, firstDate),
        lte(recurringMoneyOccurrences.dueDate, lastDate),
      ),
    );
  const totals = await recordedTotals(executor, recordedRows.map((row) => row.id));
  const pool = recordedRows.map((row) => ({
    occurrenceId: occurrenceId(row.recurringMoneyId, row.periodMonth),
    recurringMoneyId: row.recurringMoneyId,
    periodMonth: row.periodMonth,
    dueDate: row.dueDate,
    expectedAmount: Number(row.expectedAmount),
    recordedAmount: totals.get(row.id) ?? 0,
    type: row.type,
    payee: row.payee,
    category: row.category,
    clientId: row.clientId,
    givingRecipientId: row.givingRecipientId,
    givingDesignationId: row.givingDesignationId,
  }));

  const recordedKeys = new Set(
    recordedRows.map((row) => occurrenceId(row.recurringMoneyId, row.periodMonth)),
  );
  const projectionMonths = monthsBetween(firstDate, lastDate).filter(
    (periodMonth) => periodMonth >= currentPeriodMonth,
  );
  if (projectionMonths.length > 0) {
    const schedules = await executor
      .select()
      .from(recurringOutgoings)
      .where(
        and(
          eq(recurringOutgoings.workspaceId, workspaceId),
          eq(recurringOutgoings.isActive, true),
          eq(recurringOutgoings.frequency, "monthly"),
        ),
      );
    for (const schedule of schedules) {
      for (const periodMonth of projectionMonths) {
        const id = occurrenceId(schedule.id, periodMonth);
        if (recordedKeys.has(id)) continue;
        const dueDate = dateForPeriod(periodMonth, schedule.dayOfMonth);
        if (dueDate < firstDate || dueDate > lastDate) continue;
        pool.push({
          occurrenceId: id,
          recurringMoneyId: schedule.id,
          periodMonth,
          dueDate,
          expectedAmount: Number(schedule.amount),
          recordedAmount: 0,
          type: schedule.type,
          payee: schedule.vendor,
          category: schedule.category,
          clientId: schedule.clientId,
          givingRecipientId: schedule.givingRecipientId,
          givingDesignationId: schedule.givingDesignationId,
        });
      }
    }
  }
  return pool;
}

async function findImportMatches(
  executor: Executor,
  workspaceId: string,
  candidates: ValidatedImportCandidate[],
  currentPeriodMonth: string,
): Promise<MatchCandidate[]> {
  const pool = await importMatchPool(executor, workspaceId, candidates, currentPeriodMonth);
  const provisionallyMatched = new Map<OccurrenceId, number>();
  const matches: MatchCandidate[] = [];

  for (const candidate of candidates) {
    const eligible = pool.filter((occurrence) => {
      const provisional = provisionallyMatched.get(occurrence.occurrenceId) ?? 0;
      const outstanding =
        moneyInPence(occurrence.expectedAmount) -
        moneyInPence(occurrence.recordedAmount + provisional);
      return (
        occurrence.type === candidate.type &&
        moneyInPence(candidate.amount) <= outstanding &&
        dateDistance(occurrence.dueDate, candidate.date) <= 7 &&
        payeesMatch(occurrence.payee, candidate.payee)
      );
    });
    if (eligible.length === 0) continue;

    const withExpectedPayee = eligible.filter((occurrence) => normalizedPayee(occurrence.payee));
    const candidatesByPayee = withExpectedPayee.length > 0 ? withExpectedPayee : eligible;
    const nearestDistance = Math.min(
      ...candidatesByPayee.map((occurrence) => dateDistance(occurrence.dueDate, candidate.date)),
    );
    const nearest = candidatesByPayee.filter(
      (occurrence) => dateDistance(occurrence.dueDate, candidate.date) === nearestDistance,
    );
    if (nearest.length !== 1) continue;
    if (!normalizedPayee(nearest[0].payee) && eligible.length !== 1) continue;

    const occurrence = nearest[0];
    provisionallyMatched.set(
      occurrence.occurrenceId,
      (provisionallyMatched.get(occurrence.occurrenceId) ?? 0) + candidate.amount,
    );
    matches.push({
      key: candidate.fingerprint,
      amount: candidate.amount,
      occurrenceId: occurrence.occurrenceId,
      recurringMoneyId: occurrence.recurringMoneyId,
      periodMonth: occurrence.periodMonth,
      category: occurrence.category,
      clientId: occurrence.clientId,
      givingRecipientId: occurrence.givingRecipientId,
      givingDesignationId: occurrence.givingDesignationId,
    });
  }
  return matches;
}

async function existingFingerprints(
  executor: Executor,
  workspaceId: string,
  fingerprints: string[],
) {
  if (fingerprints.length === 0) return new Set<string>();
  const rows = await executor
    .select({ fingerprint: transactions.importFingerprint })
    .from(transactions)
    .where(
      and(
        eq(transactions.workspaceId, workspaceId),
        inArray(transactions.importFingerprint, fingerprints),
      ),
    );
  return new Set(rows.flatMap((row) => (row.fingerprint ? [row.fingerprint] : [])));
}

function uniqueImportCandidates(candidates: ValidatedImportCandidate[]) {
  const seen = new Set<string>();
  const duplicateLineNumbers: number[] = [];
  const unique = candidates.filter((candidate) => {
    if (seen.has(candidate.fingerprint)) {
      duplicateLineNumbers.push(candidate.lineNumber);
      return false;
    }
    seen.add(candidate.fingerprint);
    return true;
  });
  return { unique, duplicateLineNumbers };
}

export function createRecurringMoneyOccurrences(
  clock: Clock = systemClock,
): RecurringMoneyOccurrences {
  async function month(workspaceId: string, periodMonth: string): Promise<OccurrenceMonth> {
    workspaceIdSchema.parse(workspaceId);
    periodMonthSchema.parse(periodMonth);
    const recorded = await loadRecordedMonth(db, workspaceId, periodMonth);
    const occurrences = [...recorded];
    const currentPeriodMonth = getPeriodMonthFromDate(formatUtcDate(clock.now()));

    if (periodMonth >= currentPeriodMonth) {
      const recordedScheduleIds = new Set(recorded.map((occurrence) => occurrence.recurringMoneyId));
      const schedules = await db
        .select()
        .from(recurringOutgoings)
        .where(
          and(
            eq(recurringOutgoings.workspaceId, workspaceId),
            eq(recurringOutgoings.isActive, true),
            eq(recurringOutgoings.frequency, "monthly"),
          ),
        );
      for (const schedule of schedules) {
        if (!recordedScheduleIds.has(schedule.id)) {
          occurrences.push(projectedOccurrence(schedule, periodMonth));
        }
      }
    }

    occurrences.sort(
      (left, right) =>
        left.dueDate.localeCompare(right.dueDate) || left.name.localeCompare(right.name),
    );
    return { periodMonth, occurrences };
  }

  async function settle(
    workspaceId: string,
    request: SettlementRequest,
  ): Promise<SettlementResult> {
    workspaceIdSchema.parse(workspaceId);
    const reference = occurrenceReference(request.occurrenceId);
    const userId = await ownerUserId(workspaceId);

    if (request.action === "mark-paid") {
      boundedDateSchema.parse(request.paidAt);
      return db.transaction(async (tx) => {
        await lockWorkspaceLedger(tx, workspaceId);
        const recorded = await materializeOccurrence(
          tx,
          workspaceId,
          userId,
          reference,
          clock.now(),
        );
        const totals = await recordedTotals(tx, [recorded.id]);
        const remainingPence =
          moneyInPence(recorded.expectedAmount) - moneyInPence(totals.get(recorded.id) ?? 0);
        if (remainingPence <= 0) {
          throw new RecurringMoneySettlementError("This occurrence is already settled");
        }
        const amount = remainingPence / 100;
        const [transaction] = await tx
          .insert(transactions)
          .values({
            id: crypto.randomUUID(),
            userId,
            workspaceId,
            amount: String(amount),
            date: request.paidAt,
            type: recorded.type,
            status: "cleared",
            needsReview: false,
            category: recorded.category ?? "Uncategorized",
            payee: recorded.payee,
            clientId: recorded.clientId,
            givingRecipientId: recorded.givingRecipientId,
            givingDesignationId: recorded.givingDesignationId,
            notes: recorded.notes,
            tags: [],
            createdAt: clock.now(),
            updatedAt: clock.now(),
          })
          .returning({ id: transactions.id });
        await tx.insert(recurringMoneySettlements).values({
          id: crypto.randomUUID(),
          userId,
          workspaceId,
          occurrenceId: recorded.id,
          transactionId: transaction.id,
          provenance: "lifecycle-created",
          createdAt: clock.now(),
        });
        const occurrence = await loadRecordedOccurrence(tx, workspaceId, reference);
        if (!occurrence) throw new RecurringMoneyOccurrenceError("Occurrence not found");
        return { occurrence, transactionId: transaction.id };
      });
    }

    idSchema.parse(request.transactionId);
    if (request.action === "match") {
      return db.transaction(async (tx) => {
        await lockWorkspaceLedger(tx, workspaceId);
        const recorded = await materializeOccurrence(
          tx,
          workspaceId,
          userId,
          reference,
          clock.now(),
        );
        const [transaction] = await tx
          .select({ id: transactions.id, type: transactions.type })
          .from(transactions)
          .where(
            and(
              eq(transactions.id, request.transactionId),
              eq(transactions.workspaceId, workspaceId),
            ),
          )
          .limit(1)
          .for("update");
        if (!transaction) throw new RecurringMoneyOccurrenceError("Transaction not found or unauthorized");
        if (transaction.type !== recorded.type) {
          throw new RecurringMoneyConstraintError(
            "Transaction type must match the Recurring money occurrence",
          );
        }
        const [linked] = await tx
          .insert(recurringMoneySettlements)
          .values({
            id: crypto.randomUUID(),
            userId,
            workspaceId,
            occurrenceId: recorded.id,
            transactionId: transaction.id,
            provenance: "externally-created",
            createdAt: clock.now(),
          })
          .onConflictDoNothing({ target: recurringMoneySettlements.transactionId })
          .returning({ id: recurringMoneySettlements.id });
        if (!linked) {
          throw new RecurringMoneySettlementError(
            "Transaction is already matched to Recurring money",
          );
        }
        const occurrence = await loadRecordedOccurrence(tx, workspaceId, reference);
        if (!occurrence) throw new RecurringMoneyOccurrenceError("Occurrence not found");
        return { occurrence, transactionId: transaction.id };
      });
    }

    return db.transaction(async (tx) => {
      await lockWorkspaceLedger(tx, workspaceId);
      const [recorded] = await tx
        .select({ id: recurringMoneyOccurrences.id })
        .from(recurringMoneyOccurrences)
        .where(
          and(
            eq(recurringMoneyOccurrences.workspaceId, workspaceId),
            eq(recurringMoneyOccurrences.recurringMoneyId, reference.recurringMoneyId),
            eq(recurringMoneyOccurrences.periodMonth, reference.periodMonth),
          ),
        )
        .limit(1)
        .for("update");
      if (!recorded) throw new RecurringMoneyOccurrenceError("Occurrence not found or unauthorized");
      const [settlement] = await tx
        .select({ provenance: recurringMoneySettlements.provenance })
        .from(recurringMoneySettlements)
        .where(
          and(
            eq(recurringMoneySettlements.workspaceId, workspaceId),
            eq(recurringMoneySettlements.occurrenceId, recorded.id),
            eq(recurringMoneySettlements.transactionId, request.transactionId),
          ),
        )
        .limit(1);
      if (!settlement) {
        throw new RecurringMoneySettlementError("Recurring money settlement not found");
      }
      if (settlement.provenance === "lifecycle-created") {
        const [transaction] = await tx
          .select({ status: transactions.status, accountId: transactions.accountId, date: transactions.date })
          .from(transactions)
          .where(
            and(
              eq(transactions.id, request.transactionId),
              eq(transactions.workspaceId, workspaceId),
            ),
          )
          .limit(1);
        if (transaction?.status === "reconciled") {
          throw new RecurringMoneyConstraintError("Reconciled transactions cannot be deleted");
        }
        if (transaction?.accountId) {
          const account = await assertInWorkspace(workspaceId, transaction.accountId, tx);
          assertDateIsOpen(account, transaction.date);
        }
        await tx
          .delete(transactions)
          .where(
            and(
              eq(transactions.id, request.transactionId),
              eq(transactions.workspaceId, workspaceId),
            ),
          );
      } else {
        await tx
          .delete(recurringMoneySettlements)
          .where(
            and(
              eq(recurringMoneySettlements.workspaceId, workspaceId),
              eq(recurringMoneySettlements.occurrenceId, recorded.id),
              eq(recurringMoneySettlements.transactionId, request.transactionId),
            ),
          );
      }
      const occurrence = await loadRecordedOccurrence(tx, workspaceId, reference);
      if (!occurrence) throw new RecurringMoneyOccurrenceError("Occurrence not found");
      return { occurrence, transactionId: request.transactionId };
    });
  }

  async function revise(
    workspaceId: string,
    request: OccurrenceRevision,
  ): Promise<RecurringMoneyOccurrence> {
    workspaceIdSchema.parse(workspaceId);
    amountSchema.parse(request.expectedAmount);
    const reference = occurrenceReference(request.occurrenceId);
    const userId = await ownerUserId(workspaceId);
    return db.transaction(async (tx) => {
      await lockWorkspaceLedger(tx, workspaceId);
      const recorded = await materializeOccurrence(
        tx,
        workspaceId,
        userId,
        reference,
        clock.now(),
      );
      await tx
        .update(recurringMoneyOccurrences)
        .set({ expectedAmount: String(request.expectedAmount), updatedAt: clock.now() })
        .where(
          and(
            eq(recurringMoneyOccurrences.id, recorded.id),
            eq(recurringMoneyOccurrences.workspaceId, workspaceId),
          ),
        );
      const occurrence = await loadRecordedOccurrence(tx, workspaceId, reference);
      if (!occurrence) throw new RecurringMoneyOccurrenceError("Occurrence not found");
      return occurrence;
    });
  }

  function importTransactions(
    workspaceId: string,
    request: Extract<ImportRequest, { mode: "preview" }>,
  ): Promise<ImportPreviewResult>;
  // eslint-disable-next-line no-redeclare -- TypeScript overload for committed imports
  function importTransactions(
    workspaceId: string,
    request: Extract<ImportRequest, { mode: "commit" }>,
  ): Promise<ImportCommitResult>;
  // eslint-disable-next-line no-redeclare -- implementation for the overloads above
  async function importTransactions(
    workspaceId: string,
    request: ImportRequest,
  ): Promise<ImportResult> {
    workspaceIdSchema.parse(workspaceId);
    const { unique, duplicateLineNumbers } = uniqueImportCandidates(request.candidates);
    const currentPeriodMonth = getPeriodMonthFromDate(formatUtcDate(clock.now()));

    if (request.mode === "preview") {
      const existing = await existingFingerprints(
        db,
        workspaceId,
        unique.map((candidate) => candidate.fingerprint),
      );
      const readyCandidates = unique.filter((candidate) => {
        if (existing.has(candidate.fingerprint)) {
          duplicateLineNumbers.push(candidate.lineNumber);
          return false;
        }
        return true;
      });
      const matches = await findImportMatches(
        db,
        workspaceId,
        readyCandidates,
        currentPeriodMonth,
      );
      const matched = new Set(matches.map((match) => match.key));
      return {
        mode: "preview",
        ready: readyCandidates.length,
        duplicateLineNumbers: duplicateLineNumbers.sort((left, right) => left - right),
        matchedLineNumbers: readyCandidates
          .filter((candidate) => matched.has(candidate.fingerprint))
          .map((candidate) => candidate.lineNumber),
      };
    }

    if (unique.length === 0) {
      return {
        mode: "commit",
        importedIds: [],
        duplicateLineNumbers: duplicateLineNumbers.sort((left, right) => left - right),
        matchedLineNumbers: [],
      };
    }
    const userId = await ownerUserId(workspaceId);
    return db.transaction(async (tx) => {
      await lockWorkspaceLedger(tx, workspaceId);
      if (request.accountId) {
        const account = await assertInWorkspace(workspaceId, request.accountId, tx);
        for (const candidate of request.candidates) assertDateIsOpen(account, candidate.date);
      }
      const existing = await existingFingerprints(
        tx,
        workspaceId,
        unique.map((candidate) => candidate.fingerprint),
      );
      const rowsToInsert = unique.filter((candidate) => {
        if (existing.has(candidate.fingerprint)) {
          duplicateLineNumbers.push(candidate.lineNumber);
          return false;
        }
        return true;
      });
      if (rowsToInsert.length === 0) {
        return {
          mode: "commit" as const,
          importedIds: [],
          duplicateLineNumbers: duplicateLineNumbers.sort((left, right) => left - right),
          matchedLineNumbers: [],
        };
      }

      const proposedMatches = await findImportMatches(
        tx,
        workspaceId,
        rowsToInsert,
        currentPeriodMonth,
      );
      const orderedMatches = [...proposedMatches].sort((left, right) =>
        left.occurrenceId.localeCompare(right.occurrenceId),
      );
      for (const match of orderedMatches) {
        await lockOccurrence(tx, workspaceId, {
          recurringMoneyId: match.recurringMoneyId,
          periodMonth: match.periodMonth,
        });
      }
      const matches = await findImportMatches(
        tx,
        workspaceId,
        rowsToInsert,
        currentPeriodMonth,
      );
      const recordedByOccurrence = new Map<OccurrenceId, RecordedRow>();
      for (const match of [...matches].sort((left, right) =>
        left.occurrenceId.localeCompare(right.occurrenceId),
      )) {
        if (recordedByOccurrence.has(match.occurrenceId)) continue;
        const reference = {
          recurringMoneyId: match.recurringMoneyId,
          periodMonth: match.periodMonth,
        };
        const recorded = await materializeOccurrence(
          tx,
          workspaceId,
          userId,
          reference,
          clock.now(),
        );
        recordedByOccurrence.set(match.occurrenceId, recorded);
      }

      const recordedRows = [...recordedByOccurrence.values()];
      const totals = await recordedTotals(tx, recordedRows.map((row) => row.id));
      const allocated = new Map(totals);
      const availableMatches = matches.filter((match) => {
        const recorded = recordedByOccurrence.get(match.occurrenceId);
        if (!recorded) return false;
        const expected = Number(recorded.expectedAmount);
        const current = allocated.get(recorded.id) ?? 0;
        if (moneyInPence(current + match.amount) > moneyInPence(expected)) return false;
        allocated.set(recorded.id, current + match.amount);
        return true;
      });
      const matchesByFingerprint = new Map(
        availableMatches.map((match) => [match.key, match]),
      );

      const inserted = await tx
        .insert(transactions)
        .values(
          rowsToInsert.map((candidate) => {
            const match = matchesByFingerprint.get(candidate.fingerprint);
            return {
              id: crypto.randomUUID(),
              userId,
              workspaceId,
              accountId: request.accountId,
              amount: String(candidate.amount),
              date: candidate.date,
              type: candidate.type,
              status: "cleared" as const,
              needsReview: match ? false : (candidate.needsReview ?? true),
              category: match?.category ?? candidate.category,
              payee: candidate.payee,
              clientId: match ? match.clientId : (candidate.clientId ?? null),
              givingRecipientId: match
                ? match.givingRecipientId
                : (candidate.givingRecipientId ?? null),
              givingDesignationId: match
                ? match.givingDesignationId
                : (candidate.givingDesignationId ?? null),
              notes: candidate.notes,
              tags: candidate.tags,
              receiptStorageId: null,
              importFingerprint: candidate.fingerprint,
              createdAt: clock.now(),
              updatedAt: clock.now(),
            };
          }),
        )
        .onConflictDoNothing({
          target: [transactions.workspaceId, transactions.importFingerprint],
        })
        .returning({ id: transactions.id, fingerprint: transactions.importFingerprint });

      const insertedByFingerprint = new Map(
        inserted.flatMap((row) =>
          row.fingerprint ? [[row.fingerprint, row.id] as const] : [],
        ),
      );
      const linked = new Set<string>();
      for (const match of availableMatches) {
        const transactionId = insertedByFingerprint.get(match.key);
        const recorded = recordedByOccurrence.get(match.occurrenceId);
        if (!transactionId || !recorded) continue;
        await tx.insert(recurringMoneySettlements).values({
          id: crypto.randomUUID(),
          userId,
          workspaceId,
          occurrenceId: recorded.id,
          transactionId,
          provenance: "externally-created",
          createdAt: clock.now(),
        });
        linked.add(match.key);
      }

      const insertedFingerprints = new Set(
        inserted.flatMap((row) => (row.fingerprint ? [row.fingerprint] : [])),
      );
      duplicateLineNumbers.push(
        ...rowsToInsert
          .filter((candidate) => !insertedFingerprints.has(candidate.fingerprint))
          .map((candidate) => candidate.lineNumber),
      );
      return {
        mode: "commit" as const,
        importedIds: inserted.map((row) => row.id),
        duplicateLineNumbers: duplicateLineNumbers.sort((left, right) => left - right),
        matchedLineNumbers: rowsToInsert
          .filter((candidate) => linked.has(candidate.fingerprint))
          .map((candidate) => candidate.lineNumber),
      };
    });
  }

  async function assertChange(workspaceId: string, request: RelatedChange, executor: LedgerReader = db) {
    workspaceIdSchema.parse(workspaceId);
    if (request.kind === "transaction-type") {
      idSchema.parse(request.transactionId);
      const [settlement] = await executor
        .select({ occurrenceType: recurringMoneyOccurrences.type })
        .from(recurringMoneySettlements)
        .innerJoin(
          recurringMoneyOccurrences,
          eq(recurringMoneySettlements.occurrenceId, recurringMoneyOccurrences.id),
        )
        .where(
          and(
            eq(recurringMoneySettlements.workspaceId, workspaceId),
            eq(recurringMoneySettlements.transactionId, request.transactionId),
          ),
        )
        .limit(1);
      if (settlement && settlement.occurrenceType !== request.nextType) {
        throw new RecurringMoneyConstraintError(
          "Unmatch this Transaction from Recurring money before changing its type",
        );
      }
      return;
    }

    idSchema.parse(request.recurringMoneyId);
    const [history] = await executor
      .select({ id: recurringMoneyOccurrences.id })
      .from(recurringMoneyOccurrences)
      .where(
        and(
          eq(recurringMoneyOccurrences.workspaceId, workspaceId),
          eq(recurringMoneyOccurrences.recurringMoneyId, request.recurringMoneyId),
        ),
      )
      .limit(1);
    if (history) {
      throw new RecurringMoneyConstraintError(
        "Deactivate Recurring money with recorded occurrences instead of deleting it",
      );
    }
  }

  return { month, settle, revise, importTransactions, assertChange };
}

const occurrences = createRecurringMoneyOccurrences();

export const month = occurrences.month;
export const settle = occurrences.settle;
export const revise = occurrences.revise;
export const importTransactions = occurrences.importTransactions;
export const assertChange = occurrences.assertChange;
export { occurrenceId as recurringMoneyOccurrenceId };
