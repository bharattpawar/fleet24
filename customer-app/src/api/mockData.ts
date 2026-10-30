import { OutletSummary } from '../components/RestaurantCard';
import { MenuItemData } from '../components/MenuItemCard';
import { CartData } from '../context/CartContext';
import { OrderItemSummary } from '../screens/OrdersScreen';
import { UserProfile } from '../context/AuthContext';

/**
 * Global Mock Data Toggle
 * Set to `true` for standalone visual review on physical device or emulator.
 * Set to `false` to connect to the live NestJS backend API.
 */
export const USE_MOCK_DATA = false;

// 1. Mock Outlets in Greater Noida
export const MOCK_OUTLETS: OutletSummary[] = [
  {
    id: 'outlet-1-punjabi-dhaba',
    restaurantName: 'Amritsari Kulcha & Chaap Hub',
    outletName: 'Knowledge Park III Main Branch',
    slug: 'amritsari-kulcha-kp3',
    logoUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=1000&auto=format&fit=crop&q=80', // Crispy Amritsari Kulcha & Dal
    address: 'Commercial Belt, Near Sharda University, Knowledge Park III',
    deliveryRadiusKm: '6.5',
    isAcceptingOrders: true,
  },
  {
    id: 'outlet-2-chowringhee-rolls',
    restaurantName: 'Chowringhee Kathi Junction',
    outletName: 'Pari Chowk Express',
    slug: 'chowringhee-pari-chowk',
    logoUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=1000&auto=format&fit=crop&q=80', // Kathi Rolls platter
    address: 'Metro Station Plaza, Near Alpha 1 Commercial Complex',
    deliveryRadiusKm: '8.0',
    isAcceptingOrders: true,
  },
  {
    id: 'outlet-3-noida-biryani',
    restaurantName: 'Awadh Dum Biryani & Kebabs',
    outletName: 'Jaghat Farm Outlet',
    slug: 'awadh-dum-biryani-jaghat',
    logoUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=1000&auto=format&fit=crop&q=80', // Royal Dum Biryani
    address: 'Shop 14, Jaghat Farm Market, Gamma 1',
    deliveryRadiusKm: '5.0',
    isAcceptingOrders: true,
  },
  {
    id: 'outlet-4-south-indian-cafe',
    restaurantName: 'Dakshin Tiffins & Filter Coffee',
    outletName: 'Galgotias Student Hub',
    slug: 'dakshin-tiffins-galgotias',
    logoUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=1000&auto=format&fit=crop&q=80', // Crisp Masala Dosa
    address: 'Food Street, Opposite Galgotias Campus, Knowledge Park II',
    deliveryRadiusKm: '4.5',
    isAcceptingOrders: false, // Closed showcase
  },
  {
    id: 'outlet-5-chai-nashta',
    restaurantName: 'Campus Chai & Bun Maska Co.',
    outletName: 'Gautam Buddha University Gate 2',
    slug: 'campus-chai-gbu',
    logoUrl: 'https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=1000&auto=format&fit=crop&q=80', // Chai and snacks
    address: 'GBU Main Boulevard, Sector Chi V',
    deliveryRadiusKm: '7.0',
    isAcceptingOrders: true,
  },
];

