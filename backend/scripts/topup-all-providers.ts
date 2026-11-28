import 'dotenv/config';
import { PrismaClient, WalletTransactionType } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TOPUP_AMOUNT = 1_000_000; // 1.000.000 VNĐ

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

function getArgument(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (arg) {
    return arg.split('=')[1]?.trim();
  }
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && index + 1 < process.argv.length
    ? process.argv[index + 1]?.trim()
    : undefined;
}

async function main() {
  const isExecute =
    process.argv.includes('--execute') || process.argv.includes('--run');
  const amountArg = getArgument('amount');
  const topUpAmount = amountArg ? parseInt(amountArg, 10) : DEFAULT_TOPUP_AMOUNT;

  if (isNaN(topUpAmount) || topUpAmount <= 0) {
    throw new Error('Số tiền nạp không hợp lệ. Vui lòng nhập số dương.');
  }

  console.log('====================================================');
  console.log('  LAMBE PROVIDER WALLET BULK TOP-UP SCRIPT');
  console.log('====================================================');
  console.log(`Số tiền nạp mỗi đối tác: ${formatVND(topUpAmount)}`);
  console.log(
    `Chế độ: ${
      isExecute
        ? '⚡ THỰC THI (ĐANG CẬP NHẬT DATABASE THẬT)'
        : '🔍 XEM TRƯỚC / DRY-RUN (Chưa thay đổi dữ liệu)'
    }`,
  );
  console.log('----------------------------------------------------');

  await prisma.$connect();

  // 1. Lấy danh sách tất cả ProviderProfile trong hệ thống
  const providers = await prisma.providerProfile.findMany({
    include: {
      user: {
        select: {
          id: true,
          phone: true,
          fullName: true,
        },
      },
      wallet: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (providers.length === 0) {
    console.log('ℹ️ Không tìm thấy tài khoản đối tác (ProviderProfile) nào trong database.');
    return;
  }

  console.log(`📋 Tìm thấy tổng cộng: ${providers.length} đối tác.`);
  console.log('Chi tiết danh sách:');

  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    const name = p.displayName || p.user.fullName || 'Đối tác';
    const phone = p.user.phone;
    const currentBalance = p.wallet?.balanceAmount ?? 0;
    const newBalance = currentBalance + topUpAmount;

    console.log(
      `  ${i + 1}. [${p.id.slice(0, 8)}] ${name} (${phone}) | Số dư hiện tại: ${formatVND(
        currentBalance,
      )} ➡️ Số dư mới: ${formatVND(newBalance)}`,
    );
  }

  console.log('----------------------------------------------------');

  if (!isExecute) {
    console.log('\n⚠️  ĐÂY LÀ CHẾ ĐỘ XEM TRƯỚC (DRY RUN). CHƯA CÓ DỮ LIỆU NÀO ĐƯỢC THAY ĐỔI.');
    console.log('👉 Để thực thi nạp tiền vào database thật, vui lòng chạy lệnh:');
    console.log('   npm run provider:topup-all -- --execute\n');
    console.log('   (Hoặc: npx ts-node scripts/topup-all-providers.ts --execute)');
    return;
  }

  // 2. Thực thi nạp tiền thật sự
  console.log('\n⚡ Đang thực thi nạp tiền vào ví của các đối tác...');
  const runTimestamp = Date.now();
  let updatedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const p of providers) {
      let wallet = p.wallet;

      // Nếu đối tác chưa có ví, tự động khởi tạo ví
      if (!wallet) {
        wallet = await tx.providerWallet.create({
          data: {
            providerId: p.id,
            balanceAmount: 0,
            heldAmount: 0,
            currencyCode: 'VND',
          },
        });
      }

      const balanceBefore = wallet.balanceAmount;
      const balanceAfter = balanceBefore + topUpAmount;

      // Cập nhật số dư ví
      await tx.providerWallet.update({
        where: { id: wallet.id },
        data: {
          balanceAmount: balanceAfter,
        },
      });

      // Tạo lịch sử giao dịch ví (WalletTransaction)
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.TOP_UP,
          amount: topUpAmount,
          balanceBeforeAmount: balanceBefore,
          balanceAfterAmount: balanceAfter,
          heldBeforeAmount: wallet.heldAmount,
          heldAfterAmount: wallet.heldAmount,
          idempotencyKey: `admin-bulk-topup:${wallet.id}:${runTimestamp}`,
          reason: `Nạp tiền hệ thống (${formatVND(topUpAmount)})`,
        },
      });

      // Cập nhật tín hiệu ví để sync notification
      await tx.providerWalletSignal.upsert({
        where: { walletId: wallet.id },
        create: { walletId: wallet.id, updatedAt: new Date() },
        update: { updatedAt: new Date() },
      });

      updatedCount++;
    }
  });

  console.log(`\n🎉 Thành công! Đã nạp ${formatVND(topUpAmount)} vào ví của ${updatedCount} đối tác.`);
  console.log('====================================================\n');
}

main()
  .catch((err) => {
    console.error('❌ Lỗi khi thực thi top-up:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
