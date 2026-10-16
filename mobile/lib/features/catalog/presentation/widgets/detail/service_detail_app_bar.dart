import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ServiceDetailAppBar extends StatefulWidget implements PreferredSizeWidget {
  final String title;
  final VoidCallback? onShare;
  final VoidCallback? onFavorite;

  const ServiceDetailAppBar({
    super.key,
    required this.title,
    this.onShare,
    this.onFavorite,
  });

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  State<ServiceDetailAppBar> createState() => _ServiceDetailAppBarState();
}

class _ServiceDetailAppBarState extends State<ServiceDetailAppBar> {
  bool _isFavorite = false;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFFF8F9FF).withValues(alpha: 0.9),
            border: Border(
              bottom: BorderSide(
                color: const Color(0xFFE2E8F0).withValues(alpha: 0.7),
                width: 1,
              ),
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.03),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: SafeArea(
            bottom: false,
            child: SizedBox(
              height: 56,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Tên dịch vụ ở chính giữa màn hình
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 92),
                    child: Text(
                      widget.title,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0B1C30),
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),

                  // Nút Quay lại bên trái
                  Positioned(
                    left: 4,
                    child: IconButton(
                      icon: const Icon(
                        Icons.arrow_back_rounded,
                        color: Color(0xFF0B1C30),
                        size: 24,
                      ),
                      onPressed: () {
                        if (Navigator.of(context).canPop()) {
                          Navigator.of(context).pop();
                        } else {
                          context.go('/services');
                        }
                      },
                      tooltip: 'Quay lại',
                    ),
                  ),

                  // Nút Chia sẻ và Yêu thích bên phải
                  Positioned(
                    right: 4,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(
                            Icons.share_outlined,
                            color: Color(0xFF475569),
                            size: 21,
                          ),
                          onPressed: widget.onShare ??
                              () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Đã sao chép liên kết dịch vụ'),
                                    behavior: SnackBarBehavior.floating,
                                    duration: Duration(seconds: 2),
                                  ),
                                );
                              },
                          tooltip: 'Chia sẻ',
                        ),
                        IconButton(
                          icon: Icon(
                            _isFavorite
                                ? Icons.favorite_rounded
                                : Icons.favorite_border_rounded,
                            color: _isFavorite
                                ? const Color(0xFFE11D48)
                                : const Color(0xFF475569),
                            size: 22,
                          ),
                          onPressed: () {
                            setState(() {
                              _isFavorite = !_isFavorite;
                            });
                            widget.onFavorite?.call();
                          },
                          tooltip: 'Lưu yêu thích',
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
