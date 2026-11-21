/** Calendar dates are local dates, never UTC instants (avoids off-by-one days). */
export function calendarDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function calendarDay(value: string): Date {
  return new Date(value + "T12:00:00");
}
export function dayLabel(value: string, now = new Date()): string {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (value === calendarDate(now)) return "Today";
  if (value === calendarDate(tomorrow)) return "Tomorrow";
  if (value === calendarDate(yesterday)) return "Yesterday";
  return calendarDay(value).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(value.slice(0, 4) !== String(now.getFullYear())
      ? { year: "numeric" }
      : {}),
  });
}
export function timeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
export function planLabel(date: string | null, time: string | null) {
  return date
    ? `${dayLabel(date)}${time ? ` · ${timeLabel(time)}` : " · Any time"}`
    : "Someday, something delicious";
}
export function monthCells(month: Date): (string | null)[] {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  return [
    ...Array.from({ length: start.getDay() }, () => null),
    ...Array.from({ length: count }, (_, i) =>
      calendarDate(new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ),
  ];
}
