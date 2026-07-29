import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotificationService } from "../NotificationService";
import { NotificationError } from "@/types/notifications";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  isValidPreferences,
  type NotificationType,
  type CreateNotificationInput,
  type NotificationPreferences,
} from "@/types/notifications";
import {
  MOCK_UUID,
  buildValidPayload,
  buildValidInput,
} from "./fixtures/notifications.fixtures";

function createMockChain() {
  const state: {
    singleResult: { data: unknown; error: unknown };
    maybeSingleResult: { data: unknown; error: unknown };
    selectResult: { data: unknown; error: unknown; count?: number };
  } = {
    singleResult: { data: null, error: null },
    maybeSingleResult: { data: null, error: null },
    selectResult: { data: null, error: null },
  };

  const insert = vi.fn();
  const update = vi.fn();
  const del = vi.fn();
  const select = vi.fn();
  const eq = vi.fn();
  const single = vi.fn();
  const maybeSingle = vi.fn();
  const order = vi.fn();
  const range = vi.fn();

  function buildChain() {
    const chain: Record<string, unknown> = {
      insert,
      update,
      delete: del,
      select,
      eq,
      single,
      maybeSingle,
      order,
      range,
      then: (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(state.selectResult).then(resolve, reject),
    };
    return chain;
  }

  const chain = buildChain();

  insert.mockReturnValue(chain);
  update.mockReturnValue(chain);
  del.mockReturnValue(chain);
  select.mockReturnValue(chain);
  eq.mockReturnValue(chain);
  order.mockReturnValue(chain);
  range.mockReturnValue(chain);
  single.mockImplementation(() => Promise.resolve(state.singleResult));
  maybeSingle.mockImplementation(() => Promise.resolve(state.maybeSingleResult));

  const from = vi.fn().mockReturnValue(chain);
  const supabase = { from } as unknown as SupabaseClient<Database>;

  return { supabase, state, from, insert, update, del, select, eq, single, maybeSingle, order, range };
}

describe("createNotificationService", () => {
  it("should return an object with all expected methods", () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    const expectedMethods = [
      "create",
      "createMany",
      "markAsRead",
      "markAllAsRead",
      "delete",
      "getNotifications",
      "getUnreadCount",
      "getNotification",
      "getPreferences",
      "setPreferences",
    ];
    for (const method of expectedMethods) {
      expect(service).toHaveProperty(method);
      expect(typeof (service as Record<string, unknown>)[method]).toBe("function");
    }
  });

  it("should throw TypeError when supabaseClient is null", () => {
    expect(() =>
      createNotificationService(null as unknown as SupabaseClient<Database>),
    ).toThrow(TypeError);
  });

  it("should throw TypeError when supabaseClient is undefined", () => {
    expect(() =>
      createNotificationService(undefined as unknown as SupabaseClient<Database>),
    ).toThrow(TypeError);
  });
});

