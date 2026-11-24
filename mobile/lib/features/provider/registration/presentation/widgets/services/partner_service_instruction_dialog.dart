import 'package:flutter/material.dart';

class PartnerServiceInstructionDialog extends StatelessWidget {
  const PartnerServiceInstructionDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showDialog(
      context: context,
      builder: (ctx) => const PartnerServiceInstructionDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      contentPadding: const EdgeInsets.all(24),
      title: const Row(
        children: [
          Icon(Icons.menu_book_rounded, color: Color(0xFF0F766E)),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Hướng dẫn thiết lập',
              style: TextStyle(
                color: Color(0xFF0B1C30),
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
          ),
        ],
      ),
      content: const SingleChildScrollView(
        child: Text(
          'Chào mừng bạn đến với bước thiết lập Dịch vụ của hệ thống Lambe!\n\n'
          '1. TÌM KIẾM DỊCH VỤ\n'
          '• Nhập từ khoá vào thanh tìm kiếm (VD: "Cắt tóc", "Nhuộm") để tìm nhanh.\n'
          '• Hoặc bấm vào thanh danh mục (Tóc, Nail, Spa...) để lọc dịch vụ theo chuyên môn của bạn.\n\n'
          '2. THIẾT LẬP GIÁ & THỜI GIAN\n'
          '• Bấm chọn một dịch vụ, một biểu mẫu sẽ mở ra.\n'
          '• Hãy nhấn vào nút (i) Gợi ý để xem giới hạn mức Giá sàn (thấp nhất) và Giá trần (cao nhất) cho phép.\n'
          '• Điền giá tiền và thời gian thực hiện (tính bằng phút) mà bạn tự tin nhất.\n\n'
          '3. LƯU & CHỈNH SỬA\n'
          '• Nhấn "Lưu thông tin", dịch vụ sẽ tự động được thu gọn lại và chuyển xuống khu vực DỊCH VỤ ĐÃ CHỌN ở cuối màn hình.\n'
          '• Nếu muốn đổi giá, bấm biểu tượng Cây bút. Nếu muốn bỏ chọn, bấm Dấu X.\n\n'
          '4. ĐỀ XUẤT DỊCH VỤ MỚI\n'
          '• Nếu bạn có kỹ năng đặc biệt mà hệ thống chưa có, hãy lướt xuống cuối danh sách và nhấn "Đề xuất dịch vụ mới".',
          style: TextStyle(color: Color(0xFF3E4947), fontSize: 14, height: 1.6),
          textAlign: TextAlign.left,
        ),
      ),
      actions: [
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0F766E),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(100),
              ),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: const Text(
              'Đã hiểu',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
          ),
        ),
      ],
    );
  }
}
