"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function PharmacySuccessRedirectInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const ref = searchParams.get("ref");
    router.replace(`/patient/pharmacy/orders/success${ref ? `?ref=${ref}` : ""}`);
  }, [searchParams, router]);

  return null;
}

export default function PharmacySuccessRedirect() {
  return (
    <Suspense>
      <PharmacySuccessRedirectInner />
    </Suspense>
  );
}
