export interface Branch {
  id: string;
  name: string;
  address: string;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'vendedor';
  branch_id?: string;
  created_at: string;
}


export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image_url?: string;
  is_visible: boolean;
  drop_id?: string;
  created_at: string;
  variants?: ProductVariant[];
  drop?: Drop;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  created_at: string;
  product?: Product;
}


export interface Stock {
  id: string;
  variant_id: string;
  branch_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  variant?: ProductVariant;
  branch?: Branch;
}

export interface Sale {
  payment_type: 'EFECTIVO' | 'QR' | 'TARJETA' | 'MIXTO';
  sale_channel: 'TIENDA' | 'WEB';
  id: string;
  user_id: string;
  branch_id: string;
  customer_id?: string | null;
  total: number;
  subtotal?: number;
  discount_amount?: number;
  notes?: string;
  payment_details?: {
    efectivo?: number;
    qr?: number;
    tarjeta?: number;
  };
  sale_date: string;
  created_at: string;
  sale_items?: SaleItem[];
  user?: User;
  branch?: Branch;
}

export interface Customer {
  id: string;
  customer_code: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  created_at: string;
  purchase_count?: number;
  total_spent?: number;
  last_purchase?: string | null;
}

export interface SalesUnitsBreakdown {
  label: string;
  units: number;
  percentage: number;
}


export interface SaleItem {
  id: string;
  sale_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  variant?: ProductVariant;
}

export interface DashboardStats {
  monthlyTotal: number;
  monthlySalesCount: number;
  monthlyItemsSold: number;
  totalSales: number;
  topProduct?: {
    name: string;
    total_sold: number;
  };
  lowStockProducts: Array<{
    name: string;
    quantity: number;
  }>;
  dailySales: Array<{
    date: string;
    total: number;
  }>;
}

export interface DailyReport {
  date: string;
  branchId: string;
  totalSales: number;
  numberOfSales: number;
  averageSale: number;
  totalItemsSold: number;
  sales: Sale[];
  topProducts: Array<{
    name: string;
    quantity: number;
    total: number;
  }>;
}

export interface MixedPaymentBreakdown {
  payment_method: string;
  total_amount: number;
  transaction_count: number;
}

export interface SalesWithDiscounts {
  total_sales: number;
  total_discounts: number;
  net_sales: number;
  number_of_sales: number;
  sales_with_discounts: number;
}

// Tipos para el sistema de flujo de caja
export interface CashRegister {
  id: string;
  branch_id: string;
  user_id: string;
  status: 'ABIERTA' | 'CERRADA';
  opening_date: string;
  opening_amount: number;
  opening_user_id: string;
  opening_notes?: string;
  closing_date?: string;
  closing_amount?: number;
  closing_user_id?: string;
  closing_notes?: string;
  expected_cash: number;
  expected_qr: number;
  expected_card: number;
  expected_total: number;
  cash_difference: number;
  created_at: string;
  updated_at: string;
}

export interface CashMovement {
  id: string;
  cash_register_id: string;
  movement_type: 'INGRESO' | 'EGRESO';
  payment_type: 'EFECTIVO' | 'QR' | 'TARJETA' | 'MIXTO';
  amount: number;
  description: string;
  reference_id?: string;
  reference_type?: string;
  user_id: string;
  created_at: string;
}

export interface CashRegisterSummary {
  opening_amount: number;
  expected_cash: number;
  expected_qr: number;
  expected_card: number;
  expected_total: number;
  closing_amount?: number;
  cash_difference?: number;
  total_sales: number;
  total_movements: number;
}

export interface CashMovementWithUser {
  id: string;
  movement_type: 'INGRESO' | 'EGRESO';
  payment_type: 'EFECTIVO' | 'QR' | 'TARJETA' | 'MIXTO';
  amount: number;
  description: string;
  reference_id?: string;
  reference_type?: string;
  user_name: string;
  created_at: string;
}

export interface OpenCashRegister {
  id: string;
  opening_date: string;
  opening_amount: number;
  opening_user_name: string;
  opening_notes?: string;
  expected_cash: number;
  expected_qr: number;
  expected_card: number;
  expected_total: number;
}

export interface CashRegisterHistory {
  id: string;
  opening_date: string;
  closing_date?: string;
  opening_amount: number;
  closing_amount?: number;
  expected_total: number;
  cash_difference?: number;
  opening_user_name: string;
  closing_user_name?: string;
  status: 'ABIERTA' | 'CERRADA';
}

// Tipos para reportes de ingresos mensuales
export interface MonthlyRevenueReport {
  start_date: string;
  end_date: string;
  total_revenue: number;
  total_sales_count: number;
  average_sale_amount: number;
  revenue_by_payment_type: {
    efectivo: number;
    qr: number;
    tarjeta: number;
    mixto: number;
  };
  daily_revenue?: Array<{
    date: string;
    total: number;
    count: number;
  }>;
}

export interface MonthlyRevenueComparison {
  current_month_start: string;
  current_month_end: string;
  current_month_revenue: number;
  current_month_sales_count: number;
  previous_month_start: string;
  previous_month_end: string;
  previous_month_revenue: number;
  previous_month_sales_count: number;
  revenue_change: number;
  revenue_change_percentage: number;
  sales_count_change: number;
  sales_count_change_percentage: number;
}

// Tipos para el sistema de drops
export interface Drop {
  id: string;
  name: string;
  description: string;
  launch_date: string;
  end_date?: string;
  status: 'ACTIVO' | 'INACTIVO' | 'FINALIZADO';
  is_featured: boolean;
  image_url?: string;
  banner_url?: string;
  created_at: string;
  updated_at: string;
  products?: Product[];
  product_count?: number;
}

export interface DropProduct {
  id: string;
  drop_id: string;
  product_id: string;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  product?: Product;
  drop?: Drop;
}

export interface DropWithProducts extends Drop {
  products: Product[];
  product_count: number;
}

export interface DropStats {
  total_drops: number;
  active_drops: number;
  featured_drops: number;
  total_products_in_drops: number;
  upcoming_drops: number;
}

// Tipos para el sistema de descuentos por porcentaje
export interface Discount {
  id: string;
  name: string;
  percentage: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  discount_products?: DiscountProduct[];
  discount_drops?: DiscountDrop[];
  product_count?: number;
  drop_count?: number;
}

export interface DiscountProduct {
  id: string;
  discount_id: string;
  product_id: string;
  created_at: string;
  product?: Product;
  discount?: Discount;
}

export interface DiscountDrop {
  id: string;
  discount_id: string;
  drop_id: string;
  created_at: string;
  drop?: Drop;
  discount?: Discount;
}

export interface DiscountWithProducts extends Discount {
  discount_products: DiscountProduct[];
  products: Product[];
}

export interface DiscountWithDrops extends Discount {
  discount_drops: DiscountDrop[];
  drops: Drop[];
}

export type DiscountStatus = 'active' | 'scheduled' | 'expired';

export interface ProductWithDiscount extends Product {
  active_discount?: {
    discount_id: string;
    discount_name: string;
    percentage: number;
    discounted_price: number;
    start_date: string;
    end_date: string;
    source: 'product' | 'drop';
  } | null;
}