import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, minTouchTarget, shadows } from '../theme/tokens';
import { useRestaurantAuth } from '../context/RestaurantAuthContext';
import { restaurantApi } from '../api/restaurantApi';
import { MenuCategory, MenuItem } from '../types';
import { KitchenHeader } from '../components/KitchenHeader';
import { discountedPrice, dishDiscountBadge, readDishDiscount, type DishDiscountType } from '../utils/dishDiscount';

export const RestaurantMenuScreen: React.FC<{ onNavigateToOutlets?: () => void }> = ({
  onNavigateToOutlets,
}) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const { activeOutlet, permissions } = useRestaurantAuth();

  // Data states
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<{ outletId: string; itemId: string; message: string } | null>(null);
  const [failedPhotos, setFailedPhotos] = useState<Record<string, string>>({});
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);

  // Add / Edit Modal states
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formIsVeg, setFormIsVeg] = useState(true);
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formIsAvailable, setFormIsAvailable] = useState(true);
  const [formDiscountOn, setFormDiscountOn] = useState(false);
  const [formDiscountType, setFormDiscountType] = useState<DishDiscountType>('percentage');
  const [formDiscountValue, setFormDiscountValue] = useState('');
  const [submittingItem, setSubmittingItem] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; price?: string; category?: string; discount?: string }>({});

  // Category Creation Modal states
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [submittingCategory, setSubmittingCategory] = useState(false);

  // 1. Fetch menu data for active outlet
  const fetchMenuData = useCallback(async (isSilent = false) => {
    if (!activeOutlet?.id) {
      setLoading(false);
      return;
    }
    if (!isSilent) setLoading(true);

    try {
      const [catList, itemList] = await Promise.all([
        restaurantApi.listCategories(activeOutlet.id),
        restaurantApi.listMenuItems(activeOutlet.id),
      ]);

      setCategories(catList || []);
      setItems(itemList || []);
    } catch (err: any) {
      console.warn('[Menu] Failed loading outlet menu:', err?.message);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  }, [activeOutlet?.id]);

  useEffect(() => {
    setItems([]);
    setCategories([]);
    setSelectedCategoryId('all');
    setSearchQuery('');
    fetchMenuData(false);
  }, [activeOutlet?.id, fetchMenuData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMenuData(true);
  };

  // 2. Toggle Stock Availability
  const handleToggleAvailability = async (item: MenuItem) => {
    if (!activeOutlet?.id) {
      Alert.alert('No Outlet Selected', 'Please select an outlet from the top bar before changing item stock availability.');
      return;
    }
    if (togglingItemId) return;
    const outletId = activeOutlet.id;
    setAvailabilityError(null);
    setTogglingItemId(item.id);

    const targetStatus = !(item.effectiveIsAvailable ?? item.isAvailable);

    try {
      await restaurantApi.setOutletOverride(activeOutlet.id, item.id, {
        isAvailable: targetStatus,
        customPrice: item.isOverridden && Number(item.effectivePrice) !== Number(item.basePrice)
          ? Number(item.effectivePrice)
          : undefined,
      });

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, isAvailable: targetStatus, effectiveIsAvailable: targetStatus }
            : it,
        ),
      );
    } catch (err: any) {
      setAvailabilityError({ outletId, itemId: item.id, message: err?.message || 'Could not update availability.' });
      fetchMenuData(true);
    } finally {
      setTogglingItemId(null);
    }
  };

  // 3. Open Modal for Adding / Editing
  const openAddItemModal = () => {
    if (!permissions.canManageMenu) {
      Alert.alert('Access Restricted', 'Only Restaurant Owners and Managers can add or edit catalog items.');
      return;
    }
    setEditingItem(null);
    setFormName('');
    setFormPrice('');
    setFormDesc('');
    setFormCategoryId(categories[0]?.id || '');
    setFormIsVeg(true);
    setFormImageUrl('');
    setFormIsAvailable(true);
    setFormDiscountOn(false);
    setFormDiscountType('percentage');
    setFormDiscountValue('');
    setFieldErrors({});
    setItemModalVisible(true);
  };

  const openEditItemModal = (item: MenuItem) => {
    if (!permissions.canManageMenu) {
      Alert.alert('Access Restricted', 'Only Restaurant Owners and Managers can edit catalog items.');
      return;
    }
    setEditingItem(item);
    setFormName(item.name);
    setFormPrice(item.effectivePrice?.toString() || item.basePrice?.toString() || item.price?.toString() || '');
    setFormDesc(item.description || '');
    setFormCategoryId(item.categoryId);
    setFormIsVeg(Boolean(item.isVeg));
    setFormImageUrl(item.imageUrl || '');
    setFormIsAvailable(Boolean(item.effectiveIsAvailable ?? item.isAvailable));
    setFormDiscountOn(Boolean(item.discountType));
    setFormDiscountType(item.discountType ?? 'percentage');
    setFormDiscountValue(item.discountValue != null ? String(Number(item.discountValue)) : '');
    setFieldErrors({});
    setItemModalVisible(true);
  };

  // 4. Save Menu Item
  const handleSaveMenuItem = async () => {
    if (!activeOutlet?.id) return;

    const errors: { name?: string; price?: string; category?: string; discount?: string } = {};
    if (!formName.trim()) {
      errors.name = 'Item name is required.';
    }
    const parsedPrice = parseFloat(formPrice.trim());
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      errors.price = 'Enter a valid positive price in ₹.';
    }
    if (!formCategoryId) {
      errors.category = 'Please select a category.';
    }
    const discount = readDishDiscount(
      { enabled: formDiscountOn, type: formDiscountType, value: formDiscountValue },
      isNaN(parsedPrice) ? 0 : parsedPrice,
    );
    if ('error' in discount) {
      errors.discount = discount.error;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmittingItem(true);
    try {
      if (editingItem) {
        await restaurantApi.updateMenuItem(editingItem.id, {
          name: formName.trim(),
          basePrice: parsedPrice,
          description: formDesc.trim() || undefined,
          categoryId: formCategoryId,
          isVeg: formIsVeg,
          imageUrl: formImageUrl.trim() || undefined,
          isAvailable: formIsAvailable,
          ...('payload' in discount ? discount.payload : {}),
        });
      } else {
        const created = await restaurantApi.createMenuItem(activeOutlet.id, {
          name: formName.trim(),
          basePrice: parsedPrice,
          description: formDesc.trim() || undefined,
          categoryId: formCategoryId,
          isVeg: formIsVeg,
          imageUrl: formImageUrl.trim() || undefined,
          isAvailable: formIsAvailable,
        });
        if ('payload' in discount && discount.payload.discountType) {
          await restaurantApi.updateMenuItem(created.id, discount.payload);
        }
      }

      setItemModalVisible(false);
      await fetchMenuData(true);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Could not save menu item. Check fields.');
    } finally {
      setSubmittingItem(false);
    }
  };

  // 5. Create Category
  const handleCreateCategory = async () => {
    if (!activeOutlet?.id || !newCatName.trim()) return;

    setSubmittingCategory(true);
    try {
      const created = await restaurantApi.createCategory(activeOutlet.id, newCatName.trim(), categories.length);
      setNewCatName('');
      setCategoryModalVisible(false);
      setCategories((prev) => [...prev, created]);
      setSelectedCategoryId(created.id);
    } catch (err: any) {
      Alert.alert('Category Creation Failed', err?.message || 'Failed to create category.');
    } finally {
      setSubmittingCategory(false);
    }
  };

  // 6. Filter & Search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        selectedCategoryId === 'all' || item.categoryId === selectedCategoryId;
      const matchesSearch =
        searchQuery.trim() === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategoryId, searchQuery]);

  return (
    <View style={styles.container}>
      <KitchenHeader onOutletPress={onNavigateToOutlets} />

      {/* Control Header */}
      <View style={styles.controlHeaderWrapper}>
        <View style={styles.controlHeader}>
          <View style={styles.titleCol}>
            <Text style={styles.screenTitle}>Menu</Text>
            <Text style={styles.statsSubtitle}>{items.length} {items.length === 1 ? 'dish' : 'dishes'}</Text>
          </View>

          {permissions.canManageMenu && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={openAddItemModal}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Add new dish"
            >
              <Ionicons name="add" size={18} color={colors.textWhite} />
              <Text style={styles.addButtonText}>Add Dish</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search dishes or ingredients..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills Bar */}
      <View style={styles.categoriesBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'all', name: 'All Dishes', displayOrder: -1, isActive: true, outletId: '' }, ...categories]}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.categoriesList}
          renderItem={({ item }) => {
            const isSelected = selectedCategoryId === item.id;
            return (
              <TouchableOpacity
                style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                onPress={() => setSelectedCategoryId(item.id)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            permissions.canManageMenu ? (
              <TouchableOpacity
                style={styles.addCategoryPill}
                onPress={() => setCategoryModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={14} color={colors.primary} />
                <Text style={styles.addCategoryText}>New Category</Text>
              </TouchableOpacity>
            ) : undefined
          }
        />
      </View>

      {/* Menu Item Cards List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching menu catalog...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="fast-food-outline" size={38} color={colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No Dishes Found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? `No dishes matching "${searchQuery}".`
              : 'Add your first food item or select another category.'}
          </Text>
          {permissions.canManageMenu && (
            <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddItemModal} activeOpacity={0.8}>
              <Ionicons name="add-circle" size={18} color={colors.textWhite} />
              <Text style={styles.emptyAddText}>Add First Dish</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          key={isWide ? 'grid-2' : 'list-1'}
          data={filteredItems}
          keyExtractor={(item) => item.id}
          numColumns={isWide ? 2 : 1}
          columnWrapperStyle={isWide ? styles.gridRow : undefined}
          contentContainerStyle={styles.itemsList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          renderItem={({ item }) => {
            const isAvailable = item.effectiveIsAvailable ?? item.isAvailable;
            const price = item.effectivePrice ?? item.basePrice ?? item.price ?? 0;
            const hasCustomOverride = item.isOverridden && item.basePrice != null && Number(item.effectivePrice) !== Number(item.basePrice);

            return (
              <View style={[isWide && styles.gridCol]}>
                <View style={[styles.itemCard, !isAvailable && styles.itemCardInactive]}>
                  <View style={styles.itemBodyRow}>
                    <View style={styles.thumbnailWrapper}>
                      {item.imageUrl && failedPhotos[item.id] !== item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.thumbnail}
                          onError={() => {
                            const uri = item.imageUrl;
                            if (uri) setFailedPhotos((previous) => ({ ...previous, [item.id]: uri }));
                          }}
                        />
                      ) : (
                        <View style={styles.placeholderThumbnail} accessibilityLabel="No dish photo">
                          <Ionicons name="restaurant-outline" size={24} color={colors.textSecondary} />
                        </View>
                      )}
                    </View>
                    <View style={styles.itemDescriptionCol}>
                      <View style={styles.itemHeaderRow}>
                        <View style={[styles.fssaiBox, item.isVeg ? styles.fssaiVeg : styles.fssaiNonVeg]}>
                          <View style={[styles.fssaiDot, item.isVeg ? styles.fssaiDotVeg : styles.fssaiDotNonVeg]} />
                        </View>
                        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                      </View>
                      {item.description && <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>}
                      <View style={styles.priceContainer}>
                        <Text style={styles.itemPrice}>₹{price}</Text>
                        {dishDiscountBadge(item.discountType, item.discountValue) && (
                          <Text style={styles.discountBadge}>
                            {dishDiscountBadge(item.discountType, item.discountValue)} · ₹{item.finalPrice ?? discountedPrice(Number(price), item.discountType!, Number(item.discountValue))}
                          </Text>
                        )}
                        {hasCustomOverride && (
                          <Text style={styles.overrideBadgeText}>Outlet · Base ₹{item.basePrice}</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={styles.itemFooterRow}>
                    {permissions.canManageMenu && (
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => openEditItemModal(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${item.name}`}
                      >
                        <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                        <Text style={styles.editLabel}>Edit</Text>
                      </TouchableOpacity>
                    )}
                    <View style={styles.stockStatusContainer}>
                      <Text style={[styles.stockLabel, isAvailable ? styles.stockLabelIn : styles.stockLabelOut]}>
                        {togglingItemId === item.id ? 'Updating…' : isAvailable ? 'Available' : 'Unavailable'}
                      </Text>
                      <Switch
                        accessibilityLabel={`Availability for ${item.name}`}
                        value={isAvailable}
                        onValueChange={() => handleToggleAvailability(item)}
                        disabled={!activeOutlet?.id || Boolean(togglingItemId) || !permissions.canToggleItemAvailability}
                        trackColor={{ false: colors.textMuted, true: colors.online }}
                        thumbColor={colors.textWhite}
                      />
                    </View>
                  </View>
                  {availabilityError?.itemId === item.id && availabilityError.outletId === activeOutlet?.id && (
                    <Text accessibilityRole="alert" style={styles.errorText}>{availabilityError.message}</Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Add / Edit Dish Modal */}
      <Modal visible={itemModalVisible} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalTopRow}>
              <View>
                <Text style={styles.modalSheetTitle}>
                  {editingItem ? 'Edit Dish' : 'Add New Dish'}
                </Text>
                <Text style={styles.modalSheetSub}>
                  {editingItem ? 'Update catalog details & pricing' : 'Create a new dish for your menu'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setItemModalVisible(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
              {/* Dish Name */}
              <Text style={styles.fieldLabel}>Dish Name *</Text>
              <TextInput
                style={[styles.input, fieldErrors.name && styles.inputError]}
                placeholder="e.g. Paneer Butter Masala"
                placeholderTextColor={colors.textMuted}
                value={formName}
                onChangeText={(t) => {
                  setFormName(t);
                  if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
                }}
              />
              {fieldErrors.name && <Text style={styles.errorText}>{fieldErrors.name}</Text>}

              {/* Price in INR */}
              <Text style={styles.fieldLabel}>Base Price (₹) *</Text>
              <TextInput
                style={[styles.input, fieldErrors.price && styles.inputError]}
                placeholder="e.g. 240.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={formPrice}
                onChangeText={(t) => {
                  setFormPrice(t);
                  if (fieldErrors.price) setFieldErrors((p) => ({ ...p, price: undefined }));
                }}
              />
              {fieldErrors.price && <Text style={styles.errorText}>{fieldErrors.price}</Text>}

              {/* Restaurant's own discount on this dish */}
              <View style={styles.modalSwitchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalSwitchTitle}>Discount on this dish</Text>
                  <Text style={styles.modalSwitchSub}>Customers see the old price struck out. Your restaurant gives this discount.</Text>
                </View>
                <Switch
                  accessibilityLabel="Discount on this dish"
                  value={formDiscountOn}
                  onValueChange={(on) => {
                    setFormDiscountOn(on);
                    if (fieldErrors.discount) setFieldErrors((p) => ({ ...p, discount: undefined }));
                  }}
                />
              </View>
              {formDiscountOn && (
                <>
                  <View style={styles.vegToggleRow}>
                    {(['percentage', 'fixed_amount'] as const).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.vegOptionBtn, formDiscountType === type && styles.vegOptionActive]}
                        onPress={() => setFormDiscountType(type)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: formDiscountType === type }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.vegOptionText, formDiscountType === type && styles.vegOptionTextActive]}>
                          {type === 'percentage' ? '% off' : 'Flat ₹ off'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={[styles.input, fieldErrors.discount && styles.inputError]}
                    accessibilityLabel={formDiscountType === 'percentage' ? 'Discount percent' : 'Discount in rupees'}
                    placeholder={formDiscountType === 'percentage' ? 'e.g. 20 (max 90)' : 'e.g. 30'}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    value={formDiscountValue}
                    onChangeText={(t) => {
                      setFormDiscountValue(t);
                      if (fieldErrors.discount) setFieldErrors((p) => ({ ...p, discount: undefined }));
                    }}
                  />
                  {fieldErrors.discount ? (
                    <Text style={styles.errorText}>{fieldErrors.discount}</Text>
                  ) : Number(formPrice) > 0 && Number(formDiscountValue) > 0 ? (
                    <Text style={styles.modalSwitchSub}>
                      Customer pays ₹{discountedPrice(Number(formPrice), formDiscountType, Number(formDiscountValue))} instead of ₹{Number(formPrice)}
                    </Text>
                  ) : null}
                </>
              )}

              {/* Category Picker */}
              <Text style={styles.fieldLabel}>Category *</Text>
              <View style={styles.catPickerRow}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catPickChip, formCategoryId === c.id && styles.catPickChipActive]}
                    onPress={() => {
                      setFormCategoryId(c.id);
                      if (fieldErrors.category) setFieldErrors((p) => ({ ...p, category: undefined }));
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.catPickChipText,
                        formCategoryId === c.id && styles.catPickChipTextActive,
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {fieldErrors.category && <Text style={styles.errorText}>{fieldErrors.category}</Text>}

              {/* Food Type (Veg / Non-Veg) */}
              <Text style={styles.fieldLabel}>Dietary Specification</Text>
              <View style={styles.vegToggleRow}>
                <TouchableOpacity
                  style={[styles.vegOptionBtn, formIsVeg && styles.vegOptionActive]}
                  onPress={() => setFormIsVeg(true)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.fssaiBox, styles.fssaiVeg]}>
                    <View style={[styles.fssaiDot, styles.fssaiDotVeg]} />
                  </View>
                  <Text style={[styles.vegOptionText, formIsVeg && styles.vegOptionTextActive]}>
                    Vegetarian
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.vegOptionBtn, !formIsVeg && styles.nonVegOptionActive]}
                  onPress={() => setFormIsVeg(false)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.fssaiBox, styles.fssaiNonVeg]}>
                    <View style={[styles.fssaiDot, styles.fssaiDotNonVeg]} />
                  </View>
                  <Text style={[styles.vegOptionText, !formIsVeg && styles.nonVegOptionTextActive]}>
                    Non-Vegetarian
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Image URL */}
              <Text style={styles.fieldLabel}>Photo URL (Public Link)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://images.unsplash.com/..."
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                value={formImageUrl}
                onChangeText={setFormImageUrl}
              />
              {formImageUrl.length > 5 && (
                <View style={styles.imagePreviewWrapper}>
                  <Image source={{ uri: formImageUrl }} style={styles.imagePreview} />
                </View>
              )}

              {/* Description */}
              <Text style={styles.fieldLabel}>Description / Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Portion size, spice level, or key ingredients"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={formDesc}
                onChangeText={setFormDesc}
              />

              {/* Availability Switch */}
              <View style={styles.modalSwitchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalSwitchTitle}>Available Immediately</Text>
                  <Text style={styles.modalSwitchSub}>Customers will be able to order this item</Text>
                </View>
                <Switch
                  value={formIsAvailable}
                  onValueChange={setFormIsAvailable}
                  trackColor={{ false: '#6B7280', true: colors.online }}
                  thumbColor={colors.textWhite}
                />
              </View>

              {/* Submit CTA */}
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSaveMenuItem}
                disabled={submittingItem}
                activeOpacity={0.8}
              >
                {submittingItem ? (
                  <ActivityIndicator size="small" color={colors.textWhite} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingItem ? 'Save Changes' : 'Create Dish'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Category Modal */}
      <Modal visible={categoryModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.smallModalCard}>
            <Text style={styles.smallModalTitle}>Add Menu Category</Text>
            <Text style={styles.smallModalSub}>e.g. Starters, Tandoor, Rice Bowls, Beverages</Text>

            <TextInput
              style={styles.input}
              placeholder="Category Name"
              placeholderTextColor={colors.textMuted}
              value={newCatName}
              onChangeText={setNewCatName}
              autoFocus
            />

            <View style={styles.smallModalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCategoryModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleCreateCategory}
                disabled={submittingCategory || !newCatName.trim()}
                activeOpacity={0.8}
              >
                {submittingCategory ? (
                  <ActivityIndicator size="small" color={colors.textWhite} />
                ) : (
                  <Text style={styles.confirmBtnText}>Add Category</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  controlHeaderWrapper: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  titleCol: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: colors.primary,
  },
  statsSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    minHeight: minTouchTarget,
    borderRadius: borderRadius.md,
    gap: 6,
    justifyContent: 'center',

  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textWhite,
  },
  searchBarWrapper: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    minHeight: minTouchTarget,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',

  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  categoriesBar: {
    paddingVertical: spacing.sm,
  },
  categoriesList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    maxWidth: 1200,
  },
  categoryPill: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: colors.textWhite,
  },
  addCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceGreen,
    borderWidth: 1,
    borderColor: 'rgba(36, 83, 63, 0.2)',
    minHeight: 44,
    justifyContent: 'center',
  },
  addCategoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  itemsList: {
    padding: spacing.md,
    paddingBottom: 120,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  gridRow: {
    gap: spacing.md,
  },
  gridCol: {
    flex: 1,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,

  },
  itemCardInactive: {
    opacity: 0.75,
    backgroundColor: '#FAFAF8',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  fssaiBox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fssaiVeg: {
    borderColor: colors.vegGreen,
  },
  fssaiNonVeg: {
    borderColor: colors.nonVegRed,
  },
  fssaiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  fssaiDotVeg: {
    backgroundColor: colors.vegGreen,
  },
  fssaiDotNonVeg: {
    backgroundColor: colors.nonVegRed,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  editBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editLabel: { fontSize: 13, fontWeight: '700', color: colors.primary },
  itemBodyRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  thumbnailWrapper: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDescriptionCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  itemDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  priceContainer: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  discountBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.vegGreen,
  },
  overrideBadgeText: {
    fontSize: 10,
    color: colors.pendingDark,
    fontWeight: '700',
  },
  itemFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  stockStatusContainer: {
    minHeight: 44,
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stockLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  stockLabelIn: {
    color: colors.online,
  },
  stockLabelOut: {
    color: colors.rejected,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: spacing.lg,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    minHeight: minTouchTarget,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
  },
  emptyAddText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textWhite,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 25, 21, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.modal,
  },
  modalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  modalSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSheetSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget,
    fontSize: 14,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.rejected,
  },
  textArea: {
    minHeight: 70,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 11,
    color: colors.rejected,
    marginTop: 2,
    fontWeight: '600',
  },
  catPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.xs,
  },
  catPickChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  catPickChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catPickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  catPickChipTextActive: {
    color: colors.textWhite,
    fontWeight: '700',
  },
  vegToggleRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  vegOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.surface,
    minHeight: minTouchTarget,
  },
  vegOptionActive: {
    borderColor: colors.vegGreen,
    backgroundColor: colors.vegGreenLight,
  },
  nonVegOptionActive: {
    borderColor: colors.nonVegRed,
    backgroundColor: colors.nonVegRedLight,
  },
  vegOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  vegOptionTextActive: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  nonVegOptionTextActive: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  imagePreviewWrapper: {
    marginTop: spacing.xs,
    width: 90,
    height: 70,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  modalSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceGreen,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.md,
  },
  modalSwitchTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  modalSwitchSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    minHeight: minTouchTarget,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,

  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textWhite,
  },
  smallModalCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.modal,
  },
  smallModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  smallModalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  smallModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelBtn: {
    paddingHorizontal: spacing.lg,
    minHeight: minTouchTarget,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  confirmBtn: {
    paddingHorizontal: spacing.xl,
    minHeight: minTouchTarget,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',

  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textWhite,
  },
});
