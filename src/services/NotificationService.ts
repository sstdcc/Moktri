import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  NotificationError,
  type NotificationType,
  type NotificationPayload,
  type CreateNotificationInput,
  type NotificationResult,
  type NotificationRecord,
  type PaginatedResult,
  type NotificationQueryParams,
  type NotificationPreferences,
  type NotificationServiceConfig,
  type NotificationServiceInterface,
  isValidPreferences,
} from "@/types/notifications";

const TABLE = "notifications";
const PREFERENCES_KEY = "miftah_notif_prefs";
const DEFAULT_PREFERENCES: NotificationPreferences = {
  new_response: true,
  listing_expiring: true,
  listing_approved: true,
  listing_rejected: true,
  verification_update: true,
  new_report: true,
  system: true,
};

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
      // Do NOT chain .select().single() here: the notifications SELECT RLS only
      // allows the recipient (auth.uid() = user_id) to read a row back, so a
      // write that targets another user would always surface as PGRST116 even
      // though the INSERT committed. Plain insert keeps the write visible.
      // See the comment in ListingRequestsPage.tsx ("no .select() chained").
      const { error } = await supabase
        .from(TABLE)
        .insert(dbRow);

      if (error) throw error;

      // Temporary Phase 1 logging. Will be replaced by LoggerService in a future phase.
      console.debug("[NotificationService] Created", { type, recipientId });

      return {
        id: "",
        type,
        recipientId,
        titleAr: payload.titleAr,
        createdAt: new Date().toISOString(),
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
      // Same as create(): do not chain .select() so RLS can't hide the newly
      // inserted rows (recipients are usually different from the caller).
      const { error } = await supabase
        .from(TABLE)
        .insert(dbRows);

      if (error) throw error;

      const results: NotificationResult[] = notifications.map((n, i) => ({
        id: "",
        type: n.type,
        recipientId: n.recipientId,
        titleAr: n.payload.titleAr,
        createdAt: new Date().toISOString(),
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

  async function getNotifications(
    params: NotificationQueryParams,
  ): Promise<PaginatedResult<NotificationRecord>> {
    if (params.page < 0) {
      throw new NotificationError("INVALID_INPUT", "page must be >= 0", { operation: "getNotifications" });
    }
    const pageSize = params.pageSize ?? 30;
    if (pageSize < 1) {
      throw new NotificationError("INVALID_INPUT", "pageSize must be >= 1", { operation: "getNotifications" });
    }
    if (pageSize > 100) {
      throw new NotificationError("INVALID_INPUT", "pageSize must be <= 100", { operation: "getNotifications" });
    }

    const from = params.page * pageSize;

    try {
      let query = supabase
        .from(TABLE)
        .select("id, type, user_id, title_ar, body_ar, link, is_read, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (params.filter === "unread") {
        query = query.eq("is_read", false);
      }
      if (params.type) {
        query = query.eq("type", params.type);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      const rows = data ?? [];
      const records: NotificationRecord[] = rows.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        type: row.type as NotificationType,
        recipientId: row.user_id as string,
        titleAr: (row.title_ar as string) ?? null,
        bodyAr: (row.body_ar as string) ?? null,
        link: (row.link as string) ?? null,
        isRead: (row.is_read as boolean) ?? false,
        createdAt: (row.created_at as string) ?? "",
      }));

      const total = count ?? 0;
      const hasMore = from + pageSize < total;

      console.debug("[NotificationService] getNotifications", { page: params.page, total, hasMore });

      return { data: records, total, hasMore, page: params.page };
    } catch (err) {
      if (err instanceof NotificationError) throw err;
      throw classifyError(err, "getNotifications");
    }
  }

  async function getUnreadCount(): Promise<number> {
    try {
      const { error, count } = await supabase
        .from(TABLE)
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);

      if (error) throw error;

      console.debug("[NotificationService] getUnreadCount", { count });

      return count ?? 0;
    } catch (err) {
      console.warn("[NotificationService] getUnreadCount failed, returning 0", err);
      return 0;
    }
  }

  async function getNotification(id: string): Promise<NotificationRecord> {
    if (!id) {
      throw new NotificationError("INVALID_INPUT", "id must be a non-empty string", { operation: "getNotification" });
    }

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("id, type, user_id, title_ar, body_ar, link, is_read, created_at")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new NotificationError("NOT_FOUND", `No notification found with id ${id}`, { operation: "getNotification" });
      }

      console.debug("[NotificationService] getNotification", { id });

      return {
        id: data.id,
        type: data.type,
        recipientId: data.user_id,
        titleAr: data.title_ar ?? null,
        bodyAr: data.body_ar ?? null,
        link: data.link ?? null,
        isRead: data.is_read ?? false,
        createdAt: data.created_at ?? "",
      };
    } catch (err) {
      if (err instanceof NotificationError) throw err;
      throw classifyError(err, "getNotification");
    }
  }

  async function getPreferences(): Promise<NotificationPreferences> {
    try {
      const raw = localStorage.getItem(PREFERENCES_KEY);
      if (!raw) {
        console.debug("[NotificationService] getPreferences: no saved preferences, returning defaults");
        return { ...DEFAULT_PREFERENCES };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.warn("[NotificationService] getPreferences: JSON parse failed, returning defaults");
        return { ...DEFAULT_PREFERENCES };
      }

      if (!isValidPreferences(parsed)) {
        console.warn("[NotificationService] getPreferences: invalid structure, returning defaults");
        return { ...DEFAULT_PREFERENCES };
      }

      console.debug("[NotificationService] getPreferences: loaded saved preferences");
      return parsed;
    } catch (err) {
      console.warn("[NotificationService] getPreferences: unexpected error, returning defaults", err);
      return { ...DEFAULT_PREFERENCES };
    }
  }

  async function setPreferences(prefs: NotificationPreferences): Promise<void> {
    if (!isValidPreferences(prefs)) {
      throw new NotificationError("INVALID_INPUT", "All 7 preference keys must be present with boolean values", { operation: "setPreferences" });
    }

    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
      console.debug("[NotificationService] setPreferences: saved");
    } catch (err) {
      throw new NotificationError("DATABASE_ERROR", "Failed to save preferences to localStorage", { cause: err, operation: "setPreferences" });
    }
  }

  return {
    create,
    createMany,
    markAsRead,
    markAllAsRead,
    delete: deleteNotification,
    getNotifications,
    getUnreadCount,
    getNotification,
    getPreferences,
    setPreferences,
  };
}
