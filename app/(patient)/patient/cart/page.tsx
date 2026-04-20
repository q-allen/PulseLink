"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShoppingCart, ArrowLeft, AlertCircle, Truck, Package, MapPin } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import CartItemCard from '@/components/pharmacy/CartItem';
import PrescriptionUpload from '@/components/pharmacy/PrescriptionUpload';
import { usePharmacyStore } from '@/store/pharmacyStore';
import { paymentService } from '@/services/paymentService';

export default function CartPage() {
  const router = useRouter();
  const { cart, cartTotal, cartCount, hasRxItems, prescriptionFile, savedAddresses, selectedAddressId } = usePharmacyStore();

  const subtotal = cartTotal();
  const count = cartCount();
  const rxItems = hasRxItems();
  const canCheckout = !rxItems || !!prescriptionFile;

  // Calculate delivery fee based on selected address province
  const selectedAddr = savedAddresses.find((a) => a.id === selectedAddressId);
  const province = selectedAddr?.province || 'Metro Manila';
  const { fee: deliveryFee, freeThreshold } = paymentService.getDeliveryFee(province, subtotal);
  const grandTotal = subtotal + deliveryFee;

  if (count === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto py-16 text-center space-y-4">
          <div className="h-24 w-24 bg-secondary rounded-full flex items-center justify-center mx-auto">
            <ShoppingCart className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Your cart is empty</h2>
          <p className="text-muted-foreground">Browse medicines from our partner pharmacies to get started.</p>
          <Button asChild>
            <Link href="/patient/pharmacy">Browse Medicines</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/patient/pharmacy')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Shopping Cart</h1>
            <p className="text-muted-foreground">{count} {count === 1 ? 'item' : 'items'}</p>
          </div>
        </div>

        {/* Rx Warning */}
        {rxItems && !prescriptionFile && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-warning/10 border border-warning/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-foreground text-sm mb-2">Prescription Required</p>
                <p className="text-sm text-muted-foreground mb-3">Your cart contains prescription-only medicines. Upload your prescription to proceed.</p>
                <PrescriptionUpload compact />
              </div>
            </div>
          </motion.div>
        )}

        {rxItems && prescriptionFile && (
          <div className="p-3 bg-success/10 border border-success/30 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="text-sm"><p className="font-medium text-success">Prescription attached ✓</p></div>
              <div className="ml-auto"><PrescriptionUpload compact /></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3">
            {cart.map((item) => (
              <motion.div key={item.medicine.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} layout>
                <CartItemCard item={item} />
              </motion.div>
            ))}
            <Button variant="outline" className="gap-2" asChild>
              <Link href="/patient/pharmacy"><ArrowLeft className="h-4 w-4" /> Continue Shopping</Link>
            </Button>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Order Summary</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal ({count} items)</span>
                    <span className="font-medium">₱{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Truck className="h-3 w-3" /> Delivery
                      {province !== 'Metro Manila' && <span className="text-xs">({province})</span>}
                    </span>
                    <span className={deliveryFee === 0 ? 'text-success font-medium' : 'font-medium'}>
                      {deliveryFee === 0 ? 'FREE' : `₱${deliveryFee.toFixed(2)}`}
                    </span>
                  </div>
                  {subtotal < freeThreshold && (
                    <div className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded-lg">
                      Add ₱{(freeThreshold - subtotal).toFixed(2)} more for free delivery
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-primary text-lg">₱{grandTotal.toFixed(2)}</span>
                  </div>

                  <Button className="w-full" size="lg" disabled={!canCheckout} onClick={() => router.push('/patient/checkout')}>
                    Proceed to Checkout
                  </Button>
                  {!canCheckout && (
                    <p className="text-xs text-destructive text-center">Upload prescription to continue</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-secondary/30">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">Delivery Info</span>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1"><Package className="h-3 w-3" /> Metro Manila: 1–3 days</p>
                    <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Provinces: 3–7 days</p>
                    <p className="flex items-center gap-1"><Truck className="h-3 w-3" /> Free delivery on orders ₱{freeThreshold.toLocaleString()}+</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
