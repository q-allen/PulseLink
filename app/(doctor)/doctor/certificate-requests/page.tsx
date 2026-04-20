"use client";

import { useState, useEffect } from "react";
import { medicalRecordsService } from "@/services/medicalRecordsService";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, CheckCircle, XCircle, User } from "lucide-react";
import { toast } from "sonner";
import { ApproveCertificateDialog } from "@/components/doctor/ApproveCertificateDialog";

interface CertificateRequest {
  id: number;
  patient: { id: number; first_name: string; last_name: string; email: string };
  appointment?: { id: number; date: string };
  purpose: string;
  notes: string;
  status: "pending" | "approved" | "rejected";
  certificate?: { id: number };
  created_at: string;
}

export default function CertificateRequestsPage() {
  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<CertificateRequest | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await medicalRecordsService.getCertificateRequests();
      if (res.success) {
        setRequests(res.data);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (request: CertificateRequest) => {
    setSelectedRequest(request);
    setShowApproveDialog(true);
  };

  const handleReject = async (requestId: number) => {
    if (!confirm("Are you sure you want to reject this certificate request?")) return;

    try {
      const res = await medicalRecordsService.rejectCertificateRequest(requestId.toString());
      if (res.success) {
        toast.success("Certificate request rejected");
        loadRequests();
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to reject request");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
      pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Pending" },
      approved: { color: "bg-green-100 text-green-800", icon: CheckCircle, label: "Approved" },
      rejected: { color: "bg-red-100 text-red-800", icon: XCircle, label: "Rejected" },
    };
    const { color, icon: Icon, label } = variants[status] || variants.pending;
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  const filteredRequests = requests.filter((req) => {
    if (filter === "all") return true;
    return req.status === filter;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Certificate Requests</h1>
        <p className="text-gray-600 mt-1">Manage patient medical certificate requests</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setFilter("pending")}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === "pending"
              ? "text-teal-600 border-b-2 border-teal-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setFilter("approved")}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === "approved"
              ? "text-teal-600 border-b-2 border-teal-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Approved
        </button>
        <button
          onClick={() => setFilter("rejected")}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === "rejected"
              ? "text-teal-600 border-b-2 border-teal-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Rejected
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === "all"
              ? "text-teal-600 border-b-2 border-teal-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          All ({requests.length})
        </button>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No {filter !== "all" ? filter : ""} certificate requests</p>
          </Card>
        ) : (
          filteredRequests.map((req) => (
            <Card key={req.id} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {req.patient.first_name} {req.patient.last_name}
                      </h3>
                      <p className="text-sm text-gray-500">{req.patient.email}</p>
                    </div>
                  </div>

                  <div className="ml-13 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Purpose:</span>
                      <span className="text-sm text-gray-900">{req.purpose}</span>
                      {getStatusBadge(req.status)}
                    </div>

                    {req.notes && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">Notes:</span>
                        <p className="text-sm text-gray-600 mt-1">{req.notes}</p>
                      </div>
                    )}

                    {req.appointment && (
                      <p className="text-xs text-gray-500">
                        Appointment: {new Date(req.appointment.date).toLocaleDateString()}
                      </p>
                    )}

                    <p className="text-xs text-gray-500">
                      Requested on {new Date(req.created_at).toLocaleDateString()} at{" "}
                      {new Date(req.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                {req.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(req)}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleReject(req.id)}
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Approve Dialog */}
      {selectedRequest && (
        <ApproveCertificateDialog
          open={showApproveDialog}
          onClose={() => {
            setShowApproveDialog(false);
            setSelectedRequest(null);
          }}
          request={selectedRequest}
          onSuccess={loadRequests}
        />
      )}
    </div>
  );
}
