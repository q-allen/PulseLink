"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, User, CreditCard, CheckCircle, ArrowLeft, ArrowRight,
  Video, Building2, Clock, Star, ChevronLeft, MapPin, ExternalLink, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useBookingStore } from '@/store/bookingStore';
import { doctorService } from '@/services/doctorService';
import { appointmentService } from '@/services/appointmentService';
import { createPaymongoCheckoutSession, retrievePaymongoCheckoutSession } from '@/features/patient/booking/actions';
import { useAuthStore } from '@/store';
import { useToast } from '@/hooks/use-toast';
import ScheduleStep from '@/components/booking/ScheduleStep';
import PatientDetailsStep from '@/components/booking/PatientDetailsStep';
import PaymentStep from '@/components/booking/PaymentStep';
import type { Doctor, TimeSlot } from '@/types';
import { formatTime12Hour } from '@/lib/utils';

const steps = [
  { id: 1, name: 'Schedule',        icon: Calendar    },
  { id: 2, name: 'Patient Details', icon: User        },
  { id: 3, name: 'Payment',         icon: CreditCard  },
  { id: 4, name: 'Confirmation',    icon: CheckCircle },
];

// ── ClinicInfoPanel — shown at step 3 for in-clinic bookings ──────────────────
// NowServing.ph pattern: no online payment for in-clinic; patient pays at clinic.
function ClinicInfoPanel({ doctor, fee }: { doctor: Doctor; fee: number }) {
  const address = [doctor.clinicAddress, doctor.location].filter(Boolean).join(', ');
  const mapsUrl = address
    ? `https://maps.google.com/?q=${encodeURIComponent(address)}`
    : null;

  return (
    <div className="space-y-4">
      <Card className="border-success/30 bg-success/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-success">
            <Building2 className="h-4 w-4" />
            In-Clinic Appointment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{doctor.hospital}</p>
            {address && (
              <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                {address}
              </p>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Get Directions on Google Maps
              </a>
            )}
          </div>

          {/* Payment notice — NowServing pattern: fee paid in person */}
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 space-y-1">
            <p className="text-sm font-semibold text-warning">💳 Payment at Clinic</p>
            <p className="text-sm text-muted-foreground">
              Consultation fee of{' '}
              <span className="font-bold text-foreground">₱{fee.toLocaleString()}</span>{' '}
              is paid directly to the doctor upon arrival. No online payment required.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1 text-xs text-muted-foreground">
            <p>• Please arrive <strong>15 minutes</strong> before your scheduled time.</p>
            <p>• Bring a valid ID and your HMO card (if applicable).</p>
            <p>• You will receive a confirmation notification after booking.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── BookingContent ─────────────────────────────────────────────────────────────

function BookingContent() {
  const params = useParams<{ doctorId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const doctorIdParam = params?.doctorId;
  const doctorId = Array.isArray(doctorIdParam) ? doctorIdParam[0] : doctorIdParam;
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const finalizingRef = useRef(false);
  
  // Validation state for each step
  const [step1Valid, setStep1Valid] = useState(false);
  const [step1Errors, setStep1Errors] = useState<string[]>([]);
  const [step2Valid, setStep2Valid] = useState(false);
  const [step2Errors, setStep2Errors] = useState<string[]>([]);

  const bookingDraftKey = doctorId ? `booking-draft-${doctorId}` : 'booking-draft';
  const checkoutKey    = doctorId ? `booking-checkout-${doctorId}` : 'booking-checkout';
  const mode = searchParams.get('mode'); // 'consult_now' for on-demand
  const suggestedDateParam =
    searchParams.get('suggestedDate') ||
    searchParams.get('followUpDate') ||
    searchParams.get('date');
  const isConsultNow = mode === 'consult_now';

  const {
    currentStep,
    selectedDoctor,
    consultationType,
    selectedDate,
    selectedTimeSlot,
    consultationFee,
    patientDetails,
    paymentMethod,
    paymentStatus,
    appointmentId,
    checkoutId,
    transactionId,
    setDoctor,
    setConsultationType,
    setSchedule,
    setPatientDetails,
    setPaymentMethod,
    nextStep,
    prevStep,
    goToStep,
    setPaymentStatus,
    setTransactionId,
    setAppointmentId,
    setCheckout,
    clearCheckout,
    resetBooking,
  } = useBookingStore();

  useEffect(() => {
    const loadDoctor = async () => {
      if (doctorId) {
        const response = await doctorService.getDoctorById(doctorId);
        if (response.success && response.data) {
          setDoctor(response.data);
          // Auto-configure for Consult Now mode
          if (isConsultNow) {
            setConsultationType('online');
            const today = new Date().toISOString().split('T')[0];
            const now = new Date().toTimeString().split(' ')[0].substring(0, 5);
            setSchedule(today, {
              id: `consult-now-${Date.now()}`,
              date: today,
              startTime: now,
              endTime: now,
              isAvailable: true,
            }, response.data.onlineConsultationFee || 0);
          }
        } else {
          toast({ title: 'Error', description: 'Doctor not found', variant: 'destructive' });
          router.push('/patient/doctors');
        }
      }
      setIsLoading(false);
    };
    loadDoctor();
  }, [doctorId, isConsultNow, setDoctor, setConsultationType, setSchedule, router, toast]);

  // Preselect suggested follow-up date (if provided via invitation link)
  useEffect(() => {
    if (!suggestedDateParam || isConsultNow) return;
    if (!selectedDoctor) return;
    if (selectedDate) return; // keep any existing draft selection
    setSchedule(
      suggestedDateParam,
      null as unknown as TimeSlot,
      0,
    );
  }, [suggestedDateParam, isConsultNow, selectedDoctor, selectedDate, setSchedule]);

  const saveDraftToSession = () => {
    if (!user || !selectedDoctor || !consultationType || !selectedTimeSlot) return;
    const doctorUserId = selectedDoctor.userId ?? selectedDoctor.id;
    const draft = {
      patientId:            user.id,
      doctorId:             doctorUserId,
      date:                 selectedDate,
      time:                 selectedTimeSlot.startTime,
      endTime:              selectedTimeSlot.endTime,
      type:                 isConsultNow ? 'on_demand' : consultationType,
      symptoms:             patientDetails.symptoms,
      patientDetails,
      consultationFee,
      doctorName:           selectedDoctor.name,
      paymentMethod,
      // Patient profile fields
      firstName:            patientDetails.firstName,
      middleName:           patientDetails.middleName,
      lastName:             patientDetails.lastName,
      dateOfBirth:          patientDetails.dateOfBirth,
      email:                patientDetails.email,
      sex:                  patientDetails.sex,
      homeAddress:          patientDetails.homeAddress,
      reasonForConsultation: patientDetails.reasonForConsultation,
    };
    sessionStorage.setItem(bookingDraftKey, JSON.stringify(draft));
  };

  const clearSessionDraft = () => {
    sessionStorage.removeItem(bookingDraftKey);
    sessionStorage.removeItem(checkoutKey);
  };

  // ── Online payment return handler ──────────────────────────────────────────
  const finalizeFromCheckout = useCallback(async () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    setIsFinalizing(true);

    const storedDraft      = sessionStorage.getItem(bookingDraftKey);
    const storedCheckoutId = sessionStorage.getItem(checkoutKey) || checkoutId;
    if (!storedDraft || !storedCheckoutId) {
      finalizingRef.current = false;
      setIsFinalizing(false);
      setPaymentStatus('failed');
      toast({ title: 'Payment Verification Failed', description: 'Missing booking data. Please try again.', variant: 'destructive' });
      return;
    }

    setPaymentStatus('processing');

    try {
      // PayMongo can take 1-3 seconds to update the checkout session status
      // after redirecting back. Retry up to 5 times with a 1.5 s gap before
      // giving up — this prevents false "Payment Pending" errors on fast redirects.
      let checkoutSession: Record<string, unknown> | null = null;
      let isPaid = false;
      const MAX_RETRIES = 5;
      const RETRY_DELAY_MS = 1500;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        checkoutSession = await retrievePaymongoCheckoutSession(storedCheckoutId);
        const attrs = (checkoutSession as { attributes?: Record<string, unknown> })?.attributes ?? {};

        // PayMongo checkout session fields (in priority order):
        //   attributes.payment_status  — "paid" when GCash/bank payment succeeds
        //   attributes.payments[0].attributes.status — "paid" on the payment object
        //   attributes.status          — "active" (session open) or "expired"
        // We must NOT use || short-circuit because an empty-string payment_status
        // would fall through to "active" (session status) which is never "paid".
        const paymentStatus: string = String(attrs.payment_status ?? '').toLowerCase();
        const paymentObjStatus: string = (
          Array.isArray(attrs.payments) && attrs.payments.length > 0
            ? String((attrs.payments[0] as { attributes?: { status?: unknown } })?.attributes?.status ?? '')
            : ''
        ).toLowerCase();

        isPaid =
          paymentStatus === 'paid' ||
          paymentObjStatus === 'paid' ||
          paymentObjStatus === 'succeeded';

        if (isPaid) break;

        // Not paid yet — wait before retrying (except on the last attempt)
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }

      if (!isPaid) {
        setPaymentStatus('failed');
        toast({
          title: 'Payment Not Confirmed',
          description: 'We could not confirm your payment. If you were charged, please contact support with your PayMongo receipt.',
          variant: 'destructive',
        });
        return;
      }

      // Extract the PayMongo payment ID from the checkout session
      const paymongoPaymentId: string =
        ((checkoutSession as { attributes?: { payments?: { id: string }[] } })?.attributes?.payments?.[0]?.id) ?? storedCheckoutId;

      const draft = JSON.parse(storedDraft) as {
        patientId: string; doctorId: string; date: string; time: string;
        endTime?: string; type: 'online' | 'in-clinic'; symptoms?: string;
        patientDetails?: typeof patientDetails; consultationFee?: number;
        paymentMethod?: 'gcash' | 'bank';
        firstName?: string; middleName?: string; lastName?: string;
        dateOfBirth?: string; email?: string; sex?: string;
        homeAddress?: string; reasonForConsultation?: string;
      };

      if (draft.type) setConsultationType(draft.type);
      if (draft.date && draft.time) {
        setSchedule(draft.date, {
          id: `slot-${draft.date}-${draft.time}`,
          date: draft.date,
          startTime: draft.time,
          endTime: draft.endTime || draft.time,
          isAvailable: false,
        }, draft.consultationFee || consultationFee);
      }
      if (draft.patientDetails) setPatientDetails(draft.patientDetails);
      setPaymentMethod(draft.paymentMethod || paymentMethod || 'gcash');

      const appointmentRes = await appointmentService.createAppointment({
        patientId:            draft.patientId,
        doctorId:             draft.doctorId,
        date:                 draft.date,
        time:                 draft.time,
        type:                 draft.type as 'online' | 'in-clinic' | 'on-demand',
        symptoms:             draft.symptoms,
        paymongoPaymentId,
        firstName:            draft.firstName,
        middleName:           draft.middleName,
        lastName:             draft.lastName,
        dateOfBirth:          draft.dateOfBirth,
        email:                draft.email,
        sex:                  draft.sex,
        homeAddress:          draft.homeAddress,
        reasonForConsultation: draft.reasonForConsultation,
      });

      if (!appointmentRes.success) {
        setPaymentStatus('failed');
        toast({ title: 'Booking Failed', description: 'Payment was received but appointment creation failed. Please contact support.', variant: 'destructive' });
        return;
      }

      setAppointmentId(appointmentRes.data.id);
      setTransactionId(storedCheckoutId);
      setPaymentStatus('success');
      setIsFinalizing(false);
      goToStep(4);
      sessionStorage.removeItem(bookingDraftKey);
      sessionStorage.removeItem(checkoutKey);
    } catch (error) {
      setIsFinalizing(false);
      setPaymentStatus('failed');
      toast({ title: 'Payment Verification Failed', description: error instanceof Error ? error.message : 'Unable to verify payment.', variant: 'destructive' });
    }
  }, [
    bookingDraftKey, checkoutId, checkoutKey, consultationFee, paymentMethod,
    goToStep, setConsultationType, setSchedule, setPatientDetails,
    setPaymentMethod, setAppointmentId, setPaymentStatus, setTransactionId, toast,
  ]);

  useEffect(() => {
    const statusParam = searchParams.get('payment_status');
    if (!statusParam) return;
    if (statusParam === 'cancelled' || statusParam === 'failed') {
      setPaymentStatus('failed');
      clearCheckout();
      toast({ title: 'Payment Cancelled', description: 'Payment was cancelled. You can try again.', variant: 'destructive' });
      return;
    }
    if (statusParam === 'success') finalizeFromCheckout();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => { return () => {}; }, []);

  const handleBack = () => {
    if (currentStep === 1) { resetBooking(); router.push('/patient/doctors'); }
    else prevStep();
  };

  // ── In-clinic: no payment, book directly ──────────────────────────────────
  const isInClinic = consultationType === 'in-clinic';

  // Use validation state from child components
  const canProceedFromStep1 = step1Valid;
  const canProceedFromStep2 = step2Valid;
  const canProceedFromStep3 = isInClinic || !!paymentMethod;

  const handleProceed = async () => {
    if (currentStep === 1) {
      if (!canProceedFromStep1) {
        toast({
          title: 'Incomplete Information',
          description: step1Errors[0] || 'Please complete all required fields',
          variant: 'destructive',
        });
        return;
      }
      nextStep();
    } else if (currentStep === 2) {
      if (!canProceedFromStep2) {
        toast({
          title: 'Incomplete Information',
          description: step2Errors[0] || 'Please complete all required fields',
          variant: 'destructive',
        });
        return;
      }
      nextStep();
    } else if (currentStep === 3) {
      if (!canProceedFromStep3) {
        toast({
          title: 'Payment Method Required',
          description: 'Please select a payment method',
          variant: 'destructive',
        });
        return;
      }
      if (isInClinic) await bookInClinic();
      else await processPayment();
    }
  };

  // ── bookInClinic: POST appointment, skip PayMongo entirely ─────────────────
  const bookInClinic = async () => {
    if (!selectedDoctor || !user || !consultationType || !selectedTimeSlot) return;
    setPaymentStatus('processing');
    try {
      const doctorUserId = selectedDoctor.userId ?? selectedDoctor.id;
      const appointmentRes = await appointmentService.createAppointment({
        patientId:            user.id,
        doctorId:             doctorUserId,
        date:                 selectedDate,
        time:                 selectedTimeSlot.startTime,
        type:                 'in-clinic',
        symptoms:             patientDetails.symptoms,
        firstName:            patientDetails.firstName,
        middleName:           patientDetails.middleName,
        lastName:             patientDetails.lastName,
        dateOfBirth:          patientDetails.dateOfBirth,
        email:                patientDetails.email,
        sex:                  patientDetails.sex,
        homeAddress:          patientDetails.homeAddress,
        reasonForConsultation: patientDetails.reasonForConsultation,
      });
      if (!appointmentRes.success) {
        setPaymentStatus('failed');
        toast({ title: 'Booking Failed', description: 'Could not create appointment.', variant: 'destructive' });
        return;
      }
      setAppointmentId(appointmentRes.data.id);
      setPaymentStatus('success');
      clearSessionDraft();
      goToStep(4);
    } catch (error) {
      setPaymentStatus('failed');
      toast({ title: 'Booking Failed', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const processPayment = async () => {
    if (!paymentMethod || !selectedDoctor || !user || !consultationType || !selectedTimeSlot) return;
    setPaymentStatus('processing');
    saveDraftToSession();
    try {
      const origin     = window.location.origin;
      const successUrl = `${origin}/patient/book/${doctorId}?payment_status=success`;
      const cancelUrl  = `${origin}/patient/book/${doctorId}?payment_status=cancelled`;

      const checkout = await createPaymongoCheckoutSession({
        amount:       consultationFee,
        doctorName:   selectedDoctor.name,
        patientName:  patientDetails.fullName || user.name,
        patientEmail: patientDetails.email || user.email,
        patientPhone: patientDetails.contactNumber,
        method:       paymentMethod,
        successUrl,
        cancelUrl,
        metadata: {
          doctorId:        selectedDoctor.userId ?? selectedDoctor.id,
          patientId:       user.id,
          consultationType,
          date:            selectedDate,
          time:            selectedTimeSlot.startTime,
          bookedForName:   patientDetails.isForSelf ? '' : patientDetails.fullName,
        },
      });

      setCheckout({ checkoutId: checkout.checkoutId, checkoutUrl: checkout.checkoutUrl });
      sessionStorage.setItem(checkoutKey, checkout.checkoutId);

      // Redirect the current tab for both gcash and card so that sessionStorage
      // is preserved when PayMongo redirects back to the success URL.
      window.location.href = checkout.checkoutUrl;
    } catch (error) {
      setPaymentStatus('failed');
      toast({ title: 'Payment Failed', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const handleStep1ValidationChange = useCallback((isValid: boolean, errors: string[]) => {
    setStep1Valid(isValid);
    setStep1Errors(errors);
  }, []);

  const handleStep2ValidationChange = useCallback((isValid: boolean, errors: string[]) => {
    setStep2Valid(isValid);
    setStep2Errors(errors);
  }, []);

  const handleRetryPayment = () => { setPaymentStatus('idle'); clearCheckout(); };
  const handleViewAppointment = () => { resetBooking(); router.push('/patient/appointments'); };
  const handleBookAnother     = () => { resetBooking(); router.push('/patient/doctors'); };

  if (isFinalizing) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-primary" />
          <p className="text-lg font-semibold text-foreground">Confirming your payment…</p>
          <p className="text-sm text-muted-foreground">Please wait, do not close this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!selectedDoctor) return null;

  // Clinic address for confirmation step
  const clinicAddress = [selectedDoctor.clinicAddress, selectedDoctor.location].filter(Boolean).join(', ');
  const clinicMapsUrl = clinicAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(clinicAddress)}`
    : null;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">
                {isConsultNow ? 'Consult Now' : 'Book Appointment'}
              </h1>
              {isConsultNow && (
                <Badge className="bg-success/15 text-success border-success/30 gap-1">
                  <Zap className="h-3 w-3" /> On-Demand
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {isConsultNow
                ? 'Fast-track consultation — connect with your doctor in minutes'
                : 'Complete the steps below to book your consultation'}
            </p>
          </div>
        </div>

        {/* Doctor Info Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-4 p-4">
            {selectedDoctor.avatar ? (
              <img src={selectedDoctor.avatar} alt={selectedDoctor.name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold text-xl">
                {selectedDoctor.name?.[0] ?? '?'}
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{selectedDoctor.name}</h3>
              <p className="text-sm text-muted-foreground">{selectedDoctor.specialty}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  <span className="text-sm font-medium">{selectedDoctor.rating}</span>
                </div>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{selectedDoctor.hospital}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stepper */}
        <div className="relative">
          <Progress value={(currentStep / steps.length) * 100} className="h-2 mb-4" />
          <div className="flex justify-between">
            {steps.map((step) => {
              const isActive    = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const Icon        = step.icon;
              return (
                <div key={step.id} className="flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isActive    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                    : isCompleted ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                    {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    {/* Rename step 3 label for in-clinic */}
                    {step.id === 3 && isInClinic ? 'Clinic Info' : step.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentStep === 1 && (
              <ScheduleStep
                onValidationChange={handleStep1ValidationChange}
              />
            )}
            {currentStep === 2 && (
              <PatientDetailsStep
                onValidationChange={handleStep2ValidationChange}
              />
            )}
            {currentStep === 3 && (
              isInClinic
                ? <ClinicInfoPanel doctor={selectedDoctor} fee={selectedDoctor.consultationFee ?? 0} />
                : <PaymentStep onRetry={handleRetryPayment} />
            )}
            {currentStep === 4 && (
              <Card>
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Clock className="h-10 w-10 text-amber-600" />
                  </div>
                  <CardTitle className="text-xl text-amber-700">Your Booking is Under Review</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please wait for your doctor&apos;s response to confirm the booking.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Appointment Details */}
                  <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold text-sm text-foreground mb-2">Appointment Details</h3>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reference Number</span>
                      <span className="font-mono font-semibold text-primary">
                        APT-{appointmentId?.slice(-8).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Doctor</span>
                      <span className="font-medium">{selectedDoctor.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Consultation Type</span>
                      <span className="font-medium capitalize flex items-center gap-1">
                        {consultationType === 'online'
                          ? <><Video className="h-4 w-4" /> Online</>
                          : <><Building2 className="h-4 w-4" /> In-Clinic</>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date & Time</span>
                      <span className="font-medium">{selectedDate} at {selectedTimeSlot?.startTime && formatTime12Hour(selectedTimeSlot.startTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-medium text-warning">Pending confirmation</span>
                    </div>
                    {!isInClinic && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment Reference</span>
                        <span className="font-mono text-xs">{transactionId || 'PayMongo'}</span>
                      </div>
                    )}
                  </div>

                  {/* Patient Details */}
                  <div className="bg-primary/5 rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <User className="h-4 w-4" /> Patient Information
                    </h3>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{patientDetails.fullName}</span>
                    </div>
                    {!patientDetails.isForSelf && patientDetails.bookedForRelationship && patientDetails.bookedForRelationship !== 'self' && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Relationship</span>
                        <span className="font-medium capitalize">{patientDetails.bookedForRelationship}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Age</span>
                      <span className="font-medium">{patientDetails.age || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sex</span>
                      <span className="font-medium capitalize">{patientDetails.sex}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium text-sm">{patientDetails.email}</span>
                    </div>
                  </div>

                  {/* In-clinic: clinic address + map link + pay-at-clinic notice */}
                  {isInClinic && (
                    <div className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-2">
                      <p className="text-sm font-semibold text-success flex items-center gap-1.5">
                        <Building2 className="h-4 w-4" /> {selectedDoctor.hospital}
                      </p>
                      {clinicAddress && (
                        <p className="text-xs text-muted-foreground flex items-start gap-1">
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          {clinicAddress}
                        </p>
                      )}
                      <p className="text-xs font-semibold text-warning">
                        💳 Pay the doctor in person at the clinic upon arrival.
                      </p>
                      {clinicMapsUrl && (
                        <a
                          href={clinicMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Get Directions on Google Maps
                        </a>
                      )}
                    </div>
                  )}

                  <div className="text-center text-sm text-muted-foreground space-y-1">
                    {!isInClinic && (
                      <p className="text-success font-medium">
                        Payment successfully received. Your booking is now under review.
                      </p>
                    )}
                    <p>A confirmation email with your payment receipt has been sent to your email address.</p>
                    <p>You will receive another email once your doctor confirms the booking.</p>
                    {consultationType === 'online'
                      ? <p>Video link will be ready about 15 minutes before your appointment.</p>
                      : <p>Please arrive 15 minutes before your scheduled time.</p>}
                    {!isInClinic && <p className="text-xs">Secure payment powered by PayMongo.</p>}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button variant="outline" className="flex-1" onClick={handleBookAnother}>Book Another</Button>
                    <Button className="flex-1 gradient-primary border-0" onClick={handleViewAppointment}>
                      View in Appointments
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        {currentStep < 4 && (
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleProceed}
              disabled={
                (currentStep === 1 && !canProceedFromStep1) ||
                (currentStep === 2 && !canProceedFromStep2) ||
                (currentStep === 3 && (!canProceedFromStep3 || paymentStatus === 'processing' ||
                  (!isInClinic && paymentStatus === 'awaiting_payment')))
              }
              className="gradient-primary border-0"
            >
              {currentStep === 3 ? (
                paymentStatus === 'processing' ? <>Processing…</> :
                isInClinic                     ? <>Confirm Booking</> :
                paymentStatus === 'awaiting_payment' ? <>Awaiting payment…</> :
                <>Pay ₱{consultationFee.toLocaleString()}</>
              ) : (
                <>Continue <ArrowRight className="h-4 w-4 ml-2" /></>
              )}
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function BookingPage() {
  return (
    <Suspense>
      <BookingContent />
    </Suspense>
  );
}
