"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, MapPin, CreditCard, ShoppingBag,
  Pill, Check, Shield, Truck, ExternalLink, Clock,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import DeliveryAddressForm from '@/components/checkout/DeliveryAddressForm';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector';
import PrescriptionUpload from '@/components/pharmacy/PrescriptionUpload';
import { usePharmacyStore } from '@/store/pharmacyStore';
import { pharmacyService } from '@/services/pharmacyService';
import { useAuthStore } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 1, label: 'Delivery', icon: MapPin },
  { id: 2, label: 'Payment', icon: CreditCard },
  { id: 3, label: 'Review',  icon: ShoppingBag },
];

const DELIVERY_FEE_METRO    = 99;
const DELIVERY_FEE_PROVINCE = 150;
const FREE_THRESHOLD        = 1500;

function getDeliveryFee(province: string, subtotal: number) {
  if (subtotal >= FREE_THRESHOLD) return 0;
  return province === 'Metro Manila' ? DELIVERY_FEE_METRO : DELIVERY_FEE_PROVINCE;
}

function getMethodLabel(method: string) {
  return { cod: 'Cash on Delivery', gcash: 'GCash', card: 'Credit / Debit Card' }[method] ?? method;
}

interface OrderResult {
  orderRef: string;
  estimatedDelivery: string;
  totalAmount: number;
  paymentMethod: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const {
    cart, cartTotal, cartCount, hasRxItems,
    savedAddresses, selectedAddressId,
    selectedPaymentMethod, clearCart,
    prescriptionFile, prescriptionUploadId, prescriptionId,
  } = usePharmacyStore();

