import { describe, expect, it } from "vitest";
import { taskState } from "@/components/jarvis/hud-state";

describe("Real task status", () => {
  const now = Date.parse("2026-10-08T16:35:00Z");
  it("marks a pending past deadline as overdue", () => {
    expect(taskState({ done: false, due_at: "2026-10-07T16:35:00Z" }, now)).toBe("overdue");
  });
  it("keeps a completed past deadline completed", () => {
    expect(taskState({ done: true, due_at: "2026-10-07T16:35:00Z" }, now)).toBe("completed");
  });
  it("does not invent a deadline for an undated task", () => {
    expect(taskState({ done: false }, now)).toBe("pending");
  });
});