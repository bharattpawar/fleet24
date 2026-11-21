import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "./AuthContext";
import { DishSaveTarget, EatListEntry, eatListApi } from "../api/eatList";
import { EatListEditor } from "../components/eat-list/EatListEditor";
import { EatListContext as Context, keyOf } from "./EatListState";
import { appStyles } from "../theme/appStyles";

export function EatListProvider({
  children,
  onRequireAuth,
  onOpenList,
  authVisible,
}: {
  children: React.ReactNode;
  onRequireAuth: () => void;
  onOpenList: () => void;
  authVisible: boolean;
}) {
  const { user } = useAuth();
  const userId = user?.id;
  const currentUser = useRef(userId);
  const [revision, setRevision] = useState(0);
  const [membershipCache, setMembership] = useState<{ owner: string | undefined; entries: Record<string, string | null> }>({ owner: userId, entries: {} });
  const membership = membershipCache.owner === userId ? membershipCache.entries : {};
  const [editor, setEditor] = useState<{
    target: DishSaveTarget;
    entry?: EatListEntry;
    owner: string;
  } | null>(null);
  const pending = useRef<DishSaveTarget | null>(null);
  const queue = useRef(new Map<string, DishSaveTarget>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const [toast, setToast] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect -- Auth is an external session; discard cached data and resume a guest save only after authentication. */
  useEffect(() => {
    currentUser.current = userId;
    generation.current++;
    setMembership({ owner: userId, entries: {} });
    setEditor(previous => previous?.owner === userId ? previous : null);
    setToast(false);
  }, [userId]);
  useEffect(() => {
    if (userId && pending.current) {
      setEditor({ target: pending.current, owner: userId });
      pending.current = null;
    } else if (!authVisible && !userId) pending.current = null;
  }, [userId, authVisible]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(false), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const requestMembership = useCallback(
    (target: DishSaveTarget) => {
      if (!userId) return;
      queue.current.set(keyOf(target), target);
      if (timer.current) return;
      timer.current = setTimeout(async () => {
        timer.current = null;
        const batch = [...queue.current.values()];
        queue.current.clear();
        const owner = currentUser.current;
        if (!owner) return;
        const version = generation.current;
        const groups = new Map<string, string[]>();
        batch.forEach((t) =>
          groups.set(t.outletId, [
            ...(groups.get(t.outletId) || []),
            t.menuItemId,
          ]),
        );
        const result: Record<string, string | null> = {};
        await Promise.all(
          [...groups].map(async ([outletId, ids]) => {
            for (let i = 0; i < ids.length; i += 100) {
              const chunk = ids.slice(i, i + 100);
              try {
                const rows = await eatListApi.membership(outletId, chunk);
                chunk.forEach((id) => {
                  result[`${outletId}:${id}`] =
                    rows.find((r) => r.menuItemId === id)?.id ?? null;
                });
              } catch {
                /* The editor retries membership before allowing a write. */
              }
            }
          }),
        );
        if (currentUser.current === owner && generation.current === version)
          setMembership((previous) => ({ owner, entries: Object.fromEntries(Object.entries({ ...(previous.owner === owner ? previous.entries : {}), ...result }).slice(-1000)) }));
      }, 60);
    },
    [userId],
  );
  const changed = useCallback(() => {
    generation.current++;
    setRevision((v) => v + 1);
    setMembership({ owner: currentUser.current, entries: {} });
  }, []);
  const open = useCallback(
    (target: DishSaveTarget, entry?: EatListEntry) => {
      if (!userId) {
        pending.current = target;
        onRequireAuth();
        return;
      }
      setEditor({ target, entry, owner: userId });
    },
    [userId, onRequireAuth],
  );
  return (
    <Context.Provider
      value={{ revision, userId, membership, requestMembership, open, changed }}
    >
      {children}
      {editor && editor.owner === userId && (
        <EatListEditor
          key={`${editor.owner}:${keyOf(editor.target)}`}
          target={editor.target}
          initialEntry={editor.entry}
          onClose={() => setEditor(null)}
          onSaved={() => {
            if (currentUser.current !== editor.owner) return;
            changed();
            setEditor(null);
            setToast(true);
          }}
        />
      )}
      {toast && (
        <View style={s.toast} accessibilityLiveRegion="polite">
          <View style={{ flex: 1 }}>
            <Text style={s.toastTitle}>Saved to your Eat List</Text>
            <Text style={s.toastText}>
              A little plan for something delicious.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              setToast(false);
              onOpenList();
            }}
            style={s.toastAction}
          >
            <Text style={s.toastLink}>View list</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Dismiss saved message"
            onPress={() => setToast(false)}
            style={{ padding: 8 }}
          >
            <Ionicons name="close" color="#FFFFFF" size={19} />
          </TouchableOpacity>
        </View>
      )}
    </Context.Provider>
  );
}

const s = appStyles({
  toast: {
    position: "absolute",
    bottom: 84,
    alignSelf: "center",
    width: "94%",
    maxWidth: 520,
    backgroundColor: "#193B2C",
    padding: 14,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    boxShadow: "0px 8px 25px rgba(0,0,0,0.18)",
  },
  toastTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  toastText: { color: "#D8E7DB", fontSize: 10, marginTop: 3 },
  toastAction: { padding: 9, backgroundColor: "#D9F078", borderRadius: 10 },
  toastLink: { color: "#193B2C", fontSize: 12, fontWeight: "700" },
});
