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
  color?: string | null;
  fit?: ProductFit | null;
  product_style?: ProductStyle | null;
  created_at: string;
  variants?: ProductVariant[];
  drop?: Drop;
}

export type ProductFit = 'Oversize' | 'Regular' | 'Boxy' | 'Slim';
export type ProductStyle = 'Básico' | 'Estampado' | 'Bordado' | 'Serigrafía' | 'Otro';

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
  loyalty_points_earned?: number;
  user?: User;
  branch?: Branch;
}

export interface Customer {
  id: string;
  auth_user_id?: string | null;
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
  deactivated_at?: string | null;
}

export interface LoyaltyTransaction {
  id: string;
  sale_id?: string | null;
  type: string;
  points: number;
  balance_after: number;
  reason: string;
  created_by?: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface LoyaltySummary {
  customer_id: string;
  enabled: boolean;
  points_balance: number;
  lifetime_points_earned: number;
  lifetime_points_redeemed: number;
  transactions: LoyaltyTransaction[];
}

export interface LoyaltySettings {
  enabled: boolean;
  points_per_currency_unit: number;
  currency_unit_amount: number;
  minimum_purchase_amount: number;
  max_points_per_sale: number | null;
  expiration_enabled: boolean;
  expiration_days: number | null;
  redemption_enabled: boolean;
  redemption_value: number;
  min_points_to_redeem: number;
}

export type CrewRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
export type CrewMembershipStatus = 'scheduled' | 'active' | 'expired' | 'cancelled' | 'inactive';
export type CrewBenefitType = 'percentage_discount' | 'fixed_discount' | 'product_discount' | 'category_discount' | 'drop_discount' | 'manual' | 'crew_plan';

export interface CrewPlan {
  id: string; code: string; name: string; price: number; currency: string;
  duration_months: number; is_active: boolean; sort_order: number;
}

export interface CrewBenefitDefinition {
  id: string; code: string; name: string; description?: string | null;
  benefit_type: CrewBenefitType; rule: Record<string, unknown>; is_active: boolean; is_public: boolean;
}

export interface CrewMembershipRequest {
  id: string; request_number: string; customer_id: string; plan_id: string;
  plan_name_snapshot: string; plan_code_snapshot: string; price_snapshot: number;
  currency_snapshot: string; duration_months_snapshot: number; status: CrewRequestStatus;
  receipt_path?: string | null; rejection_reason?: string | null; reviewed_at?: string | null;
  submitted_at?: string | null; created_at: string;
  customer?: Customer; reviewed_by_user?: Pick<User, 'id' | 'name'>;
}

export interface CrewMembership {
  id: string; member_number: string; customer_id: string; plan_id: string;
  plan_name_snapshot: string; plan_code_snapshot: string; price_snapshot: number;
  status: CrewMembershipStatus; started_at: string; expires_at: string; created_at: string;
  customer?: Customer;
}

export interface CustomerAccountLinkRequest {
  id: string; customer_id: string; auth_user_id: string; auth_email: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  rejection_reason?: string | null; created_at: string;
  customer?: Customer;
}

export interface CrewContext {
  active: boolean; membership_id?: string | null; member_number?: string | null;
  plan_id?: string | null; plan_name?: string | null; started_at?: string | null;
  expires_at?: string | null; benefits: CrewBenefitDefinition[];
  loyalty_enabled?: boolean; points_balance?: number;
}

export interface CrewSaleQuote {
  source: 'none' | 'crew' | 'manual' | 'catalog_promotion'; catalog_subtotal: number;
  subtotal: number; discount_amount: number; total: number; savings: number;
  membership_id?: string | null; benefit_id?: string | null;
  benefit_snapshot?: Record<string, unknown> | null;
}

export interface SalesUnitsBreakdown {
  label: string;
  units: number;
  percentage: number;
}
export interface SalesChannelBreakdown {
  channel: string;
  sales_count: number;
  units: number;
  revenue: number;
  sales_percentage: number;
  units_percentage: number;
  revenue_percentage: number;
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
