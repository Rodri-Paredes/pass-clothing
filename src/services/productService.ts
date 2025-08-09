// Removed duplicate top-level createProductVariant function
import { supabase } from '../lib/supabase';
import type { Product, Stock } from '../lib/types';

export class ProductService {
  async createProductVariant(variant: { product_id: string; size: string }): Promise<any> {
    const { data, error } = await supabase
      .from('product_variants')
      .insert(variant)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        variants:product_variants(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getProduct(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        variants:product_variants(*)
      `)
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
        variant:product_variants(*),
        branch:branches(*)
      `)
      .eq('branch_id', branchId)
      .order('quantity', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getStockByProduct(variantId: string): Promise<Stock[]> {
    const { data, error } = await supabase
      .from('stock')
      .select(`
        *,
        variant:product_variants(*),
        branch:branches(*)
      `)
      .eq('variant_id', variantId);

    if (error) throw error;
    return data || [];
  }

  async updateStock(variantId: string, branchId: string, quantity: number): Promise<void> {
    // Check if stock record exists
    const { data: existing, error: selectError } = await supabase
      .from('stock')
      .select('id')
      .eq('variant_id', variantId)
      .eq('branch_id', branchId);

    if (selectError) throw selectError;

    if (existing && existing.length > 0) {
      // Update existing stock record
      const { error } = await supabase
        .from('stock')
        .update({ 
          quantity, 
          updated_at: new Date().toISOString() 
        })
        .eq('variant_id', variantId)
        .eq('branch_id', branchId);

      if (error) throw error;
    } else {
      // Create new stock record
      const { error } = await supabase
        .from('stock')
        .insert({
          variant_id: variantId,
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