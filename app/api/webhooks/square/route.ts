import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { PaymentStatus } from "@prisma/client";

import { sendRegistrationReceiptEmail } from "../../../../lib/email/resend";
import { verifySquareWebhookSignature } from "../../../../lib/payments/square";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

// In-memory rate limiting: max 100 requests per minute per IP.
// Acceptable for single-instance deployments; replace with a DB-backed
// bucket (like AuthRateLimitBucket) if horizontal scaling is required.
const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1_000;
const RATE_LIMIT_MAX = 100;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);

  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(ip, { count: 1, windowStart: now });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return "unknown";
}

type SquarePaymentObject = {
  id?: string;
  order_id?: string;
  status?: string;
};

type SquareWebhookEvent = {
  type?: string;
  data?: {
    object?: {
      payment?: SquarePaymentObject;
    };
  };
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!signatureKey) {
    console.error("SQUARE_WEBHOOK_SIGNATURE_KEY is not configured.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const receivedSignature = request.headers.get("x-square-hmacsha256-signature");
  if (!receivedSignature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 401 });
  }

  const rawBody = await request.text();

  // Build the canonical notification URL used when signing this webhook in Square's dashboard.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const notificationUrl = `${appUrl}/api/webhooks/square`;

  const isValid = verifySquareWebhookSignature({
    signatureKey,
    notificationUrl,
    rawBody,
    receivedSignature,
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: SquareWebhookEvent;
  try {
    event = JSON.parse(rawBody) as SquareWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Acknowledge all event types; only process payment.completed.
  if (event.type !== "payment.completed") {
    return NextResponse.json({ ok: true });
  }

  const payment = event.data?.object?.payment;
  const squarePaymentId = payment?.id;
  const squareOrderId = payment?.order_id;

  if (!squarePaymentId || !squareOrderId) {
    return NextResponse.json({ error: "Missing payment or order ID." }, { status: 400 });
  }

  const registration = await prisma.eventRegistration.findFirst({
    where: { squareOrderId },
    select: {
      id: true,
      paymentStatus: true,
      _count: { select: { attendees: true } },
      club: {
        select: {
          name: true,
          memberships: {
            where: { isPrimary: true },
            select: {
              user: { select: { email: true } },
            },
            take: 1,
          },
        },
      },
      event: { select: { name: true } },
    },
  });

  if (!registration) {
    // No matching registration — unrelated Square order; acknowledge gracefully.
    return NextResponse.json({ ok: true });
  }

  if (registration.paymentStatus === PaymentStatus.PAID) {
    // Idempotency: already processed this payment.
    return NextResponse.json({ ok: true });
  }

  await prisma.eventRegistration.update({
    where: { id: registration.id },
    data: {
      paymentStatus: PaymentStatus.PAID,
      amountPaid: 0, // actual amount will be updated in a future reconciliation step
      squarePaymentId,
    },
  });

  revalidatePath("/director/events");
  revalidatePath("/admin/events");

  // Send registration confirmation email to the club's primary director.
  const directorEmail = registration.club.memberships[0]?.user.email ?? null;
  if (directorEmail) {
    try {
      await sendRegistrationReceiptEmail({
        to: directorEmail,
        clubName: registration.club.name,
        eventName: registration.event.name,
        attendeeCount: registration._count.attendees,
      });
    } catch (emailError) {
      // Non-fatal: payment is already recorded.
      console.error("Payment confirmed but confirmation email failed to send.", emailError);
    }
  }

  return NextResponse.json({ ok: true });
}
