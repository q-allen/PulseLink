"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Calendar,
  FileText,
  Clock,
  Shield,
  Smartphone,
  CheckCircle2,
  ArrowRight,
  Activity,
  CreditCard,
  Video,
  UserCheck,
  Wallet,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { doctorService } from '@/services/doctorService';

type SpecialtyCount = {
  id: string;
  name: string;
  count: number;
  isPlaceholder?: boolean;
};

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const features = [
  {
    icon: UserCheck,
    title: 'Licensed PRC Doctors',
    description: 'Consult with verified, PRC-licensed physicians across major specialties.',
  },
  {
    icon: Video,
    title: 'Secure Video Consults',
    description: 'High-quality, private video calls from the comfort of your home.',
  },
  {
    icon: Calendar,
    title: 'Easy Online Booking',
    description: 'Book appointments based on the doctor’s real-time availability.',
  },
  {
    icon: Clock,
    title: 'Real-Time Queue Updates',
    description: 'Track your live queue position and get notified when it’s your turn.',
  },
  {
    icon: FileText,
    title: 'Digital Prescriptions',
    description: 'Receive e-prescriptions and consultation notes instantly after your visit.',
  },
  {
    icon: Wallet,
    title: 'Flexible Payments',
    description: 'Pay securely via GCash, card, or cash directly at the clinic.',
  },
];

const stats = [
  { value: 'PRC', label: 'Licensed Doctors' },
  { value: 'Live', label: 'Queue Updates' },
  { value: 'Video', label: 'Secure Consults' },
  { value: 'eRx', label: 'Digital Prescriptions' },
];

const paymentMethods = [
  { name: 'Cash on Clinic', icon: Wallet },
  { name: 'GCash', icon: Smartphone },
  { name: 'Credit / Debit Card', icon: CreditCard },
];

const bookingSteps = [
  {
    step: 1,
    icon: UserCheck,
    title: 'Create an Account or Log In',
    description: 'Sign up or log in to start booking consultations with licensed doctors.',
  },
  {
    step: 2,
    icon: Users,
    title: 'Browse Doctors',
    description: 'Search and filter doctors by specialty and availability.',
  },
  {
    step: 3,
    icon: Calendar,
    title: 'Book an Appointment',
    description: 'Choose a date and time based on the doctor’s available schedule for online or in-clinic consultation.',
  },
  {
    step: 4,
    icon: Video,
    title: 'Consult with the Doctor',
    description: 'Join a secure video call or visit the clinic on your scheduled time.',
  },
];

