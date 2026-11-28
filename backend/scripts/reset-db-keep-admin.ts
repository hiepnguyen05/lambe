import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { createClient } from 'redis';
import { ARGON2_OPTIONS } from '../src/modules/internal-auth/constants/password.constants';

const prisma = new PrismaClient();

// Standard 5 categories and services to seed if reseed is requested
const DEFAULT_CATALOG = [
  {
    code: 'HAIR_MEN',
    name: 'Tóc Nam',
    normalizedName: 'toc nam',
    slug: 'toc-nam',
    description: 'Dịch vụ cắt tóc, tạo kiểu, uốn nhuộm và chăm sóc tóc nam tại nhà.',
    iconUrl: 'scissors',
    sortOrder: 1,
    services: [
      {
        code: 'CAT_TOC_NAM_CO_BAN',
        name: 'Cắt Tóc Nam Cơ Bản',
        normalizedName: 'cat toc nam co ban',
        slug: 'cat-toc-nam-co-ban',
        description: 'Cắt tóc nam cơ bản, tỉa phom và tạo kiểu sáp chuẩn salon.',
        minPriceAmount: 30000,
        maxPriceAmount: 500000,
        defaultDurationMinutes: 45,
        targetAudience: 'MEN' as const,
        minExperienceYears: 2,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 1,
      },
      {
        code: 'UON_TOC_NAM',
        name: 'Uốn Tóc Nam',
        normalizedName: 'uon toc nam',
        slug: 'uon-toc-nam',
        description: 'Uốn phồng chân tóc, uốn sóng layer, uốn con sâu cho nam giới.',
        minPriceAmount: 100000,
        maxPriceAmount: 10000000,
        defaultDurationMinutes: 120,
        targetAudience: 'MEN' as const,
        minExperienceYears: 0,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 2,
      },
      {
        code: 'NHUOM_TOC_NAM',
        name: 'Nhuộm Tóc Nam',
        normalizedName: 'nhuom toc nam',
        slug: 'nhuom-toc-nam',
        description: 'Nhuộm màu thời trang, phủ bạc hoặc tẩy highlight tóc nam.',
        minPriceAmount: 100000,
        maxPriceAmount: 10000000,
        defaultDurationMinutes: 120,
        targetAudience: 'MEN' as const,
        minExperienceYears: 0,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 3,
      },
      {
        code: 'GOI_DAU_NAM',
        name: 'Gội Đầu Nam',
        normalizedName: 'goi dau nam',
        slug: 'goi-dau-nam',
        description: 'Gội sạch gàu, massage bấm huyệt da đầu thư giãn.',
        minPriceAmount: 50000,
        maxPriceAmount: 300000,
        defaultDurationMinutes: 30,
        targetAudience: 'MEN' as const,
        minExperienceYears: 0,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 4,
      },
      {
        code: 'COMBO_CAT_GOI_NAM',
        name: 'Combo Cắt & Gội Nam',
        normalizedName: 'combo cat goi nam',
        slug: 'combo-cat-goi-nam',
        description: 'Trọn gói cắt tóc nam, gội đầu sảng khoái và tạo kiểu tóc.',
        minPriceAmount: 100000,
        maxPriceAmount: 600000,
        defaultDurationMinutes: 60,
        targetAudience: 'MEN' as const,
        minExperienceYears: 1,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 5,
      },
    ],
  },
  {
    code: 'HAIR_WOMEN',
    name: 'Tóc Nữ',
    normalizedName: 'toc nu',
    slug: 'toc-nu',
    description: 'Dịch vụ cắt tóc tạo kiểu, uốn, nhuộm, phục hồi tóc nữ chuyên sâu.',
    iconUrl: 'flame',
    sortOrder: 2,
    services: [
      {
        code: 'CAT_TOC_NU',
        name: 'Cắt Tóc Nữ Tạo Kiểu',
        normalizedName: 'cat toc nu tao kieu',
        slug: 'cat-toc-nu-tao-kieu',
        description: 'Cắt layer, bob, pixie hoặc tỉa đuôi tóc nữ theo dáng khuôn mặt.',
        minPriceAmount: 100000,
        maxPriceAmount: 800000,
        defaultDurationMinutes: 60,
        targetAudience: 'WOMEN' as const,
        minExperienceYears: 2,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 1,
      },
      {
        code: 'UON_TOC_NU',
        name: 'Uốn Tóc Nữ',
        normalizedName: 'uon toc nu',
        slug: 'uon-toc-nu',
        description: 'Uốn setting, uốn lạnh, uốn sóng lơi tự nhiên cho nữ.',
        minPriceAmount: 300000,
        maxPriceAmount: 2500000,
        defaultDurationMinutes: 180,
        targetAudience: 'WOMEN' as const,
        minExperienceYears: 2,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 2,
      },
      {
        code: 'NHUOM_TOC_NU',
        name: 'Nhuộm Tóc Nữ Thời Trang',
        normalizedName: 'nhuom toc nu thoi trang',
        slug: 'nhuom-toc-nu-thoi-trang',
        description: 'Nhuộm màu thời trang, balayage, ombre, tẩy tone cao cấp.',
        minPriceAmount: 350000,
        maxPriceAmount: 3000000,
        defaultDurationMinutes: 150,
        targetAudience: 'WOMEN' as const,
        minExperienceYears: 1,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 3,
      },
      {
        code: 'PHUC_HOO_TOC',
        name: 'Phục Hồi Tóc Chuyên Sâu',
        normalizedName: 'phuc hoi toc chuyen sau',
        slug: 'phuc-hoi-toc-chuyen-sau',
        description: 'Hấp collagen, phủ bóng keratin phục hồi tóc hư tổn nặng.',
        minPriceAmount: 200000,
        maxPriceAmount: 1500000,
        defaultDurationMinutes: 90,
        targetAudience: 'WOMEN' as const,
        minExperienceYears: 1,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 4,
      },
    ],
  },
  {
    code: 'NAIL',
    name: 'Nail & Móng',
    normalizedName: 'nail mong',
    slug: 'nail-mong',
    description: 'Chăm sóc móng tay, móng chân, sơn gel và thiết kế nail nghệ thuật.',
    iconUrl: 'palette',
    sortOrder: 3,
    services: [
      {
        code: 'SON_GEL_MONG_TAY',
        name: 'Sơn Gel Móng Tay',
        normalizedName: 'son gel mong tay',
        slug: 'son-gel-mong-tay',
        description: 'Cắt da, dũa phom và sơn gel màu sắc bền đẹp cao cấp.',
        minPriceAmount: 100000,
        maxPriceAmount: 400000,
        defaultDurationMinutes: 45,
        targetAudience: 'WOMEN' as const,
        minExperienceYears: 1,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 1,
      },
      {
        code: 'CAT_DA_VE_MONG',
        name: 'Cắt Da & Chăm Sóc Móng',
        normalizedName: 'cat da cham soc mong',
        slug: 'cat-da-cham-soc-mong',
        description: 'Làm sạch da chết quanh móng, cắt tỉa gọn gàng và dưỡng ẩm viền móng.',
        minPriceAmount: 60000,
        maxPriceAmount: 200000,
        defaultDurationMinutes: 30,
        targetAudience: 'ALL' as const,
        minExperienceYears: 1,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 2,
      },
      {
        code: 'UP_MONG_THIET_KE',
        name: 'Úp Móng & Thiết Kế Nail',
        normalizedName: 'up mong thiet ke nail',
        slug: 'up-mong-thiet-ke-nail',
        description: 'Nối móng tip/úp, đắp gel, ẩn hoa khô, vẽ họa tiết và đính đá nghệ thuật.',
        minPriceAmount: 200000,
        maxPriceAmount: 800000,
        defaultDurationMinutes: 90,
        targetAudience: 'WOMEN' as const,
        minExperienceYears: 2,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 3,
      },
    ],
  },
  {
    code: 'SPA_MASSAGE',
    name: 'Spa & Chăm Sóc Da',
    normalizedName: 'spa cham soc da',
    slug: 'spa-cham-soc-da',
    description: 'Gội đầu dưỡng sinh thư giãn, chăm sóc da mặt và massage trị liệu.',
    iconUrl: 'sparkles',
    sortOrder: 4,
    services: [
      {
        code: 'GOI_DAU_DUONG_SINH',
        name: 'Gội Đầu Dưỡng Sinh',
        normalizedName: 'goi dau duong sinh',
        slug: 'goi-dau-duong-sinh',
        description: 'Gội đầu canh thảo dược kết hợp bấm huyệt vùng đầu, massage cổ vai gáy.',
        minPriceAmount: 120000,
        maxPriceAmount: 500000,
        defaultDurationMinutes: 60,
        targetAudience: 'ALL' as const,
        minExperienceYears: 1,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 1,
      },
      {
        code: 'CHAM_SOC_DA_MAT',
        name: 'Chăm Sóc Da Mặt Chuyên Sâu',
        normalizedName: 'cham soc da mat chuyen sau',
        slug: 'cham-soc-da-mat-chuyen-sau',
        description: 'Làm sạch sâu, hút bã nhờn, điện di tinh chất và đắp mặt nạ phục hồi.',
        minPriceAmount: 250000,
        maxPriceAmount: 1200000,
        defaultDurationMinutes: 75,
        targetAudience: 'ALL' as const,
        minExperienceYears: 1,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 2,
      },
      {
        code: 'MASSAGE_CO_VAI_GAY',
        name: 'Massage Trị Liệu Cổ Vai Gáy',
        normalizedName: 'massage tri lieu co vai gay',
        slug: 'massage-tri-lieu-co-vai-gay',
        description: 'Xoa bóp, ấn huyệt giải tỏa căng cơ vùng cổ vai gáy cho dân văn phòng.',
        minPriceAmount: 150000,
        maxPriceAmount: 600000,
        defaultDurationMinutes: 60,
        targetAudience: 'ALL' as const,
        minExperienceYears: 1,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 3,
      },
    ],
  },
  {
    code: 'MAKEUP',
    name: 'Trang Điểm (Makeup)',
    normalizedName: 'trang diem makeup',
    slug: 'trang-diem-makeup',
    description: 'Dịch vụ trang điểm dự tiệc, sự kiện, chụp ảnh kỷ yếu và cô dâu tận nơi.',
    iconUrl: 'wand_2',
    sortOrder: 5,
    services: [
      {
        code: 'MAKEUP_DU_TIEC',
        name: 'Trang Điểm Dự Tiệc',
        normalizedName: 'trang diem du tiec',
        slug: 'trang-diem-du-tiec',
        description: 'Trang điểm và làm tóc dự tiệc theo phong cách Hàn Quốc, Tây hoặc tự nhiên.',
        minPriceAmount: 250000,
        maxPriceAmount: 1000000,
        defaultDurationMinutes: 60,
        targetAudience: 'WOMEN' as const,
        minExperienceYears: 2,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 1,
      },
      {
        code: 'MAKEUP_CO_DAU',
        name: 'Trang Điểm Cô Dâu',
        normalizedName: 'trang diem co dau',
        slug: 'trang-diem-co-dau',
        description: 'Gói trang điểm cô dâu ngày cưới hoặc ăn hỏi, kèm phụ kiện và làm tóc.',
        minPriceAmount: 800000,
        maxPriceAmount: 3500000,
        defaultDurationMinutes: 120,
        targetAudience: 'WOMEN' as const,
        minExperienceYears: 3,
        requiresCertificate: false,
        minPortfolioImages: 0,
        sortOrder: 2,
      },
    ],
  },
];

