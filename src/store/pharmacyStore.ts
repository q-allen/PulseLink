import { create } from 'zustand';
import { Medicine, OrderItem } from '@/types';
import { BackendOrderItem } from '@/services/pharmacyService';

export interface DeliveryAddress {
  id: string;
  fullName: string;
  mobile: string;
  houseUnit: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  zipCode: string;
  notes?: string;
  isDefault?: boolean;
}

export interface PharmacyState {
  cart: OrderItem[];
  prescriptionFile: File | null;
  prescriptionUrl: string | null;
  prescriptionUploadId: number | null;   // ID returned by backend after upload
  /** ID of the prescription that pre-filled the cart (from consultation handoff) */
  prescriptionId: number | null;
  selectedAddressId: string | null;
  savedAddresses: DeliveryAddress[];
  selectedPaymentMethod: string;
  addToCart: (medicine: Medicine) => void;
  removeFromCart: (medicineId: string) => void;
  updateQuantity: (medicineId: string, quantity: number) => void;
  clearCart: () => void;
  setPrescription: (file: File | null, url: string | null, uploadId?: number | null) => void;
  prefillFromPrescription: (items: BackendOrderItem[], prescriptionId: number) => void;
  setSelectedAddress: (id: string) => void;
  addAddress: (address: Omit<DeliveryAddress, 'id'>) => void;
  setPaymentMethod: (method: string) => void;
  cartTotal: () => number;
  cartCount: () => number;
  hasRxItems: () => boolean;
}

export const usePharmacyStore = create<PharmacyState>((set, get) => ({
  cart: [],
  prescriptionFile: null,
  prescriptionUrl: null,
  prescriptionUploadId: null,
  prescriptionId: null,
  selectedAddressId: null,
  savedAddresses: [],
  selectedPaymentMethod: 'cod',

  addToCart: (medicine) => {
    set((state) => {
      const existing = state.cart.find((i) => i.medicine.id === medicine.id);
      if (existing) {
        return {
          cart: state.cart.map((i) =>
            i.medicine.id === medicine.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { cart: [...state.cart, { medicine, quantity: 1 }] };
    });
  },

  removeFromCart: (medicineId) =>
    set((state) => ({ cart: state.cart.filter((i) => i.medicine.id !== medicineId) })),

  updateQuantity: (medicineId, quantity) =>
    set((state) => ({
      cart:
        quantity <= 0
          ? state.cart.filter((i) => i.medicine.id !== medicineId)
          : state.cart.map((i) =>
              i.medicine.id === medicineId ? { ...i, quantity } : i
            ),
    })),

  clearCart: () => set({ cart: [], prescriptionFile: null, prescriptionUrl: null, prescriptionId: null, prescriptionUploadId: null }),

  setPrescription: (file, url, uploadId = null) => set({ prescriptionFile: file, prescriptionUrl: url, prescriptionUploadId: uploadId }),

  /**
   * Pre-fill cart from backend prescription items.
   * Each BackendOrderItem that has a medicine_id is converted to a minimal
   * Medicine stub so the existing cart UI renders without changes.
   */
  prefillFromPrescription: (items, prescriptionId) => {
    const cartItems: OrderItem[] = items
      .filter((i) => i.medicine_id !== null && !i.not_in_catalogue)
      .map((i) => ({
        medicine: {
          id: String(i.medicine_id),
          name: i.name,
          genericName: i.generic_name,
          category: 'Prescription',
          price: i.price,
          description: '',
          dosageForm: i.dosage_form,
          manufacturer: '',
          requiresPrescription: true,
          inStock: true,
          quantity: 999,
        },
        quantity: i.quantity,
      }));
    set({ cart: cartItems, prescriptionId });
  },

  setSelectedAddress: (id) => set({ selectedAddressId: id }),

  addAddress: (address) => {
    const id = `addr-${Date.now()}`;
    set((state) => ({
      savedAddresses: [...state.savedAddresses, { ...address, id }],
      selectedAddressId: id,
    }));
  },

  setPaymentMethod: (method) => set({ selectedPaymentMethod: method }),

  cartTotal: () => get().cart.reduce((sum, i) => sum + i.medicine.price * i.quantity, 0),

  cartCount: () => get().cart.reduce((sum, i) => sum + i.quantity, 0),

  hasRxItems: () => get().cart.some((i) => i.medicine.requiresPrescription),
}));
