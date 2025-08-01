import React from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import Button from '../ui/Button';
import { useAuthStore } from '../../store/authStore';

const Header: React.FC = () => {
  const { signOut, user, activeBranch, branches, setActiveBranch } = useAuthStore();
  const [showBranchSelector, setShowBranchSelector] = React.useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleBranchSelect = async (branch: any) => {
    try {
      await setActiveBranch(branch);
      setShowBranchSelector(false);
    } catch (error) {
      console.error('Error switching branch:', error);
    }
  };

  const availableBranches = user?.role === 'admin' 
    ? branches 
    : branches.filter(b => b.id === user?.branch_id);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {activeBranch ? `${activeBranch.name}` : 'Seleccionar Sucursal'}
          </h2>
          
          {availableBranches.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowBranchSelector(!showBranchSelector)}
                className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <span>Cambiar</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              
              {showBranchSelector && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-40">
                  {availableBranches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => handleBranchSelect(branch)}
                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {branch.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleSignOut}
          className="flex items-center space-x-2"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar Sesión</span>
        </Button>
      </div>
    </header>
  );
};

export default Header;