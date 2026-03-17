import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type SquareConfig = {
  accessToken: string;
  environment: "sandbox" | "production";
  locationId: string;
};

export type CreateCheckoutLinkInput = {
  registrationId: string;
  amountInCents: number;
  eventName: string;
  directorEmail: string;
};

export type CreateCheckoutLinkResult = {
  checkoutUrl: string;
  squareOrderId: string;
};

export function getSquareConfig(): SquareConfig | null {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
  const locationId = process.env.SQUARE_LOCATION_ID?.trim();

  if (!accessToken || !locationId) {
    return null;
  }

  const rawEnv = process.env.SQUARE_ENVIRONMENT?.trim();
  const environment: "sandbox" | "production" = rawEnv === "production" ? "production" : "sandbox";

  return { accessToken, environment, locationId };
}

export function getSquareBaseUrl(environment: "sandbox" | "production"): string {
  return environment === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

type SquarePaymentLinkResponse = {
  payment_link: {
    url: string;
    order_id: string;
  };
};

/**
 * Creates a Square Checkout payment link for a registration.
 *
 * Signature verification for webhooks is handled by verifySquareWebhookSignature()
 * using Node.js crypto — no Square SDK required; the algorithm is identical.
 */
export async function createCheckoutLink(
  input: CreateCheckoutLinkInput,
): Promise<CreateCheckoutLinkResult> {
  const config = getSquareConfig();
  if (!config) {
    throw new Error(
      "Square is not configured. Set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.",
    );
  }

  const baseUrl = getSquareBaseUrl(config.environment);
  const response = await fetch(`${baseUrl}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2024-01-17",
    },
    body: JSON.stringify({
      idempotency_key: randomUUID(),
      order: {
        order: {
          location_id: config.locationId,
          reference_id: input.registrationId,
          line_items: [
            {
              name: input.eventName,
              quantity: "1",
              base_price_money: {
                amount: input.amountInCents,
                currency: "USD",
              },
            },
          ],
        },
      },
      pre_populated_data: {
        buyer_email: input.directorEmail,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Square API error ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as SquarePaymentLinkResponse;
  return {
    checkoutUrl: data.payment_link.url,
    squareOrderId: data.payment_link.order_id,
  };
}

/**
 * Verifies a Square webhook signature using HMAC-SHA256.
 *
 * Square computes: base64(HMAC-SHA256(signatureKey, notificationUrl + rawBody))
 * and sends the result in the x-square-hmacsha256-signature header.
 */
export function verifySquareWebhookSignature(input: {
  signatureKey: string;
  notificationUrl: string;
  rawBody: string;
  receivedSignature: string;
}): boolean {
  try {
    const hmac = createHmac("sha256", input.signatureKey);
    hmac.update(input.notificationUrl + input.rawBody);
    const expected = hmac.digest("base64");

    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(input.receivedSignature);

    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }

    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}
