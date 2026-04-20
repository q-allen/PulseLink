import { Smartphone, CreditCard, Banknote, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePharmacyStore } from '@/store/pharmacyStore';

const methods = [
  {
    id: 'gcash',
    label: 'GCash',
    description: 'Pay via GCash e-wallet',
    icon: Smartphone,
    color: 'bg-primary',
  },
  {
    id: 'bank',
    label: 'Credit / Debit Card',
    description: 'Visa, Mastercard via PayMongo',
    icon: CreditCard,
    color: 'bg-accent',
  },
  {
    id: 'cod',
    label: 'Cash on Delivery',
    description: 'Pay when your order arrives',
    icon: Banknote,
    color: 'bg-success',
  },
] as const;

export default function PaymentMethodSelector() {
  const { selectedPaymentMethod, setPaymentMethod } = usePharmacyStore();

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        {methods.map((m) => {
          const Icon = m.icon;
          const isSelected = selectedPaymentMethod === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setPaymentMethod(m.id)}
              className={cn(
                'p-4 rounded-xl border-2 transition-all text-left flex items-center gap-3',
                isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              )}
            >
              <div className={cn('p-2 rounded-lg text-white shrink-0', m.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground flex items-center gap-2">
                  {m.label}
                  {m.id === 'gcash' && <img src="/gcash.svg" alt="GCash" className="h-5" />}
                </p>
                <p className="text-xs text-muted-foreground">{m.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {selectedPaymentMethod === 'gcash' && (
        <div className="p-3 rounded-lg bg-secondary/50 text-sm text-muted-foreground">
          You will be redirected to GCash to complete payment.
        </div>
      )}
      {selectedPaymentMethod === 'bank' && (
        <div className="p-3 rounded-lg bg-secondary/50 text-sm text-muted-foreground">
          You will be redirected to PayMongo to enter your card details.
        </div>
      )}
      {selectedPaymentMethod === 'cod' && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-sm text-muted-foreground">
          Pay the exact amount in cash when the courier delivers your order.
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Secure payment powered by PayMongo
      </div>
    </div>
  );
}
