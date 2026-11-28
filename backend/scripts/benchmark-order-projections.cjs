// Read-only benchmark. Run inside the API container or with DATABASE_URL set.
const { PrismaClient } = require('@prisma/client');
const path = require('node:path');
const { orderInclude, providerOrderViewInclude, createdOrderInclude } = require(
  path.join(
    process.cwd(),
    'dist/src/modules/orders/application/persistence/order.presenter',
  ),
);
let queries = 0;
const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
prisma.$on('query', () => queries++);
const acceptInclude = {
  provider: { select: { wallet: { select: { id: true } } } },
};
const pendingInclude = Object.fromEntries(
  Object.entries(providerOrderViewInclude).filter(([key]) =>
    [
      'provider',
      'customer',
      'providerService',
      'statusHistory',
      'walletHold',
    ].includes(key),
  ),
);
const summary = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: Math.round(sorted[Math.floor(sorted.length * 0.5)]),
    p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
  };
};
async function main() {
  const sample = await prisma.serviceOrder.findFirst({ select: { id: true } });
  if (!sample) throw new Error('No order available for read-only measurement.');
  const allVariants = {
    before: orderInclude,
    acceptRead: acceptInclude,
    response: providerOrderViewInclude,
    pendingResponse: pendingInclude,
    bookingBefore: createdOrderInclude,
    bookingAfter: { statusHistory: createdOrderInclude.statusHistory },
  };
  const requested = process.argv.slice(2);
  const variants = requested.length
    ? Object.fromEntries(
        requested.map((name) => {
          if (!allVariants[name]) throw new Error('Unknown benchmark variant');
          return [name, allVariants[name]];
        }),
      )
    : allVariants;
  const times = {},
    counts = {};
  for (const name of Object.keys(variants)) {
    times[name] = [];
    counts[name] = [];
  }
  for (let i = 0; i < 25; i++) {
    const names = Object.keys(variants);
    if (i % 2) names.reverse();
    for (const name of names) {
      queries = 0;
      const start = performance.now();
      await prisma.serviceOrder.findUniqueOrThrow({
        where: { id: sample.id },
        include: variants[name],
      });
      if (i >= 5) {
        times[name].push(performance.now() - start);
        counts[name].push(queries);
      }
    }
  }
  console.log(
    JSON.stringify(
      Object.fromEntries(
        Object.keys(variants).map((name) => [
          name,
          {
            ...summary(times[name]),
            queries: counts[name][0],
            samples: times[name].length,
          },
        ]),
      ),
    ),
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
