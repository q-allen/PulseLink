"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  CreditCard, Pill, Video, Building2, RefreshCw,
  Loader2, Search, X, Receipt, ArrowUpRight,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store';
import { appointmentService } from '@/services/appointmentService';
import { pharmacyService } from '@/services/pharmacyService';
import { useToast } from '@/hooks/use-toast';
import { Appointment } from '@/types';

interface RawOrder {
  id: number;
  order_ref: string;
  total_amount: string;
  status: string;
  payment_method: string;
  payment_status: string;
  created_at: string;
  items: { name: string; quantity: number; price: string }[];
}

const paymentStatusConfig: Record<string, { label: string; className: string }> = {
  paid:      { label: 'Paid',      className: 'bg-success/15 text-success border-success/30' },
  pending:   { label: 'Pending',   className: 'bg-warning/15 text-warning border-warning/30' },
  awaiting:  { label: 'Awaiting',  className: 'bg-warning/15 text-warning border-warning/30' },
  refunded:  { label: 'Refunded',  className: 'bg-muted text-muted-foreground border-border' },
  failed:    { label: 'Failed',    className: 'bg-destructive/15 text-destructive border-destructive/30' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground border-border' },
};

function PaymentBadge({ status }: { status: string }) {
  const cfg = paymentStatusConfig[status] ?? paymentStatusConfig.pending;
  return <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;
}

function AppointmentRow({ apt, index }: { apt: Appointment; index: number }) {
  const router = useRouter();
  const isOnline = apt.type === 'online' || apt.type === 'on_demand';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className="hover:shadow-sm transition-shadow">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              {isOnline
                ? <Video className="h-5 w-5 text-primary" />
                : <Building2 className="h-5 w-5 text-primary" />}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground truncate">
                Consultation — {apt.doctor?.name ?? 'Doctor'}
              </p>
              <p className="text-xs text-muted-foreground">{apt.doctor?.specialty}</p>
              <p className="text-xs text-muted-foreground">
                {apt.date} · {apt.time}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <PaymentBadge status={apt.paymentStatus ?? 'pending'} />
            <div className="text-right">
              <p className="font-bold text-sm text-foreground">
                {apt.fee != null ? `₱${Number(apt.fee).toLocaleString()}` : '—'}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{isOnline ? 'Online' : 'In-Clinic'}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => router.push(`/patient/appointments/${apt.id}`)}
            >
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function OrderRow({ order, index }: { order: RawOrder; index: number }) {
  const itemNames = order.items?.map((i) => i.name).join(', ') ?? '—';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className="hover:shadow-sm transition-shadow">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <Pill className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground truncate">
                Order {order.order_ref}
              </p>
              <p className="text-xs text-muted-foreground truncate">{itemNames}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(order.created_at), 'MMM d, yyyy · h:mm a')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <PaymentBadge status={order.payment_status} />
            <div className="text-right">
              <p className="font-bold text-sm text-foreground">
                ₱{Number(order.total_amount).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4 flex gap-3">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PaymentHistoryPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [aptsRes, ordersRes] = await Promise.all([
        appointmentService.getAppointments({ patientId: user.id }),
        pharmacyService.getOrders(user.id),
      ]);
      if (aptsRes.success) {
        setAppointments(
          aptsRes.data.filter((a) => a.paymentStatus && a.paymentStatus !== 'pending' || a.fee != null)
        );
      }
      if (ordersRes.success) setOrders(ordersRes.data as unknown as RawOrder[]);
    } catch {
      toast({ title: 'Failed to load payment history', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) fetchData(); }, [user]);

  const filteredApts = appointments.filter((a) =>
    !search ||
    a.doctor?.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.doctor?.specialty?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredOrders = orders.filter((o) =>
    !search ||
    o.order_ref.toLowerCase().includes(search.toLowerCase()) ||
    o.items?.some((i) => i.name.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPaid =
    appointments
      .filter((a) => a.paymentStatus === 'paid' && a.fee != null)
      .reduce((s, a) => s + Number(a.fee), 0) +
    orders
      .filter((o) => o.payment_status === 'paid')
      .reduce((s, o) => s + Number(o.total_amount), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Payment History</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Your consultation and pharmacy payment records
            </p>
          </div>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="text-2xl font-bold text-foreground">
                {loading ? <Loader2 className="h-5 w-5 animate-spin inline" /> : `₱${totalPaid.toLocaleString()}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {appointments.filter((a) => a.paymentStatus === 'paid').length} consultations ·{' '}
                {orders.filter((o) => o.payment_status === 'paid').length} pharmacy orders
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by doctor, medicine, or order ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-10"
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">
              All
              <span className="ml-1.5 bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">
                {filteredApts.length + filteredOrders.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="consultations">
              Consultations
              <span className="ml-1.5 bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">
                {filteredApts.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="pharmacy">
              Pharmacy
              <span className="ml-1.5 bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">
                {filteredOrders.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <LoadingSkeleton />
          ) : (
            <>
              <TabsContent value="all" className="space-y-3">
                {filteredApts.length === 0 && filteredOrders.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <Receipt className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="font-medium text-foreground">No payment records found</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {search ? 'Try a different search.' : 'Your payments will appear here after booking.'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {filteredApts.map((apt, i) => <AppointmentRow key={apt.id} apt={apt} index={i} />)}
                    {filteredOrders.map((o, i) => <OrderRow key={o.id} order={o} index={filteredApts.length + i} />)}
                  </>
                )}
              </TabsContent>

              <TabsContent value="consultations" className="space-y-3">
                {filteredApts.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <Video className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="font-medium text-foreground">No consultation payments</p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredApts.map((apt, i) => <AppointmentRow key={apt.id} apt={apt} index={i} />)
                )}
              </TabsContent>

              <TabsContent value="pharmacy" className="space-y-3">
                {filteredOrders.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <Pill className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="font-medium text-foreground">No pharmacy orders</p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredOrders.map((o, i) => <OrderRow key={o.id} order={o} index={i} />)
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
