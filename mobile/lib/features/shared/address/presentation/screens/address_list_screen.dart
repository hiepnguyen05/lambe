import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/widgets/app_dialog.dart';

import '../../di/address_providers.dart';
import '../../domain/entities/address_entity.dart';

class AddressListScreen extends ConsumerWidget {
  const AddressListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addressState = ref.watch(addressNotifierProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Sổ địa chỉ',
          style: TextStyle(
            color: Color(0xFF0B1C30),
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF0B1C30)),
      ),
      body: addressState.when(
        data: (addresses) {
          if (addresses.isEmpty) {
            return RefreshIndicator(
              color: const Color(0xFF0F766E),
              onRefresh: () =>
                  ref.read(addressNotifierProvider.notifier).fetchAddresses(),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(32),
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.14),
                  Center(
                    child: Container(
                      width: 76,
                      height: 76,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDFA),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0xFFCCFBF1),
                          width: 1.5,
                        ),
                      ),
                      child: const Icon(
                        Icons.location_off_outlined,
                        size: 36,
                        color: Color(0xFF0F766E),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Chưa có địa chỉ nào',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Lưu địa chỉ nhà riêng hoặc nơi làm việc để đặt lịch dịch vụ nhanh chóng hơn.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: Color(0xFF64748B),
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            color: const Color(0xFF0F766E),
            onRefresh: () =>
                ref.read(addressNotifierProvider.notifier).fetchAddresses(),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: addresses.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) => _AddressCard(
                address: addresses[index],
                onEdit: () => context.push(
                  '/profile/address/edit',
                  extra: addresses[index],
                ),
                onSetDefault: () =>
                    _setDefault(context, ref, addresses[index].id),
                onDelete: () => _deleteAddress(context, ref, addresses[index]),
              ),
            ),
          );
        },
        loading: () => const Center(
          child: CircularProgressIndicator(color: Color(0xFF0F766E)),
        ),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.wifi_off_rounded,
                  size: 42,
                  color: Color(0xFFDC2626),
                ),
                const SizedBox(height: 12),
                Text(
                  e.toString().replaceFirst('Exception: ', ''),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
                ),
                const SizedBox(height: 14),
                FilledButton(
                  onPressed: () => ref
                      .read(addressNotifierProvider.notifier)
                      .fetchAddresses(),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                  ),
                  child: const Text('Thử lại'),
                ),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: FilledButton.icon(
            onPressed: () => context.push('/profile/address/create'),
            icon: const Icon(Icons.add_location_alt_outlined, size: 19),
            label: const Text(
              'Thêm địa chỉ mới',
              style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.bold),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF0F766E),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 15),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(100),
              ),
              elevation: 0,
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _setDefault(
    BuildContext context,
    WidgetRef ref,
    String id,
  ) async {
    try {
      await ref.read(addressNotifierProvider.notifier).setDefaultAddress(id);
    } catch (e) {
      if (context.mounted) {
        AppDialog.showErrorDialog(context, message: e.toString());
      }
    }
  }

  Future<void> _deleteAddress(
    BuildContext context,
    WidgetRef ref,
    AddressEntity address,
  ) async {
    final confirm = await AppDialog.showConfirmDialog(
      context,
      title: 'Xóa địa chỉ',
      message: 'Bạn có chắc chắn muốn xóa địa chỉ này?',
      confirmText: 'Xóa',
    );
    if (confirm != true) return;
    try {
      await ref.read(addressNotifierProvider.notifier).deleteAddress(address.id);
      if (context.mounted) {
        AppDialog.showMessageDialog(
          context,
          title: 'Thành công',
          message: 'Đã xóa địa chỉ',
        );
      }
    } catch (e) {
      if (context.mounted) {
        AppDialog.showErrorDialog(context, message: e.toString());
      }
    }
  }
}

class _AddressCard extends StatelessWidget {
  final AddressEntity address;
  final VoidCallback onEdit;
  final VoidCallback onSetDefault;
  final VoidCallback onDelete;

