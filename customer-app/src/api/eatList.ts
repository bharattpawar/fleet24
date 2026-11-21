import { apiRequest } from "./client";
import type { OutletSummary } from "../components/RestaurantCard";

export type EatListMode = "all" | "planned" | "someday";
export interface DishSaveTarget {
  outletId: string;
  menuItemId: string;
  name: string;
  restaurantName: string;
  imageUrl?: string | null;
}
export interface EatListPlan {
  note: string | null;
  plannedDate: string | null;
  plannedTime: string | null;
  timeZone: string | null;
}
export interface EatListEntry extends EatListPlan {
  id: string;
  outletId: string | null;
  menuItemId: string | null;
  name: string;
  restaurantName: string;
  outletName: string;
  imageUrl: string | null;
  isVeg: boolean;
  savedPrice: number;
  price: number;
  createdAt: string;
  updatedAt: string;
  isAvailable: boolean;
  canOpenMenu: boolean;
  outlet: OutletSummary | null;
}
export interface EatListPage {
  items: EatListEntry[];
  stats: Record<EatListMode, number>;
  nextCursor: string | null;
}
const root = "/customer/eat-list";
export const eatListApi = {
  list(
    mode: EatListMode,
    date?: string,
    cursor?: string | null,
    signal?: AbortSignal,
  ) {
    const q = new URLSearchParams({ mode, limit: "20" });
    if (date) q.set("date", date);
    if (cursor) q.set("cursor", cursor);
    return apiRequest<EatListPage>(`${root}?${q}`, { signal });
  },
  membership(outletId: string, itemIds: string[]) {
    return apiRequest<{ id: string; menuItemId: string }[]>(
      `${root}/membership?${new URLSearchParams({ outletId, itemIds: itemIds.join(",") })}`,
    );
  },
  get(id: string) {
    return apiRequest<EatListEntry>(`${root}/${id}`);
  },
  save(target: DishSaveTarget, plan: EatListPlan) {
    return apiRequest<EatListEntry>(root, {
      method: "POST",
      body: JSON.stringify({
        outletId: target.outletId,
        menuItemId: target.menuItemId,
        ...plan,
      }),
    });
  },
  update(id: string, plan: EatListPlan) {
    return apiRequest<EatListEntry>(`${root}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(plan),
    });
  },
  remove(id: string) {
    return apiRequest<{ removed: boolean }>(`${root}/${id}`, {
      method: "DELETE",
    });
  },
};
