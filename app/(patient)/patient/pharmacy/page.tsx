"use client";

/**
 * /patient/pharmacy/page.tsx
 *
 * NowServing alignment:
 * - Pre-filled cart banner when patient arrives from "Order These Medicines" CTA
 * - Delivery tracking section (Processing → Shipped → Out for Delivery → Delivered)
 * - COD allowed; online payment via PayMongo
 * - No separate pharmacy account — everything tied to the patient User
 */

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Pill, ShoppingCart, AlertCircle, CheckCircle2,
  Package, Truck, MapPin, Clock, ChevronRight, X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PrescriptionUpload from "@/components/pharmacy/PrescriptionUpload";
import { usePharmacyStore } from "@/store/pharmacyStore";
import { pharmacyService, BackendOrder, DELIVERY_STEPS } from "@/services/pharmacyService";
import { Medicine } from "@/types";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["All", "Pain Relief", "Antibiotics", "Cardiovascular", "Vitamins", "First Aid", "Maintenance"];

// ── Delivery tracker component ────────────────────────────────────────────────
// NowServing pattern: horizontal step indicator showing the 4-stage pipeline.
function DeliveryTracker({ order }: { order: BackendOrder }) {
  const currentIdx = DELIVERY_STEPS.findIndex((s) => s.key === order.status);
  const stepIcons = [Package, MapPin, CheckCircle2];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Order <span className="font-mono text-primary">{order.order_ref}</span>
        </p>
        <Badge
          variant={order.status === "delivered" ? "default" : "secondary"}
          className="text-xs capitalize"
        >
          {order.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Step pipeline */}
      <div className="flex items-center gap-0">
        {DELIVERY_STEPS.map((step, idx) => {
          const Icon = stepIcons[idx];
          const done = idx <= currentIdx;
          const active = idx === currentIdx;
          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                    done
                      ? "bg-teal-600 text-white"
                      : "bg-muted text-muted-foreground"
                  } ${active ? "ring-2 ring-teal-400 ring-offset-1" : ""}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`text-[10px] text-center leading-tight w-16 ${done ? "text-teal-700 dark:text-teal-300 font-medium" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
              </div>
              {idx < DELIVERY_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mb-4 mx-1 ${idx < currentIdx ? "bg-teal-600" : "bg-muted"}`} />
              )}
            </div>
          );
        })}
      </div>

      {order.tracking_number && (
        <p className="text-xs text-muted-foreground">
          Tracking: <span className="font-mono font-medium text-foreground">{order.tracking_number}</span>
        </p>
      )}
    </div>
  );
}