async function clearRedisCache() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('ℹ️  REDIS_URL không được cấu hình, bỏ qua dọn dẹp Redis.');
    return;
  }

  try {
    console.log('🔄 Đang kết nối Redis để xóa cache...');
    const client = createClient({ url: redisUrl });
    await client.connect();
    await client.flushDb();
    await client.disconnect();
    console.log('✅ Đã xóa toàn bộ cache Redis (FLUSHDB thành công).');
  } catch (error) {
    console.warn('⚠️  Không thể kết nối hoặc xóa Redis cache:', error instanceof Error ? error.message : error);
  }
}

async function seedCatalog(adminAccountId: string) {
  console.log('🌱 Đang nạp lại 5 danh mục và dịch vụ tiêu chuẩn...');
  for (const catData of DEFAULT_CATALOG) {
    const { services, ...catFields } = catData;
    const category = await prisma.serviceCategory.upsert({
      where: { code: catFields.code },
      create: {
        ...catFields,
        status: 'ACTIVE',
        createdById: adminAccountId,
        updatedById: adminAccountId,
      },
      update: {
        name: catFields.name,
        normalizedName: catFields.normalizedName,
        slug: catFields.slug,
        description: catFields.description,
        iconUrl: catFields.iconUrl,
        sortOrder: catFields.sortOrder,
        status: 'ACTIVE',
      },
    });

    for (const serviceData of services) {
      await prisma.service.upsert({
        where: { code: serviceData.code },
        create: {
          ...serviceData,
          categoryId: category.id,
          currencyCode: 'VND',
          status: 'ACTIVE',
          createdById: adminAccountId,
          updatedById: adminAccountId,
        },
        update: {
          name: serviceData.name,
          normalizedName: serviceData.normalizedName,
          slug: serviceData.slug,
          description: serviceData.description,
          minPriceAmount: serviceData.minPriceAmount,
          maxPriceAmount: serviceData.maxPriceAmount,
          defaultDurationMinutes: serviceData.defaultDurationMinutes,
          targetAudience: serviceData.targetAudience,
          minExperienceYears: serviceData.minExperienceYears,
          requiresCertificate: serviceData.requiresCertificate,
          minPortfolioImages: serviceData.minPortfolioImages,
          sortOrder: serviceData.sortOrder,
          status: 'ACTIVE',
        },
      });
    }
  }
  console.log('✅ Đã nạp thành công 5 danh mục chuẩn và các dịch vụ mẫu.');
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const wipeCatalog = process.argv.includes('--keep-admin-only') || process.argv.includes('--wipe-catalog');
  const keepCatalog = process.argv.includes('--keep-catalog');
  // Mặc định: dọn sạch và nạp lại catalog chuẩn trừ khi được yêu cầu xóa sạch cả catalog hoặc giữ nguyên catalog
  const reseedCatalog = !wipeCatalog && !keepCatalog;

  console.log('====================================================');
  console.log('  LAMBE DATABASE RESET & CLEANUP SCRIPT');
  console.log('====================================================');
  console.log(`Chế độ: ${isDryRun ? '🔍 DRY RUN (Không thay đổi dữ liệu)' : '⚡ THỰC THI (Xóa dữ liệu)'}`);
  console.log(`Xử lý catalog dịch vụ: ${
    wipeCatalog ? '🗑️ Xóa trắng cả danh mục và dịch vụ (Chỉ giữ lại admin)' :
    keepCatalog ? '🔒 Giữ nguyên danh mục và dịch vụ hiện có' :
    '🌱 Xóa rác và nạp lại 5 danh mục dịch vụ chuẩn'
  }`);
  console.log('----------------------------------------------------');

  await prisma.$connect();

  // 1. Tìm hoặc tạo tài khoản Admin hợp lệ
  let adminAccounts = await prisma.internalAccount.findMany({
    where: {
      roles: {
        some: {
          role: 'ADMIN',
        },
      },
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      roles: { select: { role: true } },
    },
  });

  if (adminAccounts.length === 0) {
    console.log('⚠️ Không tìm thấy tài khoản admin nào! Đang tạo tài khoản admin mặc định: adminhiep...');
    if (!isDryRun) {
      const passwordHash = await argon2.hash('ngochiep20122005', ARGON2_OPTIONS);
      const createdAdmin = await prisma.internalAccount.create({
        data: {
          username: 'adminhiep',
          normalizedUsername: 'adminhiep',
          fullName: 'Nguyễn Ngọc Hiệp',
          email: 'adminhiep@lambe.vn',
          status: 'ACTIVE',
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          credential: {
            create: { passwordHash },
          },
          roles: {
            create: { role: 'ADMIN' },
          },
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          roles: { select: { role: true } },
        },
      });
      adminAccounts = [createdAdmin];
    }
  }

  const adminIds = adminAccounts.map((a) => a.id);
  console.log('🛡️  Tài khoản ADMIN được BẢO TỒN:');
  for (const acc of adminAccounts) {
    console.log(`   - [${acc.username}] ${acc.fullName} (${acc.email || 'No email'}) - ID: ${acc.id}`);
  }

  // 2. Lấy danh sách toàn bộ các bảng trong schema public
  const rawTables: Array<{ table_name: string }> = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const allTableNames = rawTables.map((t) => t.table_name);

  // Bảng không bao giờ được xóa:
  const PROTECTED_TABLES = new Set([
    '_prisma_migrations',
    'feed_cache_state',
    'internal_accounts',
    'internal_credentials',
    'internal_role_assignments',
  ]);

  const CATALOG_TABLES = new Set([
    'service_categories',
    'services',
  ]);

  // Các bảng cần TRUNCATE:
  const tablesToTruncate = allTableNames.filter((name) => {
    if (PROTECTED_TABLES.has(name)) return false;
    if (CATALOG_TABLES.has(name)) {
      return wipeCatalog || reseedCatalog;
    }
    return true;
  });

  console.log(`\n📋 Tổng số bảng cần dọn dẹp: ${tablesToTruncate.length}/${allTableNames.length} bảng.`);

  if (isDryRun) {
    console.log('\n[DRY RUN] Danh sách các bảng sẽ bị TRUNCATE:');
    console.log(tablesToTruncate.join(', '));
    console.log('\n[DRY RUN] Các tài khoản nội bộ không phải Admin sẽ bị xóa.');
    return;
  }

  // 3. Thực hiện TRUNCATE CASCADE tất cả bảng cần dọn
  if (tablesToTruncate.length > 0) {
    console.log('\n🧹 Đang xóa sạch dữ liệu từ các bảng...');
    const quotedTables = tablesToTruncate.map((t) => `"${t}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} CASCADE;`);
    console.log('✅ Đã xóa sạch toàn bộ đơn hàng, thợ, khách, ví, chat, bài viết, thông báo.');
  }

  // 4. Dọn dẹp tài khoản nội bộ không phải Admin
  console.log('🧹 Đang dọn dẹp các tài khoản nội bộ phụ / test...');
  await prisma.$executeRawUnsafe(`DELETE FROM "internal_sessions";`);
  await prisma.$executeRawUnsafe(`DELETE FROM "internal_setup_tokens";`);

  const placeholders = adminIds.map((_, i) => `$${i + 1}`).join(', ');
  if (placeholders) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "internal_credentials" WHERE "internal_account_id" NOT IN (${adminIds.map((id) => `'${id}'`).join(', ')});`
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "internal_role_assignments" WHERE "internal_account_id" NOT IN (${adminIds.map((id) => `'${id}'`).join(', ')});`
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "internal_accounts" WHERE "id" NOT IN (${adminIds.map((id) => `'${id}'`).join(', ')});`
    );
  }
  console.log('✅ Đã dọn dẹp các tài khoản phụ.');

  // 5. Nạp lại catalog chuẩn nếu được yêu cầu
  if (reseedCatalog && adminAccounts[0]) {
    await seedCatalog(adminAccounts[0].id);
  }

  // 6. Xóa cache Redis
  await clearRedisCache();

  // 7. Thống kê kết quả sau khi dọn dẹp
  const [
    remainingUsers,
    remainingInternal,
    remainingOrders,
    remainingCategories,
    remainingServices,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.internalAccount.count(),
    prisma.serviceOrder.count(),
    prisma.serviceCategory.count(),
    prisma.service.count(),
  ]);

  console.log('\n====================================================');
  console.log('  KẾT QUẢ SAU KHI DỌN DẸP DATABASE');
  console.log('====================================================');
  console.log(`👥 Tài khoản người dùng (Khách & Thợ): ${remainingUsers} (đã xóa hết)`);
  console.log(`📦 Đơn hàng (Orders):                  ${remainingOrders} (đã xóa hết)`);
  console.log(`🛡️  Tài khoản Admin nội bộ:            ${remainingInternal} (được bảo tồn)`);
  console.log(`📂 Danh mục dịch vụ:                   ${remainingCategories}`);
  console.log(`✂️  Dịch vụ:                            ${remainingServices}`);
  console.log('====================================================');
  console.log('🎉 Hoàn tất dọn dẹp database an toàn thành công!\n');
}

main()
  .catch((err) => {
    console.error('❌ Lỗi khi thực thi reset database:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
