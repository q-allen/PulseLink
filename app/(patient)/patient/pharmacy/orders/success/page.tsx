"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Clock, Truck } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { pharmacyService, BackendOrder } from "@/services/pharmacyService";

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const ref          = searchParams.get("ref");

  const [order, setOrder]     = useState<BackendOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ref) { setLoading(false); return; }
    // Poll once — webhook may take a few seconds to confirm payment
    const load = async () => {
      const res = await pharmacyService.getMyOrders();
      if (res.success) {
        const found = res.data.find((o) => o.order_ref === ref) ?? null;
        setOrder(found);
      }
      setLoading(false);
    };
    load();
    // Re-poll after 3 s in case webhook hasn't fired yet
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, [ref]);

  const today = new Date();
  today.setDate(today.getDate() + 3);
  const estimated = today.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6"
        >
          <div className="h-20 w-20 rounded-full bg-success/20 flex items-center justify-center mx-auto">
            <Check className="h-10 w-10 text-success" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">Payment Successful!</h2>
            <p className="text-muted-foreground mt-1">Your order has been confirmed.</p>
          </div>

          <Card>
            <CardContent className="p-5 space-y-3 text-left">
              {loading ? (
                <>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Order Reference</span>
                    <span className="font-bold text-primary font-mono">{ref ?? "—"}</span>
                  </div>
                  <Separator />
                  {order && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <span className="font-medium capitalize">{order.status.replace(/_/g, " ")}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-bold">
                          ₱{parseFloat(order.total_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Items</span>
                        <span>{order.items.length} item{order.items.length !== 1 ? "s" : ""}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated Delivery</span>
                    <span className="font-medium">{estimated}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary shrink-0" />
            You'll receive notifications as your order progresses.
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => router.push("/patient")}>
              Dashboard
            </Button>
            <Button className="flex-1 gap-2" onClick={() => router.push("/patient/pharmacy")}>
              <Truck className="h-4 w-4" /> Track Order
            </Button>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense>
      <OrderSuccessContent />
    </Suspense>
  );
}
