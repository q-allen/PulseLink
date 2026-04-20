"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Calendar, CalendarDays, MessageCircle, FileText, Clock, ArrowRight, Users, Video, Zap,
  Shield, Stethoscope, Activity, CheckCircle2, TrendingUp, DollarSign, Star,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuthStore } from '@/store';
import { doctorService } from '@/services/doctorService';
import { appointmentService } from '@/services/appointmentService';
import { Appointment, Doctor } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { formatTime12Hour } from '@/lib/utils';

const quickActions = [
  { label: 'Start On-Demand', icon: Zap,         href: '/doctor/queue',         color: 'bg-gradient-to-br from-warning to-warning/70',         desc: 'Accept instant consults' },
  { label: 'View Schedule',   icon: CalendarDays, href: '/doctor/schedule',      color: 'bg-gradient-to-br from-primary to-primary/70',         desc: 'Manage availability' },
  { label: 'View Patients',   icon: Users,        href: '/doctor/patients',      color: 'bg-gradient-to-br from-success to-success/70',         desc: 'Patient history' },
  { label: 'Messages',        icon: MessageCircle,href: '/doctor/messages',      color: 'bg-gradient-to-br from-accent to-accent/70',           desc: 'Chat with patients' },
  { label: 'Appointments',    icon: Calendar,     href: '/doctor/appointments',  color: 'bg-gradient-to-br from-primary/80 to-primary/60',      desc: 'Upcoming slots' },
  { label: 'Prescriptions',   icon: FileText,     href: '/doctor/prescriptions', color: 'bg-gradient-to-br from-destructive/80 to-destructive/60', desc: 'E-prescriptions' },
];

const focusChips = [
  { label: 'General Medicine', icon: Stethoscope, color: 'bg-primary/10 text-primary hover:bg-primary/20' },
  { label: 'Cardiology',       icon: Activity,    color: 'bg-success/10 text-success hover:bg-success/20' },
  { label: 'Dermatology',      icon: Star,        color: 'bg-warning/10 text-warning hover:bg-warning/20' },
];

const getAgeLabel = (dateOfBirth?: string) => {
  if (!dateOfBirth) return '—';
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return '—';
  const diff = Date.now() - dob.getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))).toString();
};

