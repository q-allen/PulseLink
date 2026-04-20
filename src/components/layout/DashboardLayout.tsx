"use client";

import { ReactNode, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Home,
  Calendar,
  CalendarDays,
  MessageCircle,
  FileText,
  User,
  Bell,
  LogOut,
  Menu,
  X,
  Search,
  Settings,
  Users,
  Clock,
  Pill,
  Trash2,
  FlaskConical,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAuthStore, useUIStore, useNotificationStore } from '@/store';
import { authService } from '@/services/authService';
import { doctorService } from '@/services/doctorService';
import { notificationService } from '@/services/notificationService';
import { useToast } from '@/hooks/use-toast';
import { UserRole, Doctor } from '@/types';
import { PageLoader } from '@/components/ui/page-loader';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const navItems: Record<Exclude<UserRole, 'admin'>, NavItem[]> = {
  patient: [
    { label: 'Dashboard', href: '/patient', icon: Home },
    { label: 'Find Doctors', href: '/patient/doctors', icon: Search },
    { label: 'Appointments', href: '/patient/appointments', icon: Calendar },
    { label: 'Messages', href: '/patient/messages', icon: MessageCircle },
    { label: 'My Files', href: '/patient/records', icon: FileText },
    { label: 'Pharmacy', href: '/patient/pharmacy', icon: Pill },
  ],
  doctor: [
    { label: 'Dashboard',    href: '/doctor',               icon: Home },
    { label: 'Queue',        href: '/doctor/queue',          icon: Clock },
    { label: 'Appointments', href: '/doctor/appointments',   icon: Calendar },
    { label: 'My Schedule',  href: '/doctor/schedule',       icon: CalendarDays },
    { label: 'Patients',     href: '/doctor/patients',       icon: Users },
    { label: 'Messages',     href: '/doctor/messages',       icon: MessageCircle },
    { label: 'Prescriptions',href: '/doctor/prescriptions',  icon: FileText },
    { label: 'Lab Results',   href: '/doctor/lab-results',    icon: FlaskConical },
    { label: 'Cert Requests', href: '/doctor/certificate-requests', icon: FileText },
    { label: 'Earnings',      href: '/doctor/earnings',       icon: TrendingUp },
  ],
};

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [routeLoading, setRouteLoading] = useState(false);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;
    const t = setTimeout(() => setRouteLoading(true), 0);
    const t2 = setTimeout(() => setRouteLoading(false), 400);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [pathname]);
  const router = useRouter();
  const { toast } = useToast();
  const { user, setUser, logout: logoutStore } = useAuthStore();
  const { sidebarOpen, mobileMenuOpen, setSidebarOpen, setMobileMenuOpen } = useUIStore();
  const { unreadCount, notifications, markAsRead, clearBadge, removeNotification } = useNotificationStore();

  const handleOnDemandToggle = async (value: boolean) => {
    if (!user || user.role !== 'doctor') return;
    const doctor = user as Doctor;
    const res = await doctorService.updateOnDemand(doctor.id, value);
    if (res.success) {
      setUser({ ...doctor, isOnDemand: value } as Doctor);
      toast({
        title: value ? 'On-demand enabled' : 'On-demand paused',
        description: value ? 'Patients can consult you instantly.' : 'You are hidden from Consult Now.',
      });
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) return null;

  const currentNavItems = user.role !== 'admin' ? (navItems[user.role] ?? []) : [];

  const handleLogout = async () => {
    await authService.logout();
    logoutStore();
    toast({
      title: 'Logged out',
      description: 'See you next time!',
    });
    router.push('/');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getNotificationUrl = (n: import('@/types').Notification): string | null => {
    const data = (n.data ?? {}) as Record<string, unknown>;
    const role = user.role;

    // Invitation
    const invitationId = data.invitation_id ?? data.invitationId;
    if (invitationId && role === 'patient') return `/patient/invitations/${invitationId}`;

    switch (n.type) {
      case 'appointment': {
        const id = data.appointment_id ?? data.appointmentId;
        if (id) {
          const isReview = /review|completed|rate/i.test(n.title + ' ' + n.message);
          return `/${role}/appointments/${id}${isReview ? '?review=1' : ''}`;
        }
        return `/${role}/appointments`;
      }
      case 'queue':
        return role === 'doctor' ? '/doctor/queue' : '/patient/appointments';
      case 'message': {
        const convId = data.conversation_id ?? data.conversationId;
        return convId ? `/${role}/messages?conversation=${convId}` : `/${role}/messages`;
      }
      case 'prescription':
        return role === 'patient' ? '/patient/records' : '/doctor/prescriptions';
      case 'lab-result':
        return role === 'patient' ? '/patient/records' : '/doctor/lab-results';
      case 'pharmacy':
        return '/patient/pharmacy?orders=1';
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Desktop */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen bg-card border-r border-border transition-all duration-300 hidden lg:block',
          sidebarOpen ? 'w-64' : 'w-20'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-border">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
                <Activity className="h-6 w-6 text-primary-foreground" />
              </div>
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xl font-bold text-foreground"
                >
                  PulseLink
                </motion.span>
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {currentNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {sidebarOpen && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex-1"
                        >
                          {item.label}
                        </motion.span>
                      )}
                      {sidebarOpen && item.badge && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User Info */}
          <div className="border-t border-border p-4">
            <div className={cn('flex items-center gap-3', !sidebarOpen && 'justify-center')}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatar} />
                <AvatarFallback>{user?.name?.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
              {sidebarOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 20 }}
              className="fixed left-0 top-0 z-50 h-screen w-72 bg-card border-r border-border lg:hidden"
            >
              <div className="flex h-full flex-col">
                <div className="flex h-16 items-center justify-between px-4 border-b border-border">
                  <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
                      <Activity className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <span className="text-xl font-bold text-foreground">PulseLink</span>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <nav className="flex-1 overflow-y-auto py-4">
                  <ul className="space-y-1 px-3">
                    {currentNavItems.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                            )}
                          >
                            <item.icon className="h-5 w-5" />
                            <span className="flex-1">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                <div className="border-t border-border p-4">
                  <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
                    <LogOut className="h-5 w-5" />
                    Logout
                  </Button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={cn('transition-all duration-300', sidebarOpen ? 'lg:ml-64' : 'lg:ml-20')}>
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b border-border bg-card/80 backdrop-blur px-3 sm:px-4 lg:px-6">
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} className="lg:hidden shrink-0">
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-1 sm:gap-2">
            {/* On-Demand Toggle — doctors only */}
            {user.role === 'doctor' && (
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-secondary/60 px-2 sm:px-3 py-1 sm:py-1.5">
                <Switch
                  checked={(user as Doctor).isOnDemand ?? false}
                  onCheckedChange={handleOnDemandToggle}
                  id="header-on-demand"
                />
                <label htmlFor="header-on-demand" className="text-[10px] sm:text-xs font-medium cursor-pointer hidden sm:block">
                  On-Demand
                </label>
                <span className={`h-2 w-2 rounded-full shrink-0 ${
                  (user as Doctor).isOnDemand ? 'bg-success animate-pulse' : 'bg-muted-foreground/50'
                }`} />
              </div>
            )}
            {/* Notifications */}
            <DropdownMenu onOpenChange={(open) => { if (open && unreadCount > 0) { clearBadge(); notificationService.markAllAsRead(''); } }}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative shrink-0">
                  <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] sm:text-xs flex items-center justify-center font-medium">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 sm:w-80 p-0">
                <div className="px-3 py-2 border-b border-border">
                  <span className="text-xs sm:text-sm font-semibold">Notifications</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-4 px-3 text-sm text-muted-foreground text-center">
                      No new notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          'group flex items-start gap-2 px-3 py-2.5 border-b border-border/50 last:border-0 transition-colors cursor-pointer',
                          !n.isRead ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-secondary/50'
                        )}
                        onClick={() => {
                          if (!n.isRead) {
                            markAsRead(n.id);
                            notificationService.markAsRead(n.id);
                          }
                          const url = getNotificationUrl(n);
                          if (url) router.push(url);
                        }}
                      >
                        <span className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', !n.isRead ? 'bg-primary' : 'bg-transparent')} />
                        <div className="flex-1 cursor-pointer min-w-0">
                          <p className={cn('text-xs text-foreground', !n.isRead ? 'font-semibold' : 'font-normal')}>{n.title}</p>
                          <p className="text-xs text-muted-foreground">{n.message}</p>
                        </div>
                        <button
                          type="button"
                          title="Dismiss notification"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-destructive shrink-0 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); removeNotification(n.id); notificationService.deleteNotification(n.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full shrink-0 ring-offset-background hover:ring-2 hover:ring-primary/30 transition-all">
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-semibold">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-0 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3.5 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback className="gradient-primary text-primary-foreground text-sm font-semibold">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground break-words">{user.name}</p>
                    <p className="text-xs text-muted-foreground break-all">{user.email}</p>
                    <span className={cn(
                      'inline-flex items-center mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize',
                      user.role === 'doctor' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    )}>
                      {user.role}
                    </span>
                  </div>
                </div>
                {/* Menu Items */}
                <div className="p-1.5">
                  <DropdownMenuItem onClick={() => router.push(`/${user.role}/profile`)} className="flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm">My Profile</span>
                  </DropdownMenuItem>
                </div>
                <div className="p-1.5 border-t border-border">
                  <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive/10">
                      <LogOut className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-medium">Log out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 relative w-full">
          {routeLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm">
              <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            </div>
          )}
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

