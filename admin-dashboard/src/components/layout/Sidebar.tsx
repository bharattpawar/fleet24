import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Send,
  Store,
  MapPin,
  Bike,
  Users,
  CreditCard,
  RotateCcw,
  Landmark,
  Sliders,
  Activity,
  FileText,
  Settings,
  ShieldCheck,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Platform',
    items: [
      { name: 'Overview', href: '/overview', icon: LayoutDashboard },
      { name: 'Live Orders', href: '/orders', icon: ShoppingBag },
      { name: 'Dispatch Center', href: '/dispatch', icon: Send },
    ],
  },
  {
    title: 'Business Directory',
    items: [
      { name: 'Restaurants', href: '/restaurants', icon: Store },
      { name: 'Outlets', href: '/restaurants?tab=outlets', icon: MapPin },
      { name: 'Delivery Fleet', href: '/riders', icon: Bike },
      { name: 'Customers', href: '/customers', icon: Users, disabled: true, badge: 'Soon' },
    ],
  },
  {
    title: 'Finance & Ledger',
    items: [
      { name: 'Payment Transactions', href: '/finance/payments', icon: CreditCard, disabled: true, badge: 'Soon' },
      { name: 'Refund Audits', href: '/finance/refunds', icon: RotateCcw, disabled: true, badge: 'Soon' },
      { name: 'Settlements', href: '/finance/settlements', icon: Landmark, disabled: true, badge: 'Soon' },
      { name: 'Financial Settings', href: '/finance/settings', icon: Sliders, disabled: true, badge: 'Soon' },
    ],
  },
  {
    title: 'System & Governance',
    items: [
      { name: 'System Health', href: '/system/health', icon: Activity, disabled: true, badge: 'Soon' },
      { name: 'Audit Logs', href: '/system/audit', icon: FileText, disabled: true, badge: 'Soon' },
      { name: 'Access Control', href: '/system/access', icon: Settings, disabled: true, badge: 'Soon' },
    ],
  },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-[#17211B] border-r border-[#24533F]/30 flex flex-col h-screen select-none shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-[#24533F]/20">
        <div className="w-9 h-9 rounded-lg bg-[#24533F] border border-[#D9F078]/20 flex items-center justify-center text-[#D9F078] font-bold shadow-sm">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-extrabold text-sm tracking-wider text-[#F7F6F0] uppercase">
            Fleet24
          </span>
          <span className="text-[10px] tracking-widest text-[#D9F078] font-mono font-semibold">
            SUPER ADMIN
          </span>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#F7F6F0]/40">
              {section.title}
            </h3>
            <div className="space-y-0.5 pt-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                if (item.disabled) {
                  return (
                    <div
                      key={item.name}
                      className="group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[#F7F6F0]/30 cursor-not-allowed hover:bg-white/[0.02]"
                      title="Module under development"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-[#F7F6F0]/20" />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-[#F7F6F0]/40 border border-white/5 font-mono">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-[#24533F] text-[#D9F078] shadow-sm font-semibold'
                          : 'text-[#F7F6F0]/80 hover:bg-white/5 hover:text-[#F7F6F0]'
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer System Pill */}
      <div className="p-3 border-t border-[#24533F]/20">
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/20 text-[11px] text-[#F7F6F0]/60">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D9F078] animate-pulse" />
            <span className="font-mono text-[10px]">Staging Cluster</span>
          </div>
          <span className="text-[10px] font-mono text-[#F7F6F0]/40">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};

