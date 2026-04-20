"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Trash2, Save, RefreshCw, Zap, CheckCircle2,
  Info, CalendarCheck, AlertCircle, Clock, User, Video, Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store";
import { useToast } from "@/hooks/use-toast";
import { api, API_ENDPOINTS } from "@/services/api";
import { Doctor } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

type DayKey =
  | "monday" | "tuesday" | "wednesday" | "thursday"
  | "friday" | "saturday" | "sunday";

type ConsultationType = "online" | "in_clinic" | "both";

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
  consultationTypes: ConsultationType;
}

type WeeklySchedule = Record<DayKey, DaySchedule>;

interface UpcomingSlot {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  is_recurring: boolean;
  is_booked: boolean;
}

interface UpcomingAppointment {
  id: number;
  patient_name: string;
  date: string;
  time: string;
  type: "online" | "in_clinic" | "on_demand";
  status: string;
}

interface MyScheduleResponse {
  is_on_demand: boolean;
  is_available_now: boolean;
  weekly_schedule: Record<string, { start: string; end: string }>;
  upcoming_slots: UpcomingSlot[];
  upcoming_appointments: UpcomingAppointment[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS: { key: DayKey; label: string; short: string; weekend: boolean }[] = [
  { key: "monday",    label: "Monday",    short: "Mon", weekend: false },
  { key: "tuesday",   label: "Tuesday",   short: "Tue", weekend: false },
  { key: "wednesday", label: "Wednesday", short: "Wed", weekend: false },
  { key: "thursday",  label: "Thursday",  short: "Thu", weekend: false },
  { key: "friday",    label: "Friday",    short: "Fri", weekend: false },
  { key: "saturday",  label: "Saturday",  short: "Sat", weekend: true  },
  { key: "sunday",    label: "Sunday",    short: "Sun", weekend: true  },
];

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}

const CONSULT_OPTIONS: { value: ConsultationType; label: string; icon: React.ElementType }[] = [
  { value: "online",    label: "Online",    icon: Video     },
  { value: "in_clinic", label: "In-Clinic", icon: Building2 },
  { value: "both",      label: "Both",      icon: CheckCircle2 },
];

const DEFAULT_SCHEDULE: WeeklySchedule = {
  monday:    { enabled: false, start: "09:00", end: "17:00", consultationTypes: "both" },
  tuesday:   { enabled: false, start: "09:00", end: "17:00", consultationTypes: "both" },
  wednesday: { enabled: false, start: "09:00", end: "17:00", consultationTypes: "both" },
  thursday:  { enabled: false, start: "09:00", end: "17:00", consultationTypes: "both" },
  friday:    { enabled: false, start: "09:00", end: "17:00", consultationTypes: "both" },
  saturday:  { enabled: false, start: "09:00", end: "13:00", consultationTypes: "both" },
  sunday:    { enabled: false, start: "09:00", end: "13:00", consultationTypes: "both" },
};

const TYPE_META: Record<UpcomingAppointment["type"], { label: string; icon: React.ElementType; color: string }> = {
  online:    { label: "Online",    icon: Video,      color: "text-primary" },
  in_clinic: { label: "In-Clinic", icon: Building2,  color: "text-success" },
  on_demand: { label: "On-Demand", icon: Zap,        color: "text-warning" },
};

const STATUS_COLOR: Record<string, string> = {
  pending:     "bg-warning/15 text-warning border-warning/30",
  confirmed:   "bg-primary/15 text-primary border-primary/30",
  in_progress: "bg-success/15 text-success border-success/30",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function apiScheduleToLocal(
  raw: Record<string, { start: string; end: string; consultation_types?: ConsultationType }>
): WeeklySchedule {
  const result = structuredClone(DEFAULT_SCHEDULE);
  for (const [day, val] of Object.entries(raw)) {
    const key = day as DayKey;
    if (result[key] !== undefined) {
      result[key] = {
        enabled: true,
        start: val.start,
        end: val.end,
        consultationTypes: val.consultation_types ?? "both",
      };
    }
  }
  return result;
}

function localScheduleToApi(
  schedule: WeeklySchedule
): Record<string, { start: string; end: string; consultation_types: ConsultationType }> {
  const result: Record<string, { start: string; end: string; consultation_types: ConsultationType }> = {};
  for (const [day, val] of Object.entries(schedule)) {
    if (val.enabled) result[day] = { start: val.start, end: val.end, consultation_types: val.consultationTypes };
  }
  return result;
}

function slotCount(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, Math.floor((eh * 60 + em - (sh * 60 + sm)) / 30));
}

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TimeSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground
        focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow cursor-pointer"
    >
      {options.map((t) => (
        <option key={t} value={t}>
          {fmt12(t)}
        </option>
      ))}
    </select>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { user, setUser } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const doctor = user as Doctor;

