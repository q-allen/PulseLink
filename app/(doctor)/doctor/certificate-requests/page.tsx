"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { medicalRecordsService } from "@/services/medicalRecordsService";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, Clock, CheckCircle, XCircle, Search,
  Calendar, Phone, Mail, Droplets, MapPin, User,
} from "lucide-react";
import { toast } from "sonner";
import { ApproveCertificateDialog } from "@/components/doctor/ApproveCertificateDialog";

interface CertificateRequest {
  id: number;
  patient: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    date_of_birth?: string;
    gender?: string;
    blood_type?: string;
    address?: string;
  };
  appointment?: { id: number; date: string; time?: string; type?: string };
  purpose: string;
  notes: string;
  status: "pending" | "approved" | "rejected";
  certificate?: { id: number };
  created_at: string;
}

const statusConfig = {
  pending:  { color: "bg-warning/15 text-warning border-warning/30",       icon: Clock,         label: "Pending"  },
  approved: { color: "bg-success/15 text-success border-success/30",       icon: CheckCircle,   label: "Approved" },
  rejected: { color: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle, label: "Rejected" },
};

const safeFormat = (dateStr: string | undefined, fmt: string, fallback = "—") => {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? fallback : format(d, fmt);
};

const getAge = (dob?: string) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
};

export default function CertificateRequestsPage() {
  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<CertificateRequest | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await medicalRecordsService.getCertificateRequests();
      if (res.success) setRequests(res.data);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (requestId: number) => {
    if (!confirm("Are you sure you want to reject this certificate request?")) return;
    try {
      const res = await medicalRecordsService.rejectCertificateRequest(requestId.toString());
      if (res.success) { toast.success("Certificate request rejected"); loadRequests(); }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to reject request");
    }
  };

  const filtered = requests.filter((req) => {
    const matchesFilter = filter === "all" || req.status === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      `${req.patient.first_name} ${req.patient.last_name}`.toLowerCase().includes(q) ||
      req.patient.email.toLowerCase().includes(q) ||
      req.purpose.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const tabs: { key: typeof filter; label: string; count?: number; countClass?: string }[] = [
    { key: "pending",  label: "Pending",  count: pendingCount, countClass: "bg-warning/10 text-warning" },
    { key: "approved", label: "Approved", count: requests.filter((r) => r.status === "approved").length, countClass: "bg-success/10 text-success" },
    { key: "rejected", label: "Rejected", count: requests.filter((r) => r.status === "rejected").length, countClass: "bg-destructive/10 text-destructive" },
    { key: "all",      label: "All",      count: requests.length, countClass: "bg-primary/10 text-primary" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Certificate Requests</h1>
          <p className="text-muted-foreground">Review and issue medical certificates for patients.</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge className="bg-primary/10 text-primary border-primary/20">{requests.length} total</Badge>
            <Badge variant="secondary">{pendingCount} pending</Badge>
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patient, purpose..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map(({ key, label, count, countClass }) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
            >
              {label}
              {count !== undefined && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  filter === key ? "bg-white/20 text-white" : countClass
                }`}>
                  {count}
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12 text-muted-foreground/40" />}
          title="No certificate requests"
          description={search ? "Try a different search term or filter." : `No ${filter !== "all" ? filter : ""} certificate requests found.`}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((req, i) => {
            const cfg = statusConfig[req.status] ?? statusConfig.pending;
            const StatusIcon = cfg.icon;
            const age = getAge(req.patient.date_of_birth);
            const initials = `${req.patient.first_name?.[0] ?? ""}${req.patient.last_name?.[0] ?? ""}`.toUpperCase() || "?";

            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className={req.status === "pending" ? "border-warning/40 bg-warning/5" : ""}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col lg:flex-row gap-4">

                      {/* Patient info */}
                      <div className="flex gap-3 flex-1 min-w-0">
                        <Avatar className="h-14 w-14 shrink-0">
                          <AvatarFallback className="bg-teal-100 text-teal-700 font-semibold text-sm">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold truncate">
                              {req.patient.first_name} {req.patient.last_name}
                            </h3>
                            <Badge className={`text-xs ${cfg.color} flex items-center gap-1`}>
                              <StatusIcon className="w-3 h-3" />
                              {cfg.label}
                            </Badge>
                          </div>

                          {/* Patient details row */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {age !== null && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {age} yrs{req.patient.gender ? ` • ${req.patient.gender.charAt(0).toUpperCase() + req.patient.gender.slice(1)}` : ""}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {req.patient.email}
                            </span>
                            {req.patient.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {req.patient.phone}
                              </span>
                            )}
                            {req.patient.blood_type && (
                              <span className="flex items-center gap-1">
                                <Droplets className="h-3 w-3" />
                                {req.patient.blood_type}
                              </span>
                            )}
                            {req.patient.address && (
                              <span className="flex items-center gap-1 truncate max-w-[200px]">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {req.patient.address}
                              </span>
                            )}
                          </div>

                          {/* Purpose & notes */}
                          <div className="pt-1 space-y-1">
                            <p className="text-sm">
                              <span className="font-medium text-foreground">Purpose: </span>
                              <span className="text-muted-foreground">{req.purpose}</span>
                            </p>
                            {req.notes && (
                              <p className="text-sm">
                                <span className="font-medium text-foreground">Patient Notes: </span>
                                <span className="text-muted-foreground">{req.notes}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right column: dates + actions */}
                      <div className="flex flex-col justify-between gap-3 shrink-0 lg:items-end">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground lg:justify-end">
                          {req.appointment && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              Appointment: {safeFormat(req.appointment.date, "MMM d, yyyy")}
                              {req.appointment.time && ` at ${req.appointment.time}`}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Requested: {safeFormat(req.created_at, "MMM d, yyyy • h:mm a")}
                          </span>
                        </div>

                        {req.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => { setSelectedRequest(req); setShowApproveDialog(true); }}
                              size="sm"
                              className="bg-success hover:bg-success/90 text-success-foreground gap-1.5"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Approve & Issue
                            </Button>
                            <Button
                              onClick={() => handleReject(req.id)}
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10 gap-1.5"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {selectedRequest && (
        <ApproveCertificateDialog
          open={showApproveDialog}
          onClose={() => { setShowApproveDialog(false); setSelectedRequest(null); }}
          request={selectedRequest}
          onSuccess={loadRequests}
        />
      )}
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card>
      <CardContent className="py-16 text-center space-y-3">
        <div className="flex justify-center">{icon}</div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
      </CardContent>
    </Card>
  );
}
