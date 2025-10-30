import { supabase } from '../lib/supabase';
import type { Product, ProductVariant, Stock } from '../lib/types';

export interface DataIntegrityReport {
  timestamp: string;
  productsWithoutVariants: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  variantsWithoutStock: Array<{
    variant_id: string;
    product_name: string;
    size: string;
  }>;
  stockWithoutVariants: Array<{
    stock_id: string;
    variant_id: string;
    quantity: number;
  }>;
  productsWithBrokenImages: Array<{
    id: string;
    name: string;
    image_url: string;
  }>;
  orphanedImages: string[];
  totalIssues: number;
}

export class DataIntegrityChecker {
  static async generateReport(): Promise<DataIntegrityReport> {
    console.log('🔍 [DataIntegrityChecker] Generando reporte de integridad...');
    
    const report: DataIntegrityReport = {
      timestamp: new Date().toISOString(),
      productsWithoutVariants: [],
      variantsWithoutStock: [],
      stockWithoutVariants: [],
      productsWithBrokenImages: [],
      orphanedImages: [],
      totalIssues: 0
    };

    try {
      // 1. Verificar productos sin variantes
      console.log('🔍 [DataIntegrityChecker] Verificando productos sin variantes...');
      const { data: productsWithoutVariants, error: productsError } = await supabase
        .from('products')
        .select('id, name, category')
        .not('id', 'in', 
          supabase
            .from('product_variants')
            .select('product_id')
        );

      if (productsError) {
        console.error('❌ [DataIntegrityChecker] Error verificando productos:', productsError);
      } else {
        report.productsWithoutVariants = productsWithoutVariants || [];
        console.log(`📊 [DataIntegrityChecker] Productos sin variantes: ${report.productsWithoutVariants.length}`);
      }

      // 2. Verificar variantes sin stock
      console.log('🔍 [DataIntegrityChecker] Verificando variantes sin stock...');
      const { data: variantsWithoutStock, error: variantsError } = await supabase
        .from('product_variants')
        .select(`
          id as variant_id,
          size,
          product:products(name)
        `)
        .not('id', 'in',
          supabase
            .from('stock')
            .select('variant_id')
        );

      if (variantsError) {
        console.error('❌ [DataIntegrityChecker] Error verificando variantes:', variantsError);
      } else {
        report.variantsWithoutStock = (variantsWithoutStock || []).map(v => ({
          variant_id: v.variant_id,
          product_name: (v.product as any)?.name || 'Producto no encontrado',
          size: v.size
        }));
        console.log(`📊 [DataIntegrityChecker] Variantes sin stock: ${report.variantsWithoutStock.length}`);
      }

      // 3. Verificar stock sin variantes
      console.log('🔍 [DataIntegrityChecker] Verificando stock sin variantes...');
      const { data: stockWithoutVariants, error: stockError } = await supabase
        .from('stock')
        .select('id as stock_id, variant_id, quantity')
        .not('variant_id', 'in',
          supabase
            .from('product_variants')
            .select('id')
        );

      if (stockError) {
        console.error('❌ [DataIntegrityChecker] Error verificando stock:', stockError);
      } else {
        report.stockWithoutVariants = stockWithoutVariants || [];
        console.log(`📊 [DataIntegrityChecker] Stock sin variantes: ${report.stockWithoutVariants.length}`);
      }

      // 4. Verificar productos con imágenes rotas
      console.log('🔍 [DataIntegrityChecker] Verificando productos con imágenes rotas...');
      const { data: productsWithImages, error: imagesError } = await supabase
        .from('products')
        .select('id, name, image_url')
        .not('image_url', 'is', null)
        .neq('image_url', '');

      if (imagesError) {
        console.error('❌ [DataIntegrityChecker] Error verificando imágenes:', imagesError);
      } else {
        report.productsWithBrokenImages = (productsWithImages || [])
          .filter(p => !p.image_url?.startsWith('https://'))
          .map(p => ({
            id: p.id,
            name: p.name,
            image_url: p.image_url || ''
          }));
        console.log(`📊 [DataIntegrityChecker] Productos con imágenes rotas: ${report.productsWithBrokenImages.length}`);
      }

      // 5. Verificar imágenes huérfanas en storage
      console.log('🔍 [DataIntegrityChecker] Verificando imágenes huérfanas...');
      try {
        const { data: storageFiles, error: storageError } = await supabase.storage
          .from('products')
          .list();

        if (storageError) {
          console.warn('⚠️ [DataIntegrityChecker] No se pudo acceder al storage:', storageError);
        } else {
          // Obtener todas las URLs de imágenes de productos
          const { data: productImages } = await supabase
            .from('products')
            .select('image_url')
            .not('image_url', 'is', null)
            .neq('image_url', '');

          const referencedImages = new Set(
            (productImages || [])
              .map(p => {
                const url = p.image_url || '';
                return url.includes('/products/') ? url.split('/products/')[1] : null;
              })
              .filter(Boolean)
          );

          report.orphanedImages = (storageFiles || [])
            .map(file => file.name)
            .filter(name => !referencedImages.has(name));

          console.log(`📊 [DataIntegrityChecker] Imágenes huérfanas: ${report.orphanedImages.length}`);
        }
      } catch (storageError) {
        console.warn('⚠️ [DataIntegrityChecker] Error verificando storage:', storageError);
      }

      // Calcular total de problemas
      report.totalIssues = 
        report.productsWithoutVariants.length +
        report.variantsWithoutStock.length +
        report.stockWithoutVariants.length +
        report.productsWithBrokenImages.length +
        report.orphanedImages.length;

      console.log(`📊 [DataIntegrityChecker] Total de problemas encontrados: ${report.totalIssues}`);

      return report;

    } catch (error) {
      console.error('❌ [DataIntegrityChecker] Error generando reporte:', error);
      throw error;
    }
  }