// 2. Mock Menus by Outlet ID
export const MOCK_MENUS: Record<string, MenuItemData[]> = {
  'outlet-1-punjabi-dhaba': [
    {
      id: 'menu-item-101',
      name: 'Amritsari Chur Chur Naan Thali',
      description: 'Layered butter naan stuffed with paneer and spiced potatoes, served with dal makhani, chole, raita & mint chutney.',
      basePrice: '210.00',
      effectivePrice: '190.00',
      isVeg: true,
      imageUrl: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600&auto=format&fit=crop&q=80', // Authentic Indian thali with naan & curries
      effectiveIsAvailable: true,
      categoryName: 'Thalis & Combos',
      isOverridden: true,
    },
    {
      id: 'menu-item-102',
      name: 'Tandoori Malai Soya Chaap',
      description: 'Tender soya chunks marinated in rich cashew paste, cardamom, fresh cream and cooked crisp in clay tandoor.',
      basePrice: '180.00',
      effectivePrice: '180.00',
      isVeg: true,
      imageUrl: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&auto=format&fit=crop&q=80', // Grilled tandoori veg tikka / chaap
      effectiveIsAvailable: true,
      categoryName: 'Starters',
      isOverridden: false,
    },
    {
      id: 'menu-item-103',
      name: 'Dal Makhani Slow Cooked',
      description: 'Slow-simmered black lentils finished with fresh white butter and rich cream overnight on coal.',
      basePrice: '160.00',
      effectivePrice: '150.00',
      isVeg: true,
      imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80', // Dal makhani with cream
      effectiveIsAvailable: true,
      categoryName: 'Main Course',
      isOverridden: false,
    },
    {
      id: 'menu-item-104',
      name: 'Paneer Butter Masala',
      description: 'Fresh cottage cheese cubes in velvety tomato satin gravy with crushed fenugreek leaves.',
      basePrice: '220.00',
      effectivePrice: '220.00',
      isVeg: true,
      imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&auto=format&fit=crop&q=80', // Rich paneer gravy
      effectiveIsAvailable: true,
      categoryName: 'Main Course',
      isOverridden: false,
    },
    {
      id: 'menu-item-105',
      name: 'Patiala Sweet Lassi (Clay Kulhad)',
      description: 'Thick chilled Punjabi sweet curd topped with a dollop of fresh malai and crushed pistachios.',
      basePrice: '80.00',
      effectivePrice: '70.00',
      isVeg: true,
      imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80', // Chilled yogurt lassi drink
      effectiveIsAvailable: true,
      categoryName: 'Beverages',
      isOverridden: false,
    },
    {
      id: 'menu-item-106',
      name: 'Tandoori Butter Roti (Whole Wheat)',
      description: 'Traditional crisp tandoori roti made from whole wheat flour and brushed with desi ghee.',
      basePrice: '20.00',
      effectivePrice: '20.00',
      isVeg: true,
      imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&auto=format&fit=crop&q=80', // Fresh Indian roti bread
      effectiveIsAvailable: true,
      categoryName: 'Breads',
      isOverridden: false,
    },
  ],
  'outlet-2-chowringhee-rolls': [
    {
      id: 'menu-item-201',
      name: 'Double Egg Double Chicken Roll',
      description: 'Flaky layered laccha paratha with double farm egg wrap, spicy roasted chicken chunks, sliced onions & tangy lime sauce.',
      basePrice: '170.00',
      effectivePrice: '160.00',
      isVeg: false,
      imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80', // Authentic Kathi roll wrap
      effectiveIsAvailable: true,
      categoryName: 'Kathi Rolls',
      isOverridden: true,
    },
    {
      id: 'menu-item-202',
      name: 'Paneer Tikka Roll',
      description: 'Char-grilled cottage cheese tossed in Kolkata spice blend, fresh coriander, green chillies & crisp onions.',
      basePrice: '130.00',
      effectivePrice: '130.00',
      isVeg: true,
      imageUrl: 'https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?w=600&auto=format&fit=crop&q=80', // Vegetarian roll wrap
      effectiveIsAvailable: true,
      categoryName: 'Kathi Rolls',
      isOverridden: false,
    },
    {
      id: 'menu-item-203',
      name: 'Crispy Soya Masala Roll',
      description: 'Spiced textured soya granules roasted with bell peppers, rolling inside golden crisp handmade paratha.',
      basePrice: '110.00',
      effectivePrice: '110.00',
      isVeg: true,
      imageUrl: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600&auto=format&fit=crop&q=80', // Spiced wrap
      effectiveIsAvailable: true,
      categoryName: 'Kathi Rolls',
      isOverridden: false,
    },
    {
      id: 'menu-item-204',
      name: 'Masala Fries with Peri Peri Dip',
      description: 'Golden potato fries seasoned with in-house chatpata masala and served hot.',
      basePrice: '90.00',
      effectivePrice: '85.00',
      isVeg: true,
      imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80', // Seasoned french fries
      effectiveIsAvailable: true,
      categoryName: 'Sides',
      isOverridden: false,
    },
  ],
  'outlet-3-noida-biryani': [
    {
      id: 'menu-item-301',
      name: 'Lucknowi Chicken Dum Biryani',
      description: 'Long grain fragrant basmati rice cooked on slow dum with marinated chicken cuts, served with creamy burani raita.',
      basePrice: '260.00',
      effectivePrice: '240.00',
      isVeg: false,
      imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80', // Authentic Dum Biryani
      effectiveIsAvailable: true,
      categoryName: 'Biryani',
      isOverridden: true,
    },
    {
      id: 'menu-item-302',
      name: 'Subz Shahi Paneer Biryani',
      description: 'Dum-cooked basmati rice layered with spiced paneer tikka, carrots, French beans and saffron milk.',
      basePrice: '210.00',
      effectivePrice: '200.00',
      isVeg: true,
      imageUrl: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=600&auto=format&fit=crop&q=80', // Veg biryani
      effectiveIsAvailable: true,
      categoryName: 'Biryani',
      isOverridden: false,
    },
    {
      id: 'menu-item-303',
      name: 'Galouti Kebab Melt (4 Pcs)',
      description: 'Melt-in-mouth smoked vegetarian yam & lentil patties infused with 16 royal spices and rose water.',
      basePrice: '160.00',
      effectivePrice: '160.00',
      isVeg: true,
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80', // Kebabs plate
      effectiveIsAvailable: true,
      categoryName: 'Kebabs',
      isOverridden: false,
    },
  ],
};

