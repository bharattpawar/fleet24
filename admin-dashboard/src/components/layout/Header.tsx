import React from 'react';
import { useAdminAuth } from '@/features/auth/AdminAuthContext';
import { LogOut } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAdminAuth();

  return (
    <header className="h-16 bg-[#17211B] border-b border-[#24533F]/30 px-6 flex items-center justify-between shrink-0 select-none">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#F7F6F0]/60">
          Super Admin Console
        </span>
        <span className="text-xs text-[#24533F] font-bold">/</span>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#24533F]/40 border border-[#24533F] text-[#D9F078] text-[11px] font-medium font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D9F078]" />
          Production Guard Active
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Admin Identity Card */}
        <div className="flex items-center gap-3 pl-4 border-l border-[#24533F]/30">
          <div className="flex flex-col text-right">
            <span className="text-xs font-bold text-[#F7F6F0]">
              {user?.fullName || 'Super Administrator'}
            </span>
            <span className="text-[11px] font-mono text-[#F7F6F0]/50">
              {user?.phone || 'Root Staff'}
            </span>
          </div>

          <div className="w-9 h-9 rounded-full bg-[#24533F] border border-[#D9F078]/40 flex items-center justify-center text-xs font-bold text-[#D9F078] uppercase">
            {user?.fullName ? user.fullName.charAt(0) : 'A'}
          </div>

          <button
            onClick={logout}
            title="Sign out of Admin Console"
            className="p-2 ml-1 text-[#F7F6F0]/60 hover:text-[#E98755] hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