// ── Pre-filled cart banner ─────────────────────────────────────────────────────
// Shown when patient arrives via "Order These Medicines" from appointment page.
function PrefillBanner({
  itemCount,
  onDismiss,
  onGoToCart,
}: {
  itemCount: number;
  onDismiss: () => void;
  onGoToCart: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <Card className="border-teal-300 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-teal-900 dark:text-teal-100">
                Cart pre-filled from your prescription
              </p>
              <p className="text-xs text-teal-700 dark:text-teal-300">
                {itemCount} medicine{itemCount !== 1 ? "s" : ""} added. You can add extra OTC items below.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-1" onClick={onGoToCart}>
                <ShoppingCart className="h-3.5 w-3.5" />
                View Cart
              </Button>
              <button onClick={onDismiss} className="text-teal-600 hover:text-teal-800 transition-colors" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PharmacyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const {
    cart, cartCount, addToCart, prescriptionFile, hasRxItems,
    prescriptionId, clearCart, prescriptionUploadId, extractedMedIds, setExtractedMedIds,
  } = usePharmacyStore();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // Delivery tracking state
  const [myOrders, setMyOrders] = useState<BackendOrder[]>([]);
  const fromNotification = searchParams.get('orders') === '1';
  const [ordersLoading, setOrdersLoading] = useState(fromNotification);
  const [showOrders, setShowOrders] = useState(fromNotification);

  // Pre-fill banner: show when cart was populated from a prescription
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const showPrefillBanner = !!prescriptionId && !bannerDismissed;

  // Re-extract on mount if prescription already uploaded but extracted IDs lost (e.g. page refresh)
  useEffect(() => {
    if (prescriptionFile && prescriptionUploadId && extractedMedIds.length === 0) {
      pharmacyService.extractPrescription(prescriptionFile).then((res) => {
        if (res.success && res.data.length > 0) setExtractedMedIds(res.data.map((m) => m.id));
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load medicine catalogue
  useEffect(() => {
    pharmacyService.getMedicines().then((res) => {
      if (res.success) setMedicines(res.data);
      setLoading(false);
    });
  }, []);

  // Load patient's orders; re-fetch whenever the panel is opened
  useEffect(() => {
    if (!showOrders) return;
    pharmacyService.getMyOrders().then((res) => {
      if (res.success) setMyOrders(res.data);
      setOrdersLoading(false);
    });
  }, [showOrders]);

  const filtered = medicines.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || m.name.toLowerCase().includes(q) || m.genericName.toLowerCase().includes(q);
    const matchesCat = activeCategory === "All" || m.category === activeCategory;
    const matchesRx = extractedMedIds.length === 0 || extractedMedIds.includes(Number(m.id));
    return matchesSearch && matchesCat && matchesRx;
  });

  const handleAddToCart = (medicine: Medicine) => {
    // Rx items pre-filled from prescription don't need a manual upload
    if (medicine.requiresPrescription && !prescriptionFile && !prescriptionId) {
      toast({
        title: "Prescription Required",
        description: `${medicine.name} requires a valid prescription. Upload yours or order via your consultation.`,
        variant: "destructive",
      });
      return;
    }
    addToCart(medicine);
    toast({ title: "Added to cart", description: `${medicine.name} added to your cart.` });
  };

  const count = cartCount();

  // Active orders = not delivered/cancelled — shown in tracking section
  const activeOrders = myOrders.filter((o) => !["delivered", "cancelled"].includes(o.status));
  const pastOrders   = myOrders.filter((o) =>  ["delivered", "cancelled"].includes(o.status));

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pharmacy</h1>
            <p className="text-muted-foreground">Order medicines with home delivery</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* My Orders toggle */}
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (!showOrders) setOrdersLoading(true);
                setShowOrders((v) => !v);
              }}
            >
              <Package className="h-4 w-4" />
              My Orders
              {activeOrders.length > 0 && (
                <Badge className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeOrders.length}
                </Badge>
              )}
            </Button>
            <Button className="relative gap-2" onClick={() => router.push("/patient/cart")}>
              <ShoppingCart className="h-4 w-4" />
              View Cart
              {count > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {count}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* ── Pre-fill banner (from "Order These Medicines" CTA) ─────────────── */}
        <AnimatePresence>
          {showPrefillBanner && count > 0 && (
            <PrefillBanner
              itemCount={count}
              onDismiss={() => setBannerDismissed(true)}
              onGoToCart={() => router.push("/patient/cart")}
            />
          )}
        </AnimatePresence>

        {/* ── Delivery Tracking Panel ─────────────────────────────────────────
            NowServing pattern: patient can see exactly where their order is.
            Processing → Shipped → Out for Delivery → Delivered
        ─────────────────────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showOrders && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Truck className="h-5 w-5 text-primary" />
                    Order Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {ordersLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : activeOrders.length === 0 && pastOrders.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      No orders yet. Add medicines to your cart to get started.
                    </div>
                  ) : (
                    <>
                      {/* Active orders with live tracker */}
                      {activeOrders.length > 0 && (
                        <div className="space-y-4">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Active Orders
                          </p>
                          {activeOrders.map((order) => (
                            <div key={order.id} className="p-4 border rounded-xl space-y-3">
                              <DeliveryTracker order={order} />
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                  {order.items.length} item{order.items.length !== 1 ? "s" : ""} ·{" "}
                                  ₱{parseFloat(order.total_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(order.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                                </span>
                              </div>
                              {order.from_prescription && (
                                <Badge variant="outline" className="text-[10px] border-teal-400 text-teal-600">
                                  From Prescription
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Past orders — collapsed list */}
                      {pastOrders.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Past Orders
                          </p>
                          {pastOrders.map((order) => (
                            <div
                              key={order.id}
                              className="flex items-center justify-between p-3 border rounded-lg text-sm"
                            >
                              <div>
                                <span className="font-mono text-xs text-primary">{order.order_ref}</span>
                                <p className="text-xs text-muted-foreground">
                                  {order.items.length} item{order.items.length !== 1 ? "s" : ""} ·{" "}
                                  ₱{parseFloat(order.total_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              <Badge
                                variant={order.status === "delivered" ? "default" : "destructive"}
                                className="text-xs capitalize"
                              >
                                {order.status.replace(/_/g, " ")}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Prescription Upload Banner ──────────────────────────────────────
            Only shown when cart was NOT pre-filled from a prescription.
            NowServing: if you came from a consultation, you don't need to
            manually upload — the digital Rx is already linked.
        ─────────────────────────────────────────────────────────────────────── */}
        {(!prescriptionId || prescriptionFile) && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Upload Your Prescription</h3>
                  <p className="text-sm text-muted-foreground">
                    Some medicines require a valid prescription. Upload it here to order Rx-only items.
                  </p>
                </div>
                <PrescriptionUpload />
              </div>
            </CardContent>
          </Card>
        )}

        {extractedMedIds.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl text-sm">
            <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
            <p className="flex-1 text-teal-800 dark:text-teal-200">
              Showing <span className="font-semibold">{extractedMedIds.length}</span> medicine(s) found in your prescription.
            </p>
            <Button variant="ghost" size="sm" className="text-teal-600 h-7" onClick={() => setExtractedMedIds([])}>
              Show all
            </Button>
          </div>
        )}

        {/* Rx warning — only if cart has Rx items, no prescription file, and no digital Rx linked */}
        {hasRxItems() && !prescriptionFile && !prescriptionId && (
          <div className="flex items-center gap-3 p-4 bg-warning/10 border border-warning/30 rounded-xl text-sm">
            <AlertCircle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-foreground">
              Your cart has prescription-required items. Please upload your prescription before checkout.
            </p>
          </div>
        )}

        {/* ── Search ─────────────────────────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, generic name, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* ── Category Filters ────────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              className="whitespace-nowrap shrink-0"
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* ── Medicine Grid ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? Array(6).fill(0).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-20 w-20 rounded-xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))
            : filtered.length === 0
            ? (
              <Card className="col-span-full">
                <CardContent className="py-16 text-center">
                  <Pill className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-40" />
                  <h3 className="font-semibold text-foreground">No medicines found</h3>
                  <p className="text-sm text-muted-foreground">Try a different search or category</p>
                </CardContent>
              </Card>
            )
            : filtered.map((medicine, i) => (
              <motion.div
                key={medicine.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className="h-16 w-16 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                        <Pill className="h-8 w-8 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-foreground text-sm leading-tight">{medicine.name}</h3>
                            <p className="text-xs text-muted-foreground">{medicine.genericName}</p>
                          </div>
                          {medicine.requiresPrescription && (
                            <Badge variant="outline" className="shrink-0 text-xs border-warning text-warning">Rx</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{medicine.dosageForm}</p>
                        <p className="text-xs text-muted-foreground">{medicine.manufacturer}</p>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{medicine.description}</p>

                    <div className="flex items-center justify-between mt-4">
                      <div>
                        <span className="text-lg font-bold text-primary">₱{medicine.price.toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground ml-1">per piece</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(medicine)}
                        disabled={!medicine.inStock}
                        variant={cart.find((item) => item.medicine.id === medicine.id) ? "secondary" : "default"}
                      >
                        {!medicine.inStock
                          ? "Out of Stock"
                          : cart.find((item) => item.medicine.id === medicine.id)
                          ? "Add More"
                          : "Add to Cart"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          }
        </div>
      </div>
    </DashboardLayout>
  );
}
