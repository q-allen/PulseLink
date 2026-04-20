import { useEffect, useState, useCallback } from 'react';
import {
  format, addDays, startOfToday, isToday, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
  isBefore, addMonths, subMonths, parseISO,
} from 'date-fns';
import { Video, Building2, Clock, Calendar as CalendarIcon, Info, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, formatTime12Hour } from '@/lib/utils';
import { useBookingStore } from '@/store/bookingStore';
import { appointmentService } from '@/services/appointmentService';
import { useToast } from '@/hooks/use-toast';
import { TimeSlot } from '@/types';

// Maps backend weekly_schedule keys to JS getDay() numbers
const DAY_NAME_TO_NUM: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ScheduleStepProps {
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
}

export default function ScheduleStep({ onValidationChange }: ScheduleStepProps) {
  const {
    selectedDoctor,
    consultationType,
    selectedDate,
    selectedTimeSlot,
    consultationFee,
    setConsultationType,
    setSchedule,
  } = useBookingStore();

  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(startOfToday()));
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { toast } = useToast();

  // Detect on-demand mode from URL
  const isConsultNow = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'consult_now';

  // Validate current step and notify parent
  useEffect(() => {
    const errors: string[] = [];
    
    if (isConsultNow) {
      // On-demand mode is always valid (auto-filled)
      setValidationErrors([]);
      onValidationChange?.(true, []);
      return;
    }
    
    if (!consultationType) {
      errors.push('Please select a consultation type (Online or In-Clinic)');
    }
    if (!selectedDate) {
      errors.push('Please select an appointment date');
    }
    if (!selectedTimeSlot) {
      errors.push('Please select an appointment time');
    }
    
    setValidationErrors(errors);
    onValidationChange?.(errors.length === 0, errors);
  }, [consultationType, selectedDate, selectedTimeSlot, isConsultNow]);

  // Derive which consultation types this doctor actually offers.
  // If the doctor has a weekly schedule but no explicit fee flags, default both to true
  // so the patient isn't blocked from booking a doctor who clearly has availability.
  const hasWeeklySchedule = Object.keys(selectedDoctor?.weeklySchedule ?? {}).length > 0;
  
  // Check consultation types available for the selected date
  const getConsultationTypesForDate = (date: string | null) => {
    if (!date || !selectedDoctor?.weeklySchedule) {
      return {
        acceptsOnline: selectedDoctor?.acceptsOnline ?? hasWeeklySchedule,
        acceptsInClinic: selectedDoctor?.acceptsInClinic ?? hasWeeklySchedule,
      };
    }
    
    const dateObj = new Date(date + 'T00:00:00');
    const dayNum = dateObj.getDay();
    const dayName = Object.keys(DAY_NAME_TO_NUM).find(key => DAY_NAME_TO_NUM[key] === dayNum);
    
    if (dayName && selectedDoctor.weeklySchedule[dayName]) {
      const scheduleForDay = selectedDoctor.weeklySchedule[dayName];
      const consultTypes = scheduleForDay.consultation_types;
      
      if (consultTypes === 'online') {
        return { acceptsOnline: true, acceptsInClinic: false };
      } else if (consultTypes === 'in_clinic') {
        return { acceptsOnline: false, acceptsInClinic: true };
      } else if (consultTypes === 'both') {
        return { acceptsOnline: true, acceptsInClinic: true };
      }
    }
    
    return {
      acceptsOnline: selectedDoctor?.acceptsOnline ?? hasWeeklySchedule,
      acceptsInClinic: selectedDoctor?.acceptsInClinic ?? hasWeeklySchedule,
    };
  };
  
  const { acceptsOnline, acceptsInClinic } = getConsultationTypesForDate(selectedDate);

  // Keep calendar month in sync with pre-selected dates (e.g., follow-up invitations)
  useEffect(() => {
    if (!selectedDate) return;
    const dt = parseISO(selectedDate);
    if (Number.isNaN(dt.getTime())) return;
    if (!isSameMonth(dt, calendarMonth)) {
      setCalendarMonth(startOfMonth(dt));
    }
  }, [selectedDate, calendarMonth]);

  // Auto-select the only available type when there is exactly one option
  useEffect(() => {
    if (!consultationType) {
      if (acceptsOnline && !acceptsInClinic)  setConsultationType('online');
      if (acceptsInClinic && !acceptsOnline)  setConsultationType('in-clinic');
    }
  }, [acceptsOnline, acceptsInClinic, consultationType, setConsultationType]);

  // Build the set of day-of-week numbers the doctor works
  const schedule = selectedDoctor?.weeklySchedule ?? {};
  const activeDayNums = new Set(
    Object.keys(schedule)
      .map((d) => DAY_NAME_TO_NUM[d.toLowerCase()])
      .filter((n) => n !== undefined)
  );
  const hasSchedule = activeDayNums.size > 0;

  const today = startOfToday();
  const maxDate = addDays(today, 60);

  // Returns true if a given date is a valid bookable day
  const isBookableDate = (date: Date) =>
    !isBefore(date, today) &&
    !isBefore(maxDate, date) &&
    (!hasSchedule || activeDayNums.has(date.getDay()));

  // Build calendar grid for the current month view
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 }),
    end:   endOfWeek(endOfMonth(calendarMonth),     { weekStartsOn: 0 }),
  });

  const loadSlots = useCallback(async () => {
    if (!selectedDoctor || !selectedDate) return;
    setIsLoadingSlots(true);
    try {
      const doctorUserId = selectedDoctor.userId ?? selectedDoctor.id;
      const res = await appointmentService.getAvailableSlots(doctorUserId, selectedDate);
      if (res.success) {
        // If today is selected, hide slots whose time has already passed.
        // Use new Date(y, m, d) to avoid parseISO treating the string as UTC
        // which causes isToday() to return false in UTC+ timezones (e.g. Asia/Manila).
        const [y, mo, d] = selectedDate.split('-').map(Number);
        const selectedDateObj = new Date(y, mo - 1, d);
        const now = new Date();
        const slots = isToday(selectedDateObj)
          ? res.data.filter((s) => {
              const [h, m] = s.startTime.split(':').map(Number);
              const slotTime = new Date(y, mo - 1, d, h, m, 0, 0);
              return slotTime > now;
            })
          : res.data;
        setAvailableSlots(slots);
      }
    } catch {
      toast({ title: 'Failed to load slots', description: 'Could not fetch available time slots. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoadingSlots(false);
    }
  }, [selectedDoctor, selectedDate, toast]);

  useEffect(() => {
    if (selectedDoctor && selectedDate) loadSlots();
  }, [loadSlots, selectedDoctor, selectedDate]);

  const handleDateSelect = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Check what consultation types are available for this date
    const { acceptsOnline: dateAcceptsOnline, acceptsInClinic: dateAcceptsInClinic } = getConsultationTypesForDate(dateStr);
    
    // Auto-select or reset consultation type based on availability
    let newConsultationType = consultationType;
    if (dateAcceptsOnline && !dateAcceptsInClinic) {
      newConsultationType = 'online';
      setConsultationType('online');
    } else if (dateAcceptsInClinic && !dateAcceptsOnline) {
      newConsultationType = 'in-clinic';
      setConsultationType('in-clinic');
    } else if (!dateAcceptsOnline && !dateAcceptsInClinic) {
      newConsultationType = null;
      setConsultationType(null);
    } else if (consultationType && ((consultationType === 'online' && !dateAcceptsOnline) || (consultationType === 'in-clinic' && !dateAcceptsInClinic))) {
      // Reset if current type is not available for this date
      newConsultationType = null;
      setConsultationType(null);
    }
    
    const fee = newConsultationType === 'online'
      ? selectedDoctor?.onlineConsultationFee ?? 0
      : newConsultationType === 'in-clinic'
      ? selectedDoctor?.consultationFee ?? 0
      : 0;
    
    // Reset slot when date changes
    setSchedule(dateStr, null as unknown as TimeSlot, fee);
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    const fee = consultationType === 'online'
      ? selectedDoctor?.onlineConsultationFee ?? 0
      : selectedDoctor?.consultationFee ?? 0;
    setSchedule(selectedDate, slot, fee);
  };

  const handleTypeSelect = (type: 'online' | 'in-clinic') => {
    setConsultationType(type);
  };

  return (
    <div className="space-y-6">
      {/* On-Demand Mode: Show simplified info card instead of full schedule UI */}
      {isConsultNow ? (
        <Card className="border-success/30 bg-success/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-success">
              <Zap className="h-4 w-4" />
              Consult Now - On-Demand Consultation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-success/30 bg-background p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-success text-white shrink-0">
                  <Video className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Online Video Consultation</p>
                  <p className="text-sm text-muted-foreground">Connect with your doctor instantly</p>
                </div>
                <p className="text-2xl font-bold text-primary">₱{selectedDoctor?.onlineConsultationFee?.toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4 text-success" />
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-semibold">Today</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-success" />
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-semibold">ASAP</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1 text-xs text-muted-foreground">
              <p>• Your consultation will start within 15 minutes after payment</p>
              <p>• You'll receive a video link once the doctor is ready</p>
              <p>• Make sure you have a stable internet connection</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        // Normal booking flow: show full schedule UI
        <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Consultation Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {/* ── Online card ── */}
            <button
              onClick={() => acceptsOnline && handleTypeSelect('online')}
              disabled={!acceptsOnline}
              className={cn(
                'p-4 rounded-xl border-2 transition-all text-left',
                !acceptsOnline
                  ? 'border-border bg-muted/40 opacity-50 cursor-not-allowed'
                  : consultationType === 'online'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'p-2.5 rounded-lg shrink-0',
                  !acceptsOnline
                    ? 'bg-muted text-muted-foreground'
                    : consultationType === 'online'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary'
                )}>
                  <Video className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-foreground">Online Consultation</p>
                    {!acceptsOnline && (
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        Not offered
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Video call from home</p>
                  <p className={cn('text-base font-bold mt-1.5', acceptsOnline ? 'text-primary' : 'text-muted-foreground')}>
                    {acceptsOnline ? `₱${selectedDoctor?.onlineConsultationFee?.toLocaleString()}` : 'Unavailable'}
                  </p>
                </div>
              </div>
            </button>

            {/* ── In-Clinic card ── */}
            <button
              onClick={() => acceptsInClinic && handleTypeSelect('in-clinic')}
              disabled={!acceptsInClinic}
              className={cn(
                'p-4 rounded-xl border-2 transition-all text-left',
                !acceptsInClinic
                  ? 'border-border bg-muted/40 opacity-50 cursor-not-allowed'
                  : consultationType === 'in-clinic'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'p-2.5 rounded-lg shrink-0',
                  !acceptsInClinic
                    ? 'bg-muted text-muted-foreground'
                    : consultationType === 'in-clinic'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary'
                )}>
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-foreground">In-Clinic Visit</p>
                    {!acceptsInClinic && (
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        Not offered
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {selectedDoctor?.hospital ?? 'Clinic visit'}
                  </p>
                  <p className={cn('text-base font-bold mt-1.5', acceptsInClinic ? 'text-primary' : 'text-muted-foreground')}>
                    {acceptsInClinic ? `₱${selectedDoctor?.consultationFee?.toLocaleString()}` : 'Unavailable'}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Doctor's Weekly Schedule ──────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            Doctor's Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Weekly availability grid */}
          {hasSchedule ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Available days &amp; hours
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(schedule).map(([day, hours]) => (
                  <div
                    key={day}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20"
                  >
                    <span className="w-8 text-xs font-bold text-primary uppercase">
                      {DAY_ABBR[DAY_NAME_TO_NUM[day.toLowerCase()]] ?? day.slice(0, 3)}
                    </span>
                    <span className="text-xs text-foreground">
                      {formatTime12Hour((hours as { start: string; end: string; consultation_types?: string }).start)}
                      {' – '}
                      {formatTime12Hour((hours as { start: string; end: string; consultation_types?: string }).end)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-muted-foreground text-sm">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>This doctor hasn't published a fixed weekly schedule. All dates in the next 30 days are shown — pick any and check available slots.</span>
            </div>
          )}

          {/* ── Calendar ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Select a date
            </p>

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-1">
              <button
                onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
                disabled={isBefore(endOfMonth(subMonths(calendarMonth, 1)), today)}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold">
                {format(calendarMonth, 'MMMM yyyy')}
              </span>
              <button
                onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                disabled={isBefore(maxDate, startOfMonth(addMonths(calendarMonth, 1)))}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-y-1">
              {calendarDays.map((date) => {
                const dateStr   = format(date, 'yyyy-MM-dd');
                const inMonth   = isSameMonth(date, calendarMonth);
                const bookable  = isBookableDate(date);
                const isSelected = selectedDate === dateStr;
                const todayMark  = isToday(date);
                return (
                  <button
                    key={dateStr}
                    onClick={() => bookable && handleDateSelect(date)}
                    disabled={!bookable}
                    className={cn(
                      'relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-all',
                      !inMonth && 'opacity-0 pointer-events-none',
                      inMonth && !bookable && 'text-muted-foreground/40 cursor-not-allowed',
                      inMonth && bookable && !isSelected && 'hover:bg-primary/10 text-foreground',
                      isSelected && 'bg-primary text-primary-foreground font-bold',
                      todayMark && !isSelected && 'ring-2 ring-primary/50 font-semibold',
                    )}
                  >
                    {format(date, 'd')}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Time Slots ────────────────────────────────────────── */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Available Times
              <span className="text-muted-foreground font-normal text-sm ml-1">
                — {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d')}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSlots ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-muted-foreground text-sm">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>No available slots for this date. Try another day.</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {availableSlots.map((slot) => {
                  const isSelected = selectedTimeSlot?.id === slot.id;
                  return (
                    <Button
                      key={slot.id}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      disabled={!slot.isAvailable}
                      onClick={() => slot.isAvailable && handleSlotSelect(slot)}
                      className={cn(
                        'h-10 text-xs',
                        isSelected && 'gradient-primary border-0',
                        !slot.isAvailable && 'opacity-40 cursor-not-allowed line-through'
                      )}
                    >
                      {formatTime12Hour(slot.startTime)}
                    </Button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 4. Booking Summary ───────────────────────────────────── */}
      {consultationType && selectedDate && selectedTimeSlot && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Your Booking
                </p>
                <p className="font-semibold text-foreground">
                  {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-sm text-muted-foreground">
                  at {formatTime12Hour(selectedTimeSlot.startTime)}
                  {selectedTimeSlot.endTime && selectedTimeSlot.endTime !== selectedTimeSlot.startTime
                    ? ` – ${formatTime12Hour(selectedTimeSlot.endTime)}`
                    : ''}
                </p>
                <Badge variant="secondary" className="mt-1 capitalize text-xs">
                  {consultationType === 'online' ? '📹 Online' : '🏥 In-Clinic'}
                </Badge>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Consultation Fee</p>
                <p className="text-2xl font-bold text-primary">
                  ₱{consultationFee.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Validation Errors ─────────────────────────────────────── */}
      {!isConsultNow && validationErrors.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-destructive text-sm">Please complete the following:</p>
                <ul className="list-disc list-inside space-y-0.5 text-sm text-destructive/90">
                  {validationErrors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
        </>
      )}
    </div>
  );
}
