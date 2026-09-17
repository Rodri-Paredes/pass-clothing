import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Users, 
  Settings,
  X,
  Star,
  Percent,
  Activity,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface SidebarProps {
  onClose?: () => void;
}

const NAV_MAIN = [
  { name: 'Dashboard',      href: '/dashboard',    icon: LayoutDashboard, adminOnly: false },
  { name: 'Ventas',         href: '/sales',        icon: ShoppingCart,    adminOnly: false },
  { name: 'Clientes',       href: '/customers',    icon: Users,           adminOnly: true  },
  { name: 'Estadísticas',   href: '/sales-statistics', icon: BarChart3,    adminOnly: true  },
  { name: 'Productos',      href: '/products',     icon: Package,         adminOnly: false },
  { name: 'Drops',          href: '/drops',        icon: Star,            adminOnly: true  },
  { name: 'Descuentos',     href: '/discounts',    icon: Percent,         adminOnly: true  },
  { name: 'Cierre de Caja', href: '/cash-closure', icon: BarChart3,       adminOnly: false },
];

const NAV_ADMIN = [
  { name: 'Usuarios',       href: '/users',    icon: Users },
  { name: 'Configuración',  href: '/settings', icon: Settings },
  { name: 'Diagnóstico',    href: '/health',   icon: Activity },
];

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { user, activeBranch } = useAuthStore();

  const handleNavClick = () => { if (onClose) onClose(); };

  const NavItem = ({ item }: { item: typeof NAV_MAIN[0] }) => (
    <NavLink
      to={item.href}
      onClick={handleNavClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group ${
          isActive
            ? 'bg-brand-500/15 text-brand-300'
            : 'text-slate-400 hover:bg-white/6 hover:text-slate-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={`h-4 w-4 flex-shrink-0 transition-colors ${
              isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'
            }`}
          />
          <span className="truncate flex-1">{item.name}</span>
          {isActive && <ChevronRight className="h-3 w-3 text-brand-400 opacity-60" />}
        </>
      )}
    </NavLink>
  );

  return (
    <div
      className="w-60 flex flex-col h-full sidebar-scroll overflow-y-auto"
      style={{ background: 'var(--sidebar-bg)' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-brand flex items-center justify-center shadow-glow flex-shrink-0">
            <ShoppingCart className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-wide">PASS</span>
            <span className="ml-1.5 text-xs text-slate-500 font-normal hidden xl:inline">ERP</span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Branch badge */}
      {activeBranch && (
        <div className="mx-3 mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/8">
          <MapPin className="h-3.5 w-3.5 text-brand-400 flex-shrink-0" />
          <span className="text-xs text-slate-300 truncate font-medium">{activeBranch.name}</span>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        <p className="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-widest text-slate-600">Principal</p>
        {NAV_MAIN.filter((item) => !item.adminOnly || user?.role === 'admin').map((item) => (
          <NavItem key={item.href} item={item} />
        ))}

        {user?.role === 'admin' && (
          <>
            <div className="my-3 border-t border-white/6" />
            <p className="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-widest text-slate-600">Administración</p>
            {NAV_ADMIN.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="p-3 mt-2">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 border border-white/8">
          <div className="h-7 w-7 rounded-full bg-gradient-brand flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-white">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
            <p className="text-2xs text-slate-500 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
