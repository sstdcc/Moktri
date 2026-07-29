import type { Database } from "@/integrations/supabase/types";

export type NotificationType = Database["public"]["Enums"]["notification_type"];

export interface NotificationPayload {
  titleAr: string;
  bodyAr?: string;
  link?: string;
}

export interface CreateNotificationInput {
  type: NotificationType;
  recipientId: string;
  payload: NotificationPayload;
}

export interface NotificationResult {
  id: string;
  type: NotificationType;
  recipientId: string;
  titleAr: string;
  createdAt: string;
}

export type NotificationErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "DATABASE_ERROR"
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE"
  | "UNKNOWN";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NotificationServiceConfig {
}

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  recipientId: string;
  titleAr: string | null;
  bodyAr: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  page: number;
}

export interface NotificationQueryParams {
  page: number;
  pageSize?: number;
  filter?: "all" | "unread";
  type?: NotificationType;
}

export interface NotificationPreferences {
  new_response: boolean;
  listing_expiring: boolean;
  listing_approved: boolean;
  listing_rejected: boolean;
  verification_update: boolean;
  new_report: boolean;
  system: boolean;
}

export function isValidPreferences(value: unknown): value is NotificationPreferences {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  const keys: (keyof NotificationPreferences)[] = [
    "new_response",
    "listing_expiring",
    "listing_approved",
    "listing_rejected",
    "verification_update",
    "new_report",
    "system",
  ];
  return keys.every((key) => typeof obj[key] === "boolean");
}

export interface NotificationServiceInterface {
  create(
    type: NotificationType,
    recipientId: string,
    payload: NotificationPayload,
  ): Promise<NotificationResult>;

  createMany(
    notifications: CreateNotificationInput[],
  ): Promise<NotificationResult[]>;

  markAsRead(notificationId: string): Promise<void>;

  markAllAsRead(): Promise<{ count: number }>;

  delete(notificationId: string): Promise<void>;

  getNotifications(params: NotificationQueryParams): Promise<PaginatedResult<NotificationRecord>>;

  getUnreadCount(): Promise<number>;

  getNotification(id: string): Promise<NotificationRecord>;

  getPreferences(): Promise<NotificationPreferences>;

  setPreferences(prefs: NotificationPreferences): Promise<void>;
}

export class NotificationError extends Error {
  public readonly code: NotificationErrorCode;
  public readonly details: {
    cause?: unknown;
    operation?: string;
    timestamp: string;
  };

  constructor(
    code: NotificationErrorCode,
    message: string,
    details?: { cause?: unknown; operation?: string },
  ) {
    super(message);
    this.name = "NotificationError";
    this.code = code;
    this.details = {
      ...details,
      timestamp: new Date().toISOString(),
    };
  }

  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
