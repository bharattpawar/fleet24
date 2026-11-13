import React from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useAdminAuth } from './AdminAuthContext';

export const AdminAccessDeniedScreen: React.FC = () => {
  const { user, logout } = useAdminAuth();

  return (
    <div className="min-h-screen bg-charcoal flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-white/10 text-center space-y-5">
        <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl mx-auto flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-black text-charcoal">Access Denied</h2>
          <p className="text-xs text-muted-foreground">
            Administrative role required to enter the Fleet24 Super Admin Console.
          </p>
        </div>

        <div className="p-4 bg-muted/60 rounded-xl border border-border text-xs text-left space-y-1.5 font-mono">
          <p className="text-muted-foreground">Account: <span className="text-charcoal font-bold">{user?.phone || user?.fullName}</span></p>
          <p className="text-muted-foreground">Assigned Roles: <span className="text-red-700 font-bold">{user?.roles?.join(', ') || 'none'}</span></p>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Your credentials authenticated successfully, but this account does not possess the <strong>admin</strong> system role. Please sign in with an authorized administrator number.
        </p>

        <button
          onClick={logout}
          className="w-full py-2.5 bg-charcoal hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign Out & Return
        </button>
      </div>
    </div>
  );
};

