import { createContext, useContext } from "react";
import type { DishSaveTarget, EatListEntry } from "../api/eatList";
export interface EatListContextValue {
  revision: number;
  userId?: string;
  membership: Record<string, string | null>;
  requestMembership: (target: DishSaveTarget) => void;
  open: (target: DishSaveTarget, entry?: EatListEntry) => void;
  changed: () => void;
}
export const EatListContext = createContext<EatListContextValue | null>(null);
export const useEatList = () => useContext(EatListContext);
export const keyOf = (target: DishSaveTarget) =>
  `${target.outletId}:${target.menuItemId}`;