describe("NotificationService.create", () => {
  it("should create a notification and return NotificationResult", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    const expectedId = "notif-1";
    const expectedDate = "2026-07-29T12:00:00Z";
    state.singleResult = {
      data: {
        id: expectedId,
        type: "system",
        title_ar: "إشعار تجريبي",
        created_at: expectedDate,
      },
      error: null,
    };

    const result = await service.create("system", MOCK_UUID, buildValidPayload());

    expect(result.id).toBe(expectedId);
    expect(result.type).toBe("system");
    expect(result.recipientId).toBe(MOCK_UUID);
    expect(result.titleAr).toBe("إشعار تجريبي");
    expect(result.createdAt).toBe(expectedDate);
  });

  it("should throw INVALID_INPUT for empty recipientId", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    await expect(
      service.create("system", "", buildValidPayload()),
    ).rejects.toThrow(NotificationError);

    await expect(
      service.create("system", "", buildValidPayload()),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("should throw INVALID_INPUT for empty titleAr", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    await expect(
      service.create("system", MOCK_UUID, { titleAr: "" }),
    ).rejects.toThrow(NotificationError);

    await expect(
      service.create("system", MOCK_UUID, { titleAr: "" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("should throw FORBIDDEN when Supabase returns 42501", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.singleResult = {
      data: null,
      error: { code: "42501", message: "permission denied for table notifications", details: "", hint: "" },
    };

    await expect(
      service.create("system", MOCK_UUID, buildValidPayload()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("should throw DATABASE_ERROR when Supabase returns other error codes", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.singleResult = {
      data: null,
      error: { code: "23503", message: "insert or update on table violates foreign key constraint", details: "", hint: "" },
    };

    await expect(
      service.create("system", MOCK_UUID, buildValidPayload()),
    ).rejects.toMatchObject({ code: "DATABASE_ERROR" });
  });

  it("should throw UNEXPECTED_RESPONSE when insert returns no data", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.singleResult = {
      data: null,
      error: null,
    };

    await expect(
      service.create("system", MOCK_UUID, buildValidPayload()),
    ).rejects.toMatchObject({ code: "UNEXPECTED_RESPONSE" });
  });

  it("should create with bodyAr as null when not provided", async () => {
    const { supabase, state, insert } = createMockChain();
    const service = createNotificationService(supabase);

    state.singleResult = {
      data: { id: "n1", type: "system", title_ar: "test", created_at: "2026-01-01T00:00:00Z" },
      error: null,
    };

    await service.create("system", MOCK_UUID, { titleAr: "test" });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ body_ar: null }),
    );
  });

  it("should create with link as null when not provided", async () => {
    const { supabase, state, insert } = createMockChain();
    const service = createNotificationService(supabase);

    state.singleResult = {
      data: { id: "n1", type: "system", title_ar: "test", created_at: "2026-01-01T00:00:00Z" },
      error: null,
    };

    await service.create("system", MOCK_UUID, { titleAr: "test" });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ link: null }),
    );
  });
});

