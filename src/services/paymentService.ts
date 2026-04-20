import { ApiResponse } from '@/types';
import { api, API_ENDPOINTS } from './api';

export type PaymentMethod = 'cod' | 'gcash' | 'bank';
export type PaymentStatus = 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'awaiting_payment';

export interface PaymentTransaction {
  id: string;
  orderId: string;
  patientId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  referenceNumber: string;
  createdAt: string;
  completedAt?: string;
  failureReason?: string;
  // PayMongo-specific
  paymongoSourceId?: string;
  paymongoPaymentIntentId?: string;
  redirectUrl?: string;
  bankInstructions?: {
    bank: string;
    accountNumber: string;
    accountName: string;
    referenceCode: string;
    expiresAt: string;
  };
}

export interface ProcessPaymentData {
  orderId: string;
  patientId: string;
  amount: number;
  method: PaymentMethod;
}

type BankInstructionsPayload = {
  bank?: string;
  accountNumber?: string;
  accountName?: string;
  referenceCode?: string;
  expiresAt?: string;
};

const PAYMENTS_MODE = (process.env.NEXT_PUBLIC_PAYMENTS_MODE ??
  (process.env.NODE_ENV === 'production' ? 'live' : 'mock')).toLowerCase();
const USE_MOCK_PAYMENTS = PAYMENTS_MODE !== 'live';

const mockTransactions: PaymentTransaction[] = [];

