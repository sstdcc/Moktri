import type {
  NotificationPayload,
  CreateNotificationInput,
  NotificationType,
} from "@/types/notifications";

export const MOCK_UUID = "00000000-0000-0000-0000-000000000001";

export function buildValidPayload(
  overrides?: Partial<NotificationPayload>,
): NotificationPayload {
  return {
    titleAr: "إشعار تجريبي",
    bodyAr: "هذا إشعار اختباري",
    link: "/listings",
    ...overrides,
  };
}

export function buildValidInput(
  overrides?: Partial<CreateNotificationInput>,
): CreateNotificationInput {
  return {
    type: "system" as NotificationType,
    recipientId: MOCK_UUID,
    payload: buildValidPayload(),
    ...overrides,
  };
}

export const VALID_NOTIFICATION_TYPE: NotificationType = "system";
export const INVALID_EMPTY_RECIPIENT = "";
export const INVALID_EMPTY_TITLE_PAYLOAD: NotificationPayload = {
  titleAr: "",
};
