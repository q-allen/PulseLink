"use client";

import { useEffect, useMemo, useState } from 'react'; // useState kept for appointments/loading
import { isToday, isTomorrow, format } from 'date-fns';
import { Calendar, Clock, MessageCircle, Users, Video, Activity, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Appointment, Doctor } from '@/types';
import { appointmentService } from '@/services/appointmentService';
import { doctorService } from '@/services/doctorService';
import { useAuthStore } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import VerificationBanner from '@/components/doctor/VerificationBanner';

export default function DoctorDashboard() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { toast } = useToast();
  const doctor = user as Doctor;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const onDemand = doctor?.isOnDemand ?? false;

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!doctor) return;
      setLoading(true);
      const res = await appointmentService.getAppointments({ doctorId: doctor.userId ?? doctor.id });
      if (res.success) setAppointments(res.data);
      setLoading(false);
    };
    fetchAppointments();
  }, [doctor?.id, doctor?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayAppointments = useMemo(
    () => appointments.filter((apt) => isToday(new Date(apt.date))),
    [appointments]
  );

  const queueWaiting = todayAppointments
    .filter((apt) => apt.status === 'confirmed')
    .sort((a, b) => a.time.localeCompare(b.time));
  const queueInProgress = todayAppointments.find((apt) => apt.status === 'in-progress');
  const nowServing = queueInProgress || queueWaiting[0] || null;

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((apt) => new Date(apt.date) >= new Date() && !isToday(new Date(apt.date)))
        .slice(0, 4),
    [appointments]
  );

  const totalEarnings = todayAppointments
    .filter((apt) => apt.status === 'completed')
    .reduce((sum, apt) => sum + (apt.fee || doctor?.consultationFee || 0), 0);

  const isVerified = doctor?.isVerified ?? false;

  const handleOnDemand = async (value: boolean) => {
    if (!doctor || !isVerified) return;
    const res = await doctorService.updateOnDemand(doctor.id, value);
    if (res.success) {
      setUser({ ...doctor, isOnDemand: value } as Doctor);
      toast({
        title: value ? 'On-demand enabled' : 'On-demand paused',
        description: value ? 'Patients can consult you instantly.' : 'You are hidden from Consult Now.',
      });
    }
  };

  const dateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Verification / completion banner */}
      <VerificationBanner doctor={doctor} />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, Dr. {doctor?.name?.split(' ')[1] ?? doctor?.name}
          </h1>
          <p className="text-muted-foreground text-sm">{doctor?.specialty} • {doctor?.hospital}</p>
        </div>
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center gap-2 ${!isVerified ? 'opacity-40 cursor-not-allowed' : ''}`}>
                <Switch
                  checked={onDemand}
                  onCheckedChange={handleOnDemand}
                  id="on-demand-toggle"
                  disabled={!isVerified}
                />
                <label
                  htmlFor="on-demand-toggle"
                  className={`text-sm text-muted-foreground ${!isVerified ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {onDemand ? 'On-Demand: On' : 'On-Demand: Off'}
                </label>
              </div>
            </TooltipTrigger>
            {!isVerified && (
              <TooltipContent>
                <p>Available after verification</p>
              </TooltipContent>
            )}
          </Tooltip>
          <Badge className={onDemand && isVerified ? 'bg-success/15 text-success border-success/30' : 'bg-muted text-muted-foreground'}>
            <span className={`mr-1 h-2 w-2 rounded-full ${onDemand && isVerified ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
            {onDemand && isVerified ? 'Available Now' : 'Offline'}
          </Badge>
        </div>
      </div>

      <Card className={onDemand && isVerified ? 'border-success/30 bg-success/5' : 'border-border'}>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${onDemand && isVerified ? 'bg-success/20' : 'bg-muted'}`}>
              <Zap className={`h-6 w-6 ${onDemand && isVerified ? 'text-success' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {!isVerified
                  ? 'On-demand unavailable until verified'
                  : onDemand ? 'On-demand consultations are live' : 'On-demand is paused'}
              </p>
              <p className="text-sm text-muted-foreground">
                {!isVerified
                  ? 'Your account is pending admin verification.'
                  : onDemand
                    ? 'Patients can consult you instantly from the app.'
                    : 'Turn on to accept instant video consultations.'}
              </p>
            </div>
          </div>
          <div className="sm:ml-auto flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    variant={onDemand && isVerified ? 'outline' : 'default'}
                    onClick={() => handleOnDemand(!onDemand)}
                    disabled={!isVerified}
                  >
                    {onDemand && isVerified ? 'Pause On-Demand' : 'Go On-Demand'}
                  </Button>
                </span>
              </TooltipTrigger>
              {!isVerified && (
                <TooltipContent><p>Available after verification</p></TooltipContent>
              )}
            </Tooltip>
            <Button size="sm" variant="ghost" onClick={() => router.push('/doctor/queue')}>
              View Queue
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Now Serving</CardTitle>
            <Button variant="outline" size="sm" onClick={() => router.push('/doctor/queue')}>
              Manage Queue
            </Button>
          </CardHeader>
          <CardContent>
            {!nowServing ? (
              <div className="p-6 rounded-lg bg-background border border-border text-sm text-muted-foreground">
                No patient is currently being served.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={nowServing.patient?.avatar} />
                  <AvatarFallback>{nowServing.patient?.name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-xl font-semibold">{nowServing.patient?.name}</p>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{nowServing.time}</span>
                    <span className="flex items-center gap-1">{nowServing.type === 'online' ? <Video className="h-4 w-4" /> : <Users className="h-4 w-4" />}{nowServing.type === 'online' ? 'Video' : 'In-Clinic'}</span>
                    <Badge className="bg-success/15 text-success border-success/30">
                      {nowServing.status === 'in-progress' ? 'In Progress' : 'Waiting'}
                    </Badge>
                  </div>
                </div>
                <Button className="gap-2" onClick={() => router.push('/doctor/queue')}>
                  <Video className="h-4 w-4" />
                  Start Video
                </Button>
              </div>
            )}
            <div className="mt-4 space-y-2">
              {queueWaiting.slice(0, 4).map((apt, index) => (
                <div key={apt.id} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                  <span className="text-xs text-muted-foreground w-8">#{index + 1}</span>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={apt.patient?.avatar} />
                    <AvatarFallback>{apt.patient?.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{apt.patient?.name}</p>
                    <p className="text-xs text-muted-foreground">{apt.time} • {apt.type === 'online' ? 'Video' : 'Clinic'}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? '-' : todayAppointments.length}</p>
                <p className="text-sm text-muted-foreground">Consults Today</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-success/10 text-success">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? '-' : todayAppointments.filter((a) => a.status === 'completed').length}</p>
                <p className="text-sm text-muted-foreground">Patients Seen</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/10 text-accent">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? '-' : upcomingAppointments.length}</p>
                <p className="text-sm text-muted-foreground">Upcoming</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-warning/10 text-warning">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">₱{loading ? '-' : totalEarnings.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Earnings Today</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Button variant="outline" className="gap-2" onClick={() => router.push('/doctor/appointments')}>
          <Calendar className="h-4 w-4" />
          View Appointments
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => router.push('/doctor/messages')}>
          <MessageCircle className="h-4 w-4" />
          Open Messages
        </Button>
        <Button className="gap-2" onClick={() => router.push('/doctor/queue')}>
          <Clock className="h-4 w-4" />
          Manage Queue
        </Button>
      </div>
    </div>
    </TooltipProvider>
  );
}