// Fallback menu for any outlet without explicit menu
export const DEFAULT_MOCK_MENU: MenuItemData[] = MOCK_MENUS['outlet-1-punjabi-dhaba'];

// 3. Mock Active Cart
export const MOCK_CART: CartData = {
  cartId: 'cart-mock-12345',
  outletId: 'outlet-1-punjabi-dhaba',
  restaurantName: 'Amritsari Kulcha & Chaap Hub',
  outletName: 'Knowledge Park III Main Branch',
  isOutletOperational: true,
  items: [
    {
      id: 'cart-item-1',
      menuItemId: 'menu-item-101',
      name: 'Amritsari Chur Chur Naan Thali',
      quantity: 2,
      unitPrice: 190.0,
      totalPrice: 380.0,
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'cart-item-2',
      menuItemId: 'menu-item-105',
      name: 'Patiala Sweet Lassi (Clay Kulhad)',
      quantity: 1,
      unitPrice: 70.0,
      totalPrice: 70.0,
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80',
    },
  ],
  itemCount: 3,
  itemTotal: 450.0,
  deliveryFee: 30.0,
  taxAmount: 22.5, // 5% GST
  discountAmount: 0.0,
  totalPayable: 502.5,
};

// 4. Mock Sample Orders
export const MOCK_ORDERS: OrderItemSummary[] = [
  {
    id: 'ord-mock-001',
    orderNumber: 'FLT-2026-8910',
    restaurantName: 'Awadh Dum Biryani & Kebabs',
    outletName: 'Jaghat Farm Outlet',
    status: 'preparing',
    totalPayable: '480.00',
    itemCount: 2,
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 mins ago
  },
  {
    id: 'ord-mock-002',
    orderNumber: 'FLT-2026-8845',
    restaurantName: 'Chowringhee Kathi Junction',
    outletName: 'Pari Chowk Express',
    status: 'delivered',
    totalPayable: '320.00',
    itemCount: 2,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
  },
  {
    id: 'ord-mock-003',
    orderNumber: 'FLT-2026-8702',
    restaurantName: 'Amritsari Kulcha & Chaap Hub',
    outletName: 'Knowledge Park III Main Branch',
    status: 'pending_payment',
    totalPayable: '502.50',
    itemCount: 3,
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(), // 4 mins ago
  },
  {
    id: 'ord-mock-004',
    orderNumber: 'FLT-2026-8490',
    restaurantName: 'Campus Chai & Bun Maska Co.',
    outletName: 'GBU Gate 2',
    status: 'cancelled',
    totalPayable: '140.00',
    itemCount: 1,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
  },
];

// 5. Mock User Profile & Addresses
export const MOCK_USER_PROFILE: UserProfile = {
  id: 'usr-mock-greater-noida',
  phone: '9876543210',
  fullName: 'Aarav Sharma',
  email: 'aarav.sharma@student.gbu.ac.in',
  roles: ['customer'],
};

export const MOCK_ADDRESSES = [
  {
    id: 'addr-mock-01',
    label: 'Hostel / Campus',
    addressLine1: 'Room 312, Boys Hostel 4',
    addressLine2: 'Sharda University Campus, Knowledge Park III',
    landmark: 'Opposite Academic Block 2',
    city: 'Greater Noida',
    postalCode: '201306',
    latitude: '28.4744000',
    longitude: '77.5040000',
    isDefault: true,
  },
  {
    id: 'addr-mock-02',
    label: 'Apartment',
    addressLine1: 'Flat 504, Tower Emerald',
    addressLine2: 'Purvanchal Royal City, Chi V',
    landmark: 'Near Noida-Greater Noida Expressway',
    city: 'Greater Noida',
    postalCode: '201310',
    latitude: '28.4520000',
    longitude: '77.5210000',
    isDefault: false,
  },
];
