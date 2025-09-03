import { supabase } from '../lib/supabase';
import type { 
  CashRegister, 
  CashMovement, 
  CashRegisterSummary, 
  CashMovementWithUser,
  OpenCashRegister,
  CashRegisterHistory
} from '../lib/types';

export class CashRegisterService {
  // Abrir caja
  async openCashRegister(branchId: string, openingAmount: number, openingNotes?: string): Promise<string> {
    const { data, error } = await supabase.rpc('open_cash_register', {
      p_branch_id: branchId,
      p_opening_amount: openingAmount,
      p_opening_notes: openingNotes
    });

    if (error) throw error;
    return data;
  }

  // Cerrar caja
  async closeCashRegister(cashRegisterId: string, closingAmount: number, closingNotes?: string): Promise<void> {
    const { error } = await supabase.rpc('close_cash_register', {
      p_cash_register_id: cashRegisterId,
      p_closing_amount: closingAmount,
      p_closing_notes: closingNotes
    });

    if (error) throw error;
  }

  // Obtener caja abierta de una sucursal
  async getOpenCashRegister(branchId: string): Promise<OpenCashRegister | null> {
    const { data, error } = await supabase.rpc('get_open_cash_register', {
      p_branch_id: branchId
    });

    if (error) throw error;
    return data?.[0] || null;
  }

  // Obtener resumen de caja
  async getCashRegisterSummary(cashRegisterId: string): Promise<CashRegisterSummary | null> {
    const { data, error } = await supabase.rpc('get_cash_register_summary', {
      p_cash_register_id: cashRegisterId
    });

    if (error) throw error;
    return data?.[0] || null;
  }

  // Obtener movimientos de caja
  async getCashMovements(cashRegisterId: string): Promise<CashMovementWithUser[]> {
    const { data, error } = await supabase.rpc('get_cash_movements', {
      p_cash_register_id: cashRegisterId
    });

    if (error) throw error;
    return data || [];
  }

  // Obtener historial de cajas
  async getCashRegisterHistory(branchId: string, startDate: string, endDate: string): Promise<CashRegisterHistory[]> {
    const { data, error } = await supabase.rpc('get_cash_register_history', {
      p_branch_id: branchId,
      p_start_date: startDate,
      p_end_date: endDate
    });

    if (error) throw error;
    return data || [];
  }

  // Registrar movimiento manual (ingreso/egreso)
  async addManualMovement(
    cashRegisterId: string,
    userId: string,
    movementType: 'INGRESO' | 'EGRESO',
    paymentType: 'EFECTIVO' | 'QR' | 'TARJETA',
    amount: number,
    description: string
  ): Promise<void> {
    const { error } = await supabase
      .from('cash_movements')
      .insert({
        cash_register_id: cashRegisterId,
        user_id: userId,
        movement_type: movementType,
        payment_type: paymentType,
        amount,
        description
      });

    if (error) throw error;
  }

  // Obtener caja por ID
  async getCashRegisterById(cashRegisterId: string): Promise<CashRegister | null> {
    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('id', cashRegisterId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting cash register by ID:', error);
      return null;
    }
  }

  // Verificar si hay caja abierta en una sucursal
  async hasOpenCashRegister(branchId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('get_open_cash_register', {
        p_branch_id: branchId
      });

      if (error) throw error;
      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking open cash register:', error);
      return false;
    }
  }

  // Obtener estadísticas de caja para el dashboard
  async getCashRegisterStats(branchId: string): Promise<{
    hasOpenRegister: boolean;
    openRegister?: OpenCashRegister;
    todaySales: number;
    todayCash: number;
    todayQR: number;
    todayCard: number;
  }> {
    const hasOpenRegister = await this.hasOpenCashRegister(branchId);
    let openRegister: OpenCashRegister | undefined;
    
    if (hasOpenRegister) {
      const register = await this.getOpenCashRegister(branchId);
      openRegister = register || undefined;
    }

    // Obtener ventas del día
    const today = new Date().toISOString().split('T')[0];
    
    const { data: salesData } = await supabase.rpc('sum_total_sales', {
      payment_type_param: null,
      sale_date_param: today,
      branch_id_param: branchId
    });

    const { data: cashData } = await supabase.rpc('sum_total_sales', {
      payment_type_param: 'EFECTIVO',
      sale_date_param: today,
      branch_id_param: branchId
    });

    const { data: qrData } = await supabase.rpc('sum_total_sales', {
      payment_type_param: 'QR',
      sale_date_param: today,
      branch_id_param: branchId
    });

    const { data: cardData } = await supabase.rpc('sum_total_sales_card', {
      sale_date_param: today,
      branch_id_param: branchId
    });

    return {
      hasOpenRegister,
      openRegister,
      todaySales: salesData || 0,
      todayCash: cashData || 0,
      todayQR: qrData || 0,
      todayCard: cardData || 0
    };
  }

  // Obtener reporte de caja para impresión
  async getCashRegisterReport(cashRegisterId: string): Promise<{
    cashRegister: CashRegister;
    summary: CashRegisterSummary;
    movements: CashMovementWithUser[];
    branch: any;
    openingUser: any;
    closingUser?: any;
  }> {
    const cashRegister = await this.getCashRegisterById(cashRegisterId);
    if (!cashRegister) throw new Error('Caja no encontrada');

    const summary = await this.getCashRegisterSummary(cashRegisterId);
    const movements = await this.getCashMovements(cashRegisterId);

    // Obtener información de la sucursal y usuarios
    const { data: branch } = await supabase
      .from('branches')
      .select('*')
      .eq('id', cashRegister.branch_id)
      .single();

    const { data: openingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', cashRegister.opening_user_id)
      .single();

    let closingUser;
    if (cashRegister.closing_user_id) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', cashRegister.closing_user_id)
        .single();
      closingUser = data;
    }

    return {
      cashRegister,
      summary: summary!,
      movements,
      branch,
      openingUser,
      closingUser
    };
  }
}

export const cashRegisterService = new CashRegisterService();
