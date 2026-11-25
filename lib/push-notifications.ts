import { createHash, timingSafeEqual } from "node:crypto";
import { sendNotification, type PushSubscription, type RequestOptions } from "web-push";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  pushNotificationPreferences,
  pushSubscriptions,
  workspaceMemberships,
} from "@/db/schema";
import * as notificationsService from "@/lib/db/notifications";
import { userIdSchema, workspaceIdSchema } from "@/lib/db/validation";
import { z } from "zod";
import {
  claimDelivery,
  completeDeliveries,
  releaseDeliveries,
} from "@/lib/notification-deliveries";

const endpointSchema = z.string().url().max(2048).refine(
  (value) => new URL(value).protocol === "https:",
  "Push endpoint must use HTTPS",
);
const keySchema = z.string().min(1).max(512);

export const pushSubscriptionSchema = z.object({
  endpoint: endpointSchema,
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: keySchema,
    auth: keySchema,
  }),
});

export type BrowserPushSubscription = z.infer<typeof pushSubscriptionSchema>;

export class PushConfigurationError extends Error {
  constructor() {
    super("Web Push is not configured");
  }
}

export class PushSubscriptionConflictError extends Error {
  constructor() {
    super("This browser is already subscribed by another workspace member");
  }
}

export function getPublicPushConfiguration() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  const configured = Boolean(
    publicKey
      && process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim()
      && process.env.WEB_PUSH_VAPID_SUBJECT?.trim(),
  );
  return { configured, publicKey: configured ? publicKey : null };
}

function getDeliveryConfiguration() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) throw new PushConfigurationError();
  return { publicKey, privateKey, subject };
}

export function validDispatchToken(supplied: string | null) {
  const configured = process.env.NOTIFICATION_DISPATCH_TOKEN;
  if (!configured || !supplied) return false;
  const configuredDigest = createHash("sha256").update(configured).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(configuredDigest, suppliedDigest);
}

export async function getSubscriptionStatus(
  userId: string,
  workspaceId: string,
  endpoint?: string,
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  if (endpoint) endpointSchema.parse(endpoint);

  const [preference] = await db
    .select({ enabled: pushNotificationPreferences.enabled })
    .from(pushNotificationPreferences)
    .where(
      and(
        eq(pushNotificationPreferences.userId, userId),
        eq(pushNotificationPreferences.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  let deviceEnabled = false;
  if (endpoint) {
    const [subscription] = await db
      .select({ enabled: pushSubscriptions.enabled })
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.workspaceId, workspaceId),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      )
      .limit(1);
    deviceEnabled = subscription?.enabled ?? false;
  }

  return {
    ...getPublicPushConfiguration(),
    enabled: preference?.enabled ?? false,
    deviceEnabled,
  };
}

export async function subscribe(
  userId: string,
  workspaceId: string,
  input: BrowserPushSubscription,
  oldEndpoint?: string,
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const subscription = pushSubscriptionSchema.parse(input);
  if (oldEndpoint) endpointSchema.parse(oldEndpoint);
  if (!getPublicPushConfiguration().configured) throw new PushConfigurationError();

  const now = new Date();
  await db.transaction(async (tx) => {
    if (oldEndpoint && oldEndpoint !== subscription.endpoint) {
      await tx
        .update(pushSubscriptions)
        .set({ enabled: false, updatedAt: now })
        .where(
          and(
            eq(pushSubscriptions.userId, userId),
            eq(pushSubscriptions.workspaceId, workspaceId),
            eq(pushSubscriptions.endpoint, oldEndpoint),
          ),
        );
    }

    await tx
      .insert(pushNotificationPreferences)
      .values({ id: crypto.randomUUID(), userId, workspaceId, enabled: true, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [pushNotificationPreferences.userId, pushNotificationPreferences.workspaceId],
        set: { enabled: true, updatedAt: now },
      });

    const saved = await tx
      .insert(pushSubscriptions)
      .values({
        id: crypto.randomUUID(),
        userId,
        workspaceId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [pushSubscriptions.workspaceId, pushSubscriptions.endpoint],
        setWhere: eq(pushSubscriptions.userId, userId),
        set: {
          userId,
          workspaceId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          enabled: true,
          updatedAt: now,
        },
      })
      .returning({ id: pushSubscriptions.id });
    if (!saved[0]) throw new PushSubscriptionConflictError();
  });
}

export async function unsubscribe(userId: string, workspaceId: string, endpoint?: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  if (endpoint) endpointSchema.parse(endpoint);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .insert(pushNotificationPreferences)
      .values({ id: crypto.randomUUID(), userId, workspaceId, enabled: false, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [pushNotificationPreferences.userId, pushNotificationPreferences.workspaceId],
        set: { enabled: false, updatedAt: now },
      });
    await tx
      .update(pushSubscriptions)
      .set({ enabled: false, updatedAt: now })
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.workspaceId, workspaceId),
        ),
      );
  });
}