  const [step, setStep]               = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);

  const subtotal     = cartTotal();
  const count        = cartCount();
  const selectedAddr = savedAddresses.find((a) => a.id === selectedAddressId);
  const province     = selectedAddr?.province ?? 'Metro Manila';
  const deliveryFee  = getDeliveryFee(province, subtotal);
  const grandTotal   = subtotal + deliveryFee;

  // Rx gate: block checkout if cart has Rx items but no prescription attached
  const rxBlocked = hasRxItems() && !prescriptionFile && !prescriptionId;

  const handlePlaceOrder = async () => {
    if (!selectedAddr || !user) return;
    if (rxBlocked) {
      toast({ title: 'Prescription required', description: 'Upload your prescription before placing the order.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await pharmacyService.placeOrder({
        patientId:            user.id,
        items:                cart,
        deliveryAddress:      selectedAddr,
        paymentMethod:        selectedPaymentMethod,
        totalAmount:          grandTotal,
        prescriptionUploadId: prescriptionUploadId ?? undefined,
        prescriptionId:       prescriptionId ?? undefined,
      });

      // Online payment — redirect to PayMongo checkout
      if (selectedPaymentMethod !== 'cod' && res.data.checkoutUrl) {
        clearCart();
        window.location.href = res.data.checkoutUrl;
        return;
      }

      // COD — show success screen
      clearCart();
      setOrderResult({
        orderRef:          res.data.orderRef,
        estimatedDelivery: res.data.estimatedDelivery,
        totalAmount:       grandTotal,
        paymentMethod:     selectedPaymentMethod,
      });
      toast({ title: 'Order placed! 🎉', description: `Order ${res.data.orderRef} confirmed.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      toast({ title: 'Order Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (orderResult) {
    const isMetro = province === 'Metro Manila';
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto py-8">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
            <div className="h-20 w-20 rounded-full bg-success/20 flex items-center justify-center mx-auto">
              <Check className="h-10 w-10 text-success" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Order Placed!</h2>
              <p className="text-muted-foreground mt-1">Your medicines are on their way</p>
            </div>

            <Card>
              <CardContent className="p-5 space-y-3 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order Reference</span>
                  <span className="font-bold text-primary font-mono">{orderResult.orderRef}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment</span>
                  <span className="font-medium">{getMethodLabel(orderResult.paymentMethod)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold">₱{orderResult.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Delivery</span>
                  <span className="font-medium">{orderResult.estimatedDelivery}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Area</span>
                  <span className="font-medium">{isMetro ? '1–3 days (Metro Manila)' : '3–7 days (Province)'}</span>
                </div>
              </CardContent>
            </Card>

            {orderResult.paymentMethod === 'cod' && (
              <Card className="border-success/30 bg-success/5">
                <CardContent className="p-4 text-left text-sm space-y-1">
                  <p className="font-medium">💵 Cash on Delivery</p>
                  <p className="text-muted-foreground text-xs">
                    Please prepare ₱{orderResult.totalAmount.toFixed(2)} when the courier arrives.
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              You'll be notified when your order status changes.
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => router.push('/patient')}>
                Dashboard
              </Button>
              <Button className="flex-1 gap-2" onClick={() => router.push('/patient/pharmacy')}>
                <Truck className="h-4 w-4" /> Track Order
              </Button>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  // ── Checkout steps ────────────────────────────────────────────────────────
  const canProceedStep1 = !!selectedAddressId;
  const canProceedStep2 = !!selectedPaymentMethod;
  const canConfirm      = canProceedStep1 && canProceedStep2 && !rxBlocked && count > 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => step === 1 ? router.push('/patient/cart') : setStep(step - 1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Checkout</h1>
            <p className="text-muted-foreground">Step {step} of {STEPS.length}</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center',
                step === s.id ? 'bg-primary text-primary-foreground'
                  : step > s.id ? 'bg-success/20 text-success'
                  : 'bg-secondary text-muted-foreground'
              )}>
                {step > s.id ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="h-0.5 w-4 bg-border mx-1" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Step content */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" /> Delivery Address
                      </CardTitle>
                    </CardHeader>
                    <CardContent><DeliveryAddressForm /></CardContent>
                  </Card>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" /> Payment Method
                      </CardTitle>
                    </CardHeader>
                    <CardContent><PaymentMethodSelector /></CardContent>
                  </Card>

                  {/* Prescription upload — shown on payment step if cart has Rx items */}
                  {hasRxItems() && !prescriptionId && (
                    <Card className={cn('border-2', rxBlocked ? 'border-warning/60' : 'border-success/40')}>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" /> Prescription
                          {rxBlocked && (
                            <Badge variant="outline" className="ml-auto text-xs border-warning text-warning">Required</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground mb-3">
                          Your cart contains prescription-only medicines. Upload a valid prescription to proceed.
                        </p>
                        <PrescriptionUpload />
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4 text-primary" /> Review Order
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Items */}
                      <div className="space-y-2">
                        {cart.map((item) => (
                          <div key={item.medicine.id} className="flex items-center gap-3 p-3 bg-secondary/40 rounded-lg">
                            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                              <Pill className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.medicine.name}</p>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span>{item.medicine.dosageForm} · Qty: {item.quantity}</span>
                                {item.medicine.requiresPrescription && (
                                  <Badge variant="outline" className="text-[10px] border-warning text-warning">Rx</Badge>
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-bold text-primary shrink-0">
                              ₱{(item.medicine.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <Separator />

                      {/* Prescription status */}
                      {hasRxItems() && (
                        <div className={cn(
                          'p-3 rounded-lg text-sm',
                          prescriptionFile ? 'bg-success/10 border border-success/30' : 'bg-warning/10 border border-warning/30'
                        )}>
                          <p className="font-medium">
                            {prescriptionFile ? '✓ Prescription attached' : '⚠ No prescription uploaded'}
                          </p>
                          {prescriptionFile && (
                            <p className="text-xs text-muted-foreground mt-0.5">{prescriptionFile.name}</p>
                          )}
                        </div>
                      )}

                      {/* Delivery address */}
                      {selectedAddr && (
                        <div className="p-3 bg-secondary/40 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Deliver to</p>
                          <p className="text-sm font-medium">{selectedAddr.fullName}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedAddr.houseUnit} {selectedAddr.street}, {selectedAddr.barangay},<br />
                            {selectedAddr.city}, {selectedAddr.province} {selectedAddr.zipCode}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{selectedAddr.mobile}</p>
                        </div>
                      )}

                      {/* Payment method */}
                      <div className="p-3 bg-secondary/40 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Payment</p>
                        <p className="text-sm font-medium">{getMethodLabel(selectedPaymentMethod)}</p>
                        {selectedPaymentMethod !== 'cod' && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            You will be redirected to PayMongo to complete payment.
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <Shield className="h-3.5 w-3.5" />
                        Secure payment via PayMongo
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation buttons */}
            <div className="mt-4 flex gap-3">
              {step < STEPS.length ? (
                <Button
                  className="flex-1 gap-2"
                  onClick={() => setStep(step + 1)}
                  disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  className="flex-1 gap-2"
                  size="lg"
                  onClick={handlePlaceOrder}
                  disabled={isProcessing || !canConfirm}
                >
                  {isProcessing ? (
                    <><div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Processing…</>
                  ) : (
                    <>Place Order · ₱{grandTotal.toFixed(2)}</>
                  )}
                </Button>
              )}
            </div>

            {step === STEPS.length && rxBlocked && (
              <p className="text-xs text-destructive text-center mt-2">
                Upload your prescription on Step 2 to continue.
              </p>
            )}
          </div>

          {/* Order summary sidebar */}
          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-24">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cart.map((item) => (
                  <div key={item.medicine.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate flex-1 mr-2">
                      {item.medicine.name} ×{item.quantity}
                    </span>
                    <span className="font-medium shrink-0">₱{(item.medicine.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₱{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Truck className="h-3 w-3" /> Delivery
                  </span>
                  <span className={deliveryFee === 0 ? 'text-success font-medium' : ''}>
                    {deliveryFee === 0 ? 'FREE' : `₱${deliveryFee.toFixed(2)}`}
                  </span>
                </div>
                {subtotal < FREE_THRESHOLD && (
                  <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded-lg">
                    Add ₱{(FREE_THRESHOLD - subtotal).toFixed(2)} more for free delivery
                  </p>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">₱{grandTotal.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
