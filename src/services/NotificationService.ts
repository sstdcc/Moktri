import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  NotificationError,
  type NotificationType,
  type NotificationPayload,
  type CreateNotificationInput,
  type NotificationResult,
  type NotificationServiceConfig,
  type NotificationServiceInterface,
} from "@/types/notifications";

const TABLE = "notifications";

function classifyError(err: unknown, operation: string): NotificationError {
  if (err && typeof err === "object" && "code" in err) {
    const pgErr = err as { code: string; message: string; details?: string; hint?: string };
    switch (pgErr.code) {
      case "42501":
      case "PGRST301":
        return new NotificationError("FORBIDDEN", pgErr.message, { cause: err, operation });
      case "PGRST116":
        return new NotificationError("NOT_FOUND", pgErr.message, { cause: err, operation });
      default:
        return new NotificationError("DATABASE_ERROR", pgErr.message, { cause: err, operation });
    }
  }

  if (err instanceof TypeError) {
    return new NotificationError("NETWORK_ERROR", err.message, { cause: err, operation });
  }

  return new NotificationError("UNKNOWN", String(err), { cause: err, operation });
}

export function createNotificationService(
  supabase: SupabaseClient<Database>,
  _config?: NotificationServiceConfig,
): NotificationServiceInterface {
  if (!supabase) {
    throw new TypeError("supabase client is required");
  }
  async function create(
    type: NotificationType,
    recipientId: string,
    payload: NotificationPayload,
  ): Promise<NotificationResult> {
    if (!recipientId) {
      throw new NotificationError("INVALID_INPUT", "recipientId must be a non-empty string", { operation: "create" });
    }
    if (!payload.titleAr) {
      throw new NotificationError("INVALID_INPUT", "titleAr is required in notification payload", { operation: "create" });
    }

    const dbRow = {
      user_id: recipientId,
      type,
      title_ar: payload.titleAr,
      body_ar: payload.bodyAr ?? null,
      link: payload.link ?? null,
    };

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(dbRow)
        .select("id, type, title_ar, created_at")
        .single();

      if (error) throw error;
      if (!data) throw new NotificationError("UNEXPECTED_RESPONSE", "Insert returned no data", { operation: "create" });

      // Temporary Phase 1 logging. Will be replaced by LoggerService in a future phase.
      console.debug("[NotificationService] Created", { type, recipientId, id: data.id });

      return {
        id: data.id,
        type: data.type,
        recipientId,
        titleAr: data.title_ar,
        createdAt: data.created_at,
      };
    } catch (err) {
      if (err instanceof NotificationError) throw err;
      throw classifyError(err, "create");
    }
  }

  async function createMany(
    notifications: CreateNotificationInput[],
  ): Promise<NotificationResult[]> {
    if (notifications.length === 0) {
      throw new NotificationError("INVALID_INPUT", "notifications array must not be empty", { operation: "createMany" });
    }

    for (let i = 0; i < notifications.length; i++) {
      if (!notifications[i].recipientId) {
        throw new NotificationError("INVALID_INPUT", `Element at index ${i}: recipientId must be non-empty`, { operation: "createMany" });
      }
      if (!notifications[i].payload.titleAr) {
        throw new NotificationError("INVALID_INPUT", `Element at index ${i}: titleAr is required`, { operation: "createMany" });
      }
    }

    const dbRows = notifications.map((n) => ({
      user_id: n.recipientId,
      type: n.type,
      title_ar: n.payload.titleAr,
      body_ar: n.payload.bodyAr ?? null,
      link: n.payload.link ?? null,
    }));

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(dbRows)
        .select("id, type, title_ar, created_at");
      if (error) throw error;

      const results: NotificationResult[] = (data ?? []).map((row, i) => ({
        id: row.id,
        type: row.type,
        recipientId: notifications[i].recipientId,
        titleAr: row.title_ar,
        createdAt: row.created_at,
      }));

      // Temporary Phase 1 logging. Will be replaced by LoggerService in a future phase.
      console.debug("[NotificationService] Created batch", { count: results.length });

      return results;
    } catch (err) {
      if (err instanceof NotificationError) throw err;
      throw classifyError(err, "createMany");
    }
  }

  async function markAsRead(notificationId: string): Promise<void> {
    if (!notificationId) {
      throw new NotificationError("INVALID_INPUT", "notificationId must be a non-empty string", { operation: "markAsRead" });
    }

    // User ownership filtering is enforced by the PostgreSQL RLS policy
    // "Users can update own notifications" (auth.uid() = user_id).
    // No explicit user_id filter is needed in the application layer.
    let data: { id: string } | null;
    try {
      const response = await supabase
        .from(TABLE)
        .update({ is_read: true })
        .eq("id", notificationId)
        .select("id")
        .maybeSingle();
      if (response.error) throw response.error;
      data = response.data;
    } catch (err) {
      if (err instanceof NotificationError) throw err;
      throw classifyError(err, "markAsRead");
    }

    if (!data) {
      throw new NotificationError("NOT_FOUND", `No notification found with id ${notificationId}`, { operation: "markAsRead" });
    }

    // Temporary Phase 1 logging. Will be replaced by LoggerService in a future phase.
    console.debug("[NotificationService] Marked as read", { id: notificationId });
  }

  async function markAllAsRead(): Promise<{ count: number }> {
    // User ownership filtering is enforced by the PostgreSQL RLS policy
    // "Users can update own notifications" (auth.uid() = user_id).
    // No explicit user_id filter is needed in the application layer.
    let data: { id: string }[] | null;
    try {
      const response = await supabase
        .from(TABLE)
        .update({ is_read: true })
        .eq("is_read", false)
        .select("id");
      if (response.error) throw response.error;
      data = response.data;
    } catch (err) {
      if (err instanceof NotificationError) throw err;
      throw classifyError(err, "markAllAsRead");
    }

    const count = data?.length ?? 0;
    // Temporary Phase 1 logging. Will be replaced by LoggerService in a future phase.
    console.debug("[NotificationService] Marked all as read", { count });

    return { count };
  }

  async function deleteNotification(notificationId: string): Promise<void> {
    if (!notificationId) {
      throw new NotificationError("INVALID_INPUT", "notificationId must be a non-empty string", { operation: "delete" });
    }

    // Note: There is currently no FOR DELETE RLS policy on the notifications table.
    // The existing policy only covers SELECT and UPDATE with auth.uid() = user_id.
    // Until a FOR DELETE policy is added, this operation may fail with a FORBIDDEN
    // error when called from the client side. This is a known database configuration gap
    // that should be addressed separately from the application layer.
    let data: { id: string } | null;
    try {
      const response = await supabase
        .from(TABLE)
        .delete()
        .eq("id", notificationId)
        .select("id")
        .maybeSingle();
      if (response.error) throw response.error;
      data = response.data;
    } catch (err) {
      if (err instanceof NotificationError) throw err;
      throw classifyError(err, "delete");
    }

    if (!data) {
      throw new NotificationError("NOT_FOUND", `No notification found with id ${notificationId}`, { operation: "delete" });
    }

    // Temporary Phase 1 logging. Will be replaced by LoggerService in a future phase.
    console.debug("[NotificationService] Deleted", { id: notificationId });
  }

  return {
    create,
    createMany,
    markAsRead,
    markAllAsRead,
    delete: deleteNotification,
  };
}