  const _AddressCard({
    required this.address,
    required this.onEdit,
    required this.onSetDefault,
    required this.onDelete,
  });

  String _typeLabel() {
    if (address.label?.trim().isNotEmpty == true) return address.label!.trim();
    return switch (address.type) {
      'HOME' => 'Nhà riêng',
      'WORK' => 'Công ty',
      _ => 'Địa chỉ khác',
    };
  }

  IconData _typeIcon() => switch (address.type) {
    'HOME' => Icons.home_rounded,
    'WORK' => Icons.work_rounded,
    _ => Icons.location_on_rounded,
  };

  @override
  Widget build(BuildContext context) {
    final contactName = address.contactName?.trim() ?? '';
    final contactPhone = address.contactPhone?.trim() ?? '';
    final note = address.note?.trim() ?? '';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: address.isDefault
              ? const Color(0xFF0F766E)
              : const Color(0xFFE2E8F0),
          width: address.isDefault ? 1.5 : 1,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onEdit,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDFA),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        _typeIcon(),
                        color: const Color(0xFF0F766E),
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _typeLabel(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                    ),
                    if (address.isDefault) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFCCFBF1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text(
                          'Mặc định',
                          style: TextStyle(
                            color: Color(0xFF0F766E),
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  address.addressLine,
                  style: const TextStyle(
                    color: Color(0xFF334155),
                    fontSize: 13.5,
                    height: 1.4,
                  ),
                ),
                if (contactName.isNotEmpty || contactPhone.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.only(top: 1),
                        child: Icon(
                          Icons.person_outline_rounded,
                          size: 14.5,
                          color: Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Wrap(
                          spacing: 6,
                          runSpacing: 2,
                          children: [
                            if (contactName.isNotEmpty)
                              Text(
                                contactName,
                                style: const TextStyle(
                                  color: Color(0xFF475569),
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            if (contactName.isNotEmpty &&
                                contactPhone.isNotEmpty)
                              const Text(
                                '•',
                                style: TextStyle(color: Color(0xFFCBD5E1)),
                              ),
                            if (contactPhone.isNotEmpty)
                              Text(
                                contactPhone,
                                style: const TextStyle(
                                  color: Color(0xFF64748B),
                                  fontSize: 12.5,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
                if (note.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.edit_note_rounded,
                        size: 15,
                        color: Color(0xFF64748B),
                      ),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          note,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 12,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 10),
                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                const SizedBox(height: 6),
                SizedBox(
                  width: double.infinity,
                  child: Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      if (!address.isDefault)
                        InkWell(
                          onTap: onSetDefault,
                          borderRadius: BorderRadius.circular(8),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(
                              horizontal: 4,
                              vertical: 5,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.check_circle_outline_rounded,
                                  size: 15,
                                  color: Color(0xFF0F766E),
                                ),
                                SizedBox(width: 4),
                                Text(
                                  'Đặt mặc định',
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF0F766E),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      else
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 5),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.verified_rounded,
                                size: 15,
                                color: Color(0xFF0F766E),
                              ),
                              SizedBox(width: 4),
                              Text(
                                'Đang dùng mặc định',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF0F766E),
                                ),
                              ),
                            ],
                          ),
                        ),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          InkWell(
                            onTap: onEdit,
                            borderRadius: BorderRadius.circular(8),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 5,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.edit_outlined,
                                    size: 15,
                                    color: Color(0xFF475569),
                                  ),
                                  SizedBox(width: 3),
                                  Text(
                                    'Sửa',
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF475569),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 4),
                          InkWell(
                            onTap: onDelete,
                            borderRadius: BorderRadius.circular(8),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 5,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.delete_outline_rounded,
                                    size: 15,
                                    color: Color(0xFFDC2626),
                                  ),
                                  SizedBox(width: 3),
                                  Text(
                                    'Xóa',
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFFDC2626),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
