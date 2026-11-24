import 'dotenv/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';

const apiBase = process.env.LAMBE_TEST_API_BASE ?? 'http://localhost:5000/api';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api$/.test(apiBase)) {
  throw new Error('This helper only runs against a local Lambe API.');
}

const customerPhone = process.env.LAMBE_TEST_CUSTOMER_PHONE ?? '0999999999';
const providerPhone = process.env.LAMBE_TEST_PROVIDER_PHONE ?? '0777777777';
const existingOrderId = process.env.LAMBE_TEST_ORDER_ID;
const existingOrderAction = process.env.LAMBE_TEST_ORDER_ACTION ?? 'ARRIVE';
const stopAt = process.env.LAMBE_TEST_STOP_AT ?? 'EN_ROUTE';
const latitude = Number(process.env.LAMBE_TEST_LATITUDE ?? '21.0285');
const longitude = Number(process.env.LAMBE_TEST_LONGITUDE ?? '105.8542');
if (!['PENDING_PROVIDER', 'ACCEPTED', 'EN_ROUTE'].includes(stopAt)) {
  throw new Error('LAMBE_TEST_STOP_AT must be PENDING_PROVIDER, ACCEPTED or EN_ROUTE.');
}
const configuredDatabaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;
if (!configuredDatabaseUrl || !jwtSecret) {
  throw new Error('DATABASE_URL and JWT_SECRET are required.');
}
process.env.DATABASE_URL = configuredDatabaseUrl.replace(
  '@postgres:5432',
  '@localhost:5433',
);
const prisma = new PrismaClient();
const jwt = new JwtService({ secret: jwtSecret });

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message ?? `HTTP ${response.status}`;
    throw new Error(`${options.method ?? 'GET'} ${url}: ${message}`);
  }
  return body?.data ?? body;
}

async function localSession(phone) {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || user.status !== 'ACTIVE') {
    throw new Error(`Active local test user ${phone} was not found.`);
  }
  const sessionId = randomUUID();
  await prisma.userSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      refreshTokenHash: createHash('sha256')
        .update(randomBytes(64))
        .digest('hex'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      userAgent: 'local-order-test-script',
      ipAddress: '127.0.0.1',
    },
  });
  return jwt.sign(
    { sub: user.id, phone, sessionId, purpose: 'access' },
    { expiresIn: '15m' },
  );
}

function bearer(token) {
  return { authorization: `Bearer ${token}` };
}

async function main() {
  const [customerToken, providerToken] = await Promise.all([
    localSession(customerPhone),
    localSession(providerPhone),
  ]);

  if (existingOrderId) {
    const result =
      existingOrderAction === 'CANCEL'
        ? await jsonRequest(
            `${apiBase}/me/provider/orders/${existingOrderId}/cancel`,
            {
              method: 'POST',
              headers: bearer(providerToken),
              body: JSON.stringify({
                reason: 'Dọn đơn local bị bỏ dở trước lượt kiểm thử mới.',
              }),
            },
          )
        : await jsonRequest(
            `${apiBase}/me/provider/orders/${existingOrderId}/arrive`,
            {
              method: 'POST',
              headers: bearer(providerToken),
              body: JSON.stringify({
                latitude,
                longitude,
                accuracyMeters: 5,
                capturedAt: new Date().toISOString(),
              }),
            },
          );
    console.log(
      JSON.stringify(
        { orderId: existingOrderId, finalStatus: result.status },
        null,
        2,
      ),
    );
    return;
  }

  const offerings = await jsonRequest(`${apiBase}/me/provider/services`, {
    headers: bearer(providerToken),
  });
  const offering = offerings.find(
    (item) =>
      item.status === 'ACTIVE' && item.service?.name === 'Cắt tóc nam cơ bản',
  ) ?? offerings.find((item) => item.status === 'ACTIVE');
  if (!offering) throw new Error('The test provider has no active service.');

  const capturedAt = new Date().toISOString();
  await jsonRequest(`${apiBase}/me/provider/availability/online`, {
    method: 'POST',
    headers: bearer(providerToken),
    body: JSON.stringify({
      latitude,
      longitude,
      accuracyMeters: 5,
      capturedAt,
      sequence: Date.parse(capturedAt),
    }),
  });

  const orderBase = {
    providerServiceId: offering.id,
    inlineAddress: {
      label: 'Địa chỉ kiểm thử',
      addressLine: 'Khu vực Hoàn Kiếm, Hà Nội',
      latitude,
      longitude,
      provinceName: 'Hà Nội',
      districtName: 'Hoàn Kiếm',
    },
    bookingType: 'ASAP',
  };
  const quote = await jsonRequest(`${apiBase}/orders/quote`, {
    method: 'POST',
    headers: bearer(customerToken),
    body: JSON.stringify(orderBase),
  });
  if (quote.available === false || !quote.quoteToken) {
    throw new Error(`Quote unavailable: ${quote.reason ?? 'missing quote token'}`);
  }

  const order = await jsonRequest(`${apiBase}/orders`, {
    method: 'POST',
    headers: {
      ...bearer(customerToken),
      'idempotency-key': `localtest-${Date.now()}`,
    },
    body: JSON.stringify({
      ...orderBase,
      quoteToken: quote.quoteToken,
      contactName: 'Khách kiểm thử',
      contactPhone: customerPhone,
      customerNote: 'Đơn tự động phục vụ kiểm thử mobile local.',
    }),
  });

  if (stopAt === 'PENDING_PROVIDER') {
    console.log(
      JSON.stringify(
        {
          orderId: order.id,
          service: offering.service?.name ?? offering.id,
          quoteTotalAmount: quote.totalAmount,
          finalStatus: order.status,
        },
        null,
        2,
      ),
    );
    return;
  }

  const accepted = await jsonRequest(
    `${apiBase}/me/provider/orders/${order.id}/accept`,
    { method: 'POST', headers: bearer(providerToken), body: '{}' },
  );
  if (stopAt === 'ACCEPTED') {
    console.log(
      JSON.stringify(
        {
          orderId: order.id,
          service: offering.service?.name ?? offering.id,
          quoteTotalAmount: quote.totalAmount,
          createdStatus: order.status,
          finalStatus: accepted.status,
        },
        null,
        2,
      ),
    );
    return;
  }
  const enRoute = await jsonRequest(
    `${apiBase}/me/provider/orders/${order.id}/en-route`,
    { method: 'POST', headers: bearer(providerToken), body: '{}' },
  );

  console.log(
    JSON.stringify(
      {
        orderId: order.id,
        service: offering.service?.name ?? offering.id,
        quoteTotalAmount: quote.totalAmount,
        createdStatus: order.status,
        acceptedStatus: accepted.status,
        finalStatus: enRoute.status,
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
