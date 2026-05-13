import React from 'react';
import { LogOut, ChevronDown, Menu, Check } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { signOut, user, activeBranch, branches, setActiveBranch } = useAuthStore();
  const [showBranchSelector, setShowBranchSelector] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowBranchSelector(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    try { await signOut(); } catch {}
  };

  const handleBranchSelect = async (branch: any) => {
    try {
      await setActiveBranch(branch);
      setShowBranchSelector(false);
    } catch {}
  };

  const availableBranches = user?.role === 'admin'
    ? branches
    : branches.filter(b => b.id === user?.branch_id);

  return (
    <header className="bg-white/90 backdrop-blur-sm border-b border-surface-200 px-4 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-30 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-surface-500 hover:text-surface-800 hover:bg-surface-100 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Branch selector */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => availableBranches.length > 1 && setShowBranchSelector(v => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              availableBranches.length > 1
                ? 'text-surface-700 hover:bg-surface-100 cursor-pointer'
                : 'text-surface-700 cursor-default'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="max-w-[180px] truncate">
              {activeBranch?.name ?? 'Sin sucursal'}
            </span>
            {availableBranches.length > 1 && (
              <ChevronDown className={`h-3.5 w-3.5 text-surface-400 transition-transform ${
                showBranchSelector ? 'rotate-180' : ''
              }`} />
            )}
          </button>

          {showBranchSelector && (
            <div className="absolute top-full left-0 mt-1.5 bg-white border border-surface-200 rounded-xl shadow-lg z-50 min-w-[180px] py-1 animate-in">
              {availableBranches.map((branch) => (
                <button
                  key={branch.id}
                  onClick={() => handleBranchSelect(branch)}
                  className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-left text-surface-700 hover:bg-surface-50 transition-colors"
                >
                  {branch.id === activeBranch?.id && (
                    <Check className="h-3.5 w-3.5 text-brand-600 flex-shrink-0" />
                  )}
                  <span className={branch.id === activeBranch?.id ? 'ml-0' : 'ml-5'}>{branch.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right */}
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-surface-500 hover:text-surface-800 hover:bg-surface-100 rounded-lg transition-colors"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Salir</span>
      </button>
    </header>
  );
};

export default Header;