export default function DoctorDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, setUser } = useAuthStore();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [earnings, setEarnings] = useState<{
    consultsToday: number;
    consultsWeek: number;
    revenueToday: number;
    revenueWeek: number;
    pendingPayouts: number;
    pendingAmount: number;
  } | null>(null);

  const doctor = user as Doctor | undefined;
  const doctorId = doctor?.id;

  useEffect(() => {
    const fetchData = async () => {
      if (!doctorId) return;
      const res = await appointmentService.getAppointments({ doctorId });
      if (res.success) setAppointments(res.data);
      const earningsRes = await doctorService.getEarnings();
      if (earningsRes.success) setEarnings(earningsRes.data);
      setIsLoading(false);
    };
    fetchData();
  }, [doctorId]);

  const onDemand = doctor?.isOnDemand ?? false;

  const todayAppointments = useMemo(
    () => appointments.filter((apt) => {
      const date = new Date(apt.date);
      const now = new Date();
      return date.toDateString() === now.toDateString();
    }),
    [appointments]
  );

  const queueWaiting = todayAppointments
    .filter((apt) => apt.status === 'confirmed')
    .sort((a, b) => a.time.localeCompare(b.time));
  const queueInProgress = todayAppointments.find((apt) => apt.status === 'in-progress' || apt.status === 'in_progress');
  const nowServing = queueInProgress || queueWaiting[0] || null;

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((apt) => new Date(apt.date) >= new Date() && !todayAppointments.includes(apt))
        .slice(0, 3),
    [appointments, todayAppointments]
  );

  const consultsToday = todayAppointments.length;
  const patientsSeen = todayAppointments.filter((a) => a.status === 'completed').length;
  const waitingCount = queueWaiting.length;
  const formatPHP = (value?: number) =>
    typeof value === 'number'
      ? `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`
      : '—';

  const handleOnDemand = async (value: boolean) => {
    if (!doctor) return;
    const res = await doctorService.updateOnDemand(doctor.id, value);
    if (res.success) {
      setUser({ ...doctor, isOnDemand: value } as Doctor);
      toast({
        title: value ? 'On-demand enabled' : 'On-demand paused',
        description: value ? 'Patients can consult you instantly.' : 'You are hidden from Consult Now.',
      });
    }
  };

  const handleMarkDone = async () => {
    if (!nowServing) return;
    await appointmentService.completeAppointment(nowServing.id);
    setAppointments((prev) =>
      prev.map((apt) => (apt.id === nowServing.id ? { ...apt, status: 'completed' } : apt))
    );
    toast({ title: 'Consultation completed' });
  };

  const handleNextPatient = () => {
    if (queueWaiting.length > 0) {
      toast({ title: `Calling ${queueWaiting[0].patient?.name}` });
      router.push('/doctor/queue');
    }
  };

  const firstName = doctor?.name?.split(' ')[0] ?? doctor?.name ?? 'Doctor';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const nextPayoutDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString();
  }, []);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-3 sm:p-5 text-primary-foreground shadow-lg"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.3),transparent)]" />
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 sm:gap-3">
          <div>
            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold">
              {greeting}, Dr. {firstName}! 👋
            </h1>
            <p className="text-primary-foreground/90 mt-0.5 sm:mt-1 text-xs sm:text-sm">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5">
              <Switch checked={onDemand} onCheckedChange={handleOnDemand} id="doctor-on-demand" />
              <label htmlFor="doctor-on-demand" className="text-xs text-primary-foreground">
                On-Demand: {onDemand ? 'Available' : 'Paused'}
              </label>
            </div>
            <Badge className={onDemand ? 'bg-success/20 text-success border-success/30' : 'bg-white/10 text-primary-foreground border-white/20'}>
              <span className={`mr-1 h-2 w-2 rounded-full inline-block ${onDemand ? 'bg-success animate-pulse' : 'bg-white/40'}`} />
              {onDemand ? 'Live' : 'Offline'}
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-primary/20 hover:shadow-md transition-shadow">
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Today's Appointments</p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground mt-0.5">{isLoading ? '-' : consultsToday}</p>
                </div>
                <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-success/20 hover:shadow-md transition-shadow">
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Patients Seen</p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground mt-0.5">{isLoading ? '-' : patientsSeen}</p>
                </div>
                <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-warning/20 hover:shadow-md transition-shadow">
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Waiting in Queue</p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground mt-0.5">{isLoading ? '-' : waitingCount}</p>
                </div>
                <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-primary/20 hover:shadow-md transition-shadow">
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Earnings Today</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground mt-0.5">
                    {isLoading ? '-' : formatPHP(earnings?.revenueToday)}
                  </p>
                </div>
                <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-sm sm:text-base font-semibold text-foreground mb-2 sm:mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {quickActions.map((action, index) => (
            <motion.div
              key={action.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link href={action.href}>
                <Card className="hover:shadow-lg transition-all duration-200 hover:scale-105 cursor-pointer h-full group border-border/50">
                  <CardContent className="flex flex-col items-center justify-center p-2 sm:p-3 text-center gap-1.5 sm:gap-2">
                    <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-xl ${action.color} flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow`}>
                      <action.icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-foreground leading-tight">{action.label}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 hidden sm:block">{action.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Now Serving / Queue */}
        <Card className="lg:col-span-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-xl flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Now Serving
            </CardTitle>
            <Link href="/doctor/queue">
              <Button variant="ghost" size="sm" className="text-xs gap-1 hover:bg-primary/10">
                View Queue <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-10 rounded-xl" />
              </div>
            ) : !nowServing ? (
              <div className="text-center py-8 space-y-2">
                <CheckCircle2 className="h-16 w-16 mx-auto text-success/50" />
                <div>
                  <p className="font-semibold text-foreground">No queue right now</p>
                  <p className="text-sm text-muted-foreground mt-1">Turn on on-demand to accept instant consults</p>
                </div>
                <Button className="gap-2 mt-4" onClick={() => handleOnDemand(true)}>
                  <Zap className="h-4 w-4" />
                  Go On-Demand
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-background border-2 border-primary/20 shadow-sm">
                  <Avatar className="h-11 w-11 sm:h-13 sm:w-13 border-2 border-primary/30">
                    <AvatarImage src={nowServing.patient?.avatar} />
                    <AvatarFallback className="text-base sm:text-lg bg-primary/10 text-primary">
                      {nowServing.patient?.name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-base sm:text-lg font-bold text-foreground">{nowServing.patient?.name}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      {formatTime12Hour(nowServing.time)} • {nowServing.type === 'online' ? 'Video Consult' : 'In-Clinic'}
                    </p>
                    <Badge className="mt-2 bg-success/15 text-success border-success/30">
                      {nowServing.status === 'in-progress' || nowServing.status === 'in_progress' ? 'In Progress' : 'Waiting'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <Button className="gap-2 text-xs sm:text-sm" onClick={() => router.push('/doctor/queue')}>
                    <Video className="h-4 w-4" />
                    Start Video
                  </Button>
                  <Button variant="outline" onClick={handleNextPatient} className="gap-2 text-xs sm:text-sm">
                    <Clock className="h-4 w-4" />
                    Next Patient
                  </Button>
                  <Button variant="outline" onClick={handleMarkDone} className="gap-2 text-xs sm:text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Done
                  </Button>
                  <Button variant="outline" onClick={() => router.push(`/doctor/appointments/${nowServing.id}`)} className="gap-2 text-xs sm:text-sm">
                    <FileText className="h-4 w-4" />
                    Details
                  </Button>
                </div>

                {queueWaiting.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground mb-3">Next in Queue</p>
                      <div className="space-y-2">
                        {queueWaiting.slice(0, 3).map((apt, i) => (
                          <div key={apt.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                            <span className="text-xs font-semibold text-muted-foreground w-6">#{i + 1}</span>
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={apt.patient?.avatar} />
                              <AvatarFallback>{apt.patient?.name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{apt.patient?.name}</p>
                              <p className="text-xs text-muted-foreground">{formatTime12Hour(apt.time)}</p>
                            </div>
                            {apt.type === 'online' && <Video className="h-4 w-4 text-primary" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Earnings Summary */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Earnings Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Today</span>
                <span className="text-lg font-bold text-foreground">
                  {isLoading ? '-' : formatPHP(earnings?.revenueToday)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">This Week</span>
                <span className="text-lg font-bold text-foreground">
                  {isLoading ? '-' : formatPHP(earnings?.revenueWeek)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-sm font-semibold text-primary">Pending Payout</span>
                <span className="text-lg font-bold text-primary">
                  {isLoading ? '-' : formatPHP(earnings?.pendingAmount)}
                </span>
              </div>
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground">
              <p>Payouts are processed weekly on Fridays.</p>
              <p className="mt-1">Next payout: {nextPayoutDate}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Appointments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Upcoming Appointments
          </CardTitle>
          <Link href="/doctor/appointments">
            <Button variant="ghost" size="sm" className="text-xs gap-1 hover:bg-primary/10">
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : upcomingAppointments.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No upcoming appointments</p>
              <p className="text-sm mt-1">Stay on-demand to receive new consults</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((apt) => (
                <motion.div
                  key={apt.id}
                  whileHover={{ scale: 1.01 }}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
                  onClick={() => router.push(`/doctor/appointments/${apt.id}`)}
                >
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={apt.patient?.avatar} />
                    <AvatarFallback>{apt.patient?.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{apt.patient?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {getAgeLabel(apt.patient?.dateOfBirth)} yrs • {apt.patient?.gender}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={apt.type === 'online' ? 'default' : 'secondary'} className="gap-1">
                      {apt.type === 'online' && <Video className="h-3 w-3" />}
                      {apt.type === 'online' ? 'Video' : 'In-Clinic'}
                    </Badge>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{apt.date}</p>
                      <p className="text-xs text-muted-foreground">{formatTime12Hour(apt.time)}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Focus Areas */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Focus Areas</h2>
        <div className="flex flex-wrap gap-2">
          {focusChips.map((s) => (
            <motion.div
              key={s.label}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-transparent cursor-pointer transition-colors ${s.color}`}
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground">
        <Shield className="h-5 w-5 text-primary shrink-0" />
        <p>Your consultations, notes, and documents are <span className="font-medium text-foreground">encrypted and private</span>. Only you and your patients can access them.</p>
      </div>
    </div>
  );
}
