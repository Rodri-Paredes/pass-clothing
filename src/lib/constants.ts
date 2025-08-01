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

export const LOW_STOCK_THRESHOLD = 5;