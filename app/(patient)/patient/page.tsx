"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Calendar, MessageCircle, FileText, Clock, Search, Star,
  ArrowRight, Users, Pill, Video, Zap,
  Shield, Stethoscope, Baby, Heart,
  Brain, Eye, Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/store';
import { doctorService } from '@/services/doctorService';
import { appointmentService } from '@/services/appointmentService';
import { Doctor, Appointment } from '@/types';
import { cn, formatTime12Hour } from '@/lib/utils';

const quickActions = [
  { label: 'Find Doctor', icon: Search, href: '/patient/doctors', color: 'bg-primary', desc: 'Search by specialty or hospital' },
  { label: 'Consult Now', icon: Zap, href: '/patient/doctors?available=true', color: 'bg-warning', desc: '~15 min wait • On-demand video' },
  { label: 'Appointments', icon: Calendar, href: '/patient/appointments', color: 'bg-accent', desc: 'Manage your bookings' },
  { label: 'Messages', icon: MessageCircle, href: '/patient/messages', color: 'bg-success', desc: 'Chat with doctors & staff' },
  { label: 'My Files', icon: FileText, href: '/patient/records', color: 'bg-primary/70', desc: 'Prescriptions, labs, certs' },
  { label: 'Pharmacy', icon: Pill, href: '/patient/pharmacy', color: 'bg-destructive/80', desc: 'Order medicines online' },
];

const specialtyChips = [
  { label: 'General Medicine', icon: Stethoscope, color: 'bg-primary/10 text-primary hover:bg-primary/20' },
  { label: 'Pediatrics', icon: Baby, color: 'bg-accent/10 text-accent hover:bg-accent/20' },
  { label: 'OB-Gynecology', icon: Heart, color: 'bg-destructive/10 text-destructive hover:bg-destructive/20' },
  { label: 'Cardiology', icon: Activity, color: 'bg-success/10 text-success hover:bg-success/20' },
  { label: 'Psychiatry', icon: Brain, color: 'bg-warning/10 text-warning hover:bg-warning/20' },
  { label: 'Dermatology', icon: Eye, color: 'bg-primary/10 text-primary hover:bg-primary/20' },
];

