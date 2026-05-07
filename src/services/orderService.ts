/**
 * Servicio para integración entre e-commerce y ERP
 * Maneja el envío de pedidos a través de la API del backend
 */

// Configuración de la API
const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';
const WHATSAPP_BUSINESS_NUMBER = (import.meta as any).env.VITE_WHATSAPP_NUMBER || '+59112345678';

export interface OrderItem {
  product_name: string;
  variant: string;
  quantity: number;
  price: number;
}

export interface CreateOrderRequest {
  customer_name: string;
  customer_phone: string;
  items: OrderItem[];
  total: number;
  notes?: string;
}

export interface Order {
  id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  notes?: string;
}

export interface OrderResponse {
  success: boolean;
  order: Order;
  message: string;
}

export class OrderService {
  /**
   * Crear un nuevo pedido en el ERP
   */
  async createOrder(orderData: CreateOrderRequest): Promise<OrderResponse> {
    try {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al crear el pedido');
      }

      const data: OrderResponse = await response.json();
      return data;
    } catch (error: any) {
      console.error('❌ Error creando pedido:', error);
      throw new Error(error.message || 'No se pudo conectar con el servidor');
    }
  }

  /**
   * Obtener todos los pedidos (para el ERP)
   */
  async getOrders(filters?: {
    status?: 'pending' | 'completed' | 'cancelled';
    limit?: number;
    offset?: number;
  }): Promise<{ orders: Order[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());

      const response = await fetch(`${API_URL}/api/orders?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Error al obtener pedidos');
      }

      const data = await response.json();
      return {
        orders: data.orders,
        total: data.pagination.total,
      };
    } catch (error: any) {
      console.error('❌ Error obteniendo pedidos:', error);
      throw error;
    }
  }

  /**
   * Actualizar el estado de un pedido
   */
  async updateOrderStatus(
    orderId: string,
    status: 'pending' | 'completed' | 'cancelled'
  ): Promise<Order> {
    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al actualizar el pedido');
      }

      const data = await response.json();
      return data.order;
    } catch (error: any) {
      console.error('❌ Error actualizando pedido:', error);
      throw error;
    }
  }

  /**
   * Generar mensaje de WhatsApp con los detalles del pedido
   */
  generateWhatsAppMessage(order: Order): string {
    const itemsText = order.items
      .map(
        (item) =>
          `• ${item.product_name} (${item.variant}) x${item.quantity} - Bs. ${item.price.toFixed(2)}`
      )
      .join('\n');

    const message = `
🛍️ *NUEVO PEDIDO - ${order.code}*

👤 *Cliente:* ${order.customer_name}
📱 *Teléfono:* ${order.customer_phone}

📦 *Productos:*
${itemsText}

💰 *TOTAL: Bs. ${order.total.toFixed(2)}*

${order.notes ? `📝 *Notas:* ${order.notes}` : ''}

_Pedido registrado el ${new Date(order.created_at).toLocaleString('es-BO')}_
    `.trim();

    return encodeURIComponent(message);
  }

  /**
   * Abrir WhatsApp con el mensaje del pedido
   */
  openWhatsApp(order: Order, phoneNumber: string = WHATSAPP_BUSINESS_NUMBER): void {
    const message = this.generateWhatsAppMessage(order);
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    
    window.open(whatsappUrl, '_blank');
  }
}

export const orderService = new OrderService();
