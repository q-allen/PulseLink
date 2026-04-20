"use client";

import { useState, useEffect } from "react";
import { medicalRecordsService } from "@/services/medicalRecordsService";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, CheckCircle, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { API_ENDPOINTS, getBaseUrl } from "@/services/api";

interface CertificateRequest {
  id: number;
  doctor: { id: number; first_name: string; last_name: string };
  appointment?: { id: number; date: string };
  purpose: string;
  notes: string;
  status: "pending" | "approved" | "rejected";
  certificate?: { id: number; pdf_file: string };
  created_at: string;
}

interface MedicalCertificateData {
  id: number;
  doctor: { id: number; first_name: string; last_name: string };
  purpose: string;
  diagnosis: string;
  rest_days: number;
  restDays: number;
  valid_from: string;
  validFrom: string;
  valid_until: string;
  validUntil: string;
}

export default function CertificatesPage() {
  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [certificates, setCertificates] = useState<MedicalCertificateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"requests" | "certificates">("requests");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqRes, certRes] = await Promise.all([
        medicalRecordsService.getCertificateRequests(),
        medicalRecordsService.getCertificates(""),
      ]);
      if (reqRes.success) setRequests(reqRes.data);
      if (certRes.success) setCertificates(certRes.data as unknown as MedicalCertificateData[]);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
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

  const downloadPdf = (certId: number) => {
    const url = `${getBaseUrl()}${API_ENDPOINTS.CERTIFICATE_PDF(certId)}`;
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Medical Certificates</h1>
        <p className="text-gray-600 mt-1">View your certificate requests and issued certificates</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab("requests")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "requests"
              ? "text-teal-600 border-b-2 border-teal-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab("certificates")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "certificates"
              ? "text-teal-600 border-b-2 border-teal-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Issued Certificates ({certificates.length})
        </button>
      </div>

      {/* Certificate Requests Tab */}
      {activeTab === "requests" && (
        <div className="space-y-4">
          {requests.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No certificate requests yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Request a certificate from your doctor after a consultation
              </p>
            </Card>
          ) : (
            requests.map((req) => (
              <Card key={req.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{req.purpose}</h3>
                      {getStatusBadge(req.status)}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Doctor: Dr. {req.doctor.first_name} {req.doctor.last_name}
                    </p>
                    {req.notes && (
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-medium">Notes:</span> {req.notes}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Requested on {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {req.status === "approved" && req.certificate && (
                    <Button
                      onClick={() => downloadPdf(req.certificate!.id)}
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Issued Certificates Tab */}
      {activeTab === "certificates" && (
        <div className="space-y-4">
          {certificates.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No certificates issued yet</p>
            </Card>
          ) : (
            certificates.map((cert) => (
              <Card key={cert.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{cert.purpose}</h3>
                    <p className="text-sm text-gray-600 mb-1">
                      Doctor: Dr. {cert.doctor.first_name} {cert.doctor.last_name}
                    </p>
                    <p className="text-sm text-gray-700 mb-1">
                      <span className="font-medium">Diagnosis:</span> {cert.diagnosis}
                    </p>
                    <p className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">Rest Days:</span> {cert.restDays || cert.rest_days} days
                    </p>
                    <p className="text-xs text-gray-500">
                      Valid: {new Date(cert.validFrom || cert.valid_from).toLocaleDateString()} -{" "}
                      {new Date(cert.validUntil || cert.valid_until).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    onClick={() => downloadPdf(cert.id)}
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
