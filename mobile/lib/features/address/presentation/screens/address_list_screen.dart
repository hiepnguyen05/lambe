import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/utils/app_dialogs.dart';
import '../../di/address_providers.dart';

class AddressListScreen extends ConsumerWidget {
  const AddressListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addressState = ref.watch(addressNotifierProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        title: const Text(
          'Sổ địa chỉ',
          style: TextStyle(
            color: Color(0xFF0B1C30),
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF0B1C30)),
      ),
      body: addressState.when(
        data: (addresses) {
          if (addresses.isEmpty) {
            return const Center(
              child: Text(
                'Bạn chưa có địa chỉ nào',
                style: TextStyle(color: Colors.grey),
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: addresses.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final address = addresses[index];
              return Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                  border: address.isDefault
                      ? Border.all(color: const Color(0xFF0F766E), width: 1.5)
                      : null,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      address.type == 'HOME'
                          ? Icons.home_rounded
                          : (address.type == 'WORK'
                                ? Icons.work_rounded
                                : Icons.location_on_rounded),
                      color: const Color(0xFF0F766E),
                      size: 28,
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                address.label ??
                                    (address.type == 'HOME'
                                        ? 'Nhà'
                                        : 'Công ty'),
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                  color: Color(0xFF0B1C30),
                                ),
                              ),
                              if (address.isDefault) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF0FDF4),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Text(
                                    'Mặc định',
                                    style: TextStyle(
                                      color: Color(0xFF166534),
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            address.addressLine,
                            style: const TextStyle(
                              color: Color(0xFF758381),
                              fontSize: 14,
                            ),
                          ),
                          if (address.contactName != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              '${address.contactName} - ${address.contactPhone}',
                              style: const TextStyle(
                                color: Colors.black87,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    PopupMenuButton<String>(
                      icon: const Icon(Icons.more_vert, color: Colors.grey),
                      onSelected: (value) async {
                        if (value == 'edit') {
                          context.push('/profile/address/edit', extra: address);
                        } else if (value == 'delete') {
                          final confirm = await AppDialogs.showConfirmDialog(
                            context,
                            title: 'Xóa địa chỉ',
                            message: 'Bạn có chắc chắn muốn xóa địa chỉ này?',
                            confirmText: 'Xóa',
                          );
                          if (confirm == true) {
                            try {
                              await ref
                                  .read(addressNotifierProvider.notifier)
                                  .deleteAddress(address.id);
                              if (context.mounted) {
                                AppDialogs.showMessageDialog(
                                  context,
                                  title: 'Thành công',
                                  message: 'Đã xóa địa chỉ',
                                );
                              }
                            } catch (e) {
                              if (context.mounted) {
                                AppDialogs.showErrorDialog(
                                  context,
                                  message: e.toString(),
                                );
                              }
                            }
                          }
                        } else if (value == 'default') {
                          try {
                            await ref
                                .read(addressNotifierProvider.notifier)
                                .setDefaultAddress(address.id);
                          } catch (e) {
                            if (context.mounted) {
                              AppDialogs.showErrorDialog(
                                context,
                                message: e.toString(),
                              );
                            }
                          }
                        }
                      },
                      itemBuilder: (context) => [
                        if (!address.isDefault)
                          const PopupMenuItem(
                            value: 'default',
                            child: Text('Đặt làm mặc định'),
                          ),
                        const PopupMenuItem(
                          value: 'edit',
                          child: Text('Chỉnh sửa'),
                        ),
                        const PopupMenuItem(
                          value: 'delete',
                          child: Text(
                            'Xóa',
                            style: TextStyle(color: Colors.red),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, st) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(e.toString(), style: const TextStyle(color: Colors.red)),
              TextButton(
                onPressed: () =>
                    ref.read(addressNotifierProvider.notifier).fetchAddresses(),
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: ElevatedButton(
            onPressed: () {
              context.push('/profile/address/create');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0F766E),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(100),
              ),
            ),
            child: const Text(
              'Thêm địa chỉ mới',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
        ),
      ),
    );
  }
}
