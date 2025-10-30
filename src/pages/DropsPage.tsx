import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Package, Sparkles, TrendingUp, Calendar } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import * as DropComponents from '../components/drops/DropComponents';
import { dropsService } from '../services/dropsService';
import type { Drop, DropStats } from '../lib/types';

const DropsPage: React.FC = () => {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [filteredDrops, setFilteredDrops] = useState<Drop[]>([]);
  const [stats, setStats] = useState<DropStats>({
    total_drops: 0,
    active_drops: 0,
    featured_drops: 0,
    total_products_in_drops: 0,
    upcoming_drops: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Estados para modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDrop, setSelectedDrop] = useState<Drop | null>(null);
  
  // Estados para filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    featured: false,
    sortBy: 'launch_date'
  });

  const loadDrops = useCallback(async () => {
    try {
      setIsLoading(true);
      const [dropsData, statsData] = await Promise.all([
        dropsService.getAllDrops(),
        dropsService.getDropStats()
      ]);
      
      setDrops(dropsData);
      setFilteredDrops(dropsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading drops:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrops();
  }, []);

  // Aplicar filtros
  useEffect(() => {
    let filtered = [...drops];

    // Filtro por búsqueda
    if (searchQuery) {
      filtered = filtered.filter(drop =>
        drop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        drop.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filtro por estado
    if (filters.status) {
      filtered = filtered.filter(drop => drop.status === filters.status);
    }

    // Filtro por destacados
    if (filters.featured) {
      filtered = filtered.filter(drop => drop.is_featured);
    }

    // Ordenamiento
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'launch_date':
        default:
          return new Date(b.launch_date).getTime() - new Date(a.launch_date).getTime();
      }
    });

    setFilteredDrops(filtered);
  }, [drops, searchQuery, filters]);

  const handleCreateDrop = useCallback(async (dropData: Omit<Drop, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await dropsService.createDrop(dropData);
      setShowCreateModal(false);
      await loadDrops();
    } catch (error) {
      console.error('Error creating drop:', error);
      alert('Error al crear el drop. Por favor, intenta nuevamente.');
    }
  }, [loadDrops]);

  const handleEditDrop = useCallback(async (dropData: Omit<Drop, 'id' | 'created_at' | 'updated_at'>) => {
    if (!selectedDrop) return;
    
    try {
      await dropsService.updateDrop(selectedDrop.id, dropData);
      setShowEditModal(false);
      setSelectedDrop(null);
      await loadDrops();
    } catch (error) {
      console.error('Error updating drop:', error);
      alert('Error al actualizar el drop. Por favor, intenta nuevamente.');
    }
  }, [selectedDrop, loadDrops]);

  const handleDeleteDrop = useCallback(async () => {
    if (!selectedDrop) return;
    
    try {
      await dropsService.deleteDrop(selectedDrop.id);
      setShowDeleteModal(false);
      setSelectedDrop(null);
      await loadDrops();
    } catch (error) {
      console.error('Error deleting drop:', error);
      alert('Error al eliminar el drop. Por favor, intenta nuevamente.');
    }
  }, [selectedDrop, loadDrops]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleFilterChange = (newFilters: {
    status?: string;
    featured?: boolean;
    sortBy?: string;
  }) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header mejorado con gradiente */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Gestión de Drops</h1>
            </div>
            <p className="text-blue-100">Administra tus lanzamientos y colecciones exclusivas</p>
          </div>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Drop
          </Button>
        </div>
      </div>

      {/* Stats Cards mejoradas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-blue-700">Total Drops</p>
              <p className="text-3xl font-bold text-blue-900">{stats.total_drops}</p>
            </div>
            <Package className="h-10 w-10 text-blue-500 opacity-50" />
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-green-700">Activos</p>
              <p className="text-3xl font-bold text-green-900">{stats.active_drops}</p>
            </div>
            <TrendingUp className="h-10 w-10 text-green-500 opacity-50" />
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-yellow-700">Destacados</p>
              <p className="text-3xl font-bold text-yellow-900">{stats.featured_drops}</p>
            </div>
            <Sparkles className="h-10 w-10 text-yellow-500 opacity-50" />
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-purple-700">Próximos</p>
              <p className="text-3xl font-bold text-purple-900">{stats.upcoming_drops}</p>
            </div>
            <Calendar className="h-10 w-10 text-purple-500 opacity-50" />
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-pink-700">Productos</p>
              <p className="text-3xl font-bold text-pink-900">{stats.total_products_in_drops}</p>
            </div>
            <Package className="h-10 w-10 text-pink-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Filters mejorados */}
      <Card className="shadow-lg">
        <DropComponents.DropFilters
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
      </Card>

      {/* Drops Grid/List con animaciones */}
      {filteredDrops.length === 0 ? (
        <Card className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="max-w-md mx-auto">
            <div className="bg-blue-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <Package className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              {searchQuery || filters.status || filters.featured 
                ? 'No se encontraron drops' 
                : 'No hay drops creados'
              }
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || filters.status || filters.featured
                ? 'Intenta ajustar los filtros de búsqueda para ver más resultados'
                : 'Crea tu primer drop y comienza a gestionar lanzamientos exclusivos'
              }
            </p>
            {!searchQuery && !filters.status && !filters.featured && (
              <Button 
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Crear Primer Drop
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
        }>
          {filteredDrops.map((drop, index) => (
            <div 
              key={drop.id}
              className="animate-fadeIn"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <DropComponents.DropCard
                drop={drop}
                onEdit={(drop) => {
                  setSelectedDrop(drop);
                  setShowEditModal(true);
                }}
                onDelete={(drop) => {
                  setSelectedDrop(drop);
                  setShowDeleteModal(true);
                }}
                onView={(drop) => {
                  // TODO: Implementar vista de detalles del drop
                  console.log('View drop:', drop);
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modals mejorados */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="✨ Crear Nuevo Drop"
        size="lg"
      >
        <DropComponents.DropForm
          onSave={handleCreateDrop}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedDrop(null);
        }}
        title="✏️ Editar Drop"
        size="lg"
      >
        {selectedDrop && (
          <DropComponents.DropForm
            drop={selectedDrop}
            onSave={handleEditDrop}
            onCancel={() => {
              setShowEditModal(false);
              setSelectedDrop(null);
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedDrop(null);
        }}
        title="⚠️ Eliminar Drop"
        size="sm"
      >
        <div className="space-y-6 p-2">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-gray-800 font-medium mb-2">
              ¿Estás seguro de que quieres eliminar este drop?
            </p>
            <p className="text-sm text-gray-600 mb-3">
              Drop: <span className="font-semibold text-gray-900">"{selectedDrop?.name}"</span>
            </p>
            <p className="text-sm text-red-600 font-medium">
              ⚠️ Esta acción no se puede deshacer
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="danger"
              onClick={handleDeleteDrop}
              className="flex-1 font-semibold"
            >
              🗑️ Sí, Eliminar
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedDrop(null);
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DropsPage;