describe("NotificationService.createMany", () => {
  it("should create multiple notifications and return results array", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    const inputs: CreateNotificationInput[] = [
      buildValidInput({ recipientId: "user-1", payload: buildValidPayload({ titleAr: "أول" }) }),
      buildValidInput({ recipientId: "user-2", payload: buildValidPayload({ titleAr: "ثاني" }) }),
    ];

    state.selectResult = {
      data: [
        { id: "n1", type: "system", title_ar: "أول", created_at: "2026-01-01T00:00:00Z" },
        { id: "n2", type: "system", title_ar: "ثاني", created_at: "2026-01-01T00:00:01Z" },
      ],
      error: null,
    };

    const results = await service.createMany(inputs);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("n1");
    expect(results[0].recipientId).toBe("user-1");
    expect(results[1].id).toBe("n2");
    expect(results[1].recipientId).toBe("user-2");
  });

  it("should call insert once with an array matching input length", async () => {
    const { supabase, state, insert } = createMockChain();
    const service = createNotificationService(supabase);

    const inputs = [
      buildValidInput(),
      buildValidInput(),
      buildValidInput(),
    ];

    state.selectResult = {
      data: [
        { id: "n1", type: "system", title_ar: "a", created_at: "" },
        { id: "n2", type: "system", title_ar: "b", created_at: "" },
        { id: "n3", type: "system", title_ar: "c", created_at: "" },
      ],
      error: null,
    };

    await service.createMany(inputs);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(Array.isArray(insert.mock.calls[0][0])).toBe(true);
    expect(insert.mock.calls[0][0]).toHaveLength(3);
  });

  it("should throw INVALID_INPUT for empty array", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    await expect(service.createMany([])).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("should throw INVALID_INPUT if any element has empty recipientId", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    const inputs: CreateNotificationInput[] = [
      buildValidInput({ recipientId: "" }),
    ];

    await expect(service.createMany(inputs)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("should throw INVALID_INPUT if any element has empty titleAr", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    const inputs: CreateNotificationInput[] = [
      buildValidInput({ payload: { titleAr: "" } }),
    ];

    await expect(service.createMany(inputs)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("should throw DATABASE_ERROR when Supabase fails", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.selectResult = {
      data: null,
      error: { code: "42P01", message: "relation does not exist", details: "", hint: "" },
    };

    await expect(
      service.createMany([buildValidInput()]),
    ).rejects.toMatchObject({ code: "DATABASE_ERROR" });
  });
});

describe("NotificationService.markAsRead", () => {
  it("should mark a notification as read", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.maybeSingleResult = {
      data: { id: "notif-1" },
      error: null,
    };

    await expect(service.markAsRead("notif-1")).resolves.toBeUndefined();
  });

  it("should throw INVALID_INPUT for empty ID", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    await expect(service.markAsRead("")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("should throw NOT_FOUND when notification does not exist", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.maybeSingleResult = {
      data: null,
      error: null,
    };

    await expect(service.markAsRead("nonexistent")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("should throw FORBIDDEN when RLS rejects", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.maybeSingleResult = {
      data: null,
      error: { code: "42501", message: "permission denied", details: "", hint: "" },
    };

    await expect(service.markAsRead("notif-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("NotificationService.markAllAsRead", () => {
  it("should mark all unread notifications as read and return count", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.selectResult = {
      data: [{ id: "n1" }, { id: "n2" }, { id: "n3" }],
      error: null,
    };

    const result = await service.markAllAsRead();

    expect(result.count).toBe(3);
  });

  it("should return count 0 when no unread notifications", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.selectResult = {
      data: [],
      error: null,
    };

    const result = await service.markAllAsRead();

    expect(result.count).toBe(0);
  });

  it("should handle null data and return count 0", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.selectResult = {
      data: null,
      error: null,
    };

    const result = await service.markAllAsRead();

    expect(result.count).toBe(0);
  });

  it("should build the expected query chain: update -> eq(is_read, false) -> select", async () => {
    const { supabase, state, update, eq, select } = createMockChain();
    const service = createNotificationService(supabase);

    state.selectResult = {
      data: [{ id: "n1" }],
      error: null,
    };

    await service.markAllAsRead();

    expect(update).toHaveBeenCalledWith({ is_read: true });
    expect(eq).toHaveBeenCalledWith("is_read", false);
    expect(select).toHaveBeenCalledWith("id");
  });
});

describe("NotificationService.delete", () => {
  it("should delete a notification", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.maybeSingleResult = {
      data: { id: "notif-1" },
      error: null,
    };

    await expect(service.delete("notif-1")).resolves.toBeUndefined();
  });

  it("should throw INVALID_INPUT for empty ID", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    await expect(service.delete("")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("should throw NOT_FOUND when notification does not exist", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.maybeSingleResult = {
      data: null,
      error: null,
    };

    await expect(service.delete("nonexistent")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("should throw FORBIDDEN when RLS rejects", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.maybeSingleResult = {
      data: null,
      error: { code: "42501", message: "permission denied", details: "", hint: "" },
    };

    await expect(service.delete("notif-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("NotificationService.getNotifications", () => {
  it("should return first page of notifications", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.selectResult = {
      data: [
        { id: "n1", type: "system", user_id: "u1", title_ar: "أول", body_ar: null, link: null, is_read: false, created_at: "2026-01-01T00:00:00Z" },
        { id: "n2", type: "new_message", user_id: "u1", title_ar: "ثاني", body_ar: null, link: null, is_read: true, created_at: "2026-01-01T00:00:01Z" },
      ],
      error: null,
      count: 2,
    };

    const result = await service.getNotifications({ page: 0 });

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(false);
    expect(result.page).toBe(0);
    expect(result.data[0].id).toBe("n1");
    expect(result.data[0].recipientId).toBe("u1");
    expect(result.data[0].isRead).toBe(false);
    expect(result.data[1].id).toBe("n2");
    expect(result.data[1].isRead).toBe(true);
  });

  it("should return hasMore=true when more pages exist", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    const items = Array.from({ length: 30 }, (_, i) => ({
      id: `n${i}`,
      type: "system",
      user_id: "u1",
      title_ar: `Notif ${i}`,
      body_ar: null,
      link: null,
      is_read: false,
      created_at: `2026-01-01T00:00:0${String(i).padStart(2, "0")}Z`,
    }));

    state.selectResult = {
      data: items,
      error: null,
      count: 45,
    };

    const result = await service.getNotifications({ page: 0, pageSize: 30 });

    expect(result.data).toHaveLength(30);
    expect(result.total).toBe(45);
    expect(result.hasMore).toBe(true);
  });

  it("should filter by unread only", async () => {
    const { supabase, state, eq } = createMockChain();
    const service = createNotificationService(supabase);

    state.selectResult = { data: [], error: null, count: 0 };

    await service.getNotifications({ page: 0, filter: "unread" });

    expect(eq).toHaveBeenCalledWith("is_read", false);
  });

  it("should filter by notification type", async () => {
    const { supabase, state, eq } = createMockChain();
    const service = createNotificationService(supabase);

    state.selectResult = { data: [], error: null, count: 0 };

    await service.getNotifications({ page: 0, type: "new_message" });

    expect(eq).toHaveBeenCalledWith("type", "new_message");
  });

  it("should throw INVALID_INPUT for negative page", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    await expect(service.getNotifications({ page: -1 })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("should throw INVALID_INPUT for pageSize < 1", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    await expect(service.getNotifications({ page: 0, pageSize: 0 })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("should throw INVALID_INPUT for pageSize > 100", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    await expect(service.getNotifications({ page: 0, pageSize: 101 })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("should throw DATABASE_ERROR on database failure", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.selectResult = {
      data: null,
      error: { code: "42P01", message: "relation does not exist", details: "", hint: "" },
    };

    await expect(service.getNotifications({ page: 0 })).rejects.toMatchObject({
      code: "DATABASE_ERROR",
    });
  });

  it("should build expected query chain", async () => {
    const { supabase, state, select, order, range } = createMockChain();
    const service = createNotificationService(supabase);

    state.selectResult = { data: [], error: null, count: 0 };

    await service.getNotifications({ page: 0, pageSize: 10 });

    expect(select).toHaveBeenCalledWith(
      "id, type, user_id, title_ar, body_ar, link, is_read, created_at",
      { count: "exact" },
    );
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(range).toHaveBeenCalledWith(0, 9);
  });
});

describe("NotificationService.getUnreadCount", () => {
  it("should return correct count", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.selectResult = { data: null, error: null, count: 5 };

    const count = await service.getUnreadCount();

    expect(count).toBe(5);
  });

  it("should return 0 when no unread", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.selectResult = { data: null, error: null, count: 0 };

    const count = await service.getUnreadCount();

    expect(count).toBe(0);
  });

  it("should return 0 on database error", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.selectResult = {
      data: null,
      error: { code: "42P01", message: "relation does not exist", details: "", hint: "" },
    };

    const count = await service.getUnreadCount();

    expect(count).toBe(0);
  });
});

describe("NotificationService.getNotification", () => {
  it("should return notification by ID with all fields mapped", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.maybeSingleResult = {
      data: {
        id: "notif-1",
        type: "system",
        user_id: "u1",
        title_ar: "إشعار",
        body_ar: "محتوى",
        link: "/listings",
        is_read: false,
        created_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    };

    const result = await service.getNotification("notif-1");

    expect(result.id).toBe("notif-1");
    expect(result.type).toBe("system");
    expect(result.recipientId).toBe("u1");
    expect(result.titleAr).toBe("إشعار");
    expect(result.bodyAr).toBe("محتوى");
    expect(result.link).toBe("/listings");
    expect(result.isRead).toBe(false);
    expect(result.createdAt).toBe("2026-01-01T00:00:00Z");
  });

  it("should throw INVALID_INPUT for empty ID", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    await expect(service.getNotification("")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("should throw NOT_FOUND for non-existent ID", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.maybeSingleResult = { data: null, error: null };

    await expect(service.getNotification("nonexistent")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("should throw FORBIDDEN when RLS blocks", async () => {
    const { supabase, state } = createMockChain();
    const service = createNotificationService(supabase);

    state.maybeSingleResult = {
      data: null,
      error: { code: "42501", message: "permission denied", details: "", hint: "" },
    };

    await expect(service.getNotification("notif-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("NotificationService.getPreferences", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", (() => {
      let store: Record<string, string> = {};
      return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        get length() { return Object.keys(store).length; },
        key: vi.fn((_index: number) => ""),
      };
    })());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return saved preferences", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    const saved: NotificationPreferences = {
      new_response: true,
      listing_expiring: false,
      listing_approved: true,
      listing_rejected: false,
      verification_update: true,
      new_report: false,
      system: true,
    };
    localStorage.setItem("miftah_notif_prefs", JSON.stringify(saved));

    const result = await service.getPreferences();

    expect(result).toEqual(saved);
  });

  it("should return defaults when nothing saved", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    const result = await service.getPreferences();

    expect(result.new_response).toBe(true);
    expect(result.listing_expiring).toBe(true);
    expect(result.listing_approved).toBe(true);
    expect(result.listing_rejected).toBe(true);
    expect(result.verification_update).toBe(true);
    expect(result.new_report).toBe(true);
    expect(result.system).toBe(true);
  });

  it("should return defaults when localStorage is corrupted", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    localStorage.setItem("miftah_notif_prefs", "not-valid-json");

    const result = await service.getPreferences();

    expect(result.new_response).toBe(true);
    expect(result.system).toBe(true);
  });
});

describe("NotificationService.setPreferences", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", (() => {
      let store: Record<string, string> = {};
      return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        get length() { return Object.keys(store).length; },
        key: vi.fn((_index: number) => ""),
      };
    })());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should save valid preferences", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    const prefs: NotificationPreferences = {
      new_response: true,
      listing_expiring: false,
      listing_approved: true,
      listing_rejected: false,
      verification_update: true,
      new_report: false,
      system: true,
    };

    await service.setPreferences(prefs);

    const saved = JSON.parse(localStorage.getItem("miftah_notif_prefs") ?? "{}");
    expect(saved).toEqual(prefs);
  });

  it("should throw INVALID_INPUT for missing keys", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    const invalid = { new_response: true } as unknown as NotificationPreferences;

    await expect(service.setPreferences(invalid)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("should throw INVALID_INPUT for non-boolean values", async () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    const invalid = {
      new_response: true,
      listing_expiring: "yes",
      listing_approved: true,
      listing_rejected: false,
      verification_update: true,
      new_report: false,
      system: true,
    } as unknown as NotificationPreferences;

    await expect(service.setPreferences(invalid)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});

describe("NotificationError", () => {
  it("should have name NotificationError", () => {
    const err = new NotificationError("INVALID_INPUT", "test");
    expect(err.name).toBe("NotificationError");
  });

  it("should have a timestamp in details", () => {
    const err = new NotificationError("INVALID_INPUT", "test");
    expect(err.details.timestamp).toBeDefined();
    expect(typeof err.details.timestamp).toBe("string");
  });

  it("should preserve cause in details", () => {
    const cause = new Error("original error");
    const err = new NotificationError("DATABASE_ERROR", "wrapped", { cause });
    expect(err.details.cause).toBe(cause);
  });

  it("toJSON should return structured object", () => {
    const err = new NotificationError("NOT_FOUND", "not found", { operation: "test" });
    const json = err.toJSON() as Record<string, unknown>;
    expect(json.name).toBe("NotificationError");
    expect(json.code).toBe("NOT_FOUND");
    expect(json.message).toBe("not found");
    expect((json.details as Record<string, unknown>).operation).toBe("test");
  });
});
