"use server";

type PaymentMethod = "gcash" | "bank";

interface CreateCheckoutSessionInput {
  amount: number;
  doctorName: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  method: PaymentMethod;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

interface CreateCheckoutSessionResult {
  checkoutId: string;
  checkoutUrl: string;
}

const PAYMONGO_API_BASE = "https://api.paymongo.com/v1";

const getAuthHeader = () => {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey || secretKey.length < 10) {
    throw new Error(
      "PayMongo secret key is not configured. Set PAYMONGO_SECRET_KEY in .env.local with a real key from https://dashboard.paymongo.com"
    );
  }
  const token = Buffer.from(`${secretKey}:`).toString("base64");
  return `Basic ${token}`;
};

const toCentavos = (amount: number) => Math.round(amount * 100);

export async function createPaymongoCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<CreateCheckoutSessionResult> {
  const lineItemAmount = toCentavos(input.amount);

  const billing = {
    name: input.patientName,
    email: input.patientEmail,
    ...(input.patientPhone ? { phone: input.patientPhone } : {}),
  };

  const body = {
    data: {
      attributes: {
        payment_method_types: input.method === "gcash" ? ["gcash"] : ["card"],
        line_items: [
          {
            name: `Consultation with ${input.doctorName}`,
            amount: lineItemAmount,
            currency: "PHP",
            quantity: 1,
          },
        ],
        description: "Doctor consultation booking",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        billing,
        metadata: input.metadata ?? {},
        send_email_receipt: true,
      },
    },
  };

  let res;
  try {
    res = await fetch(`${PAYMONGO_API_BASE}/checkout_sessions`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error: any) {
    if (error.code === 'EAI_AGAIN' || error.cause?.code === 'EAI_AGAIN') {
      throw new Error("Unable to connect to PayMongo. Please check your internet connection and try again.");
    }
    throw new Error(`Network error: ${error.message || 'Unable to reach payment service'}`);
  }

  const json = await res.json();
  if (!res.ok) {
    const message =
      json?.errors?.[0]?.detail ||
      json?.errors?.[0]?.code ||
      "Failed to create PayMongo checkout session.";
    throw new Error(message);
  }

  const checkoutId = json?.data?.id as string | undefined;
  const checkoutUrl = json?.data?.attributes?.checkout_url as string | undefined;

  if (!checkoutId || !checkoutUrl) {
    throw new Error("PayMongo response missing checkout session data.");
  }

  return { checkoutId, checkoutUrl };
}

export async function retrievePaymongoCheckoutSession(checkoutId: string) {
  let res;
  try {
    res = await fetch(`${PAYMONGO_API_BASE}/checkout_sessions/${checkoutId}`, {
      method: "GET",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
  } catch (error: any) {
    if (error.code === 'EAI_AGAIN' || error.cause?.code === 'EAI_AGAIN') {
      throw new Error("Unable to connect to PayMongo. Please check your internet connection and try again.");
    }
    throw new Error(`Network error: ${error.message || 'Unable to reach payment service'}`);
  }

  const json = await res.json();
  if (!res.ok) {
    const message =
      json?.errors?.[0]?.detail ||
      json?.errors?.[0]?.code ||
      "Failed to retrieve PayMongo checkout session.";
    throw new Error(message);
  }

  return json?.data;
}
