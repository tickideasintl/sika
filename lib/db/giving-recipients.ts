import { and, asc, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db/client";
import { givingDesignations, givingRecipients } from "@/db/schema";
import {
  givingDesignationCreateSchema,
  givingDesignationUpdateSchema,
  givingRecipientCreateSchema,
  givingRecipientUpdateSchema,
  idSchema,
  workspaceIdSchema,
} from "./validation";
import type { LedgerReader } from "./ledger-lock";
import { ownerUserId } from "./workspaces";

export type RecipientCreateInput = z.input<typeof givingRecipientCreateSchema>;
export type RecipientUpdateInput = z.input<typeof givingRecipientUpdateSchema>;
export type DesignationCreateInput = z.input<typeof givingDesignationCreateSchema>;
export type DesignationUpdateInput = z.input<typeof givingDesignationUpdateSchema>;

export async function list(workspaceId: string, activeOnly = false) {
  workspaceIdSchema.parse(workspaceId);
  const recipientConditions = [eq(givingRecipients.workspaceId, workspaceId)];
  const designationConditions = [eq(givingDesignations.workspaceId, workspaceId)];
  if (activeOnly) {
    recipientConditions.push(eq(givingRecipients.isActive, true));
    designationConditions.push(eq(givingDesignations.isActive, true));
  }
  const [recipients, designations] = await Promise.all([
    db.select().from(givingRecipients).where(and(...recipientConditions)).orderBy(asc(givingRecipients.name)),
    db.select().from(givingDesignations).where(and(...designationConditions)).orderBy(asc(givingDesignations.name)),
  ]);
  return recipients.map((recipient) => ({
    ...recipient,
    designations: designations.filter((designation) => designation.recipientId === recipient.id),
  }));
}

export async function createRecipient(
  workspaceId: string,
  input: RecipientCreateInput,
) {
  workspaceIdSchema.parse(workspaceId);
  const valid = givingRecipientCreateSchema.parse(input);
  const userId = await ownerUserId(workspaceId);
  const now = new Date();
  const [row] = await db.insert(givingRecipients).values({
    id: crypto.randomUUID(),
    userId,
    workspaceId,
    name: valid.name,
    notes: valid.notes || null,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return row;
}

export async function updateRecipient(
  workspaceId: string,
  id: string,
  input: RecipientUpdateInput,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  const valid = givingRecipientUpdateSchema.parse(input);
  const [row] = await db.update(givingRecipients).set({
    ...(valid.name !== undefined && { name: valid.name }),
    ...(valid.notes !== undefined && { notes: valid.notes || null }),
    ...(valid.isActive !== undefined && { isActive: valid.isActive }),
    updatedAt: new Date(),
  }).where(and(
    eq(givingRecipients.id, id),
    eq(givingRecipients.workspaceId, workspaceId),
  )).returning();
  if (!row) throw new Error("Giving recipient not found or unauthorized");
  return row;
}

export async function createDesignation(
  workspaceId: string,
  input: DesignationCreateInput,
) {
  workspaceIdSchema.parse(workspaceId);
  const valid = givingDesignationCreateSchema.parse(input);
  const userId = await ownerUserId(workspaceId);
  await assertRecipientInWorkspace(workspaceId, valid.recipientId);
  const now = new Date();
  const [row] = await db.insert(givingDesignations).values({
    id: crypto.randomUUID(),
    userId,
    workspaceId,
    recipientId: valid.recipientId,
    name: valid.name,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return row;
}

export async function updateDesignation(
  workspaceId: string,
  id: string,
  input: DesignationUpdateInput,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  const valid = givingDesignationUpdateSchema.parse(input);
  const [row] = await db.update(givingDesignations).set({
    ...valid,
    updatedAt: new Date(),
  }).where(and(
    eq(givingDesignations.id, id),
    eq(givingDesignations.workspaceId, workspaceId),
  )).returning();
  if (!row) throw new Error("Giving designation not found or unauthorized");
  return row;
}

export async function assertRecipientInWorkspace(workspaceId: string, id: string, executor: LedgerReader = db) {
  idSchema.parse(id);
  const [row] = await executor.select({ id: givingRecipients.id }).from(givingRecipients).where(and(
    eq(givingRecipients.id, id),
    eq(givingRecipients.workspaceId, workspaceId),
  )).limit(1);
  if (!row) throw new Error("Giving recipient not found or unauthorized");
}

export async function assertDesignationInWorkspace(
  workspaceId: string,
  designationId: string,
  recipientId: string,
  executor: LedgerReader = db,
) {
  idSchema.parse(designationId);
  const [row] = await executor.select({ id: givingDesignations.id }).from(givingDesignations).where(and(
    eq(givingDesignations.id, designationId),
    eq(givingDesignations.recipientId, recipientId),
    eq(givingDesignations.workspaceId, workspaceId),
  )).limit(1);
  if (!row) throw new Error("Giving designation not found for this recipient");
}
