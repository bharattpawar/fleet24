import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { Sidebar, pageTitles } from './Sidebar';
import { Header } from './Header';

export function DashboardLayout() {
  const { pathname } = useLocation();
  const drawer = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLElement>(null);

  useEffect(() => {
    drawer.current?.close();
    content.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="admin-shell">
      <aside className="admin-desktop-nav"><Sidebar /></aside>
      <dialog ref={drawer} className="admin-nav-drawer" aria-label="Navigation" onClick={(event) => {
        if (event.target === event.currentTarget) drawer.current?.close();
      }}>
        <button className="admin-drawer-close" type="button" onClick={() => drawer.current?.close()} aria-label="Close navigation">
          <X size={20} />
        </button>
        <Sidebar onNavigate={() => drawer.current?.close()} />
      </dialog>
      <div className="admin-workspace">
        <Header title={pageTitles[pathname] || 'Fleet24'} onOpenNavigation={() => drawer.current?.showModal()} />
        <main className="admin-content" ref={content}><Outlet /></main>
      </div>
    </div>
  );
}
