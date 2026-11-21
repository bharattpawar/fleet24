import {
  calendarDate,
  calendarDay,
  dayLabel,
  monthCells,
  planLabel,
  timeLabel,
} from "./eatList";
describe("Eat List local calendar", () => {
  it("keeps dates local instead of converting a calendar day through UTC", () => {
    expect(calendarDate(new Date(2026, 10, 21, 0, 5))).toBe("2026-11-21");
    expect(calendarDate(calendarDay("2028-02-29"))).toBe("2028-02-29");
  });
  it("labels adjacent days correctly across year boundaries", () => {
    const now = new Date(2026, 11, 31, 23, 0);
    expect(dayLabel("2026-12-31", now)).toBe("Today");
    expect(dayLabel("2027-01-01", now)).toBe("Tomorrow");
    expect(dayLabel("2026-12-30", now)).toBe("Yesterday");
  });
  it("keeps optional meal times distinct from midnight", () => {
    expect(timeLabel("00:00")).toBe("12:00 AM");
    expect(timeLabel("20:30")).toBe("8:30 PM");
    expect(planLabel("2026-12-24", null)).toContain("Any time");
    expect(planLabel(null, null)).toBe("Someday, something delicious");
  });
  it("builds a full leap-month calendar with weekday alignment", () => {
    const cells = monthCells(new Date(2028, 1, 1));
    expect(cells.filter(Boolean)).toHaveLength(29);
    expect(
      cells.slice(0, new Date(2028, 1, 1).getDay()).every((v) => v === null),
    ).toBe(true);
    expect(cells[cells.length - 1]).toBe("2028-02-29");
  });
});
