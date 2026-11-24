import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

class FeedNoticesSheet extends ConsumerStatefulWidget {
  const FeedNoticesSheet({super.key});
  static Future<void> show(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const FeedNoticesSheet(),
  );
  @override
  ConsumerState<FeedNoticesSheet> createState() => _FeedNoticesSheetState();
}

class _FeedNoticesSheetState extends ConsumerState<FeedNoticesSheet> {
  final cancel = CancelToken();
  List<Map<String, dynamic>> rows = [];
  bool loading = true;
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final response = await ref
          .read(dioProvider)
          .get('/me/feed/notices', cancelToken: cancel);
      final data = ApiResponseParser.dataMap(response);
      if (mounted) {
        setState(() {
          rows = (data['data'] as List)
              .map((v) => Map<String, dynamic>.from(v as Map))
              .toList();
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          error = 'Không tải được thông báo Feed. Hãy đăng nhập và thử lại.';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authNotifierProvider.select((v) => v.valueOrNull?.id), (
      previous,
      next,
    ) {
      if (previous != null && previous != next && mounted) {
        cancel.cancel();
        Navigator.pop(context);
      }
    });
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.75,
      child: Column(
        children: [
          ListTile(
            title: const Text('Thông báo Feed'),
            trailing: IconButton(
              tooltip: 'Làm mới',
              onPressed: loading ? null : load,
              icon: const Icon(Icons.refresh),
            ),
          ),
          if (loading) const LinearProgressIndicator(),
          if (error != null)
            Padding(padding: const EdgeInsets.all(16), child: Text(error!)),
          if (!loading && rows.isEmpty && error == null)
            const Text('Chưa có thông báo.'),
          Expanded(
            child: ListView.builder(
              itemCount: rows.length,
              itemBuilder: (context, index) {
                final row = rows[index];
                return ListTile(
                  title: Text(row['detail'] as String),
                  subtitle: Text(row['readAt'] == null ? 'Chưa đọc' : 'Đã đọc'),
                  onTap: () async {
                    final router = GoRouter.of(context);
                    try {
                      await ref
                          .read(dioProvider)
                          .patch(
                            '/me/feed/notices/${row['id']}/read',
                            cancelToken: cancel,
                          );
                    } catch (_) {
                      return;
                    }
                    if (!context.mounted) return;
                    Navigator.pop(context);
                    router.push(
                      '/feed/posts/${row['postId']}?manage=${row['managed'] == true}',
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
