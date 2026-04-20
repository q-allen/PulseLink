import { api, API_ENDPOINTS } from "./api";
import { Medicine, Order, ApiResponse, OrderItem } from "@/types";
import { DeliveryAddress } from "@/store/pharmacyStore";
import { mapMedicine } from "./mappers";

export interface PrescriptionUploadResult {
  id: number;
  file_url: string;
  status: string;
  order: number | null;
  created_at: string;
}

export interface PlaceOrderPayload {
  patientId: string;
  items: OrderItem[];
  deliveryAddress: DeliveryAddress;
  paymentMethod: string;
  prescriptionUrl?: string | null;
  prescriptionUploadId?: number | null;
  prescriptionId?: number | null;
  totalAmount: number;
}

export interface PlaceOrderResult {
  orderRef: string;
  estimatedDelivery: string;
  paymentMethod: string;
  totalAmount: number;
  status: string;
  checkoutUrl?: string | null;
}

/** Full order shape returned by the backend (snake_case mapped here). */
export interface BackendOrder {
  id: number;
  order_ref: string;
  status: string;
  tracking_number: string;
  total_amount: string;
  delivery_address: string;
  payment_method: string;
  payment_status: string;
  from_prescription: boolean;
  prescription: number | null;
  items: BackendOrderItem[];
  created_at: string;
  updated_at: string;
  checkout_url?: string | null;
  unmatched_items?: string[];
}

export interface BackendOrderItem {
  medicine_id: number | null;
  name: string;
  generic_name: string;
  dosage_form: string;
  quantity: number;
  price: number;
  not_in_catalogue?: boolean;
}

/** Delivery pipeline labels — mirrors NowServing.ph pharmacy tracking. */
export const DELIVERY_STEPS = [
  { key: "processing",       label: "Processing" },
  { key: "shipped",          label: "Shipped" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered",        label: "Delivered" },
] as const;

export const pharmacyService = {
  getMedicines: async (query?: string, category?: string): Promise<ApiResponse<Medicine[]>> => {
    const params = new URLSearchParams();
    if (query)    params.set("q",        query);
    if (category) params.set("category", category);
    const q = params.toString() ? `?${params}` : "";
    const data = await api.get<any[]>(`${API_ENDPOINTS.MEDICINES}${q}`);
    return { success: true, data: data.map(mapMedicine) };
  },

  getMedicineById: async (id: string): Promise<ApiResponse<Medicine | null>> => {
    const data = await api.get<any>(API_ENDPOINTS.MEDICINE_DETAIL(id));
    return { success: true, data: mapMedicine(data) };
  },

  placeOrder: async (payload: PlaceOrderPayload): Promise<ApiResponse<PlaceOrderResult>> => {
    const today = new Date();
    today.setDate(today.getDate() + 3);
    const estimated = today.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });

    const backendPaymentMethod = payload.paymentMethod === "bank" ? "card" : payload.paymentMethod;
    const order = await api.post<BackendOrder>(API_ENDPOINTS.ORDERS, {
      items: payload.items.map((i) => ({
        medicine_id: Number(i.medicine.id),
        name: i.medicine.name,
        quantity: i.quantity,
        price: i.medicine.price,
        generic_name: i.medicine.genericName,
        dosage_form: i.medicine.dosageForm,
      })),
      delivery_address: `${payload.deliveryAddress.houseUnit} ${payload.deliveryAddress.street}, ${payload.deliveryAddress.barangay}, ${payload.deliveryAddress.city}, ${payload.deliveryAddress.province} ${payload.deliveryAddress.zipCode}`,
      payment_method: backendPaymentMethod,
      total_amount: payload.totalAmount,
      ...(payload.prescriptionUploadId ? { prescription_upload_id: payload.prescriptionUploadId } : {}),
      ...(payload.prescriptionId ? { prescription_id: payload.prescriptionId } : {}),
    });

    return {
      success: true,
      data: {
        orderRef: order.order_ref,
        estimatedDelivery: estimated,
        paymentMethod: backendPaymentMethod,
        totalAmount: payload.totalAmount,
        status: order.status,
        checkoutUrl: order.checkout_url ?? null,
      },
    };
  },

  /**
   * NowServing one-tap flow: patient taps "Order These Medicines" on the
   * completed appointment page. Backend reads the prescription, matches
   * medicines in the catalogue, and creates a pre-filled order.
   */
  createOrderFromPrescription: async (
    prescriptionId: number,
    deliveryAddress: string,
    paymentMethod = "cod",
  ): Promise<ApiResponse<BackendOrder>> => {
    const data = await api.post<BackendOrder>(
      API_ENDPOINTS.ORDER_FROM_PRESCRIPTION,
      { prescription_id: prescriptionId, delivery_address: deliveryAddress, payment_method: paymentMethod },
    );
    return { success: true, data };
  },

  /** List the current patient's orders with delivery status. */
  getMyOrders: async (): Promise<ApiResponse<BackendOrder[]>> => {
    try {
      const data = await api.get<BackendOrder[]>(API_ENDPOINTS.ORDERS);
      return { success: true, data: Array.isArray(data) ? data : [] };
    } catch {
      return { success: false, data: [] };
    }
  },

  getOrders: async (_patientId: string): Promise<ApiResponse<Order[]>> => {
    const data = await api.get<Order[]>(API_ENDPOINTS.ORDERS);
    return { success: true, data };
  },

  cancelOrder: async (id: string): Promise<ApiResponse<Order>> => {
    const data = await api.patch<Order>(API_ENDPOINTS.ORDER_CANCEL(id), {});
    return { success: true, data };
  },

  uploadPrescription: async (file: File, orderId?: number): Promise<ApiResponse<PrescriptionUploadResult>> => {
    const form = new FormData();
    form.append("file", file);
    if (orderId) form.append("order_id", String(orderId));
    const data = await api.upload<PrescriptionUploadResult>(API_ENDPOINTS.PRESCRIPTION_UPLOAD, form);
    return { success: true, data };
  },

  getDeliveryFee(province: string, subtotal: number): { fee: number; freeThreshold: number } {
    const FREE_THRESHOLD = 1500;
    if (subtotal >= FREE_THRESHOLD) return { fee: 0, freeThreshold: FREE_THRESHOLD };
    return { fee: province === "Metro Manila" ? 99 : 150, freeThreshold: FREE_THRESHOLD };
  },

  getMethodLabel(method: string): string {
    return { cod: "Cash on Delivery", gcash: "GCash", bank: "Bank Transfer" }[method] || method;
  },
};