type PushSender = (
  subscription: PushSubscription,
  payload: string,
  options: RequestOptions,
) => Promise<unknown>;

export interface DispatchSummary {
  subscriptions: number;
  notifications: number;
  sent: number;
  skipped: number;
  failed: number;
  disabled: number;
}

export async function dispatchPushNotifications(options: { today?: string; send?: PushSender } = {}) {
  const config = getDeliveryConfiguration();
  const send = options.send ?? sendNotification;
  const subscriptions = await db
    .select({
      id: pushSubscriptions.id,
      userId: pushSubscriptions.userId,
      workspaceId: pushSubscriptions.workspaceId,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .innerJoin(
      pushNotificationPreferences,
      and(
        eq(pushNotificationPreferences.userId, pushSubscriptions.userId),
        eq(pushNotificationPreferences.workspaceId, pushSubscriptions.workspaceId),
        eq(pushNotificationPreferences.enabled, true),
      ),
    )
    .innerJoin(
      workspaceMemberships,
      and(
        eq(workspaceMemberships.userId, pushSubscriptions.userId),
        eq(workspaceMemberships.workspaceId, pushSubscriptions.workspaceId),
      ),
    )
    .where(eq(pushSubscriptions.enabled, true));

  const summary: DispatchSummary = {
    subscriptions: subscriptions.length,
    notifications: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    disabled: 0,
  };
  const notificationsByWorkspace = new Map<
    string,
    Awaited<ReturnType<typeof notificationsService.listCurrent>>
  >();

  for (const subscription of subscriptions) {
    const workspaceKey = `${subscription.userId}:${subscription.workspaceId}`;
    let notifications = notificationsByWorkspace.get(workspaceKey);
    if (!notifications) {
      notifications = (await notificationsService.listCurrent(
        subscription.workspaceId,
        subscription.userId,
        options.today,
      )).filter((notification) => !notification.readAt);
      notificationsByWorkspace.set(workspaceKey, notifications);
      summary.notifications += notifications.length;
    }

    const reviewItems = notifications.filter((notification) => notification.kind === "review_item");
    const batches = [
      ...notifications
        .filter((notification) => notification.kind !== "review_item")
        .map((notification) => [notification]),
      ...(reviewItems.length > 0 ? [reviewItems] : []),
    ];

    for (const batch of batches) {
      const claimed = [];
      for (const notification of batch) {
        const deliveryId = await claimDelivery({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          workspaceId: subscription.workspaceId,
          destinationKey: `push:${subscription.id}`,
          eventKey: notification.id,
          channel: "web_push",
        });
        if (deliveryId) claimed.push({ deliveryId, notification });
        else summary.skipped += 1;
      }
      if (claimed.length === 0) continue;

      const deliveryIds = claimed.map(({ deliveryId }) => deliveryId);
      const notification = claimed[0].notification;
      const payload = claimed.length > 1 && notification.kind === "review_item"
        ? {
            title: `${claimed.length} imported transactions need review`,
            body: "Open Sika to classify them.",
            href: notification.href,
            tag: "transaction-review",
          }
        : {
            title: notification.title,
            body: notification.description,
            href: notification.href,
            tag: notification.id,
          };

      try {
        await send(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
          { TTL: 86_400, vapidDetails: config },
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: unknown }).statusCode;
        const failedAt = new Date();
        if (statusCode === 404 || statusCode === 410) {
          await db
            .update(pushSubscriptions)
            .set({ enabled: false, lastFailureAt: failedAt, updatedAt: failedAt })
            .where(eq(pushSubscriptions.id, subscription.id));
          summary.disabled += 1;
        } else {
          summary.failed += claimed.length;
        }
        // Failed attempts may be retried; successful delivery is the deduplication boundary.
        await releaseDeliveries(deliveryIds);
        break;
      }
      const sentAt = new Date();
      await completeDeliveries(deliveryIds, sentAt);
      await db
        .update(pushSubscriptions)
        .set({ lastSuccessAt: sentAt, updatedAt: sentAt })
        .where(eq(pushSubscriptions.id, subscription.id));
      summary.sent += claimed.length;
    }
  }

  return summary;
}
