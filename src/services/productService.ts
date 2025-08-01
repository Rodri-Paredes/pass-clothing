import { supabase } from '../lib/supabase';
import type { Product, Stock } from '../lib/types';

export class ProductService {
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getProduct(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async createProduct(product: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getStockByBranch(branchId: string): Promise<Stock[]> {
    const { data, error } = await supabase
      .from('stock')
      .select(`
        *,
        product:products(*),
        branch:branches(*)
      `)
      .eq('branch_id', branchId)
      .order('quantity', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getStockByProduct(productId: string): Promise<Stock[]> {
    const { data, error } = await supabase
      .from('stock')
      .select(`
        *,
        product:products(*),
        branch:branches(*)
      `)
      .eq('product_id', productId);

    if (error) throw error;
    return data || [];
  }

  async updateStock(productId: string, branchId: string, quantity: number): Promise<void> {
    const { data: existing } = await supabase
      .from('stock')
      .select('id')
      .eq('product_id', productId)
      .eq('branch_id', branchId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('stock')
        .update({ 
          quantity, 
          updated_at: new Date().toISOString() 
        })
        .eq('product_id', productId)
        .eq('branch_id', branchId);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('stock')
        .insert({
          product_id: productId,
          branch_id: branchId,
          quantity
        });

      if (error) throw error;
    }
  }

  async uploadProductImage(file: File): Promise<string> {
    const fileName = `${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('products')
      .getPublicUrl(fileName);

    return data.publicUrl;
  }
}

export const productService = new ProductService();