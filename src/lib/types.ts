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
  created_at: string;
  variants?: ProductVariant[];
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
  payment_type: string;
  id: string;
  user_id: string;
  branch_id: string;
  total: number;
  sale_date: string;
  created_at: string;
  sale_items?: SaleItem[];
  user?: User;
  branch?: Branch;
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