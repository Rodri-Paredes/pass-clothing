import React, { useState } from 'react';
import { 
  Calendar, 
  Star, 
  Package, 
  Edit, 
  Trash2, 
  Eye,
  Search,
  Grid,
  List,
  Upload,
  X,
  Image as ImageIcon
} from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Input from '../ui/Input';
import { supabase } from '../../lib/supabase';
import type { Drop, DropStats } from '../../lib/types';
import { useToastStore } from '../../store/toastStore';

interface DropCardProps {
  drop: Drop;
  onEdit?: (drop: Drop) => void;
  onDelete?: (drop: Drop) => void;
  onView?: (drop: Drop) => void;
  showActions?: boolean;
}

export const DropCard: React.FC<DropCardProps> = ({
  drop,
  onEdit,
  onDelete,
  onView,
  showActions = true
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVO': return 'bg-green-100 text-green-800';
      case 'INACTIVO': return 'bg-yellow-100 text-yellow-800';
      case 'FINALIZADO': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-200">
      <div className="relative">
        {drop.is_featured && (
          <div className="absolute top-2 right-2 z-10">
            <div className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
              <Star className="h-3 w-3 fill-current" />
              Destacado
            </div>
          </div>
        )}
        
        {drop.image_url && (
          <div className="aspect-video bg-gray-100 rounded-lg mb-4 overflow-hidden">
            <img 
              src={drop.image_url} 
              alt={drop.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {drop.name}
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2">
              {drop.description}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(drop.status)}`}>
              {drop.status}
            </span>
            {drop.product_count && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Package className="h-3 w-3" />
                {drop.product_count} productos
              </span>
            )}
          </div>
          
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Lanzamiento: {formatDate(drop.launch_date)}</span>
            </div>
            {drop.end_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Finaliza: {formatDate(drop.end_date)}</span>
              </div>
            )}
          </div>
          
          {showActions && (
            <div className="flex gap-2 pt-2">
              {onView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onView(drop)}
                  className="flex-1"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(drop)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(drop)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

interface DropFormProps {
  drop?: Drop;
  onSave: (drop: Omit<Drop, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const DropForm: React.FC<DropFormProps> = ({
  drop,
  onSave,
  onCancel,
  isLoading = false
}) => {
  const [formData, setFormData] = useState({
    name: drop?.name || '',
    description: drop?.description || '',
    launch_date: drop?.launch_date ? drop.launch_date.split('T')[0] : '',
    end_date: drop?.end_date ? drop.end_date.split('T')[0] : '',
    status: drop?.status || 'ACTIVO',
    is_featured: drop?.is_featured || false,
    image_url: drop?.image_url || '',
    banner_url: drop?.banner_url || ''
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(drop?.image_url || '');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string>(drop?.banner_url || '');
  const [uploading, setUploading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'banner') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'image') {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
      } else {
        setBannerFile(file);
        setBannerPreview(URL.createObjectURL(file));
      }
    }
  };

  const uploadImageToSupabase = async (file: File, type: 'image' | 'banner'): Promise<string> => {
    const fileName = `${Date.now()}-${file.name}`;
    const bucket = type === 'image' ? 'drops' : 'drops-banners';
    
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setUploading(true);
      
      let imageUrl = formData.image_url;
      let bannerUrl = formData.banner_url;
      
      // Subir imagen si hay una nueva
      if (imageFile) {
        imageUrl = await uploadImageToSupabase(imageFile, 'image');
      }
      
      // Subir banner si hay uno nuevo
      if (bannerFile) {
        bannerUrl = await uploadImageToSupabase(bannerFile, 'banner');
      }
      
      const dropData = {
        ...formData,
        image_url: imageUrl,
        banner_url: bannerUrl,
        launch_date: new Date(formData.launch_date).toISOString(),
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : undefined
      };
      
      onSave(dropData);
    } catch (error) {
      console.error('Error uploading images:', error);
      useToastStore.getState().addToast('Error al subir las imágenes. Por favor, intenta nuevamente.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-2">
      {/* Imagen Principal */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Imagen Principal del Drop
        </label>
        <div className="flex items-start gap-4">
          {imagePreview ? (
            <div className="relative group">
              <img 
                src={imagePreview} 
                alt="Preview" 
                className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
              />
              <button
                type="button"
                onClick={() => {
                  setImagePreview('');
                  setImageFile(null);
                  setFormData({ ...formData, image_url: '' });
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
              <ImageIcon className="h-10 w-10 text-gray-400 mb-1" />
              <p className="text-xs text-gray-500">Sin imagen</p>
            </div>
          )}
          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageChange(e, 'image')}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className="inline-flex items-center gap-2 cursor-pointer bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-lg text-sm font-medium text-blue-700 transition-colors border border-blue-200"
            >
              <Upload className="h-4 w-4" />
              Seleccionar Imagen
            </label>
            <p className="text-xs text-gray-500 mt-2">
              Formatos: JPG, PNG, WEBP. Tamaño recomendado: 800x600px
            </p>
          </div>
        </div>
      </div>

      {/* Banner */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Banner del Drop (Opcional)
        </label>
        <div className="flex items-start gap-4">
          {bannerPreview ? (
            <div className="relative group">
              <img 
                src={bannerPreview} 
                alt="Banner Preview" 
                className="w-48 h-24 object-cover rounded-lg border-2 border-gray-200"
              />
              <button
                type="button"
                onClick={() => {
                  setBannerPreview('');
                  setBannerFile(null);
                  setFormData({ ...formData, banner_url: '' });
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="w-48 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
              <ImageIcon className="h-8 w-8 text-gray-400 mb-1" />
              <p className="text-xs text-gray-500">Sin banner</p>
            </div>
          )}
          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageChange(e, 'banner')}
              className="hidden"
              id="banner-upload"
            />
            <label
              htmlFor="banner-upload"
              className="inline-flex items-center gap-2 cursor-pointer bg-purple-50 hover:bg-purple-100 px-4 py-2.5 rounded-lg text-sm font-medium text-purple-700 transition-colors border border-purple-200"
            >
              <Upload className="h-4 w-4" />
              Seleccionar Banner
            </label>
            <p className="text-xs text-gray-500 mt-2">
              Formato panorámico. Tamaño recomendado: 1200x400px
            </p>
          </div>
        </div>
      </div>

      {/* Resto del formulario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del Drop *
          </label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: Colección Verano 2024"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estado
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
            <option value="FINALIZADO">Finalizado</option>
          </select>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe el drop o colección..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha de Lanzamiento *
          </label>
          <Input
            type="date"
            value={formData.launch_date}
            onChange={(e) => setFormData({ ...formData, launch_date: e.target.value })}
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha de Finalización
          </label>
          <Input
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
          />
        </div>
      </div>
      
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <input
          type="checkbox"
          id="is_featured"
          checked={formData.is_featured}
          onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="is_featured" className="flex items-center gap-2 text-sm font-medium text-blue-900 cursor-pointer">
          <Star className="h-4 w-4 text-yellow-500" />
          Destacar este drop en la página principal
        </label>
      </div>
      
      <div className="flex gap-3 pt-4 border-t">
        <Button
          type="submit"
          isLoading={isLoading || uploading}
          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          {uploading ? 'Subiendo imágenes...' : (drop ? '✓ Actualizar Drop' : '+ Crear Drop')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={uploading}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
};

interface DropStatsCardProps {
  stats: DropStats;
}

export const DropStatsCard: React.FC<DropStatsCardProps> = ({ stats }) => {
  const statItems = [
    {
      label: 'Total Drops',
      value: stats.total_drops,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      label: 'Drops Activos',
      value: stats.active_drops,
      icon: Calendar,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      label: 'Destacados',
      value: stats.featured_drops,
      icon: Star,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    },
    {
      label: 'Próximos',
      value: stats.upcoming_drops,
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item) => (
        <Card key={item.label} className="text-center">
          <div className={`inline-flex p-3 rounded-full ${item.bgColor} mb-3`}>
            <item.icon className={`h-6 w-6 ${item.color}`} />
          </div>
          <p className="text-2xl font-bold text-gray-900">{item.value}</p>
          <p className="text-sm text-gray-600">{item.label}</p>
        </Card>
      ))}
    </div>
  );
};

interface DropFiltersProps {
  onSearch: (query: string) => void;
  onFilterChange: (filters: {
    status?: string;
    featured?: boolean;
    sortBy?: string;
  }) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

export const DropFilters: React.FC<DropFiltersProps> = ({
  onSearch,
  onFilterChange,
  viewMode,
  onViewModeChange
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    featured: false,
    sortBy: 'launch_date'
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch(query);
  };

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar drops..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange({ status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
            <option value="FINALIZADO">Finalizado</option>
          </select>
          
          <select
            value={filters.sortBy}
            onChange={(e) => handleFilterChange({ sortBy: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="launch_date">Por fecha de lanzamiento</option>
            <option value="name">Por nombre</option>
            <option value="created_at">Por fecha de creación</option>
          </select>
          
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={filters.featured}
            onChange={(e) => handleFilterChange({ featured: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">Solo destacados</span>
        </label>
      </div>
    </div>
  );
};
