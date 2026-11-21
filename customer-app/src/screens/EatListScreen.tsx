import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  EatListEntry,
  EatListMode,
  EatListPage,
  eatListApi,
} from "../api/eatList";
import { useAuth } from "../context/AuthContext";
import { useEatList } from "../context/EatListState";
import { colors } from "../theme/tokens";
import { appStyles } from "../theme/appStyles";
import {
  calendarDate,
  calendarDay,
  dayLabel,
  planLabel,
} from "../utils/eatList";
import { HomeImage } from "../components/home/HomeImage";
import { fallbackArt } from "../utils/imageRef";
import { VegBadge } from "../components/VegBadge";
import { ScreenEmptyState } from "../components/ScreenEmptyState";
import { OutletSummary } from "../components/RestaurantCard";

type Row =
  { key: string; title: string } | { key: string; cards: EatListEntry[] };
export function EatListScreen({
  onRequireAuth,
  onExploreFood,
  onSelectOutlet,
}: {
  onRequireAuth: () => void;
  onExploreFood: () => void;
  onSelectOutlet: (outlet: OutletSummary, dishId?: string) => void;
}) {
  const { user } = useAuth();
  const ctx = useEatList();
  const userId = user?.id;
  const [mode, setMode] = useState<EatListMode>("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [page, setPage] = useState<EatListPage>({
    items: [],
    stats: { all: 0, planned: 0, someday: 0 },
    nextCursor: null,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const version = useRef(0);
  const moreLock = useRef(false);
  const { width } = useWindowDimensions();
  const columns = width >= 960 ? 2 : 1;
  useEffect(() => {
    const current = ++version.current;
    const abort = new AbortController();
    moreLock.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset the async request lifecycle when its query or authenticated owner changes.
    setLoadingMore(false);
    if (!userId) {
      setPage({
        items: [],
        stats: { all: 0, planned: 0, someday: 0 },
        nextCursor: null,
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    eatListApi
      .list(
        mode,
        mode === "planned" ? selectedDate : undefined,
        null,
        abort.signal,
      )
      .then((result) => {
        if (version.current === current) setPage(result);
      })
      .catch((e) => {
        if (!abort.signal.aborted && version.current === current) {
          setPage((p) => ({ ...p, items: [], nextCursor: null }));
          setError(
            e instanceof Error ? e.message : "Couldn’t load your Eat List.",
          );
        }
      })
      .finally(() => {
        if (version.current === current) setLoading(false);
      });
    return () => {
      abort.abort();
      version.current = current + 1;
    };
  }, [userId, mode, selectedDate, reload, ctx?.revision]);
  const loadMore = useCallback(async () => {
    if (!user || loading || moreLock.current || !page.nextCursor) return;
    const current = version.current;
    moreLock.current = true;
    setLoadingMore(true);
    setError("");
    try {
      const result = await eatListApi.list(
        mode,
        mode === "planned" ? selectedDate : undefined,
        page.nextCursor,
      );
      if (current === version.current)
        setPage((previous) => ({
          ...result,
          items: [
            ...previous.items,
            ...result.items.filter(
              (item) => !previous.items.some((old) => old.id === item.id),
            ),
          ],
        }));
    } catch (e) {
      if (current === version.current)
        setError(e instanceof Error ? e.message : "Couldn’t load more dishes.");
    } finally {
      if (current === version.current) {
        setLoadingMore(false);
        moreLock.current = false;
      }
    }
  }, [user, loading, page.nextCursor, mode, selectedDate]);
  const rows = useMemo(() => {
    const result: Row[] = [];
    let group = "";
    let cards: EatListEntry[] = [];
    page.items.forEach((item) => {
      // The selected filter can change before its asynchronous page arrives.
      if (mode === "planned" && (!item.plannedDate || (selectedDate && item.plannedDate !== selectedDate))) return;
      if (mode === "someday" && item.plannedDate) return;
      const nextGroup =
        mode === "planned"
          ? item.plannedDate!
          : calendarDate(new Date(item.createdAt));
      if (group !== nextGroup) {
        cards = [];
        group = nextGroup;
        result.push({
          key: `heading:${group}`,
          title: `${mode === "planned" ? "" : "Saved "}${dayLabel(group)}`,
        });
      }
      if (cards.length === 0 || cards.length >= columns) {
        cards = [];
        result.push({ key: item.id, cards });
      }
      cards.push(item);
    });
    return result;
  }, [page.items, mode, selectedDate, columns]);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return calendarDate(date);
      }),
    [],
  );
  if (!user)
    return (
      <ScreenEmptyState
        icon="bookmarks-outline"
        title="Your next delicious chapter"
        subtitle="Keep every dish you want to try, plan a day, and leave a little note. Sign in to keep your Eat List with you."
        action="Sign in to start your list"
        onPress={onRequireAuth}
      />
    );
  const header = (
    <View>
      <View style={s.hero}>
        <View style={s.heroOrb} />
        <View style={s.heroOrbSmall} />
        <View style={s.heroTop}>
          <View style={s.brandChip}>
            <Ionicons name="bookmark" color="#D9F078" size={13} />
            <Text style={s.eyebrow}>A TABLE FOR YOUR CRAVINGS</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Find more dishes"
            onPress={onExploreFood}
            style={s.heroAdd}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <Text accessibilityRole="header" style={s.heroTitle}>
          Eat List<Text style={{ color: "#D9F078" }}>.</Text>
        </Text>
        <Text style={s.heroSubtitle}>Good food, for later.</Text>
        <Text style={s.heroDescription}>
          Little cravings. Big plans. All in one place.
        </Text>
        <View style={s.heroBottom}>
          <View style={s.stats}>
            <Text style={s.statNumber}>
              {page.stats.all}
              <Text style={s.statLabel}> saved dishes</Text>
            </Text>
            <View style={s.statDivider} />
            <Text style={s.statNumber}>
              {page.stats.planned}
              <Text style={s.statLabel}> planned</Text>
            </Text>
          </View>
          <View style={s.heroStamp}>
            <Ionicons name="restaurant-outline" color="#D9F078" size={24} />
          </View>
        </View>
      </View>
      <View style={s.introRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>Your delicious little plans</Text>
          <Text style={s.caption}>
            Saved to your account. Ready when you are.
          </Text>
        </View>
      </View>
      <View
        style={s.tabs}
        accessibilityRole="tablist"
        accessibilityLabel="Eat List filters"
      >
        {(
          [
            { id: "all", title: "All saves", icon: "bookmarks-outline" },
            { id: "planned", title: "Planned", icon: "calendar-outline" },
            { id: "someday", title: "Someday", icon: "sparkles-outline" },
          ] as const
        ).map((tab) => (
          <TouchableOpacity
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.title}
            accessibilityState={{ selected: mode === tab.id }}
            onPress={() => {
              setMode(tab.id);
              setSelectedDate("");
            }}
            style={[s.tab, mode === tab.id && s.tabActive]}
          >
            <Ionicons
              name={tab.icon}
              size={15}
              color={mode === tab.id ? "#FFFFFF" : "#68805D"}
            />
            <Text style={[s.tabText, mode === tab.id && s.tabTextActive]}>
              {tab.title}
            </Text>
            <Text style={[s.tabCount, mode === tab.id && s.tabTextActive]}>
              {page.stats[tab.id]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {mode === "planned" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.dateStrip}
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="All planned dates"
            accessibilityState={{ selected: !selectedDate }}
            onPress={() => setSelectedDate("")}
            style={[s.datePill, !selectedDate && s.datePillActive]}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={colors.primary}
            />
            <Text style={s.dateDay}>All days</Text>
          </TouchableOpacity>
          {days.map((date) => (
            <TouchableOpacity
              key={date}
              accessibilityRole="button"
              accessibilityLabel={`Show plans for ${date}`}
              accessibilityState={{ selected: selectedDate === date }}
              onPress={() => setSelectedDate(date)}
              style={[s.datePill, selectedDate === date && s.datePillActive]}
            >
              <Text style={s.dateWeekday}>
                {date === calendarDate()
                  ? "TODAY"
                  : calendarDay(date)
                      .toLocaleDateString("en-IN", { weekday: "short" })
                      .toUpperCase()}
              </Text>
              <Text style={s.dateNumber}>{Number(date.slice(-2))}</Text>
              <Text style={s.dateDay}>
                {calendarDay(date).toLocaleDateString("en-IN", {
                  month: "short",
                })}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {loading && (
        <View style={s.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={s.caption}>Bringing your cravings together…</Text>
        </View>
      )}
    </View>
  );
  return (
    <View style={s.root}>
      <FlatList
        data={loading ? [] : rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={[s.content, width >= 700 && s.contentWide]}
        ListHeaderComponent={header}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading && Boolean(page.items.length)}
            onRefresh={() => setReload((v) => v + 1)}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) =>
          "title" in item ? (
            <View style={s.groupHeading}>
              <View style={s.groupDot} />
              <Text style={s.groupTitle}>{item.title}</Text>
              <View style={s.groupLine} />
            </View>
          ) : (
            <View style={s.cardRow}>
              {item.cards.map((entry) => (
                <View key={entry.id} style={s.cardCell}>
                  <EatListCard
                    entry={entry}
                    onOpen={() => {
                      if (entry.outlet)
                        onSelectOutlet(
                          entry.outlet,
                          entry.menuItemId || undefined,
                        );
                    }}
                  />
                </View>
              ))}
              {columns === 2 && item.cards.length === 1 && (
                <View style={s.cardCell} />
              )}
            </View>
          )
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons
                  name={
                    mode === "planned"
                      ? "calendar-outline"
                      : "restaurant-outline"
                  }
                  color={colors.primary}
                  size={34}
                />
              </View>
              <Text style={s.emptyTitle}>
                {selectedDate
                  ? "This day is deliciously open"
                  : mode === "planned"
                    ? "Make room for something good"
                    : mode === "someday"
                      ? "For your next “maybe later”"
                      : "A good meal starts with a little wish"}
              </Text>
              <Text style={s.emptyCopy}>
                {selectedDate
                  ? "Pick another day, or add a day to one of your saved dishes."
                  : mode === "planned"
                    ? "Open a saved dish and choose a day. Your food plans will line up right here."
                    : "Tap the bookmark on any dish to keep it here. Add a note, pick a day, or let your cravings decide."}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={
                  mode === "planned" && page.stats.all
                    ? () => {
                        setMode("all");
                        setSelectedDate("");
                      }
                    : onExploreFood
                }
                style={s.emptyAction}
              >
                <Text style={s.emptyActionText}>
                  {mode === "planned" && page.stats.all
                    ? "See all saves"
                    : "Find something delicious"}
                </Text>
                <Ionicons name="arrow-forward" color="#FFFFFF" size={17} />
              </TouchableOpacity>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          <View style={s.listFooter}>
            {Boolean(error) && (
              <View style={s.errorBox}>
                <Text accessibilityRole="alert" style={s.error}>
                  {error}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() =>
                    page.items.length ? loadMore() : setReload((v) => v + 1)
                  }
                  style={s.retry}
                >
                  <Text style={s.retryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}
            {!loading && page.nextCursor && (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={loadMore}
                disabled={loadingMore}
                style={s.more}
              >
                {loadingMore ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={s.moreText}>Load more cravings</Text>
                )}
              </TouchableOpacity>
            )}
            {!loading && page.items.length > 0 && !page.nextCursor && (
              <View style={s.end}>
                <Ionicons name="heart-outline" size={17} color="#7F9471" />
                <Text style={s.endText}>
                  Good things are worth looking forward to.
                </Text>
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}

function EatListCard({
  entry,
  onOpen,
}: {
  entry: EatListEntry;
  onOpen: () => void;
}) {
  const ctx = useEatList();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const edit = () =>
    ctx?.open(
      {
        outletId: entry.outletId || "",
        menuItemId: entry.menuItemId || "",
        name: entry.name,
        restaurantName: entry.restaurantName,
        imageUrl: entry.imageUrl,
      },
      entry,
    );
  const remove = () =>
    Alert.alert(
      "Remove this craving?",
      `${entry.name} and its note will be removed from your Eat List.`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemoving(true);
            setError("");
            try {
              await eatListApi.remove(entry.id);
              ctx?.changed();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Couldn’t remove this dish.",
              );
              setRemoving(false);
            }
          },
        },
      ],
    );
  const saved = new Date(entry.createdAt);
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <View style={s.card}>
      <View style={s.dishRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`View ${entry.name}`}
          onPress={onOpen}
          disabled={!entry.canOpenMenu}
          style={s.dishPhoto}
        >
          <HomeImage
            source={entry.imageUrl}
            fallback={fallbackArt(entry.name)}
            alt={entry.name}
          />
          <View style={s.photoBookmark}>
            <Ionicons name="bookmark" color={colors.primary} size={14} />
          </View>
        </TouchableOpacity>
        <View style={s.dishInfo}>
          <View style={s.vegRow}>
            <VegBadge isVeg={entry.isVeg} size={13} />
            <Text style={s.diet}>{entry.isVeg ? "VEG" : "NON-VEG"}</Text>
          </View>
          <Text style={s.dishName} numberOfLines={2}>
            {entry.name}
          </Text>
          <Text style={s.restaurant} numberOfLines={1}>
            {entry.restaurantName}
          </Text>
          <Text style={s.price}>
            ₹{entry.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            <Text style={s.priceCaption}>
              {!entry.canOpenMenu ? " · price when saved" : ""}
            </Text>
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Remove ${entry.name} from Eat List`}
          disabled={removing}
          onPress={remove}
          style={s.remove}
        >
          {removing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="close" size={18} color="#87927D" />
          )}
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Edit plan for ${entry.name}`}
        onPress={edit}
        style={[s.plan, !entry.plannedDate && s.planSomeday]}
      >
        <View style={s.planIcon}>
          <Ionicons
            name={entry.plannedDate ? "calendar-outline" : "sparkles-outline"}
            size={18}
            color={colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.planEyebrow}>
            {entry.plannedDate ? "ON THE MENU FOR" : "NO RUSH, JUST A CRAVING"}
          </Text>
          <Text style={s.planText}>
            {planLabel(entry.plannedDate, entry.plannedTime)}
          </Text>
          {entry.timeZone && entry.timeZone !== deviceZone && (
            <Text style={s.caption}>{entry.timeZone.replace(/_/g, " ")}</Text>
          )}
        </View>
        <Ionicons name="pencil-outline" size={16} color="#7A8D68" />
      </TouchableOpacity>
      {entry.note && (
        <View style={s.note}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={15}
            color="#829069"
          />
          <Text style={s.noteText}>{entry.note}</Text>
        </View>
      )}
      {!entry.isAvailable && (
        <Text style={s.unavailable}>
          {entry.canOpenMenu
            ? "Currently unavailable to order · your plan is safe"
            : "No longer on the menu · your saved details are safe"}
        </Text>
      )}
      <View style={s.cardFooter}>
        <View style={{ flex: 1 }}>
          <Text style={s.savedLabel}>
            SAVED{" "}
            {saved
              .toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
              .toUpperCase()}
          </Text>
          <Text style={s.savedTime}>
            {saved.toLocaleTimeString("en-IN", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Edit ${entry.name} note and plan`}
          onPress={edit}
          style={s.edit}
        >
          <Text style={s.editText}>Edit</Text>
        </TouchableOpacity>
        {entry.canOpenMenu && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Open ${entry.name} in restaurant menu`}
            onPress={onOpen}
            style={s.viewDish}
          >
            <Text style={s.viewDishText}>View dish</Text>
            <Ionicons name="arrow-forward" color={colors.primary} size={14} />
          </TouchableOpacity>
        )}
      </View>
      {Boolean(error) && (
        <Text style={s.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
}
const s = appStyles({
  root: { flex: 1, backgroundColor: "#F5F8F2" },
  content: { padding: 16, paddingBottom: 28, flexGrow: 1 },
  contentWide: { paddingHorizontal: 28, paddingTop: 22 },
  hero: {
    backgroundColor: "#24533F",
    borderRadius: 27,
    padding: 23,
    overflow: "hidden",
  },
  heroOrb: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(217,240,120,0.07)",
    position: "absolute",
    right: -60,
    top: -90,
  },
  heroOrbSmall: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
    borderColor: "rgba(217,240,120,0.12)",
    right: 14,
    top: -30,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  brandChip: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: "#D5E4C4",
    flexShrink: 1,
  },
  heroAdd: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.13)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 46,
    lineHeight: 55,
    letterSpacing: -2,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 11,
  },
  heroSubtitle: {
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "600",
    color: "#F3F6E7",
    marginTop: 4,
  },
  heroDescription: {
    color: "#C1D3B9",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
  },
  heroBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 23,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    flexWrap: "wrap",
  },
  statNumber: { color: "#D9F078", fontSize: 19, fontWeight: "700" },
  statLabel: { fontSize: 11, fontWeight: "400", color: "#E3EDCF" },
  statDivider: { width: 1, height: 20, backgroundColor: "#51725A" },
  heroStamp: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(217,240,120,0.1)",
    justifyContent: "center",
    alignItems: "center",
    transform: [{ rotate: "-8deg" }],
  },
  introRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 26,
    marginBottom: 17,
  },
  sectionTitle: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: "#213C29",
  },
  caption: { fontSize: 11, lineHeight: 17, color: "#7A8970", marginTop: 4 },
  tabs: {
    flexDirection: "row",
    padding: 4,
    backgroundColor: "#E9EEE1",
    borderRadius: 16,
    gap: 3,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 3,
  },
  tabActive: {
    backgroundColor: colors.primary,
    boxShadow: "0px 3px 8px rgba(36,83,63,0.15)",
  },
  tabText: { color: "#647955", fontSize: 11, fontWeight: "700" },
  tabTextActive: { color: "#FFFFFF" },
  tabCount: { color: "#859375", fontSize: 10 },
  dateStrip: { gap: 8, paddingTop: 17, paddingBottom: 2 },
  datePill: {
    width: 63,
    minHeight: 87,
    padding: 9,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EBDC",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  datePillActive: { backgroundColor: "#E5F1BF", borderColor: "#B9CE8D" },
  dateWeekday: { color: "#7B8C68", fontSize: 9, fontWeight: "700" },
  dateNumber: { fontSize: 21, color: colors.primary, fontWeight: "800" },
  dateDay: { fontSize: 10, color: colors.primary, fontWeight: "600" },
  loading: { paddingVertical: 42, gap: 12, alignItems: "center" },
  groupHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 24,
    marginBottom: 13,
  },
  groupDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#94AA64",
  },
  groupTitle: { fontSize: 12, fontWeight: "700", color: "#6C805B" },
  groupLine: { height: 1, flex: 1, backgroundColor: "#E1E9D8" },
  cardRow: { flexDirection: "row", gap: 16, marginBottom: 15 },
  cardCell: { flex: 1, minWidth: 0 },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EBDA",
    borderRadius: 23,
    padding: 15,
    boxShadow: "0px 4px 18px rgba(43,65,32,0.035)",
  },
  dishRow: { flexDirection: "row", gap: 13, alignItems: "flex-start" },
  dishPhoto: {
    width: 94,
    height: 101,
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#F3F2E6",
  },
  photoBookmark: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 25,
    height: 25,
    backgroundColor: "#FFFFFF",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  dishInfo: { flex: 1, minWidth: 0, paddingTop: 3 },
  vegRow: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    marginBottom: 6,
  },
  diet: {
    color: "#82926B",
    fontSize: 8,
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  dishName: {
    color: "#243A28",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  restaurant: { color: "#7E8A74", fontSize: 11, lineHeight: 17, marginTop: 4 },
  price: { fontSize: 14, fontWeight: "700", color: "#486138", marginTop: 8 },
  priceCaption: { fontSize: 9, fontWeight: "400", color: "#8B947E" },
  remove: {
    width: 28,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -4,
    marginTop: -4,
  },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 11,
    borderRadius: 15,
    marginTop: 16,
    backgroundColor: "#F0F6E2",
  },
  planSomeday: { backgroundColor: "#F7F7ED" },
  planIcon: {
    height: 33,
    width: 33,
    borderRadius: 11,
    backgroundColor: "#E4EDCE",
    alignItems: "center",
    justifyContent: "center",
  },
  planEyebrow: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#8A9B70",
    marginBottom: 3,
  },
  planText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    color: "#4B6639",
  },
  note: { flexDirection: "row", gap: 8, paddingHorizontal: 4, marginTop: 14 },
  noteText: { flex: 1, color: "#798168", fontSize: 12, lineHeight: 19 },
  unavailable: {
    marginTop: 12,
    fontSize: 10,
    color: "#A37B42",
    lineHeight: 16,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "#EDF0E7",
    paddingTop: 13,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  savedLabel: {
    fontSize: 8,
    letterSpacing: 0.6,
    fontWeight: "700",
    color: "#99A38C",
  },
  savedTime: { fontSize: 10, color: "#8D987F", marginTop: 4 },
  edit: { minHeight: 36, paddingHorizontal: 10, justifyContent: "center" },
  editText: { color: "#6A8056", fontSize: 11, fontWeight: "600" },
  viewDish: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F5E7",
    borderRadius: 11,
    minHeight: 36,
    paddingHorizontal: 11,
  },
  viewDishText: { fontSize: 11, fontWeight: "700", color: colors.primary },
  empty: { alignItems: "center", paddingHorizontal: 21, paddingVertical: 42 },
  emptyIcon: {
    height: 82,
    width: 82,
    borderRadius: 28,
    backgroundColor: "#E8F0D6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    transform: [{ rotate: "-7deg" }],
  },
  emptyTitle: {
    textAlign: "center",
    fontSize: 22,
    lineHeight: 29,
    color: "#344D2B",
    fontWeight: "800",
    maxWidth: 350,
    letterSpacing: -0.4,
  },
  emptyCopy: {
    color: "#7A8B6C",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 12,
    maxWidth: 360,
  },
  emptyAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    minHeight: 48,
    borderRadius: 14,
    marginTop: 25,
  },
  emptyActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  listFooter: { paddingVertical: 8 },
  errorBox: { padding: 18, alignItems: "center", gap: 10 },
  error: { color: "#A34830", fontSize: 12, lineHeight: 19 },
  retry: { padding: 12, backgroundColor: "#E9F0D9", borderRadius: 12 },
  retryText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  more: {
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
    backgroundColor: "#EAF0DD",
    borderRadius: 14,
  },
  moreText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  end: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    marginVertical: 14,
  },
  endText: { color: "#8A9A78", fontSize: 10 },
});
