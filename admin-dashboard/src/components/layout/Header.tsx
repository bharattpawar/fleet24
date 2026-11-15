import { useAdminAuth } from '@/features/auth/AdminAuthContext';
import { ChevronDown, LogOut, Menu } from 'lucide-react';

export function Header({ title, onOpenNavigation }: { title: string; onOpenNavigation: () => void }) {
  const { user, logout } = useAdminAuth();

  return (
    <header className="admin-topbar">
      <div className="flex items-center gap-3 min-w-0">
        <button className="admin-nav-toggle" type="button" onClick={onOpenNavigation} aria-label="Open navigation" aria-haspopup="dialog">
          <Menu size={21} />
        </button>
        <h1>{title}</h1>
      </div>
      <details className="admin-account" onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}>
        <summary aria-label="Account menu">
          <span className="admin-avatar">{user?.fullName?.charAt(0) || 'A'}</span>
          <ChevronDown size={14} />
        </summary>
        <div className="admin-account-panel">
          <strong>{user?.fullName || 'Super Administrator'}</strong>
          {user?.phone && <p>{user.phone}</p>}
          <button type="button" onClick={logout}><LogOut size={16} /> Sign out</button>
        </div>
      </details>
    </header>
  );
}
