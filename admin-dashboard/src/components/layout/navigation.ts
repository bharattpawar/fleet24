import {
  Settings, Users, CreditCard, RotateCcw, Bike, ClipboardList, LayoutDashboard, MapPin, Radio, Store, AlertTriangle,
  Map as MapIcon, TicketPercent, ReceiptText, BookOpen, Smartphone, Wallet,
} from 'lucide-react';

/** Daily operations first, then people and places, then money. Each page has a one-line purpose for the header. */
export const navGroups = [
  { label: 'Operations', items: [
    { path: '/overview', label: 'Overview', icon: LayoutDashboard, description: 'Orders, revenue and fleet at a glance' },
    { path: '/orders', label: 'Live Orders', icon: ReceiptText, description: 'Every active order and its current stage' },
    { path: '/dispatch', label: 'Dispatch Center', icon: Radio, description: 'Assign riders and watch deliveries move' },
    { path: '/service-areas', label: 'Service Areas', icon: MapIcon, description: 'Where Fleet24 delivers' },
  ] },
  { label: 'Directory', items: [
    { path: '/restaurants', label: 'Restaurants', icon: Store, description: 'Brands, applications, menus and approvals' },
    { path: '/outlets', label: 'Outlets', icon: MapPin, description: 'Kitchens, hours and delivery radius' },
    { path: '/riders', label: 'Delivery Fleet', icon: Bike, description: 'Riders, verification and availability' },
    { path: '/customers', label: 'Customers', icon: Users, description: 'Customer accounts and order history' },
    { path: '/customer-home', label: 'Home Screen', icon: Smartphone, description: 'Banners, tiles and photos in the customer app' },
  ] },
  { label: 'Finance', items: [
    { path: '/finance/payments', label: 'Payments', icon: CreditCard, description: 'Captured and pending customer payments' },
    { path: '/finance/conflicts', label: 'Payment Conflicts', icon: AlertTriangle, description: 'Payments that need a decision' },
    { path: '/finance/refunds', label: 'Refunds', icon: RotateCcw, description: 'Refund requests and their status' },
    { path: '/finance/settlements', label: 'Restaurant Settlements', icon: Wallet, description: 'What each restaurant is owed' },
    { path: '/finance/payouts', label: 'Rider Payouts', icon: ClipboardList, description: 'Rider earnings and payout requests' },
    { path: '/coupons', label: 'Coupons', icon: TicketPercent, description: 'Platform offers and their limits' },
    { path: '/finance/ledger', label: 'Ledger', icon: BookOpen, description: 'Every money movement, append-only' },
    { path: '/finance/settings', label: 'Financial Settings', icon: Settings, description: 'Fees, commissions and payout rules' },
  ] },
];

export const pageTitles: Record<string, string> = Object.fromEntries(navGroups.flatMap(({ items }) =>
  items.map(({ path, label }) => [path, label]),
));

export const pageDescriptions: Record<string, string> = Object.fromEntries(navGroups.flatMap(({ items }) =>
  items.map(({ path, description }) => [path, description]),
));

