"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MapPin, Star, Filter, Video, Building2, X, Loader2,
  Zap, GraduationCap, Shield, ChevronRight, Heart, Baby, Brain,
  Activity, Stethoscope, Eye, Calendar,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { doctorService, DoctorSearchFilters } from '@/services/doctorService';
import { Doctor } from '@/types';
import { PH_CITIES } from '@/data/phCities';

const specialties = [
  'All Specialties', 'General Medicine', 'Family Medicine', 'Internal Medicine',
  'Pediatrics', 'Dermatology', 'Orthopedics', 'OB-Gynecology', 'Cardiology',
  'Neurology', 'Psychiatry', 'ENT', 'Ophthalmology', 'Pulmonology',
];

const locations = ['All Locations', ...PH_CITIES];

const popularSpecialties = [
  { label: 'General Medicine', icon: Stethoscope },
  { label: 'Pediatrics',       icon: Baby        },
  { label: 'OB-Gynecology',    icon: Heart       },
  { label: 'Cardiology',       icon: Activity    },
  { label: 'Psychiatry',       icon: Brain       },
  { label: 'Dermatology',      icon: Eye         },
];

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded-md ${className ?? ''}`} />;
}

// ── Filter sidebar / sheet ────────────────────────────────────────────────────

interface FilterControlsProps {
  specialty: string; setSpecialty: (v: string) => void;
  location: string;  setLocation:  (v: string) => void;
  maxFee: number;    setMaxFee:    (v: number) => void;
  onlyAvailable: boolean; setOnlyAvailable: (v: boolean) => void;
}

function FilterControls({ specialty, setSpecialty, location, setLocation, maxFee, setMaxFee, onlyAvailable, setOnlyAvailable }: FilterControlsProps) {
  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium">Specialty</label>
        <Select value={specialty} onValueChange={setSpecialty}>
          <SelectTrigger><SelectValue placeholder="All Specialties" /></SelectTrigger>
          <SelectContent>
            {specialties.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Location</label>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger><SelectValue placeholder="All Locations" /></SelectTrigger>
          <SelectContent>
            {locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center justify-between">
          Max Fee <span className="text-primary font-semibold">₱{maxFee.toLocaleString()}</span>
        </label>
        <div className="px-1">
          <Slider value={[maxFee]} onValueChange={([v]) => setMaxFee(v)} max={2000} min={0} step={100} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>₱0</span><span>₱2,000</span>
        </div>
      </div>
      <div
        role="checkbox"
        aria-checked={onlyAvailable as boolean}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOnlyAvailable(!onlyAvailable);
          }
        }}
        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${onlyAvailable ? 'border-success/50 bg-success/5' : 'border-border hover:border-success/30'}`}
        onClick={() => setOnlyAvailable(!onlyAvailable)}
      >
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${onlyAvailable ? 'bg-success border-success' : 'border-input'}`}>
          {onlyAvailable && <span className="text-white text-xs font-bold">✓</span>}
        </div>
        <div>
          <p className="text-sm font-medium flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-warning" />Available Now</p>
          <p className="text-xs text-muted-foreground">On-demand video consult</p>
        </div>
      </div>
    </>
  );
}

// ── Doctor Card — "View Profile" + "Book Appointment" + "Consult Now" ──────────

interface DoctorCardProps {
  doctor: Doctor;
  onView: () => void;
  onBook: () => void;
  onConsultNow: () => void;
}

function DoctorCard({ doctor, onView, onBook, onConsultNow }: DoctorCardProps) {
  return (
    <Card className="hover:shadow-md transition-all duration-200 group">
      <CardContent className="p-5">
        <div className="flex gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <Avatar
              className="h-20 w-20 cursor-pointer ring-2 ring-border group-hover:ring-primary/30 transition-all"
              onClick={onView}
            >
              <AvatarImage src={doctor.avatar} alt={doctor.name} />
              <AvatarFallback className="text-lg">
                {doctor.name?.split(' ').map(n => n[0]).join('') ?? '?'}
              </AvatarFallback>
            </Avatar>
            {/* Green dot when doctor has on-demand enabled */}
            {doctor.isOnDemand && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="absolute bottom-1 right-1 w-4 h-4 bg-success rounded-full border-2 border-background cursor-default" />
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Available for On-Demand</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                    onClick={onView}
                  >
                    {doctor.name}
                  </h3>
                  {doctor.isVerified && (
                    <Badge className="bg-success/15 text-success border-success/20 text-xs px-1.5 py-0">
                      <Shield className="h-2.5 w-2.5 mr-0.5" />Verified
                    </Badge>
                  )}
                  {doctor.isOnDemand && (
                    <Badge className="bg-warning/15 text-warning border-warning/20 text-xs px-1.5 py-0">
                      <Zap className="h-2.5 w-2.5 mr-0.5" />Available Now
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-primary font-medium">{doctor.specialty}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3 shrink-0" />{doctor.hospital}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{doctor.location}</span>
                  <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3 shrink-0" />{doctor.experience} yrs exp.</span>
                </div>
                {doctor.hmoAccepted && doctor.hmoAccepted.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {doctor.hmoAccepted.slice(0, 3).map((hmo) => (
                      <Badge key={hmo} variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted/50">{hmo}</Badge>
                    ))}
                    {doctor.hmoAccepted.length > 3 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted/50">
                        +{doctor.hmoAccepted.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Fee + Rating */}
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 justify-end">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                  <span className="font-semibold text-sm">{doctor.rating}</span>
                  <span className="text-xs text-muted-foreground">({doctor.reviewCount})</span>
                </div>
                <div className="text-sm mt-1.5 space-y-1">
                  {doctor.onlineConsultationFee ? (
                    <div className="flex items-center gap-1 justify-end text-muted-foreground">
                      <Video className="h-3 w-3" />
                      <span className="font-semibold text-foreground">₱{doctor.onlineConsultationFee}</span>
                    </div>
                  ) : null}
                  {doctor.consultationFee ? (
                    <div className="flex items-center gap-1 justify-end text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span className="font-semibold text-foreground">₱{doctor.consultationFee}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Actions — three buttons: View Profile + Book Appointment + Consult Now */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={onView}
              >
                View Profile <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={onBook}
                disabled={!doctor.isBookable}
              >
                <Calendar className="h-3.5 w-3.5" />
                {doctor.isBookable ? 'Book Appointment' : 'Unavailable'}
              </Button>
              {/* Consult Now: rendered when doctor has on-demand enabled */}
              {doctor.isOnDemand && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-success hover:bg-success/90 text-white border-0"
                  onClick={onConsultNow}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Consult Now
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function FindDoctorsContent() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [doctors,       setDoctors]       = useState<Doctor[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [searchName,    setSearchName]    = useState(searchParams.get('name') || '');
  const [specialty,     setSpecialty]     = useState(searchParams.get('specialty') || '');
  const [location,      setLocation]      = useState('');
  const [maxFee,        setMaxFee]        = useState<number>(2000);
  const [onlyAvailable, setOnlyAvailable] = useState(searchParams.get('available') === 'true');
  const [consultType,   setConsultType]   = useState<'all' | 'online' | 'in-clinic'>('all');
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);
  const [totalDoctors,  setTotalDoctors]  = useState(0);
  const [suggestions,   setSuggestions]   = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchDoctors = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: DoctorSearchFilters = {};
      if (specialty && specialty !== 'All Specialties') filters.specialty = specialty;
      if (location  && location  !== 'All Locations')   filters.location  = location;
      if (searchName)  filters.name      = searchName;
      if (maxFee < 2000) filters.maxFee  = maxFee;
      if (onlyAvailable) filters.isAvailable = true;

      const response = await doctorService.getDoctors(filters, page, 9);
      if (response.success) {
        let data = response.data;
        
        // Apply client-side filters for consultation type
        if (consultType === 'online')    data = data.filter(d => d.acceptsOnline);
        if (consultType === 'in-clinic') data = data.filter(d => d.acceptsInClinic);
        
        // Apply client-side specialty filter (case-insensitive exact match)
        if (specialty && specialty !== 'All Specialties') {
          data = data.filter(d => d.specialty?.toLowerCase() === specialty.toLowerCase());
        }
        
        // Apply client-side location filter (case-insensitive match)
        if (location && location !== 'All Locations') {
          data = data.filter(d => d.location?.toLowerCase().includes(location.toLowerCase()));
        }
        
        // Apply client-side max fee filter
        if (maxFee < 2000) {
          data = data.filter(d => {
            const onlineFee = d.onlineConsultationFee || Infinity;
            const inPersonFee = d.consultationFee || Infinity;
            return onlineFee <= maxFee || inPersonFee <= maxFee;
          });
        }
        
        // Apply client-side availability filter
        if (onlyAvailable) {
          data = data.filter(d => d.isOnDemand === true);
        }
        
        setDoctors(data);
        setTotalPages(Math.ceil(data.length / 9));
        setTotalDoctors(data.length);
      } else {
        setDoctors([]);
        setTotalPages(1);
        setTotalDoctors(0);
      }
    } catch {
      setDoctors([]);
      setTotalPages(1);
      setTotalDoctors(0);
    } finally {
      setIsLoading(false);
    }
  }, [specialty, location, maxFee, onlyAvailable, consultType, page, searchName]);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchInput = (val: string) => {
    setSearchName(val);
    if (val.length > 1) {
      const filtered = specialties
        .filter(s => s !== 'All Specialties' && s.toLowerCase().includes(val.toLowerCase()))
        .slice(0, 6);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    setPage(1);
    fetchDoctors();
  };

  const applySuggestion = (s: string) => {
    if (specialties.includes(s)) { setSpecialty(s); setSearchName(''); }
    else setSearchName(s);
    setShowSuggestions(false);
    setPage(1);
    setTimeout(fetchDoctors, 100);
  };

  const clearFilters = () => {
    setSearchName(''); setSpecialty(''); setLocation('');
    setMaxFee(2000); setOnlyAvailable(false); setConsultType('all'); setPage(1);
    router.replace(pathname);
  };

  const hasActiveFilters = specialty || location || maxFee < 2000 || onlyAvailable || searchName || consultType !== 'all';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Find a Doctor</h1>
          <p className="text-muted-foreground text-sm">Search by name or specialty — book a scheduled appointment</p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-3">
          <div ref={searchRef} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Input
              placeholder="Search by doctor name or specialty (e.g. Pediatrician)"
              value={searchName}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className="pl-10"
              aria-label="Search doctors"
            />
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  {suggestions.map((s) => (
                    <button
                      key={s} type="button"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary flex items-center gap-2 transition-colors"
                      onClick={() => applySuggestion(s)}
                    >
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />{s}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Button type="submit" className="shrink-0 gap-1.5">
            <Search className="h-4 w-4" />Search
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden shrink-0" aria-label="Open filters">
                <Filter className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-6">
                <FilterControls
                  specialty={specialty} setSpecialty={setSpecialty}
                  location={location}   setLocation={setLocation}
                  maxFee={maxFee}       setMaxFee={setMaxFee}
                  onlyAvailable={onlyAvailable} setOnlyAvailable={setOnlyAvailable}
                />
              </div>
            </SheetContent>
          </Sheet>
        </form>

        {/* Popular Specialties */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Popular Specialties</p>
          <div className="flex flex-wrap gap-2">
            {popularSpecialties.map((s) => {
              const isActive = specialty === s.label;
              return (
                <motion.button
                  key={s.label} whileTap={{ scale: 0.95 }}
                  onClick={() => { setSpecialty(isActive ? '' : s.label); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:border-primary hover:text-primary text-foreground'
                  }`}
                >
                  <s.icon className="h-3.5 w-3.5" />
                  {s.label}
                  {isActive && <X className="h-3 w-3 ml-0.5" />}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-6">
          {/* Desktop Filters Sidebar */}
          <aside className="hidden lg:block w-72 shrink-0">
            <Card className="sticky top-24">
              <CardContent className="p-4 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Filters</h3>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7 text-destructive">
                      <X className="h-3 w-3 mr-1" />Clear All
                    </Button>
                  )}
                </div>
                <FilterControls
                  specialty={specialty} setSpecialty={setSpecialty}
                  location={location}   setLocation={setLocation}
                  maxFee={maxFee}       setMaxFee={setMaxFee}
                  onlyAvailable={onlyAvailable} setOnlyAvailable={setOnlyAvailable}
                />
              </CardContent>
            </Card>
          </aside>

          {/* Results */}
          <div className="flex-1 space-y-4 min-w-0">
            {/* Tabs + Active Filter Chips */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Tabs value={consultType} onValueChange={(v) => setConsultType(v as typeof consultType)} className="shrink-0">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="online" className="gap-1.5">
                    <Video className="h-3.5 w-3.5" />Online
                  </TabsTrigger>
                  <TabsTrigger value="in-clinic" className="gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />In-Clinic
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-1.5">
                  {specialty && specialty !== 'All Specialties' && (
                    <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/10" onClick={() => setSpecialty('')}>
                      {specialty} <X className="h-3 w-3" />
                    </Badge>
                  )}
                  {location && location !== 'All Locations' && (
                    <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setLocation('')}>
                      {location} <X className="h-3 w-3" />
                    </Badge>
                  )}
                  {onlyAvailable && (
                    <Badge className="gap-1 cursor-pointer bg-success/15 text-success border-success/30" onClick={() => setOnlyAvailable(false)}>
                      <Zap className="h-3 w-3" />Available Now <X className="h-3 w-3" />
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}><CardContent className="p-5">
                    <div className="flex gap-4">
                      <Skeleton className="h-20 w-20 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-36" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  </CardContent></Card>
                ))}
              </div>
            ) : doctors.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center space-y-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                    <Search className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">No doctors found</p>
                    <p className="text-sm text-muted-foreground mt-1">Try broadening your search or adjusting your filters.</p>
                  </div>
                  <Button variant="outline" onClick={clearFilters}>Clear All Filters</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{totalDoctors} doctor{totalDoctors !== 1 ? 's' : ''} found</p>
                <div className="grid grid-cols-1 gap-4">
                  {doctors.map((doctor, index) => (
                    <motion.div
                      key={doctor.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                    >
                      <DoctorCard
                        doctor={doctor}
                        onView={() => router.push(`/patient/doctors/${doctor.id}`)}
                        onBook={() => router.push(`/patient/book/${doctor.id}`)}
                        onConsultNow={() => router.push(`/patient/book/${doctor.id}?mode=consult_now`)}
                      />
                    </motion.div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 pt-4">
                    <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <span className="flex items-center px-4 text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                    <Button variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function FindDoctorsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
      <FindDoctorsContent />
    </Suspense>
  );
}