  static async fixIssues(report: DataIntegrityReport): Promise<void> {
    console.log('🔧 [DataIntegrityChecker] Iniciando corrección de problemas...');

    try {
      // 1. Crear variantes para productos sin variantes
      if (report.productsWithoutVariants.length > 0) {
        console.log(`🔧 [DataIntegrityChecker] Creando variantes para ${report.productsWithoutVariants.length} productos...`);
        
        for (const product of report.productsWithoutVariants) {
          const { error } = await supabase
            .from('product_variants')
            .insert({
              product_id: product.id,
              size: 'M' // Talla por defecto
            });

          if (error) {
            console.error(`❌ [DataIntegrityChecker] Error creando variante para ${product.name}:`, error);
          } else {
            console.log(`✅ [DataIntegrityChecker] Variante creada para ${product.name}`);
          }
        }
      }

      // 2. Eliminar stock sin variantes
      if (report.stockWithoutVariants.length > 0) {
        console.log(`🔧 [DataIntegrityChecker] Eliminando ${report.stockWithoutVariants.length} registros de stock sin variantes...`);
        
        const stockIds = report.stockWithoutVariants.map(s => s.stock_id);
        const { error } = await supabase
          .from('stock')
          .delete()
          .in('id', stockIds);

        if (error) {
          console.error('❌ [DataIntegrityChecker] Error eliminando stock sin variantes:', error);
        } else {
          console.log(`✅ [DataIntegrityChecker] Stock sin variantes eliminado`);
        }
      }

      // 3. Limpiar imágenes huérfanas
      if (report.orphanedImages.length > 0) {
        console.log(`🔧 [DataIntegrityChecker] Limpiando ${report.orphanedImages.length} imágenes huérfanas...`);
        
        const { error } = await supabase.storage
          .from('products')
          .remove(report.orphanedImages);

        if (error) {
          console.error('❌ [DataIntegrityChecker] Error limpiando imágenes huérfanas:', error);
        } else {
          console.log(`✅ [DataIntegrityChecker] Imágenes huérfanas limpiadas`);
        }
      }

      console.log('✅ [DataIntegrityChecker] Corrección de problemas completada');

    } catch (error) {
      console.error('❌ [DataIntegrityChecker] Error corrigiendo problemas:', error);
      throw error;
    }
  }

  static async checkStockIntegrity(productId: string): Promise<any> {
    console.log(`🔍 [DataIntegrityChecker] Verificando integridad de stock para producto: ${productId}`);

    try {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select(`
          *,
          variants:product_variants(
            *,
            stock(*)
          )
        `)
        .eq('id', productId)
        .single();

      if (productError) {
        console.error('❌ [DataIntegrityChecker] Error obteniendo producto:', productError);
        throw productError;
      }

      const integrityReport = {
        productId,
        productName: product.name,
        variants: product.variants.map((variant: any) => ({
          variantId: variant.id,
          size: variant.size,
          stock: variant.stock.reduce((acc: any, stock: any) => {
            acc[stock.branch_id] = stock.quantity;
            return acc;
          }, {}),
          totalStock: variant.stock.reduce((sum: number, stock: any) => sum + stock.quantity, 0)
        })),
        totalProductStock: product.variants.reduce((sum: number, variant: any) => {
          return sum + variant.stock.reduce((variantSum: number, stock: any) => variantSum + stock.quantity, 0);
        }, 0)
      };

      console.log(`📊 [DataIntegrityChecker] Integridad de stock verificada para ${product.name}`);
      return integrityReport;

    } catch (error) {
      console.error('❌ [DataIntegrityChecker] Error verificando integridad de stock:', error);
      throw error;
    }
  }
}