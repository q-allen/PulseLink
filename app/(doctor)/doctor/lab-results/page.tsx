"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  FlaskConical, Upload, RefreshCw, Search, CheckCircle2, Clock, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store";
import { medicalRecordsService } from "@/services/medicalRecordsService";
import { LabResult } from "@/types";
export default function DoctorLabResultsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [labs, setLabs] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selected, setSelected] = useState<LabResult | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchLabs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await medicalRecordsService.getLabResults(user.id);
      if (res.success) setLabs(res.data);
    } catch {
      toast({ title: "Failed to load lab requests", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => { fetchLabs(); }, [fetchLabs]);

  const filtered = labs.filter((lab) => {
    const q = search.toLowerCase();
    return !q || lab.testName.toLowerCase().includes(q) || lab.testType.toLowerCase().includes(q);
  });

  const openUpload = (lab: LabResult) => {
    setSelected(lab);
    setFile(null);
    setNotes(lab.notes ?? "");
    setUploadOpen(true);
  };

  const handleUpload = async () => {
    if (!selected || !file) {
      toast({ title: "Please select a file to upload.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const res = await medicalRecordsService.uploadLabResults(selected.id, file, undefined, notes);
      if (!res.success) throw new Error("Upload failed");
      toast({ title: "Lab results uploaded", description: "Patient has been notified." });
      setUploadOpen(false);
      setSelected(null);
      setFile(null);
      setNotes("");
      fetchLabs();
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "completed") return <Badge className="bg-success/15 text-success border-success/30">Completed</Badge>;
    if (status === "processing") return <Badge variant="secondary">Processing</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lab Requests</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Upload results for pending lab requests sent to patients.
            </p>
          </div>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={fetchLabs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by test name or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center space-y-2">
              <FlaskConical className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="font-semibold">No lab requests yet</p>
              <p className="text-sm text-muted-foreground">
                Send a lab request from an appointment to see it here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((lab, i) => (
              <motion.div
                key={lab.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-success/10 flex-shrink-0">
                          <FlaskConical className="h-5 w-5 text-success" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{lab.testName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {lab.testType}{lab.laboratory ? ` · ${lab.laboratory}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Sent: {format(new Date(lab.date), "MMM d, yyyy")}
                          </p>
                          {lab.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">{lab.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {statusBadge(lab.status)}
                        {lab.status !== "completed" && (
                          <Button size="sm" className="gap-1.5" onClick={() => openUpload(lab)}>
                            <Upload className="h-3.5 w-3.5" />
                            Upload Results
                          </Button>
                        )}
                        {lab.status === "completed" && (
                          <span className="flex items-center gap-1 text-xs text-success">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Results uploaded
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { if (!uploading) setUploadOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-success" />
              Upload Lab Results
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/50 p-3 text-sm">
                <p className="font-semibold">{selected.testName}</p>
                <p className="text-xs text-muted-foreground">{selected.testType}</p>
              </div>

              {/* File picker */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Result File (PDF, image) *
                </label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={uploading}
                />
                {file && (
                  <p className="text-xs text-success mt-1">{file.name} selected</p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Pathologist Notes (optional)
                </label>
                <Textarea
                  placeholder="Add any notes or findings..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={uploading}
                  className="min-h-[80px] resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !file} className="gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading..." : "Upload & Notify Patient"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
