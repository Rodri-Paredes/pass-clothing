import React from 'react';
import { MapPin } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const BranchSelectionPage: React.FC = () => {
  const { user, branches, setActiveBranch } = useAuthStore();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);

  const availableBranches = user?.role === 'admin' 
    ? branches 
    : branches.filter(b => b.id === user?.branch_id);

  const handleBranchSelect = async (branch: any) => {
    setIsLoading(true);
    try {
      await setActiveBranch(branch);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error selecting branch:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Selecciona tu Sucursal
          </h1>
          <p className="text-gray-600">
            Elige la sucursal desde la cual trabajarás hoy
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {availableBranches.map((branch) => (
            <Card key={branch.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-center">
                <div className="bg-blue-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="font-semibold text-lg text-gray-900 mb-2">
                  {branch.name}
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  {branch.address}
                </p>
                <Button
                  onClick={() => handleBranchSelect(branch)}
                  isLoading={isLoading}
                  className="w-full"
                >
                  Seleccionar
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {availableBranches.length === 0 && (
          <Card className="text-center">
            <p className="text-gray-600">
              No tienes acceso a ninguna sucursal. Contacta al administrador.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BranchSelectionPage;