import { Pill, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrderItem } from '@/types';
import { usePharmacyStore } from '@/store/pharmacyStore';

interface CartItemProps {
  item: OrderItem;
}

export default function CartItemCard({ item }: CartItemProps) {
  const { updateQuantity, removeFromCart } = usePharmacyStore();
  const subtotal = item.medicine.price * item.quantity;

  return (
    <div className="flex gap-4 p-4 bg-secondary/40 rounded-xl border border-border">
      <div className="h-16 w-16 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
        <Pill className="h-8 w-8 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-medium text-foreground truncate text-sm">{item.medicine.name}</h4>
            <p className="text-xs text-muted-foreground">{item.medicine.dosageForm}</p>
            {item.medicine.requiresPrescription && (
              <Badge variant="outline" className="mt-1 text-xs border-warning text-warning">
                Rx Required
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 hover:text-destructive"
            onClick={() => removeFromCart(item.medicine.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 border border-border rounded-lg overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-none"
              onClick={() => updateQuantity(item.medicine.id, item.quantity - 1)}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-none"
              onClick={() => updateQuantity(item.medicine.id, item.quantity + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">₱{item.medicine.price.toFixed(2)} each</p>
            <p className="text-sm font-bold text-primary">₱{subtotal.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
