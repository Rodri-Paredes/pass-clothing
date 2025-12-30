export const CATEGORIES = [
  'Camisas',
  'Pantalones',
  'Hoodies',
  'Shorts',
  'Accesorios',
  'Poleras',
  'Gorras',
  'Tops',
  'TrackSuit Basic',
  ''

] as const;

export const SIZES = [
  'XS',
  'S', 
  'M',
  'L',
  'XL',
  'XXL'
] as const;

export const ROLES = {
  ADMIN: 'admin',
  VENDEDOR: 'vendedor'
} as const;

export const SALE_CHANNELS = [
  { value: 'TIENDA', label: 'Tienda', icon: '🏪', color: 'blue' },
  { value: 'WEB', label: 'Web', icon: '🌐', color: 'purple' }
] as const;

export const LOW_STOCK_THRESHOLD = 5;

/**
 * Obtiene la fecha actual en la zona horaria de Bolivia (America/La_Paz)
 * en formato YYYY-MM-DD
 */
export const getLocalDateString = (): string => {
  const laPazNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz' }));
  const year = laPazNow.getFullYear();
  const month = String(laPazNow.getMonth() + 1).padStart(2, '0');
  const day = String(laPazNow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Convierte una fecha YYYY-MM-DD a formato con timezone de Bolivia
 * para inicio de día: YYYY-MM-DDT00:00:00-04:00
 */
export const toBoliviaStartOfDay = (dateString: string): string => {
  return `${dateString}T00:00:00-04:00`;
};

/**
 * Convierte una fecha YYYY-MM-DD a formato con timezone de Bolivia
 * para fin de día: YYYY-MM-DDT23:59:59-04:00
 */
export const toBoliviaEndOfDay = (dateString: string): string => {
  return `${dateString}T23:59:59-04:00`;
};