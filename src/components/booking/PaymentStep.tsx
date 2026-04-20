import { format } from 'date-fns';
import {
  CreditCard, Smartphone, AlertCircle,
  Video, MapPin, Calendar, Clock, User, RefreshCw, ShieldCheck, BadgeCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn, formatTime12Hour } from '@/lib/utils';
import { useBookingStore } from '@/store/bookingStore';

interface PaymentStepProps {
  onRetry: () => void;
}

const paymentMethods = [
  {
    id: 'gcash',
    name: 'GCash',
    icon: Smartphone,
    color: 'bg-primary',
    description: 'Pay via GCash e-wallet',
  },
  {
    id: 'bank',
    name: 'Credit / Debit Card',
    icon: CreditCard,
    color: 'bg-accent',
    description: 'Visa, Mastercard via PayMongo',
  },
] as const;

export default function PaymentStep({ onRetry }: PaymentStepProps) {
  const {
    selectedDoctor,
    consultationType,
    selectedDate,
    selectedTimeSlot,
    consultationFee,
    patientDetails,
    paymentMethod,
    paymentStatus,
    checkoutId,
    checkoutUrl,
    setPaymentMethod,
  } = useBookingStore();

  const serviceFee = 0;
  const totalAmount = consultationFee + serviceFee;
  const feeLow = Math.min(
    selectedDoctor?.consultationFee ?? 0,
    selectedDoctor?.onlineConsultationFee ?? 0
  );
  const feeHigh = Math.max(
    selectedDoctor?.consultationFee ?? 0,
    selectedDoctor?.onlineConsultationFee ?? 0
  );
  const feeRange =
    feeLow === feeHigh
      ? `₱${feeLow.toLocaleString()}`
      : `₱${feeLow.toLocaleString()} – ₱${feeHigh.toLocaleString()}`;

  if (paymentStatus === 'processing') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Preparing Secure Payment
          </h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Redirecting you to PayMongo for checkout. Do not close this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="mb-6 w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Payment Failed
          </h3>
          <p className="text-muted-foreground text-center max-w-sm mb-6">
            Your payment could not be processed. Please try again or use a different payment method.
          </p>
          <Button onClick={onRetry} className="gradient-primary border-0">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── NowServing alignment: clear "You are paying for Dr. X" banner ── */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <BadgeCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            You are paying for an online consultation with{' '}
            <span className="text-primary">{selectedDoctor?.name}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedDoctor?.specialty}
            {' · '}Payment is processed securely via PulseLink (PayMongo).
            Your receipt will be emailed to you after payment.
          </p>
        </div>
      </div>

      {/* Booking Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Booking Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {selectedDoctor?.avatar ? (
              <img
                src={selectedDoctor.avatar}
                alt={selectedDoctor.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold">
                {selectedDoctor?.name?.[0] ?? '?'}
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground">{selectedDoctor?.name}</p>
              <p className="text-sm text-muted-foreground">{selectedDoctor?.specialty}</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-3">
              {consultationType === 'online' ? (
                <Video className="h-4 w-4 text-muted-foreground" />
              ) : (
                <MapPin className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">Consultation Type:</span>
              <span className="font-medium capitalize ml-auto">
                {consultationType === 'online' ? 'Online Video Call' : 'In-Clinic Visit'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Date:</span>
              <span className="font-medium ml-auto">
                {selectedDate && format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Time:</span>
              <span className="font-medium ml-auto">{selectedTimeSlot?.startTime && formatTime12Hour(selectedTimeSlot.startTime)}</span>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Patient:</span>
              <span className="font-medium ml-auto">{patientDetails.fullName}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Select Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = paymentMethod === method.id;
              
              return (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={cn(
                    'p-4 rounded-xl border-2 transition-all text-left flex items-center gap-3',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className={cn('p-2 rounded-lg text-white', method.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      {method.name}
                      {method.id === 'gcash' && (
                        <img src="/gcash.svg" alt="GCash" className="h-5" />
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{method.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Secure payment powered by PayMongo
          </div>
        </CardContent>
      </Card>

      {/* Payment Summary */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg">Payment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Consultation Fee Range</span>
            <span className="font-medium">{feeRange}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Consultation Fee</span>
            <span className="font-medium">₱{consultationFee.toLocaleString()}</span>
          </div>
          
          {serviceFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Service Fee</span>
              <span className="font-medium">₱{serviceFee.toLocaleString()}</span>
            </div>
          )}
          
          <Separator />
          
          <div className="flex justify-between">
            <span className="font-semibold text-foreground">Total Amount</span>
            <span className="text-2xl font-bold text-primary">
              ₱{totalAmount.toLocaleString()}
            </span>
          </div>

          {paymentMethod && (
            <div className="mt-4 p-3 rounded-lg bg-secondary/50 text-sm">
              <p className="text-muted-foreground">
                {paymentMethod === 'bank'
                  ? 'You will be redirected to PayMongo to enter your card details.'
                  : 'You will be redirected to GCash to complete payment.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terms Notice */}
      <p className="text-xs text-center text-muted-foreground">
        By proceeding, you agree to our Terms of Service and Privacy Policy.
        Payment is required upfront to confirm your appointment.
      </p>
    </div>
  );
}

