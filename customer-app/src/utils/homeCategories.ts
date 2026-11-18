export const normalizeCategory = (name: string) => name.trim().toLowerCase();

export function cuisineCategories(outlets: Record<string, string[]>) {
  const categories = new Map<string, { id: string; name: string; count: number }>();
  for (const names of Object.values(outlets)) {
    const seen = new Set<string>();
    for (const name of names) {
      const key = normalizeCategory(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const category = categories.get(key);
      if (category) category.count++;
      else categories.set(key, { id: 'category:' + key, name: name.trim(), count: 1 });
    }
  }
  return [...categories.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