export default function PatientDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const userId = user?.id;
  const [topDoctors, setTopDoctors] = useState<Doctor[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(!!userId);

  useEffect(() => {
    if (!userId) return;
    const fetchData = async () => {
      const [doctorsRes, appointmentsRes] = await Promise.all([
        doctorService.getTopDoctors(4),
        appointmentService.getAppointments({ patientId: userId, status: 'confirmed' }, 1, 3),
      ]);
      if (doctorsRes.success) setTopDoctors(doctorsRes.data);
      if (appointmentsRes.success) setUpcomingAppointments(appointmentsRes.data);
      setIsLoading(false);
    };
    fetchData();
  }, [userId]);

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl sm:rounded-2xl gradient-primary p-4 sm:p-5 lg:p-6 text-primary-foreground"
        >
          <div className="absolute inset-0 opacity-10 hero-radial" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
                Welcome back, {firstName}! 👋
              </h1>
              <p className="text-primary-foreground/80 mt-1 text-xs sm:text-sm">
                How are you feeling today? Your health, our priority.
              </p>
            </div>
            <Button
              variant="secondary"
              className="gap-2 shrink-0 bg-white/20 text-primary-foreground border-white/30 hover:bg-white/30 text-xs sm:text-sm"
              onClick={() => router.push('/patient/doctors?available=true')}
            >
              <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Consult Now
            </Button>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xs sm:text-sm font-semibold text-muted-foreground mb-2 sm:mb-3 uppercase tracking-wide">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            {quickActions.map((action, index) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={action.href}>
                  <Card className="hover:shadow-md transition-all duration-200 hover:border-primary/30 cursor-pointer h-full group">
                    <CardContent className="flex flex-col items-center justify-center p-3 sm:p-4 text-center gap-1.5 sm:gap-2">
                      <div className={`h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11 rounded-lg sm:rounded-xl ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <action.icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-[11px] sm:text-xs font-semibold text-foreground leading-tight">{action.label}</p>
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 hidden sm:block">{action.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Consult Now Hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-warning/30 bg-warning/5 overflow-hidden">
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-warning/20 flex items-center justify-center shrink-0">
                <Video className="h-6 w-6 sm:h-7 sm:w-7 text-warning" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="font-semibold text-foreground text-sm sm:text-base">Need to see a doctor now?</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Doctors are available for on-demand video consultation — get seen within 15 minutes.</p>
              </div>
              <Button
                className="bg-warning text-warning-foreground hover:bg-warning/90 gap-2 shrink-0 text-xs sm:text-sm"
                onClick={() => router.push('/patient/doctors?available=true')}
              >
                <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Consult Now
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Upcoming Appointments
            </CardTitle>
            <Link href="/patient/appointments">
              <Button variant="ghost" size="sm" className="text-[10px] sm:text-xs gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-secondary/50">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-24" /></div>
                  </div>
                ))}
              </div>
            ) : upcomingAppointments.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No upcoming appointments</p>
                <p className="text-sm mt-1">Book your first consultation to get started.</p>
                <Link href="/patient/doctors">
                  <Button className="mt-4 gap-2" size="sm">
                    <Search className="h-4 w-4" />Find a Doctor
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {upcomingAppointments.map((apt) => (
                  <motion.div
                    key={apt.id}
                    whileHover={{ scale: 1.01 }}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-secondary/50 border border-border hover:border-primary/20 transition-colors"
                  >
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                      <AvatarImage src={apt.doctor?.avatar} />
                      <AvatarFallback>{apt.doctor?.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm sm:text-base">{apt.doctor?.name}</p>
                      <p className="text-xs sm:text-sm text-primary">{apt.doctor?.specialty}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{apt.doctor?.hospital}</p>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1 w-full sm:w-auto">
                      <Badge variant={apt.type === 'online' ? 'default' : 'secondary'} className="text-[10px] sm:text-xs gap-1">
                        {apt.type === 'online' ? <Video className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : null}
                        {apt.type === 'online' ? 'Video' : 'In-Clinic'}
                      </Badge>
                      <div className="text-right">
                        <p className="text-[10px] sm:text-xs font-medium text-foreground">{apt.date}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{formatTime12Hour(apt.time)}</p>
                      </div>
                    </div>
                    {apt.type === 'online' && (
                      <Button size="sm" className="gap-1.5 shrink-0 text-xs" onClick={() => router.push('/patient/appointments')}>
                        <Video className="h-3.5 w-3.5" />Join
                      </Button>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Specialty Quick Search */}
        <div>
          <h2 className="text-xs sm:text-sm font-semibold text-muted-foreground mb-2 sm:mb-3 uppercase tracking-wide">Browse by Specialty</h2>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {specialtyChips.map((s) => (
              <Link key={s.label} href={`/patient/doctors?specialty=${encodeURIComponent(s.label)}`}>
                <motion.div
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className={cn(
                    'flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium border border-transparent cursor-pointer transition-colors',
                    s.color
                  )}
                >
                  <s.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {s.label}
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top Doctors */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Top Doctors
            </CardTitle>
            <Link href="/patient/doctors">
              <Button variant="ghost" size="sm" className="text-[10px] sm:text-xs gap-1">
                See All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {topDoctors.map((doctor, i) => {
                  const doctorName = doctor.name ?? 'Unknown Doctor';
                  const doctorInitial = doctorName.charAt(0) || '?';
                  return (
                    <motion.div
                      key={doctor.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <Link href={`/patient/doctors/${doctor.id}`}>
                        <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-border hover:border-primary/30 hover:bg-secondary/50 transition-all">
                          <div className="relative">
                            <Avatar className="h-12 w-12 sm:h-14 sm:w-14">
                              <AvatarImage src={doctor.avatar} />
                              <AvatarFallback>{doctorInitial}</AvatarFallback>
                            </Avatar>
                            {doctor.isAvailable && (
                              <span className="absolute bottom-0.5 right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-success rounded-full border-2 border-background" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-xs sm:text-sm leading-tight">{doctorName}</p>
                            <p className="text-[10px] sm:text-xs text-primary">{doctor.specialty}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{doctor.hospital}</p>
                            <div className="flex items-center gap-1 mt-0.5 sm:mt-1">
                              <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-warning text-warning" />
                              <span className="text-[10px] sm:text-xs font-medium">{doctor.rating}</span>
                              <span className="text-[10px] sm:text-xs text-muted-foreground">· ₱{doctor.onlineConsultationFee}</span>
                            </div>
                          </div>
                          {doctor.isOnDemand && (
                            <Badge className="shrink-0 bg-success/15 text-success border-success/30 text-[9px] sm:text-[10px]">
                              <Zap className="h-2 w-2 sm:h-2.5 sm:w-2.5 mr-0.5" />Now
                            </Badge>
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Privacy / Security Note */}
        <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-muted/50 border border-border text-xs sm:text-sm text-muted-foreground">
          <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
          <p>All your health data, consultations, and files are <span className="font-medium text-foreground">encrypted and private</span>. Only you and your doctors can access them.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
