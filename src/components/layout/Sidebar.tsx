import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Users, 
  Settings,
  Store,
  X,
  Database
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface SidebarProps {
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { user, activeBranch } = useAuthStore();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Productos', href: '/products', icon: Package },
    { name: 'Ventas', href: '/sales', icon: ShoppingCart },
    { name: 'Cierre de Caja', href: '/cash-closure', icon: BarChart3 },
    { name: 'Reportes', href: '/reports', icon: BarChart3 },
    { name: 'Diagnóstico', href: '/diagnostic', icon: Database },
    ...(user?.role === 'admin' ? [
      { name: 'Usuarios', href: '/users', icon: Users },
      { name: 'Configuración', href: '/settings', icon: Settings }
    ] : [])
  ];

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Store className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">ERP Ropa</h1>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {activeBranch && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-900">Sucursal Activa</p>
            <p className="text-sm text-blue-700 truncate">{activeBranch.name}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-2 sm:px-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={handleNavClick}
            className={({ isActive }) =>
              `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`
            }
          >
            <item.icon className="h-5 w-5 mr-3 flex-shrink-0" />
            <span className="truncate">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-white">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.name}
            </p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;