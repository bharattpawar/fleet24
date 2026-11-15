import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantsApi } from '@/lib/api/restaurants';
import type { RestaurantOutlet, MenuItem } from '@/types/restaurants';
import { 
  UtensilsCrossed, 
  Plus, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Search
} from 'lucide-react';

interface MenuManagementTabProps {
  restaurantId?: string;
  outlets: RestaurantOutlet[];
}

export const MenuManagementTab: React.FC<MenuManagementTabProps> = ({
  outlets,
}) => {
  const queryClient = useQueryClient();
  const [selectedOutletId, setSelectedOutletId] = useState<string>(outlets[0]?.id || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Modals
  const [categoryModalOpen, setCategoryModalOpen] = useState<boolean>(false);
  const [categoryName, setCategoryName] = useState<string>('');
  const [categoryDisplayOrder, setCategoryDisplayOrder] = useState<number>(0);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const [itemModalOpen, setItemModalOpen] = useState<boolean>(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState<string>('');
  const [itemDescription, setItemDescription] = useState<string>('');
  const [itemPrice, setItemPrice] = useState<string>('');
  const [itemCategoryId, setItemCategoryId] = useState<string>('');
  const [itemIsVeg, setItemIsVeg] = useState<boolean>(true);
  const [itemImageUrl, setItemImageUrl] = useState<string>('');
  const [itemIsAvailable, setItemIsAvailable] = useState<boolean>(true);

  const [actionError, setActionError] = useState<string | null>(null);

  // Queries
  const { data: categories = [] } = useQuery({
    queryKey: ['admin', 'outlets', selectedOutletId, 'categories'],
    queryFn: () => restaurantsApi.listCategories(selectedOutletId),
    enabled: Boolean(selectedOutletId),
  });

  const { data: menuItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ['admin', 'outlets', selectedOutletId, 'menu-items'],
    queryFn: () => restaurantsApi.listMenuItems(selectedOutletId),
    enabled: Boolean(selectedOutletId),
  });

  // Mutations
  const createCategoryMutation = useMutation({
    mutationFn: () =>
      restaurantsApi.createCategory(selectedOutletId, {
        name: categoryName.trim(),
        displayOrder: categoryDisplayOrder,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'outlets', selectedOutletId, 'categories'] });
      setCategoryModalOpen(false);
      setCategoryName('');
      setCategoryDisplayOrder(0);
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to create category');
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: () =>
      restaurantsApi.updateCategory(editingCategoryId!, {
        name: categoryName.trim(),
        displayOrder: categoryDisplayOrder,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'outlets', selectedOutletId, 'categories'] });
      setCategoryModalOpen(false);
      setEditingCategoryId(null);
      setCategoryName('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to update category');
    },
  });

  const createItemMutation = useMutation({
    mutationFn: () =>
      restaurantsApi.createMenuItem(selectedOutletId, {
        categoryId: itemCategoryId,
        name: itemName.trim(),
        description: itemDescription.trim() || undefined,
        basePrice: parseFloat(itemPrice),
        isVeg: itemIsVeg,
        imageUrl: itemImageUrl.trim() || undefined,
        isAvailable: itemIsAvailable,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'outlets', selectedOutletId, 'menu-items'] });
      setItemModalOpen(false);
      resetItemForm();
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to add menu item');
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: () =>
      restaurantsApi.updateMenuItem(editingItemId!, {
        categoryId: itemCategoryId || undefined,
        name: itemName.trim() || undefined,
        description: itemDescription.trim() || undefined,
        basePrice: itemPrice ? parseFloat(itemPrice) : undefined,
        isVeg: itemIsVeg,
        imageUrl: itemImageUrl.trim() || undefined,
        isAvailable: itemIsAvailable,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'outlets', selectedOutletId, 'menu-items'] });
      setItemModalOpen(false);
      resetItemForm();
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to update menu item');
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: ({ itemId, currentAvailable }: { itemId: string; currentAvailable: boolean }) =>
      restaurantsApi.updateMenuItemAvailability(itemId, !currentAvailable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'outlets', selectedOutletId, 'menu-items'] });
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to update item availability');
    },
  });

  const resetItemForm = () => {
    setEditingItemId(null);
    setItemName('');
    setItemDescription('');
    setItemPrice('');
    setItemCategoryId('');
    setItemIsVeg(true);
    setItemImageUrl('');
    setItemIsAvailable(true);
  };

  const openEditItemModal = (item: MenuItem) => {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemDescription(item.description || '');
    setItemPrice(String(item.basePrice));
    setItemCategoryId(item.categoryId);
    setItemIsVeg(item.isVeg);
    setItemImageUrl(item.imageUrl || '');
    setItemIsAvailable(item.isAvailable);
    setItemModalOpen(true);
  };

  if (outlets.length === 0) {
    return (
      <div className="p-8 text-center bg-[#F5F6F8] rounded-2xl border border-dashed border-[#E3E7EC] space-y-2">
        <UtensilsCrossed className="w-8 h-8 text-[#205641]/40 mx-auto" />
        <h3 className="text-sm font-bold text-[#171A21]">No Outlets Configured</h3>
        <p className="text-xs text-slate-600 max-w-sm mx-auto">
          Add an outlet for this restaurant first before configuring menu categories and items.
        </p>
      </div>
    );
  }

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategoryId === 'all' || item.categoryId === selectedCategoryId;
    const matchesSearch =
      !searchTerm.trim() ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Outlet Selector & Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC]">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-600 shrink-0">Active Outlet:</label>
          <select
            value={selectedOutletId}
            onChange={(e) => {
              setSelectedOutletId(e.target.value);
              setSelectedCategoryId('all');
            }}
            className="text-xs bg-[#FFFFFF] border border-[#205641] text-[#171A21] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#205641]"
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.address})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingCategoryId(null);
              setCategoryName('');
              setCategoryDisplayOrder(categories.length);
              setCategoryModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E8F2ED] text-[#205641] border border-[#205641] text-xs font-semibold hover:bg-[#205641] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Category</span>
          </button>

          <button
            onClick={() => {
              resetItemForm();
              if (categories.length > 0) {
                setItemCategoryId(categories[0].id);
              }
              setItemModalOpen(true);
            }}
            disabled={categories.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#205641] text-white text-xs font-bold hover:bg-[#205641]/80 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Food Item</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-[#9A431F]/15 border border-[#9A431F]/30 flex items-center gap-2 text-xs text-[#9A431F]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Category Tabs & Filter */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedCategoryId('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                selectedCategoryId === 'all'
                  ? 'bg-[#205641] text-white font-bold border border-[#205641]/30 shadow-xs'
                  : 'bg-[#FFFFFF] text-slate-600 hover:text-[#171A21] border border-[#E3E7EC]'
              }`}
            >
              All Items ({menuItems.length})
            </button>
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setSelectedCategoryId(c.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    selectedCategoryId === c.id
                      ? 'bg-[#205641] text-white font-bold border border-[#205641]/30 shadow-xs'
                      : 'bg-[#FFFFFF] text-slate-600 hover:text-[#171A21] border border-[#E3E7EC]'
                  }`}
                >
                  {c.name}
                </button>
                <button
                  onClick={() => {
                    setEditingCategoryId(c.id);
                    setCategoryName(c.name);
                    setCategoryDisplayOrder(c.displayOrder);
                    setCategoryModalOpen(true);
                  }}
                  className="p-1 text-slate-600 hover:text-[#205641] cursor-pointer"
                  title="Edit category"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="relative w-48 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              placeholder="Search dishes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 rounded-lg bg-[#FFFFFF] border border-[#E3E7EC] text-xs text-[#171A21] placeholder-slate-600 focus:outline-none focus:border-[#205641]"
            />
          </div>
        </div>
      </div>

      {/* Menu Item Cards */}
      {isLoadingItems ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-8 text-center bg-[#FFFFFF] rounded-xl border border-dashed border-[#E3E7EC] space-y-2">
          <UtensilsCrossed className="w-6 h-6 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-600 font-semibold">No food items found.</p>
          <p className="text-[11px] text-slate-600">
            {categories.length === 0
              ? 'Create a category first to start adding dishes to the menu.'
              : 'Add dishes using the "Add Food Item" button above.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-2.5 ${
                item.isAvailable
                  ? 'bg-[#FFFFFF] border-[#E3E7EC] hover:border-[#205641]'
                  : 'bg-[#F5F6F8] border-[#E3E7EC] opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-xs border flex items-center justify-center shrink-0 ${
                        item.isVeg ? 'border-emerald-500' : 'border-rose-500'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.isVeg ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                    </span>
                    <span className="font-bold text-xs text-[#171A21] truncate">{item.name}</span>
                  </div>
                  {item.description && (
                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="tabular-nums text-xs font-bold text-[#205641] shrink-0">
                  ₹{typeof item.basePrice === 'number' ? item.basePrice.toFixed(2) : item.basePrice}
                </div>
              </div>

              <div className="pt-2 border-t border-[#E3E7EC] flex items-center justify-between text-[11px]">
                <button
                  onClick={() =>
                    toggleAvailabilityMutation.mutate({
                      itemId: item.id,
                      currentAvailable: item.isAvailable,
                    })
                  }
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold cursor-pointer transition-colors ${
                    item.isAvailable
                      ? 'bg-[#205641] text-white hover:bg-[#205641]/70'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
                  }`}
                >
                  {item.isAvailable ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Available
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" /> Out of Stock
                    </>
                  )}
                </button>

                <button
                  onClick={() => openEditItemModal(item)}
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-[#205641] transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Category Create/Edit */}
      {categoryModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-60">
          <div className="bg-[#FFFFFF] border border-[#205641] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-[#171A21]">
              {editingCategoryId ? 'Edit Menu Category' : 'Create Menu Category'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Category Name
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Starters, Main Course, Biryani"
                  className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Display Order
                </label>
                <input
                  type="number"
                  value={categoryDisplayOrder}
                  onChange={(e) => setCategoryDisplayOrder(parseInt(e.target.value) || 0)}
                  className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-[#171A21] cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!categoryName.trim() || createCategoryMutation.isPending || updateCategoryMutation.isPending}
                onClick={() => {
                  if (editingCategoryId) {
                    updateCategoryMutation.mutate();
                  } else {
                    createCategoryMutation.mutate();
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-[#205641] text-white text-xs font-bold hover:bg-[#205641]/80 disabled:opacity-50 cursor-pointer"
              >
                {editingCategoryId ? 'Save Changes' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Item Create/Edit */}
      {itemModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-60">
          <div className="bg-[#FFFFFF] border border-[#205641] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-[#171A21]">
              {editingItemId ? 'Edit Food Item' : 'Add Food Item to Menu'}
            </h3>
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Paneer Butter Masala"
                  className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                    Category *
                  </label>
                  <select
                    value={itemCategoryId}
                    onChange={(e) => setItemCategoryId(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                    Base Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="250.00"
                    className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641] tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Dish ingredients, portion size, spice level..."
                  className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Image URL
                </label>
                <input
                  type="url"
                  value={itemImageUrl}
                  onChange={(e) => setItemImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-xs text-[#171A21] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemIsVeg}
                    onChange={(e) => setItemIsVeg(e.target.checked)}
                    className="rounded text-[#205641] focus:ring-[#205641]"
                  />
                  <span>Vegetarian (Green mark)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-[#171A21] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemIsAvailable}
                    onChange={(e) => setItemIsAvailable(e.target.checked)}
                    className="rounded text-[#205641] focus:ring-[#205641]"
                  />
                  <span>Available in Kitchen</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setItemModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-[#171A21] cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={
                  !itemName.trim() ||
                  !itemPrice ||
                  !itemCategoryId ||
                  createItemMutation.isPending ||
                  updateItemMutation.isPending
                }
                onClick={() => {
                  if (editingItemId) {
                    updateItemMutation.mutate();
                  } else {
                    createItemMutation.mutate();
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-[#205641] text-white text-xs font-bold hover:bg-[#205641]/80 disabled:opacity-50 cursor-pointer"
              >
                {editingItemId ? 'Update Dish' : 'Add Dish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
