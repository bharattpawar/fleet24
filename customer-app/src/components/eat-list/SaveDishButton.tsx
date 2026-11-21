import React, { useEffect } from "react";
import { Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DishSaveTarget } from "../../api/eatList";
import { useEatList, keyOf } from "../../context/EatListState";
import { colors } from "../../theme/tokens";
import { appStyles } from "../../theme/appStyles";
/** Mounted buttons batch visible dish membership by outlet instead of loading every saved ID. */
export function SaveDishButton({
  target,
  compact = false,
}: {
  target: DishSaveTarget;
  compact?: boolean;
}) {
  const ctx = useEatList();
  const request = ctx?.requestMembership;
  const revision = ctx?.revision;
  const { outletId, menuItemId, name, restaurantName, imageUrl } = target;
  useEffect(() => {
    request?.({ outletId, menuItemId, name, restaurantName, imageUrl });
  }, [request, revision, outletId, menuItemId, name, restaurantName, imageUrl]);
  if (!ctx) return null;
  const saved = Boolean(ctx.membership[keyOf(target)]);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      accessibilityLabel={`${saved ? "Edit" : "Save"} ${name} ${saved ? "in" : "to"} Eat List`}
      style={[s.save, compact && s.compact, saved && s.saved]}
      onPress={(event) => {
        event.stopPropagation();
        ctx.open(target);
      }}
      activeOpacity={0.8}
    >
      <Ionicons
        name={saved ? "bookmark" : "bookmark-outline"}
        color={colors.primary}
        size={18}
      />
      {!compact && (
        <Text style={s.saveText}>{saved ? "Saved" : "Eat List"}</Text>
      )}
    </TouchableOpacity>
  );
}

const s = appStyles({
  save: {
    minHeight: 40,
    paddingHorizontal: 11,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F9F3",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DFE9DC",
  },
  compact: {
    minHeight: 40,
    width: 40,
    paddingHorizontal: 0,
    backgroundColor: "#FFFFFF",
  },
  saved: { backgroundColor: "#EAF2DC" },
  saveText: { fontSize: 11, fontWeight: "700", color: colors.primary },
});