export default function LandingPage() {
  const [specialties, setSpecialties] = useState<SpecialtyCount[]>([]);
  const [isSpecialtiesLoading, setIsSpecialtiesLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadSpecialties = async () => {
      setIsSpecialtiesLoading(true);
      const response = await doctorService.getDoctors();
      if (!isActive) return;

      if (!response.success) {
        setSpecialties([]);
        setIsSpecialtiesLoading(false);
        return;
      }

      const counts = new Map<string, number>();
      for (const doctor of response.data ?? []) {
        const isBookable = Boolean(doctor.isBookable || doctor.isVerified);
        if (!isBookable) continue;
        const name = doctor.specialty?.trim();
        if (!name) continue;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }

      const list = Array.from(counts.entries())
        .map(([name, count]) => ({
          id: toSlug(name),
          name,
          count,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

      setSpecialties(list);
      setIsSpecialtiesLoading(false);
    };

    loadSpecialties();

    return () => {
      isActive = false;
    };
  }, []);

  const topSpecialties = specialties.slice(0, 7);
  const placeholderCount = Math.max(0, 7 - topSpecialties.length);
  const displaySpecialties: SpecialtyCount[] = [
    ...topSpecialties,
    ...Array.from({ length: placeholderCount }).map((_, index) => ({
      id: `placeholder-${index + 1}`,
      name: 'More specialties soon',
      count: 0,
      isPlaceholder: true,
    })),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">PulseLink</span>
            </Link>

            <div className="hidden md:flex items-center gap-6">
              <a href="#specialties" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Specialties
              </a>
              <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </a>
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/signin">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="gradient-primary border-0">
                  Sign Up Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-5" />
        <div className="absolute top-1/4 -right-1/4 w-1/2 h-1/2 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-accent/10 rounded-full blur-3xl" />

        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-6rem)]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center lg:text-left"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Fast, secure online doctor consultations in the Philippines</span>
              </motion.div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
                Talk to a Licensed Doctor Online —{' '}
                <span className="text-gradient">According to Their Schedule</span>
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8">
                Easy booking, real-time queue tracking, secure video consultations, and digital prescriptions — all in one telemedicine platform.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/signup">
                  <Button size="lg" className="gradient-primary border-0 text-lg px-8 h-12 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow w-full sm:w-auto">
                    Sign Up Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/signin">
                  <Button size="lg" variant="outline" className="text-lg px-8 h-12 w-full sm:w-auto">
                    Browse Doctors
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-12 pt-8 border-t border-border">
                {stats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    className="text-center"
                  >
                    <div className="text-2xl sm:text-3xl font-bold text-primary">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="relative">
                <div className="absolute inset-0 gradient-primary rounded-3xl transform rotate-3 opacity-20" />
                <img
                  src="/doctor.svg"
                  alt="Doctor with patient"
                  className="relative rounded-3xl shadow-2xl object-cover w-full h-[600px]"
                />

                {/* Floating Cards */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -left-8 top-1/4 bg-card rounded-xl shadow-xl p-4 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Consultation Booked!</div>
                      <div className="text-xs text-muted-foreground">Confirmed • Today</div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="absolute -right-8 bottom-1/4 bg-card rounded-xl shadow-xl p-4 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Queue Position: #2</div>
                      <div className="text-xs text-muted-foreground">Almost your turn!</div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Specialties Section */}
      <section id="specialties" className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Top Specialties for <span className="text-gradient">Online Consultations</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Connect with doctors across the most in-demand specialties available on PulseLink
            </p>
          </motion.div>

          {isSpecialtiesLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
              {Array.from({ length: 7 }).map((_, index) => (
                <Card key={`specialty-skeleton-${index}`} className="animate-pulse">
                  <CardContent className="p-4 text-center">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 mx-auto mb-3" />
                    <div className="h-3 w-24 bg-muted rounded mx-auto mb-2" />
                    <div className="h-3 w-16 bg-muted/70 rounded mx-auto" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : topSpecialties.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
              {displaySpecialties.map((specialty, index) => (
                <motion.div
                  key={specialty.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  {specialty.isPlaceholder ? (
                    <Card className="border-dashed border-border/70">
                      <CardContent className="p-4 text-center">
                        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                          <Activity className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-1">{specialty.name}</h3>
                        <p className="text-xs text-muted-foreground">Available soon</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Link href="/signin">
                      <Card className="hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
                        <CardContent className="p-4 text-center">
                          <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-3">
                            <Activity className="h-6 w-6 text-primary-foreground" />
                          </div>
                          <h3 className="text-sm font-semibold text-foreground mb-1">{specialty.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {specialty.count} {specialty.count === 1 ? 'doctor' : 'doctors'}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              No active specialties yet. Please check back soon.
            </div>
          )}

          <div className="text-center mt-8">
            <Link href="/signin">
              <Button variant="outline" size="lg">
                View All Specialties
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Booking Instructions Section */}
      <section id="how-it-works" className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              How <span className="text-gradient">Online Consultations</span> Work
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Follow these simple steps to consult with a licensed doctor on PulseLink
            </p>
          </motion.div>

          <div className="relative">
            {/* Connection Line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
              {bookingSteps.map((step, index) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="relative"
                >
                  <div className="bg-card rounded-2xl p-6 shadow-md border border-border h-full flex flex-col items-center text-center relative z-10">
                    {/* Step Number Badge */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-md">
                      {step.step}
                    </div>

                    {/* Icon */}
                    <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 mt-2">
                      <step.icon className="h-8 w-8 text-primary-foreground" />
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {step.title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="text-center mt-12">
            <Link href="/signup">
              <Button size="lg" className="gradient-primary border-0 shadow-lg shadow-primary/25">
                Start Your Online Consultation
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Built for Fast and <span className="text-gradient">Trusted Telemedicine</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From licensed doctors to secure video calls and digital prescriptions, everything is designed for online care.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-card rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow border border-border"
              >
                <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Payment Methods Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h3 className="text-lg font-semibold text-foreground mb-2">Accepted Payment Methods</h3>
            <p className="text-muted-foreground">Pay your booking fee easily through any of these options</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {paymentMethods.map((method) => (
              <div key={method.name} className="flex items-center gap-2 px-6 py-3 bg-secondary/50 rounded-lg">
                <method.icon className="h-5 w-5 text-primary" />
                <span className="font-medium">{method.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto px-3 sm:px-4 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-2xl sm:rounded-3xl gradient-hero p-8 sm:p-12 lg:p-16 text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-grid-white/10" />
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary-foreground mb-3 sm:mb-4">
                Ready for Your Online Doctor Consultation?
              </h2>
              <p className="text-sm sm:text-base lg:text-lg text-primary-foreground/80 max-w-2xl mx-auto mb-6 sm:mb-8">
                Join PulseLink to book fast, consult via secure video, and receive digital prescriptions from licensed doctors.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <Link href="/signup">
                  <Button size="lg" variant="secondary" className="text-sm sm:text-base lg:text-lg px-6 sm:px-8 h-11 sm:h-12 w-full sm:w-auto">
                    Sign Up Free
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </Link>
                <Link href="/signin">
                  <Button size="lg" variant="outline" className="text-sm sm:text-base lg:text-lg px-6 sm:px-8 h-11 sm:h-12 border-primary-foreground/60 text-primary-foreground bg-primary-foreground/10 hover:bg-primary-foreground/20 w-full sm:w-auto">
                    <Users className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Browse Doctors
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary/50 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="lg:col-span-2">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
                  <Activity className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">PulseLink</span>
              </Link>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Fast, secure online doctor consultations in the Philippines. Book, consult, and receive digital prescriptions — all in one place.
              </p>
            </div>

            {/* Platform */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Platform</h4>
              <ul className="space-y-2.5">
                {[
                  { label: 'Specialties', href: '#specialties' },
                  { label: 'How It Works', href: '#how-it-works' },
                  { label: 'Features', href: '#features' },
                ].map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Account + Socials */}
            <div className="flex gap-10">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-4">Account</h4>
                <ul className="space-y-2.5">
                  {[
                    { label: 'Sign Up Free', href: '/signup' },
                    { label: 'Sign In', href: '/signin' },
                    { label: 'Browse Doctors', href: '/signin' },
                  ].map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-4">Socials</h4>
                <ul className="space-y-2.5">
                  <li>
                    <a href="mailto:pulselink99@gmail.com" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <img src="/gmail.svg" alt="Gmail" className="h-4 w-4" />
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} PulseLink. All rights reserved.</p>
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Secure &amp; HIPAA-aligned telemedicine</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
