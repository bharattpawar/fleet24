import { Settings, Users, CreditCard, RotateCcw, Bike, ClipboardList, LayoutDashboard, MapPin, Radio, Store, AlertTriangle, Map as MapIcon, TicketPercent } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const groups = [
  { label: 'Finance', items: [
    { path: '/finance/payments', label: 'Payments', icon: CreditCard },
    { path: '/finance/conflicts', label: 'Payment Conflicts', icon: AlertTriangle },
    { path: '/finance/settlements', label: 'Restaurant Settlements', icon: Store },
    { path: '/finance/payouts', label: 'Rider Payouts', icon: Bike },
    { path: '/finance/settings', label: 'Financial Settings', icon: Settings },
    { path: '/coupons', label: 'Coupons', icon: TicketPercent },
    { path: '/finance/ledger', label: 'Ledger', icon: ClipboardList },
    { path: '/finance/refunds', label: 'Refunds', icon: RotateCcw },
  ] },
  { label: 'Operations', items: [
    { path: '/overview', label: 'Overview', icon: LayoutDashboard },
    { path: '/orders', label: 'Live Orders', icon: ClipboardList },
    { path: '/dispatch', label: 'Dispatch Center', icon: Radio },
    { path: '/service-areas', label: 'Service Areas', icon: MapIcon },
  ] },
  { label: 'Directory', items: [
    { path: '/customers', label: 'Customers', icon: Users },
    { path: '/customer-home', label: 'Home Screen', icon: Store },
    { path: '/restaurants', label: 'Restaurants', icon: Store },
    { path: '/outlets', label: 'Outlets', icon: MapPin },
    { path: '/riders', label: 'Delivery Fleet', icon: Bike },
  ] },
];

export const pageTitles = Object.fromEntries(groups.flatMap(({ items }) =>
  items.map(({ path, label }) => [path, label]),
));

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="admin-sidebar" aria-label="Dashboard">
      <NavLink to="/overview" className="admin-wordmark" onClick={onNavigate}>Fleet24</NavLink>
      {groups.map(({ label, items }) => (
        <div className="admin-nav-group" key={label}>
          <p>{label}</p>
          {items.map(({ path, label: name, icon: Icon }) => (
            <NavLink key={path} to={path} end onClick={onNavigate}>
              <Icon size={17} aria-hidden="true" />
              {name}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