  const [schedule, setSchedule] = useState<WeeklySchedule>(DEFAULT_SCHEDULE);
  const [onDemand, setOnDemand] = useState(doctor?.isOnDemand ?? false);
  const [upcomingSlots, setUpcomingSlots] = useState<UpcomingSlot[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // ── Load — single call to my-schedule ─────────────────────────────────────
  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<MyScheduleResponse>(
        `${API_ENDPOINTS.DOCTOR_MY_SCHEDULE}?days=30`
      );
      setOnDemand(data.is_on_demand);
      setSchedule(apiScheduleToLocal(data.weekly_schedule ?? {}));
      setUpcomingSlots(data.upcoming_slots ?? []);
      setUpcomingAppointments(data.upcoming_appointments ?? []);
      setIsDirty(false);
    } catch {
      toast({ title: "Failed to load schedule", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(API_ENDPOINTS.DOCTOR_AVAILABILITY, {
        is_on_demand: onDemand,
        weekly_schedule: localScheduleToApi(schedule),
      });
      setUser({ ...doctor, isOnDemand: onDemand } as Doctor);
      setIsDirty(false);
      toast({
        title: "Schedule saved ✓",
        description: "Patients can now book based on your availability.",
      });
      queryClient.invalidateQueries({ queryKey: ["doctor-slots"] });
      loadSchedule();
    } catch (e: unknown) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: DayKey) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
    setIsDirty(true);
  };

  const updateTime = (day: DayKey, field: "start" | "end", value: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
    setIsDirty(true);
  };