const generateRef = (method: PaymentMethod): string => {
  const prefix = { cod: 'COD', gcash: 'GC', bank: 'BT' }[method];
  return `${prefix}${Date.now().toString().slice(-8)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
};

const mapBankInstructions = (data?: BankInstructionsPayload) => {
  if (!data) return undefined;
  return {
    bank: data.bank ?? '',
    accountNumber: data.accountNumber ?? '',
    accountName: data.accountName ?? '',
    referenceCode: data.referenceCode ?? '',
    expiresAt: data.expiresAt ?? '',
  };
};

const mapPaymentTransaction = (data: Record<string, unknown>): PaymentTransaction => ({
  id: String(data?.id ?? data?.transaction_id ?? data?.txn_id ?? ''),
  orderId: String(data?.orderId ?? data?.order_id ?? ''),
  patientId: String(data?.patientId ?? data?.patient_id ?? ''),
  amount: Number(data?.amount ?? 0),
  method: (data?.method ?? data?.payment_method ?? 'cod') as PaymentMethod,
  status: (data?.status ?? data?.payment_status ?? 'pending') as PaymentStatus,
  referenceNumber: String(data?.referenceNumber ?? data?.reference_number ?? ''),
  createdAt: String(data?.createdAt ?? data?.created_at ?? new Date().toISOString()),
  completedAt: data?.completedAt ? String(data.completedAt) : data?.completed_at ? String(data.completed_at) : undefined,
  failureReason: data?.failureReason ? String(data.failureReason) : data?.failure_reason ? String(data.failure_reason) : undefined,
  paymongoSourceId: data?.paymongoSourceId ? String(data.paymongoSourceId) : data?.paymongo_source_id ? String(data.paymongo_source_id) : undefined,
  paymongoPaymentIntentId: data?.paymongoPaymentIntentId ? String(data.paymongoPaymentIntentId) : data?.paymongo_payment_intent_id ? String(data.paymongo_payment_intent_id) : undefined,
  redirectUrl: data?.redirectUrl ? String(data.redirectUrl) : data?.redirect_url ? String(data.redirect_url) : undefined,
  bankInstructions: mapBankInstructions(
    data?.bankInstructions ?? data?.bank_instructions
  ),
});

const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const paymentService = {
  /**
   * Feature flag:
   *   NEXT_PUBLIC_PAYMENTS_MODE=mock | live
   * Default: mock in dev, live in production.
   *
   * In live mode, the backend handles PayMongo and returns a transaction payload.
   */
  async processPayment(data: ProcessPaymentData): Promise<ApiResponse<PaymentTransaction>> {
    if (USE_MOCK_PAYMENTS) {
      const delay = 800 + Math.random() * 800;
      await new Promise((r) => setTimeout(r, delay));

      const ref = generateRef(data.method);
      const txnId = `txn-${Date.now()}`;

      if (data.method === 'cod') {
        const txn: PaymentTransaction = {
          id: txnId,
          orderId: data.orderId,
          patientId: data.patientId,
          amount: data.amount,
          method: 'cod',
          status: 'pending',
          referenceNumber: ref,
          createdAt: new Date().toISOString(),
        };
        mockTransactions.push(txn);
        return { success: true, data: txn, message: 'Order confirmed. Pay on delivery.' };
      }

      if (data.method === 'gcash') {
        if (Math.random() < 0.1) {
          return { success: false, data: null as PaymentTransaction, error: 'GCash payment failed. Please try again.' };
        }
        const txn: PaymentTransaction = {
          id: txnId,
          orderId: data.orderId,
          patientId: data.patientId,
          amount: data.amount,
          method: 'gcash',
          status: 'success',
          referenceNumber: ref,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          paymongoSourceId: `src_mock_${Date.now()}`,
          redirectUrl: 'https://gcash.com/mock-redirect',
        };
        mockTransactions.push(txn);
        return { success: true, data: txn, message: 'GCash payment successful.' };
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      const txn: PaymentTransaction = {
        id: txnId,
        orderId: data.orderId,
        patientId: data.patientId,
        amount: data.amount,
        method: 'bank',
        status: 'awaiting_payment',
        referenceNumber: ref,
        createdAt: new Date().toISOString(),
        bankInstructions: {
          bank: 'BDO Unibank',
          accountNumber: '0012-3456-7890',
          accountName: 'NowServing Healthcare Inc.',
          referenceCode: ref,
          expiresAt: expiresAt.toISOString(),
        },
      };
      mockTransactions.push(txn);
      return { success: true, data: txn, message: 'Bank transfer instructions generated.' };
    }

    try {
      const payload = {
        order_id: data.orderId,
        patient_id: data.patientId,
        amount: data.amount,
        payment_method: data.method,
      };
      const res = await api.post<PaymentTransaction>(API_ENDPOINTS.PAYMENTS_PROCESS, payload);
      return { success: true, data: mapPaymentTransaction(res as unknown as Record<string, unknown>) };
    } catch (error) {
      return { success: false, data: null as PaymentTransaction, error: toErrorMessage(error, 'Payment could not be processed.') };
    }
  },

  async getPaymentStatus(txnId: string): Promise<ApiResponse<PaymentTransaction | null>> {
    if (USE_MOCK_PAYMENTS) {
      const txn = mockTransactions.find((t) => t.id === txnId);
      return txn ? { success: true, data: txn } : { success: false, data: null, error: 'Transaction not found' };
    }

    try {
      const res = await api.get<PaymentTransaction>(API_ENDPOINTS.PAYMENTS_STATUS(txnId));
      return { success: true, data: mapPaymentTransaction(res as unknown as Record<string, unknown>) };
    } catch (error) {
      return { success: false, data: null, error: toErrorMessage(error, 'Unable to fetch payment status.') };
    }
  },

  async getPatientTransactions(patientId: string): Promise<ApiResponse<PaymentTransaction[]>> {
    if (USE_MOCK_PAYMENTS) {
      return { success: true, data: mockTransactions.filter((t) => t.patientId === patientId) };
    }

    try {
      const res = await api.get<PaymentTransaction[]>(API_ENDPOINTS.PAYMENTS_PATIENT(patientId));
      return { success: true, data: (res as unknown as Record<string, unknown>[]).map(mapPaymentTransaction) };
    } catch (error) {
      return { success: false, data: [], error: toErrorMessage(error, 'Unable to load transactions.') };
    }
  },

  getDeliveryFee(province: string, subtotal: number): { fee: number; freeThreshold: number } {
    const FREE_THRESHOLD = 1500;
    if (subtotal >= FREE_THRESHOLD) return { fee: 0, freeThreshold: FREE_THRESHOLD };
    const isMetroManila = province === 'Metro Manila';
    return { fee: isMetroManila ? 99 : 150, freeThreshold: FREE_THRESHOLD };
  },

  getMethodLabel(method: string): string {
    return { cod: 'Cash on Delivery', gcash: 'GCash', bank: 'Bank Transfer' }[method] || method;
  },
};
