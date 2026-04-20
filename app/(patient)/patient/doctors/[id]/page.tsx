"use client";

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format, addDays } from 'date-fns';
import {
  ArrowLeft, Star, MapPin, Clock, Building2, Video,
  GraduationCap, Languages, Award, Calendar, MessageCircle,
  Loader2, CheckCircle, ShieldCheck, Heart, Zap, Phone,
  Stethoscope, Users, ChevronRight, Lock, ExternalLink,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { doctorService } from '@/services/doctorService';
import { chatService } from '@/services/chatService';
import { useAuthStore } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { Doctor, Review } from '@/types';

const hmoColors: Record<string, string> = {
  PhilHealth: 'bg-blue-100 text-blue-700',
  Maxicare: 'bg-purple-100 text-purple-700',
  Medicard: 'bg-green-100 text-green-700',
  MedoCard: 'bg-teal-100 text-teal-700',
  'Pacific Cross': 'bg-orange-100 text-orange-700',
  'EastWest Healthcare': 'bg-red-100 text-red-700',
  'IntelliCare': 'bg-indigo-100 text-indigo-700',
  'Caritas Health Shield': 'bg-pink-100 text-pink-700',
};

export default function DoctorProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const idParam = params?.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [isFavorited, setIsFavorited] = useState(false);

  const {
    data: doctorData,
    isLoading: doctorLoading,
  } = useQuery({
    queryKey: ['doctor', id],
    queryFn: () => doctorService.getDoctorById(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
  const doctor = doctorData?.success ? doctorData.data : null;

  // Real slots from API — refetches whenever selectedDate changes
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const doctorUserId = doctor?.userId ?? id;
  const isLoading = doctorLoading;
  // Reviews come from the doctor detail response (recent_reviews field)
  // to avoid a separate API call with a mismatched ID.
  const reviews: Review[] = (doctor as any)?.recentReviews ?? [];
  const {
    data: slotsData,
    isLoading: slotsLoading,
  } = useQuery({
    queryKey: ['doctor-slots', doctorUserId, dateStr],
    queryFn: () => doctorService.getDoctorSlots(doctorUserId!, dateStr),
    enabled: !!doctorUserId && !!dateStr,
    staleTime: 30_000,
  });
  const slots = slotsData?.data?.slots ?? [];

  const handleStartChat = async () => {
    if (!user || !doctor) return;
    const response = await chatService.createConversation(user.id, doctor.userId ?? doctor.id);
    if (response.success) {
      router.push(`/patient/messages?conversation=${response.data.id}`);
    }
  };

  const handleConsultNow = () => {
    if (!doctor) return;
    // Gate: only allow if doctor has on-demand enabled
    if (!doctor.isOnDemand) {
      toast({ title: 'Doctor is not available for instant consults right now.', variant: 'destructive' });
      return;
    }
    toast({
      title: '🎥 Connecting to doctor…',
      description: `Starting on-demand video consultation with ${doctor.name}`,
    });
    setTimeout(() => router.push(`/patient/book/${doctor.id}?mode=consult_now`), 800);
  };

  const handleBookAppointment = () => {
    if (!doctor) return;
    router.push(`/patient/book/${doctor.id}`);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!doctor) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground">Doctor not found</p>
          <Button variant="link" onClick={() => router.push('/patient/doctors')}>Back to search</Button>
        </div>
      </DashboardLayout>
    );
  }

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : doctor.rating;

  const ratingDist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    pct: reviews.length > 0 ? (reviews.filter((r) => r.rating === star).length / reviews.length) * 100 : 0,
  }));

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-10">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => router.push('/patient/doctors')} className="gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Search
        </Button>

        {/* Hero Header Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-border">
            {/* Top gradient strip */}
            <div className="h-2 bg-gradient-to-r from-primary to-accent" />
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Avatar + Online badge */}
                <div className="relative self-start mx-auto md:mx-0">
                  <Avatar className="h-28 w-28 ring-4 ring-background shadow-lg">
                    <AvatarImage src={doctor.avatar} alt={doctor.name} />
                    <AvatarFallback className="text-3xl gradient-primary text-primary-foreground">
                      {doctor.name.split(' ').map((n) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  {/* Green dot: when doctor has on-demand enabled */}
                  {doctor.isOnDemand && (
                    <span className="absolute bottom-1 right-1 h-5 w-5 bg-success border-2 border-background rounded-full" />
                  )}
                </div>

                {/* Main info */}
                <div className="flex-1 text-center md:text-left space-y-3">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <h1 className="text-2xl font-bold text-foreground">{doctor.name}</h1>
                    {doctor.isVerified && (
                      <Badge className="gap-1 bg-primary/10 text-primary border-primary/20">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </Badge>
                    )}
                    {/* Available Now badge: when doctor has on-demand enabled */}
                    {doctor.isOnDemand && (
                      <Badge className="gap-1 bg-success/10 text-success border-success/20">
                        <Zap className="h-3 w-3" /> Available Now
                      </Badge>
                    )}
                  </div>

                  <p className="text-primary font-semibold text-lg">{doctor.specialty}</p>

                  <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-warning text-warning" />
                      <span className="font-semibold text-foreground">{avgRating.toFixed(1)}</span>
                      <span>({reviews.length || doctor.reviewCount} reviews)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4" />{doctor.hospital}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />{doctor.location}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />{doctor.experience} yrs experience
                    </span>
                  </div>

                  {/* Specialties */}
                  <div className="flex flex-wrap justify-center md:justify-start gap-1.5">
                    {doctor.specialties.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>

                  {/* HMO Badges */}
                  {doctor.hmoAccepted && doctor.hmoAccepted.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">HMO Accepted:</p>
                      <div className="flex flex-wrap justify-center md:justify-start gap-1.5">
                        {doctor.hmoAccepted.map((hmo) => (
                          <span
                            key={hmo}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${hmoColors[hmo] || 'bg-secondary text-secondary-foreground'}`}
                          >
                            {hmo}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Fees + actions */}
                <div className="flex flex-col items-center md:items-end gap-3 flex-shrink-0">
                  {/* Fees */}
                  <div className="text-center md:text-right">
                    <p className="text-xs text-muted-foreground mb-1">Consultation Fee</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 justify-center md:justify-end">
                        <Video className="h-3.5 w-3.5 text-primary" />
                        <span className="text-sm text-muted-foreground">Online:</span>
                        <span className="font-bold text-foreground">₱{doctor.onlineConsultationFee}</span>
                      </div>
                      <div className="flex items-center gap-2 justify-center md:justify-end">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">In-Clinic:</span>
                        <span className="font-bold text-foreground">
                          ₱{doctor.consultationFee}
                          <span className="text-xs font-normal text-muted-foreground ml-1">(pay at clinic)</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator className="hidden md:block w-full" />

                  {/* Dual Action Buttons */}
                  <div className="flex flex-col gap-2 w-full min-w-[180px]">
                    {/* Consult Now: when doctor has on-demand enabled */}
                    {doctor.isOnDemand && (
                      <Button
                        className="gap-2 w-full"
                        onClick={handleConsultNow}
                      >
                        <Zap className="h-4 w-4" />
                        Consult Now
                        <Badge className="ml-auto bg-primary-foreground/20 text-primary-foreground text-xs border-0">~15 min</Badge>
                      </Button>
                    )}
                    {/* Book Appointment: always enabled for verified doctors */}
                    <Button
                      variant={doctor.isOnDemand ? 'outline' : 'default'}
                      className="gap-2 w-full"
                      onClick={handleBookAppointment}
                      disabled={!doctor.isBookable}
                    >
                      <Calendar className="h-4 w-4" />
                      Book Appointment
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="flex-1" onClick={handleStartChat} aria-label="Message doctor">
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-1"
                        onClick={() => setIsFavorited(!isFavorited)}
                        aria-label="Favorite"
                      >
                        <Heart className={`h-4 w-4 ${isFavorited ? 'fill-destructive text-destructive' : ''}`} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="about" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({reviews.length || doctor.reviewCount})</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
          </TabsList>

          {/* ABOUT TAB */}
          <TabsContent value="about" className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader><CardTitle className="text-base">About {doctor.name}</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground leading-relaxed">{doctor.bio}</p>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Experience', value: `${doctor.experience}+ yrs`, icon: Clock },
                      { label: 'Patients', value: '1,200+', icon: Users },
                      { label: 'Rating', value: `${avgRating.toFixed(1)} ★`, icon: Star },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center p-3 bg-secondary/40 rounded-xl">
                        <stat.icon className="h-5 w-5 text-primary mx-auto mb-1" />
                        <p className="font-bold text-foreground">{stat.value}</p>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Education */}
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2 text-sm">
                      <GraduationCap className="h-4 w-4 text-primary" /> Education & Training
                    </h4>
                    <ul className="space-y-2">
                      {doctor.education.map((edu, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                          {edu}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Separator />

                  {/* Languages */}
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2 text-sm">
                      <Languages className="h-4 w-4 text-primary" /> Languages Spoken
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {doctor.languages.map((lang) => (
                        <Badge key={lang} variant="secondary">{lang}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* Clinic Address */}
                  {doctor.clinicAddress && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-primary" /> Clinic Address
                        </h4>
                        <div className="p-3 bg-secondary/40 rounded-xl">
                          <p className="text-sm text-muted-foreground">{doctor.clinicAddress}</p>
                          <p className="text-sm font-medium text-foreground">{doctor.hospital}</p>
                        <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto mt-1 gap-1 text-primary"
                            asChild
                          >
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent([doctor.clinicAddress, doctor.hospital, doctor.location].filter(Boolean).join(', '))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3" /> View on Google Maps
                            </a>
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* SCHEDULE TAB — real slots from API */}
          <TabsContent value="schedule" className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" /> Choose a Date & Time
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Date picker — next 14 days */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">Select Date</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                      {Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)).map((date) => {
                        const isSelected = selectedDate.toDateString() === date.toDateString();
                        return (
                          <button
                            key={date.toISOString()}
                            onClick={() => { setSelectedDate(date); setSelectedTime(''); }}
                            className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border-2 transition-all text-sm w-14 ${
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-card hover:border-primary/50'
                            }`}
                          >
                            <span className="text-xs opacity-70">{format(date, 'EEE')}</span>
                            <span className="text-lg font-bold leading-none my-0.5">{format(date, 'd')}</span>
                            <span className="text-xs opacity-70">{format(date, 'MMM')}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time slots — real data */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">
                      Available Times — {format(selectedDate, 'MMMM d, yyyy')}
                    </p>
                    {slotsLoading ? (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <Skeleton key={i} className="h-9 rounded-lg" />
                        ))}
                      </div>
                    ) : slots.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No available slots for this date.
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {slots.map((slot) => (
                          <button
                            key={slot.time}
                            disabled={!slot.is_available}
                            onClick={() => setSelectedTime(slot.time)}
                            className={`px-2 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                              selectedTime === slot.time
                                ? 'border-primary bg-primary text-primary-foreground'
                                : slot.is_available
                                  ? 'border-border bg-card hover:border-primary/50 text-foreground'
                                  : 'border-border bg-muted text-muted-foreground cursor-not-allowed line-through opacity-50'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">Strikethrough times are already booked</p>
                  </div>

                  {/* CTA */}
                  <div className="pt-2">
                    <Button
                      className="w-full gap-2"
                      size="lg"
                      disabled={!selectedTime || !doctor.isBookable}
                      onClick={handleBookAppointment}
                    >
                      <Calendar className="h-4 w-4" />
                      {selectedTime
                        ? `Book at ${selectedTime} on ${format(selectedDate, 'MMM d')}`
                        : 'Select a time to Book'}
                    </Button>
                    {!doctor.isBookable && (
                      <p className="text-xs text-destructive text-center mt-2">
                        This doctor is currently unavailable for new bookings.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* REVIEWS TAB */}
          <TabsContent value="reviews" className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {reviews.length > 0 && (
                <Card>
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row gap-6 items-center">
                      {/* Overall score */}
                      <div className="text-center flex-shrink-0">
                        <p className="text-5xl font-bold text-foreground">{avgRating.toFixed(1)}</p>
                        <div className="flex items-center justify-center gap-0.5 my-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i < Math.round(avgRating) ? 'fill-warning text-warning' : 'text-muted'}`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{reviews.length} reviews</p>
                      </div>
                      {/* Distribution */}
                      <div className="flex-1 w-full space-y-1.5">
                        {ratingDist.map(({ star, count, pct }) => (
                          <div key={star} className="flex items-center gap-2 text-sm">
                            <span className="w-3 text-muted-foreground text-right">{star}</span>
                            <Star className="h-3 w-3 fill-warning text-warning shrink-0" />
                            <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                              <div className="h-full bg-warning rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-6">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {reviews.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Star className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p>No reviews yet</p>
                  </CardContent>
                </Card>
              ) : (
                reviews.map((review) => (
                  <Card key={review.id}>
                    <CardContent className="p-4 space-y-3">
                      {/* Patient review */}
                      <div className="flex items-start gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={review.patient?.avatar} />
                          <AvatarFallback className="text-xs">{review.patient?.name?.charAt(0) || 'P'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{review.patient?.name || 'Patient'}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(review.createdAt), 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex items-center gap-0.5 my-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-warning text-warning' : 'text-muted'}`} />
                            ))}
                          </div>
                          {review.comment && (
                            <p className="text-sm text-muted-foreground">{review.comment}</p>
                          )}
                        </div>
                      </div>
                      {/* Doctor reply (NowServing pattern: public reply builds trust) */}
                      {review.doctorReply && (
                        <div className="ml-12 pl-3 border-l-2 border-primary/30 space-y-0.5">
                          <p className="text-xs font-medium text-primary flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {doctor?.name ?? 'Doctor'} replied
                            {review.replyAt && (
                              <span className="font-normal text-muted-foreground ml-1">
                                · {format(new Date(review.replyAt), 'MMM d, yyyy')}
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">{review.doctorReply}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </motion.div>
          </TabsContent>

          {/* SERVICES TAB */}
          <TabsContent value="services" className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" /> Services Offered</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {(doctor.services && doctor.services.length > 0
                    ? doctor.services
                    : ['General Consultation', 'Follow-up Consultation', 'Medical Certificate', 'Lab Request', 'Prescription Renewal']
                  ).map((svc) => (
                    <div key={svc} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors">
                      <CheckCircle className="h-4 w-4 text-success shrink-0" />
                      <span className="text-sm font-medium text-foreground">{svc}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Privacy + Security note */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 flex items-start gap-3">
                  <Lock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Your consultation is private & secure</p>
                    <p className="text-xs text-muted-foreground mt-0.5">All video consultations are end-to-end encrypted. Your medical data is strictly confidential.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Book CTA */}
              <div className="flex gap-3">
                {/* Services tab CTAs */}
                {doctor.isOnDemand && (
                  <Button className="flex-1 gap-2" onClick={handleConsultNow}>
                    <Zap className="h-4 w-4" /> Consult Now
                  </Button>
                )}
                <Button variant={doctor.isOnDemand ? 'outline' : 'default'} className="flex-1 gap-2" onClick={handleBookAppointment}>
                  <Calendar className="h-4 w-4" /> Book Appointment
                </Button>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
