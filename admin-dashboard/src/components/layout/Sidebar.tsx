import { NavLink } from 'react-router-dom';
import { navGroups } from './navigation';


export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="admin-sidebar" aria-label="Dashboard">
      <NavLink to="/overview" className="admin-brand" onClick={onNavigate} aria-label="Fleet24 admin, go to overview">
        <span className="admin-brand-mark" aria-hidden="true">F</span>
        <span>
          <span className="admin-wordmark">Fleet24</span>
          <span className="admin-brand-sub">Admin console</span>
        </span>
      </NavLink>
      {navGroups.map(({ label, items }) => (
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
