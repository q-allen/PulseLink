"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function OrderCancelContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const ref          = searchParams.get("ref");

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6"
        >
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">Payment Cancelled</h2>
            <p className="text-muted-foreground mt-1">Your order was not completed.</p>
          </div>

          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground space-y-2">
              {ref && (
                <p>
                  Order reference: <span className="font-mono font-medium text-foreground">{ref}</span>
                </p>
              )}
              <p>No payment was charged. You can retry or choose a different payment method.</p>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => router.push("/patient/cart")}>
              <ArrowLeft className="h-4 w-4" /> Back to Cart
            </Button>
            <Button className="flex-1 gap-2" onClick={() => router.push("/patient/checkout")}>
              <RefreshCw className="h-4 w-4" /> Try Again
            </Button>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

export default function OrderCancelPage() {
  return (
    <Suspense>
      <OrderCancelContent />
    </Suspense>
  );
}