  const updateConsultType = (day: DayKey, value: ConsultationType) => {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], consultationTypes: value } }));
    setIsDirty(true);
  };

  const deleteSlot = async (id: number) => {
    try {
      await api.delete(API_ENDPOINTS.DOCTOR_SLOT_DETAIL(id));
      setUpcomingSlots((prev) => prev.filter((s) => s.id !== id));
      queryClient.invalidateQueries({ queryKey: ["doctor-slots"] });
      toast({ title: "Slot removed" });
    } catch {
      toast({ title: "Failed to remove slot", variant: "destructive" });
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const enabledDays = DAYS.filter((d) => schedule[d.key].enabled);
  const totalWeeklySlots = enabledDays.reduce(
    (sum, d) => sum + slotCount(schedule[d.key].start, schedule[d.key].end),
    0
  );

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 pb-20">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            My Schedule
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Configure your weekly availability and on-demand status.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadSchedule}
          disabled={saving}
          className="gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* ── On-demand card ───────────────────────────────────────────────── */}
      <Card className={`transition-colors ${onDemand ? "border-success/40 bg-success/5" : "border-border"}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                onDemand ? "bg-success/20" : "bg-muted"
              }`}>
                <Zap className={`h-6 w-6 ${onDemand ? "text-success" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="font-semibold text-foreground">On-Demand Consultations</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {onDemand
                    ? "You are visible to patients for instant video consults."
                    : 'Enable to appear in the "Consult Now" section for patients.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge
                className={`text-xs px-2.5 py-1 ${
                  onDemand
                    ? "bg-success/15 text-success border-success/30"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                  onDemand ? "bg-success animate-pulse" : "bg-muted-foreground"
                }`} />
                {onDemand ? "Live" : "Off"}
              </Badge>
              <Switch
                checked={onDemand}
                onCheckedChange={(v) => { setOnDemand(v); setIsDirty(true); }}
                id="on-demand"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Main two-column layout ───────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6 items-start">

        {/* Left: Weekly schedule editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Weekly Availability
                </CardTitle>
                {enabledDays.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {enabledDays.length} day{enabledDays.length !== 1 ? "s" : ""} ·{" "}
                    ~{totalWeeklySlots} slots/wk
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Toggle each day and set your working hours. Each 30-min block becomes one bookable slot.
              </p>
            </CardHeader>

            <CardContent className="space-y-2 pt-0">
              {DAYS.map(({ key, label, short, weekend }) => {
                const day   = schedule[key];
                const slots = day.enabled ? slotCount(day.start, day.end) : 0;
                const endOptions = TIME_OPTIONS.filter((t) => t > day.start);

                return (
                  <div
                    key={key}
                    className={`rounded-xl border transition-all ${
                      day.enabled
                        ? "border-primary/30 bg-primary/5"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Switch
                        checked={day.enabled}
                        onCheckedChange={() => toggleDay(key)}
                        id={`day-${key}`}
                      />
                      <label
                        htmlFor={`day-${key}`}
                        className={`text-sm font-semibold cursor-pointer w-24 shrink-0 ${
                          day.enabled ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        <span className="hidden sm:inline">{label}</span>
                        <span className="sm:hidden">{short}</span>
                        {weekend && (
                          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                            (weekend)
                          </span>
                        )}
                      </label>

                      {day.enabled ? (
                        <div className="flex flex-col gap-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <TimeSelect
                                value={day.start}
                                onChange={(v) => updateTime(key, "start", v)}
                                options={TIME_OPTIONS}
                                label={`${label} start time`}
                              />
                            </div>
                            <span className="text-muted-foreground text-xs shrink-0">to</span>
                            <div className="flex-1 min-w-0">
                              <TimeSelect
                                value={day.end}
                                onChange={(v) => updateTime(key, "end", v)}
                                options={endOptions.length ? endOptions : TIME_OPTIONS}
                                label={`${label} end time`}
                              />
                            </div>
                            <Badge
                              variant={slots > 0 ? "default" : "destructive"}
                              className="shrink-0 text-xs min-w-[52px] justify-center"
                            >
                              {slots > 0 ? `${slots} slots` : "0 slots"}
                            </Badge>
                          </div>
                          <div className="flex gap-1.5">
                            {CONSULT_OPTIONS.map(({ value, label: optLabel, icon: Icon }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => updateConsultType(key, value)}
                                className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                                  day.consultationTypes === value
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                                }`}
                              >
                                <Icon className="h-3 w-3" />
                                {optLabel}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Not available
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {enabledDays.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Enable at least one day so patients can book.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Appointments */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Upcoming Appointments
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {upcomingAppointments.length} next 30 days
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {upcomingAppointments.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                  <CalendarCheck className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No upcoming appointments in the next 30 days.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {upcomingAppointments.map((apt) => {
                    const meta = TYPE_META[apt.type] ?? TYPE_META.online;
                    const TypeIcon = meta.icon;
                    const statusCls = STATUS_COLOR[apt.status] ?? "bg-muted text-muted-foreground border-border";
                    return (
                      <div
                        key={apt.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
                      >
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-muted`}>
                          <TypeIcon className={`h-4 w-4 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{apt.patient_name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(parseISO(apt.date), "EEE, MMM d")} · {fmt12(apt.time.slice(0, 5))}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge className={`text-[10px] px-1.5 py-0 h-4 border ${statusCls}`}>
                            {apt.status.replace("_", " ")}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{meta.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Summary + explicit slots */}
        <div className="space-y-4">

          {/* Schedule summary */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Schedule Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {enabledDays.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No days enabled yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {enabledDays.map(({ key, label }) => {
                    const ct = schedule[key].consultationTypes;
                    const ctMeta = CONSULT_OPTIONS.find((o) => o.value === ct)!;
                    const CtIcon = ctMeta.icon;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between text-xs bg-background rounded-lg px-3 py-2 border border-border gap-2"
                      >
                        <span className="font-medium text-foreground shrink-0">{label}</span>
                        <span className="text-muted-foreground">
                          {fmt12(schedule[key].start)} – {fmt12(schedule[key].end)}
                        </span>
                        <span className="flex items-center gap-1 text-primary shrink-0">
                          <CtIcon className="h-3 w-3" />
                          {ctMeta.label}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between text-xs pt-1 px-1">
                    <span className="text-muted-foreground">Total per week</span>
                    <span className="font-semibold text-primary">~{totalWeeklySlots} slots</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info tip */}
          <div className="flex gap-2.5 p-3 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <p>
              Your weekly schedule auto-generates 30-min slots for each enabled day.
              Explicit slots take priority over this template.
            </p>
          </div>

          {/* Upcoming explicit slots */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  Explicit Slots
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {upcomingSlots.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {upcomingSlots.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  No explicit slots. Weekly schedule handles availability automatically.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {upcomingSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                        slot.is_booked
                          ? "border-primary/30 bg-primary/5"
                          : slot.is_available
                          ? "border-border bg-background"
                          : "border-destructive/30 bg-destructive/5"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {format(parseISO(slot.date), "EEE, MMM d")}
                        </p>
                        <p className="text-muted-foreground">
                          {fmt12(slot.start_time.slice(0, 5))} – {fmt12(slot.end_time.slice(0, 5))}
                        </p>
                        <div className="flex gap-1 mt-1">
                          {slot.is_booked && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/15 text-primary border-primary/30">
                              Booked
                            </Badge>
                          )}
                          {slot.is_recurring && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              Recurring
                            </Badge>
                          )}
                          {!slot.is_available && !slot.is_booked && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                              Blocked
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-40"
                        onClick={() => deleteSlot(slot.id)}
                        disabled={slot.is_booked}
                        aria-label={slot.is_booked ? "Cannot delete a booked slot" : "Delete slot"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Sticky save bar — respects sidebar width via lg:ml-20/lg:ml-64 ── */}
      <div className={`fixed bottom-0 left-0 right-0 z-20 transition-all duration-300 ${
        isDirty ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
      }`}>
        <div className="bg-card/95 backdrop-blur border-t border-border shadow-xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
              You have unsaved changes
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { loadSchedule(); setIsDirty(false); }}
                disabled={saving}
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="gradient-primary border-0 gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save Schedule"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
