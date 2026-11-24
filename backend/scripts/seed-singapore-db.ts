import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { ARGON2_OPTIONS } from '../src/modules/internal-auth/constants/password.constants';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Sr4a8vLQTXFo@ep-orange-cherry-biptcqbf.c-5.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const prisma = new PrismaClient({
  datasources: {
    db: { url: DATABASE_URL },
  },
});

async function main() {
  console.log('Connecting to new Neon Singapore DB...');
  await prisma.$connect();
  console.log('Connected!');

  // 1. Create Admin Account
  const username = 'adminhiep';
  const normalizedUsername = 'adminhiep';
  const fullName = 'Nguyễn Ngọc Hiệp';
  const rawPassword = 'ngochiep20122005';

  const passwordHash = await argon2.hash(rawPassword, ARGON2_OPTIONS);

  const adminAccount = await prisma.internalAccount.upsert({
    where: { normalizedUsername },
    create: {
      username,
      normalizedUsername,
      fullName,
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
    update: {
      status: 'ACTIVE',
      mustChangePassword: false,
      credential: {
        upsert: {
          create: { passwordHash },
          update: { passwordHash },
        },
      },
    },
  });

  console.log(`Admin account ready: ${adminAccount.username} (${adminAccount.id})`);

  // 2. Define Categories and Services
  const catalogData = [
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
          code: 'PHUC_HOI_TOC',
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

  for (const catData of catalogData) {
    const { services, ...catFields } = catData;
    const category = await prisma.serviceCategory.upsert({
      where: { code: catFields.code },
      create: {
        ...catFields,
        status: 'ACTIVE',
        createdById: adminAccount.id,
        updatedById: adminAccount.id,
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

    console.log(`Category: ${category.name} (${category.code})`);

    for (const serviceData of services) {
      const service = await prisma.service.upsert({
        where: { code: serviceData.code },
        create: {
          ...serviceData,
          categoryId: category.id,
          currencyCode: 'VND',
          status: 'ACTIVE',
          createdById: adminAccount.id,
          updatedById: adminAccount.id,
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
      console.log(`  - Service: ${service.name} (${service.code})`);
    }
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
