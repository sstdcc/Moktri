import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotificationService } from "../NotificationService";
import { NotificationError } from "@/types/notifications";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  NotificationType,
  CreateNotificationInput,
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
    selectResult: { data: unknown; error: unknown };
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

  function buildChain() {
    const chain: Record<string, unknown> = {
      insert,
      update,
      delete: del,
      select,
      eq,
      single,
      maybeSingle,
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
  single.mockImplementation(() => Promise.resolve(state.singleResult));
  maybeSingle.mockImplementation(() => Promise.resolve(state.maybeSingleResult));

  const from = vi.fn().mockReturnValue(chain);
  const supabase = { from } as unknown as SupabaseClient<Database>;

  return { supabase, state, from, insert, update, del, select, eq, single, maybeSingle };
}

describe("createNotificationService", () => {
  it("should return an object with all expected methods", () => {
    const { supabase } = createMockChain();
    const service = createNotificationService(supabase);

    expect(service).toHaveProperty("create");
    expect(service).toHaveProperty("createMany");
    expect(service).toHaveProperty("markAsRead");
    expect(service).toHaveProperty("markAllAsRead");
    expect(service).toHaveProperty("delete");
    expect(typeof service.create).toBe("function");
    expect(typeof service.createMany).toBe("function");
    expect(typeof service.markAsRead).toBe("function");
    expect(typeof service.markAllAsRead).toBe("function");
    expect(typeof service.delete).toBe("function");
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
