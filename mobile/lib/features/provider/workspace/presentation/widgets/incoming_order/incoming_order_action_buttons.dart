import 'package:flutter/material.dart';

class IncomingOrderActionButtons extends StatelessWidget {
  final int remainingSeconds;
  final VoidCallback onReject;
  final VoidCallback onAccept;
  final bool isAccepting;

  const IncomingOrderActionButtons({
    super.key,
    required this.remainingSeconds,
    required this.onReject,
    required this.onAccept,
    this.isAccepting = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        // Nút Từ chối (Flex 1)
        Expanded(
          flex: 1,
          child: SizedBox(
            height: 48,
            child: OutlinedButton(
              onPressed: isAccepting ? null : onReject,
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF475569),
                side: const BorderSide(color: Color(0xFFCBD5E1), width: 1.2),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                padding: EdgeInsets.zero,
              ),
              child: const Text(
                'Từ chối',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ),

        const SizedBox(width: 8),

        // Nút NHẬN ĐƠN NGAY (Flex 2)
        Expanded(
          flex: 2,
          child: SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: isAccepting ? null : onAccept,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E),
                foregroundColor: Colors.white,
                elevation: 0,
                shadowColor: const Color(0xFF0F766E).withValues(alpha: 0.3),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 12),
              ),
              child: isAccepting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        color: Colors.white,
                      ),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.check_circle_rounded, size: 18),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            'NHẬN ĐƠN (${remainingSeconds}s)',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.2,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ],
    );
  }
}
