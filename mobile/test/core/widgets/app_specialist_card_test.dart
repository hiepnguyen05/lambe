import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/widgets/app_specialist_card.dart';
import 'package:mobile/features/customer/booking/domain/entities/booking_provider_candidate_entity.dart';
import 'package:mobile/features/customer/catalog/domain/entities/nearby_technician_entity.dart';

void main() {
  group('AppSpecialistCard Widget Tests', () {
    testWidgets('renders from SpecialistItem correctly and responds to tap', (
      tester,
    ) async {
      bool booked = false;
      bool cardTapped = false;

      const specialist = SpecialistItem(
        id: 'spec_1',
        name: 'Nguyễn Thị Hoa',
        specialty: 'Chuyên viên Massage & Trị liệu',
        avatarUrl: '',
        rating: 4.9,
        reviewCount: 88,
        distance: '1.5 km',
        eta: '20 phút',
        startingPrice: 250000,
        isOnline: true,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppSpecialistCard.fromSpecialistItem(
              specialist: specialist,
              onBookTap: () => booked = true,
              onCardTap: () => cardTapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Nguyễn Thị Hoa'), findsOneWidget);
      expect(find.text('Chuyên viên Massage & Trị liệu'), findsOneWidget);
      expect(find.text('4.9'), findsOneWidget);
      expect(find.text('(88)'), findsOneWidget);
      expect(find.text('từ 250.000 đ'), findsOneWidget);
      expect(find.text('1.5 km'), findsOneWidget);
      expect(find.text('Đặt lịch'), findsOneWidget);

      await tester.tap(find.text('Đặt lịch'));
      await tester.pump();
      expect(booked, isTrue);

      await tester.tap(find.text('Nguyễn Thị Hoa'));
      await tester.pump();
      expect(cardTapped, isTrue);
    });

    testWidgets('renders from NearbyTechnicianEntity with custom actionText', (
      tester,
    ) async {
      bool selected = false;

      const tech = NearbyTechnicianEntity(
        id: 'tech_99',
        displayName: 'Trần Văn Nam',
        badge: 'Top 1 Thợ Cắt Tóc',
        experienceYears: 5,
        rating: 5.0,
        reviewCount: 42,
        distanceKm: 2.3,
        priceAmount: 180000,
        isOnline: true,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppSpecialistCard.fromNearbyTechnician(
              technician: tech,
              actionText: 'Chọn thợ',
              onBookTap: () => selected = true,
            ),
          ),
        ),
      );

      expect(find.text('Trần Văn Nam'), findsOneWidget);
      expect(find.text('Top 1 Thợ Cắt Tóc • 5 năm kn'), findsOneWidget);
      expect(find.text('5.0'), findsOneWidget);
      expect(find.text('(42)'), findsOneWidget);
      expect(find.text('từ 180.000 đ'), findsOneWidget);
      expect(find.text('2.3 km'), findsOneWidget);
      expect(find.text('Chọn thợ'), findsOneWidget);

      await tester.tap(find.text('Chọn thợ'));
      await tester.pump();
      expect(selected, isTrue);
    });

    testWidgets(
      'renders from BookingProviderCandidateEntity with isSelected, onChat and duration',
      (tester) async {
        bool selected = false;
        bool chatted = false;

        const candidate = BookingProviderCandidateEntity(
          id: 'cand_123',
          displayName: 'Lê Hoàng Anh',
          badge: 'Tay Kéo Vàng',
          experienceYears: 7,
          distanceKm: 3.1,
          available: true,
          providerServiceId: 'ps_1',
          priceAmount: 200000,
          durationMinutes: 45,
          rating: 4.85,
          reviewCount: 56,
        );

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: AppSpecialistCard.fromBookingCandidate(
                candidate: candidate,
                isSelected: true,
                onSelect: () => selected = true,
                onChat: () => chatted = true,
              ),
            ),
          ),
        );

        expect(find.text('Lê Hoàng Anh'), findsOneWidget);
        expect(find.text('Tay Kéo Vàng • 7 năm KN'), findsOneWidget);
        expect(find.text('từ 200.000 đ'), findsOneWidget);
        expect(find.text('/ 45p'), findsOneWidget);
        expect(find.text('~3.1 km'), findsOneWidget);
        expect(find.text('Đã chọn'), findsOneWidget);
        expect(find.byIcon(Icons.check_rounded), findsOneWidget);
        expect(find.byIcon(Icons.chat_bubble_outline_rounded), findsOneWidget);

        await tester.tap(find.byIcon(Icons.chat_bubble_outline_rounded));
        await tester.pump();
        expect(chatted, isTrue);

        await tester.tap(find.text('Đã chọn'));
        await tester.pump();
        expect(selected, isTrue);
      },
    );

    testWidgets(
      'renders unavailable candidate with disabled text and suggested slots',
      (tester) async {
        DateTime? chosenSlot;
        final slotTime = DateTime(2026, 10, 28, 14, 30);

        final candidate = BookingProviderCandidateEntity(
          id: 'cand_busy',
          displayName: 'Phạm Thu Trang',
          badge: 'Chuyên gia Da Liễu',
          experienceYears: 4,
          distanceKm: 1.2,
          available: false,
          reason: 'PROVIDER_TIME_CONFLICT',
          suggestedSlots: [slotTime],
          providerServiceId: 'ps_2',
          priceAmount: 300000,
          durationMinutes: 60,
          rating: 4.95,
          reviewCount: 30,
        );

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: AppSpecialistCard.fromBookingCandidate(
                candidate: candidate,
                onSelectSlot: (slot) => chosenSlot = slot,
              ),
            ),
          ),
        );

        expect(find.text('Phạm Thu Trang'), findsOneWidget);
        expect(find.text('Trùng lịch'), findsOneWidget);
        expect(find.text('Giờ trống gợi ý (bấm để chọn lại):'), findsOneWidget);
        expect(find.text('14:30 28/10'), findsOneWidget);

        await tester.tap(find.text('14:30 28/10'));
        await tester.pump();
        expect(chosenSlot, equals(slotTime));
      },
    );

    testWidgets('does not overflow on narrow screens (w = 250px)', (
      tester,
    ) async {
      const candidate = BookingProviderCandidateEntity(
        id: 'cand_narrow',
        displayName: 'Nguyễn Văn Rất Dài Và Nhiều Ký Tự',
        badge: 'Chuyên gia cao cấp',
        experienceYears: 10,
        distanceKm: 15.8,
        available: true,
        providerServiceId: 'ps_narrow',
        priceAmount: 1500000,
        durationMinutes: 90,
        rating: 4.99,
        reviewCount: 999,
      );

      final unavailableCandidate = BookingProviderCandidateEntity(
        id: 'cand_narrow_unavail',
        displayName: 'Trần Thị Thu Trang Chuyên Viên',
        badge: 'Bậc Thầy Tạo Mẫu Tóc',
        experienceYears: 8,
        distanceKm: 22.4,
        available: false,
        reason: 'PROVIDER_TIME_CONFLICT',
        suggestedSlots: [
          DateTime(2026, 10, 28, 9, 0),
          DateTime(2026, 10, 28, 14, 30),
        ],
        providerServiceId: 'ps_narrow_2',
        priceAmount: 2500000,
        durationMinutes: 120,
        rating: 5.0,
        reviewCount: 1500,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 250, // very narrow card container
                child: Column(
                  children: [
                    AppSpecialistCard.fromBookingCandidate(
                      candidate: candidate,
                      onChat: () {},
                      onSelect: () {},
                    ),
                    AppSpecialistCard.fromBookingCandidate(
                      candidate: unavailableCandidate,
                      onSelectSlot: (_) {},
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );

      // Verify no exceptions or overflows thrown
      expect(tester.takeException(), isNull);
    });
  });
}
