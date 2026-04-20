"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function PharmacyCancelRedirectInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const ref = searchParams.get("ref");
    router.replace(`/patient/pharmacy/orders/cancel${ref ? `?ref=${ref}` : ""}`);
  }, [searchParams, router]);

  return null;
}

export default function PharmacyCancelRedirect() {
  return (
    <Suspense>
      <PharmacyCancelRedirectInner />
    </Suspense>
  );
}
