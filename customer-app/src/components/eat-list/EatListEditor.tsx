import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DishSaveTarget, EatListEntry, eatListApi } from "../../api/eatList";
import { colors } from "../../theme/tokens";
import { appStyles } from "../../theme/appStyles";
import {
  calendarDate,
  calendarDay,
  dayLabel,
  monthCells,
  planLabel,
} from "../../utils/eatList";
import { HomeImage } from "../home/HomeImage";
import { fallbackArt } from "../../utils/imageRef";
import { Button } from "../Button";

export function EatListEditor({
  target,
  initialEntry,
  onClose,
  onSaved,
}: {
  target: DishSaveTarget;
  initialEntry?: EatListEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [entry, setEntry] = useState(initialEntry);
  const [loading, setLoading] = useState(!initialEntry);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState(initialEntry?.note || "");
  const [date, setDate] = useState(initialEntry?.plannedDate || "");
  const [time, setTime] = useState(initialEntry?.plannedTime || "");
  const [zone, setZone] = useState(
    initialEntry?.timeZone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC",
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [month, setMonth] = useState(
    initialEntry?.plannedDate
      ? calendarDay(initialEntry.plannedDate)
      : new Date(),
  );
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (initialEntry) return;
    let active = true;
    (async () => {
      try {
        const found = await eatListApi.membership(target.outletId, [
          target.menuItemId,
        ]);
        const existing = found[0]
          ? await eatListApi.get(found[0].id)
          : undefined;
        if (!active) return;
        setEntry(existing);
        setNote(existing?.note || "");
        setDate(existing?.plannedDate || "");
        setTime(existing?.plannedTime || "");
        if (existing?.timeZone) setZone(existing.timeZone);
        if (existing?.plannedDate) setMonth(calendarDay(existing.plannedDate));
      } catch {
        if (active)
          setLoadError(
            "Couldn’t load this dish’s saved details. Please try again.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [initialEntry, target.outletId, target.menuItemId, retry]);
  const selectDate = (value: string) => {
    setDate(value);
    setError("");
    if (!value) setTime("");
  };
  const save = async () => {
    if (saving || loading || loadError) return;
    if (time && (!date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      setError(
        "Choose a day and enter a time like 19:30, or leave the time empty.",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const plan = {
        note: note.trim() || null,
        plannedDate: date || null,
        plannedTime: time || null,
        timeZone: date ? zone : null,
      };
      if (entry) await eatListApi.update(entry.id, plan);
      else await eatListApi.save(target, plan);
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn’t save. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const displayName = entry?.name || target.name;
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          accessibilityViewIsModal
        >
          <View style={s.handle} />
          <View style={s.headingRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>YOUR NEXT FOOD STORY</Text>
              <Text accessibilityRole="header" style={s.title}>
                {entry ? "Make a little plan" : "Save a little craving"}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close Eat List editor"
              disabled={saving}
              onPress={onClose}
              style={s.close}
            >
              <Ionicons name="close" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.scroll}
          >
            <View style={s.dish}>
              <View style={s.photo}>
                <HomeImage
                  source={entry?.imageUrl || target.imageUrl}
                  fallback={fallbackArt(displayName)}
                  alt={displayName}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.dishName} numberOfLines={2}>
                  {displayName}
                </Text>
                <Text style={s.muted}>{target.restaurantName}</Text>
                <Text style={s.smallGreen}>
                  {entry
                    ? "Already in your Eat List · edit anytime"
                    : "A delicious idea, kept just for you"}
                </Text>
              </View>
            </View>
            {loading ? (
              <View style={s.loading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={s.muted}>Checking your Eat List…</Text>
              </View>
            ) : loadError ? (
              <View style={s.errorBox}>
                <Text style={s.error}>{loadError}</Text>
                <Button
                  title="Try again"
                  onPress={() => {
                    setLoading(true);
                    setLoadError("");
                    setRetry((v) => v + 1);
                  }}
                />
              </View>
            ) : (
              <>
                <Text style={s.label}>When are we eating this?</Text>
                <Text style={s.help}>
                  Pick a day, or keep it for a future craving.
                </Text>
                <View style={s.chips}>
                  {[
                    { value: "", label: "Someday", icon: "sparkles-outline" },
                    {
                      value: calendarDate(),
                      label: "Today",
                      icon: "sunny-outline",
                    },
                    {
                      value: calendarDate(tomorrow),
                      label: "Tomorrow",
                      icon: "partly-sunny-outline",
                    },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.label}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                      accessibilityState={{ selected: date === option.value }}
                      onPress={() => {
                        selectDate(option.value);
                        setCalendarOpen(false);
                      }}
                      style={[s.chip, date === option.value && s.chipActive]}
                    >
                      <Ionicons
                        name={option.icon as "sunny-outline"}
                        size={16}
                        color={
                          date === option.value ? "#FFFFFF" : colors.primary
                        }
                      />
                      <Text
                        style={[
                          s.chipText,
                          date === option.value && s.chipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={s.dateButton}
                  accessibilityRole="button"
                  accessibilityLabel="Choose a date"
                  accessibilityState={{ expanded: calendarOpen }}
                  onPress={() => {
                    setCalendarOpen((v) => !v);
                    if (date) setMonth(calendarDay(date));
                  }}
                >
                  <Ionicons
                    name="calendar-outline"
                    color={colors.primary}
                    size={21}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.dateText}>
                      {date
                        ? `${dayLabel(date)} · ${calendarDay(date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
                        : "Choose another day"}
                    </Text>
                  </View>
                  <Ionicons
                    name={calendarOpen ? "chevron-up" : "chevron-down"}
                    size={17}
                    color={colors.primary}
                  />
                </TouchableOpacity>
                {calendarOpen && (
                  <View style={s.calendar}>
                    <View style={s.monthRow}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Previous month"
                        style={s.monthArrow}
                        onPress={() =>
                          setMonth(
                            new Date(
                              month.getFullYear(),
                              month.getMonth() - 1,
                              1,
                            ),
                          )
                        }
                      >
                        <Ionicons
                          name="chevron-back"
                          size={20}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                      <Text style={s.month}>
                        {month.toLocaleDateString("en-IN", {
                          month: "long",
                          year: "numeric",
                        })}
                      </Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Next month"
                        style={s.monthArrow}
                        onPress={() =>
                          setMonth(
                            new Date(
                              month.getFullYear(),
                              month.getMonth() + 1,
                              1,
                            ),
                          )
                        }
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                    </View>
                    <View style={s.calendarGrid}>
                      {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                        <View key={`day${i}`} style={s.cell}>
                          <Text style={s.weekday}>{d}</Text>
                        </View>
                      ))}
                      {monthCells(month).map((value, i) =>
                        value ? (
                          <TouchableOpacity
                            key={value}
                            accessibilityRole="button"
                            accessibilityLabel={`Plan for ${value}`}
                            accessibilityState={{ selected: date === value }}
                            style={s.cell}
                            onPress={() => {
                              selectDate(value);
                              setCalendarOpen(false);
                            }}
                          >
                            <View
                              style={[
                                s.day,
                                date === value && s.dayActive,
                                value === calendarDate() &&
                                  date !== value &&
                                  s.dayToday,
                              ]}
                            >
                              <Text
                                style={[
                                  s.dayText,
                                  date === value && s.chipTextActive,
                                ]}
                              >
                                {Number(value.slice(-2))}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <View key={`blank${i}`} style={s.cell} />
                        ),
                      )}
                    </View>
                  </View>
                )}
                {Boolean(date) && (
                  <View style={s.timeBlock}>
                    <Text style={s.label}>
                      A time? <Text style={s.optional}>(optional)</Text>
                    </Text>
                    <View style={s.timeInputRow}>
                      <Ionicons
                        name="time-outline"
                        size={20}
                        color={colors.primary}
                      />
                      <TextInput
                        accessibilityLabel="Planned time, 24 hour format"
                        placeholder="HH:mm, e.g. 19:30"
                        placeholderTextColor="#87938B"
                        value={time}
                        onChangeText={setTime}
                        maxLength={5}
                        keyboardType="numbers-and-punctuation"
                        style={s.timeInput}
                      />
                      {Boolean(time) && (
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel="Clear planned time"
                          onPress={() => setTime("")}
                          style={{ padding: 8 }}
                        >
                          <Ionicons
                            name="close-circle"
                            size={18}
                            color="#7D8E81"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={s.chips}>
                      {[
                        { label: "Breakfast", value: "09:00" },
                        { label: "Lunch", value: "13:00" },
                        { label: "Dinner", value: "20:00" },
                      ].map((o) => (
                        <TouchableOpacity
                          key={o.value}
                          accessibilityRole="button"
                          accessibilityLabel={o.label}
                          accessibilityState={{ selected: time === o.value }}
                          onPress={() => setTime(o.value)}
                          style={[s.meal, time === o.value && s.mealActive]}
                        >
                          <Text style={s.mealText}>{o.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={s.help}>
                      Time zone: {zone.replace(/_/g, " ")} · A plan, without a
                      reminder.
                    </Text>
                  </View>
                )}
                <View style={s.noteHeading}>
                  <Text style={s.label}>A note to your hungry self</Text>
                  <Text style={s.counter}>{note.length}/1,000</Text>
                </View>
                <TextInput
                  accessibilityLabel="Eat List note"
                  value={note}
                  onChangeText={setNote}
                  placeholder="Extra spicy? Share it with someone? Write it here…"
                  placeholderTextColor="#87938B"
                  multiline
                  maxLength={1000}
                  style={s.noteInput}
                  textAlignVertical="top"
                />
                <View style={s.preview}>
                  <Ionicons name="bookmark" size={17} color={colors.primary} />
                  <Text style={s.previewText}>
                    {planLabel(date || null, time || null)}
                  </Text>
                </View>
                {entry && (
                  <Text style={s.help}>
                    First saved{" "}
                    {new Date(entry.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    . Editing keeps that date.
                  </Text>
                )}
              </>
            )}
            {Boolean(error) && (
              <Text style={s.error} accessibilityRole="alert">
                {error}
              </Text>
            )}
          </ScrollView>
          <View style={s.footer}>
            <Button
              title={entry ? "Save changes" : "Save to Eat List"}
              icon={
                <Ionicons name="bookmark-outline" size={18} color="#FFFFFF" />
              }
              onPress={save}
              loading={saving}
              disabled={loading || Boolean(loadError)}
              size="lg"
            />
            <Text style={s.footerText}>
              Your dishes. Your plans. Saved to your account.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const s = appStyles({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10,29,19,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Platform.OS === "web" ? 16 : 0,
  },
  sheet: {
    width: "100%",
    maxWidth: 580,
    maxHeight: "94%",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    overflow: "hidden",
    boxShadow: "0px 18px 70px rgba(0,0,0,0.2)",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#DCE7DD",
    marginTop: 10,
  },
  headingRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: "center",
  },
  eyebrow: {
    color: "#6C8562",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "800",
    letterSpacing: -0.7,
    color: "#193B2C",
    marginTop: 4,
  },
  close: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#F1F5EE",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { paddingHorizontal: 22, paddingBottom: 16 },
  dish: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F4F7F0",
    padding: 12,
    borderRadius: 20,
    marginBottom: 24,
  },
  photo: {
    width: 72,
    height: 78,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#E7EDDE",
  },
  dishName: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    color: "#203728",
  },
  muted: { color: "#738171", fontSize: 12, lineHeight: 18, marginTop: 3 },
  smallGreen: { fontSize: 10, color: "#56753E", marginTop: 7 },
  loading: { padding: 28, alignItems: "center", gap: 10 },
  label: { color: "#243B2B", fontSize: 15, fontWeight: "700", lineHeight: 22 },
  help: { color: "#788575", fontSize: 11, lineHeight: 17, marginTop: 4 },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
    marginBottom: 12,
  },
  chip: {
    flexDirection: "row",
    flex: 1,
    minWidth: 80,
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: "#F2F6ED",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#FFFFFF" },
  dateButton: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 13,
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#DBE5D7",
    borderRadius: 14,
  },
  dateText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
    lineHeight: 18,
  },
  calendar: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#F6F9F2",
    borderRadius: 18,
  },
  monthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  month: { fontSize: 14, fontWeight: "700", color: colors.primary },
  monthArrow: { padding: 10 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "14.2857%",
    height: 41,
    alignItems: "center",
    justifyContent: "center",
  },
  weekday: { fontSize: 10, color: "#7B8C76", fontWeight: "700" },
  day: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  dayActive: { backgroundColor: colors.primary },
  dayToday: { backgroundColor: "#E4EFCB" },
  dayText: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  timeBlock: { marginTop: 19, marginBottom: 4 },
  optional: { color: "#85917F", fontSize: 12, fontWeight: "400" },
  timeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "#DBE5D7",
    borderRadius: 13,
    paddingHorizontal: 13,
    marginTop: 8,
  },
  timeInput: { flex: 1, minHeight: 46, fontSize: 14, color: colors.primary },
  meal: {
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5EB",
  },
  mealActive: { backgroundColor: "#D9F078" },
  mealText: { fontSize: 11, color: colors.primary, fontWeight: "600" },
  noteHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 23,
    marginBottom: 10,
  },
  counter: { color: "#87947D", fontSize: 10 },
  noteInput: {
    minHeight: 106,
    borderWidth: 1,
    borderColor: "#DBE5D7",
    borderRadius: 16,
    backgroundColor: "#FAFCF8",
    padding: 14,
    color: "#263D2B",
    fontSize: 13,
    lineHeight: 21,
  },
  preview: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    padding: 13,
    backgroundColor: "#EFF5E4",
    borderRadius: 13,
    marginTop: 17,
  },
  previewText: {
    flex: 1,
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
  },
  errorBox: { padding: 15, gap: 10 },
  error: { color: "#A5422E", fontSize: 12, lineHeight: 19, marginVertical: 12 },
  footer: {
    paddingTop: 14,
    paddingHorizontal: 22,
    borderTopWidth: 1,
    borderTopColor: "#EDF1E8",
  },
  footerText: {
    textAlign: "center",
    color: "#7D8C73",
    fontSize: 10,
    marginTop: 10,
  },
});
