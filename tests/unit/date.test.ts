import { describe, it, expect } from "vitest";
import {
  toISODate,
  startOfWeekMonday,
  addDays,
  formatDayLabel,
  parseDateOnlyUTC,
  addDaysUTC,
  toISODateUTC,
  todayUTCDateOnly,
  yyyyMmUTC,
  pad2,
  ymdLocal,
} from "@/lib/date/date";

describe("lib/date/date.ts", () => {
  it("pad2 pads 0-9 and leaves 2+ digits", () => {
    expect(pad2(0)).toBe("00");
    expect(pad2(7)).toBe("07");
    expect(pad2(10)).toBe("10");
    expect(pad2(123)).toBe("123");
  });

  it("toISODate formats local date parts as YYYY-MM-DD", () => {
    const d = new Date(2026, 1, 8);
    expect(toISODate(d)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toISODate(d)).toBe(`${d.getFullYear()}-02-08`);
  });

  it("ymdLocal uses local getters and pad2", () => {
    const d = new Date(2026, 0, 3);
    expect(ymdLocal(d)).toBe("2026-01-03");
  });

  it("addDays returns a new Date and shifts by N days (local)", () => {
    const d = new Date(2026, 0, 10);
    const d2 = addDays(d, 5);
    expect(d2).not.toBe(d);
    expect(d2.getFullYear()).toBe(2026);
    expect(d2.getMonth()).toBe(0);
    expect(d2.getDate()).toBe(15);
  });

  it("startOfWeekMonday returns Monday 00:00:00.000 local for a mid-week date", () => {
    const input = new Date(2026, 1, 4, 12, 30, 0, 0);
    const monday = startOfWeekMonday(input);

    expect(monday.getDay()).toBe(1); // Monday
    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(1); // Feb
    expect(monday.getDate()).toBe(2);
    expect(monday.getHours()).toBe(0);
    expect(monday.getMinutes()).toBe(0);
    expect(monday.getSeconds()).toBe(0);
    expect(monday.getMilliseconds()).toBe(0);
  });

  it("startOfWeekMonday handles Sunday by going back 6 days", () => {
    const sunday = new Date(2026, 1, 8, 9, 0, 0, 0);
    const monday = startOfWeekMonday(sunday);

    expect(monday.getDay()).toBe(1);
    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(1);
    expect(monday.getDate()).toBe(2);
  });

  it("formatDayLabel uses toISODate", () => {
    const d = new Date(2026, 1, 8);
    expect(formatDayLabel(d)).toBe(toISODate(d));
  });

  it("parseDateOnlyUTC returns UTC midnight Date for valid YYYY-MM-DD", () => {
    const d = parseDateOnlyUTC("2026-02-08");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-02-08T00:00:00.000Z");
  });

  it("parseDateOnlyUTC returns null for invalid formats", () => {
    const d = parseDateOnlyUTC("2026-02-30");
    expect(d?.toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });

  it("addDaysUTC adds days using UTC fields", () => {
    const base = new Date("2026-02-08T00:00:00.000Z");
    const plus3 = addDaysUTC(base, 3);
    expect(plus3.toISOString()).toBe("2026-02-11T00:00:00.000Z");
    expect(base.toISOString()).toBe("2026-02-08T00:00:00.000Z");
  });

  it("toISODateUTC uses ISO slice(0,10)", () => {
    const d = new Date("2026-02-08T23:59:59.000Z");
    expect(toISODateUTC(d)).toBe("2026-02-08");
  });

  it("yyyyMmUTC formats YYYY-MM from UTC fields", () => {
    const d = new Date("2026-02-08T00:00:00.000Z");
    expect(yyyyMmUTC(d)).toBe("2026-02");
  });

  it("todayUTCDateOnly returns UTC date at midnight", () => {
    const d = todayUTCDateOnly();
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
    expect(d.getUTCMilliseconds()).toBe(0);

    expect(d.toISOString()).toMatch(/T00:00:00\.000Z$/);
  });
});
