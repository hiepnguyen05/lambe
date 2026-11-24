import 'dart:io';

import 'package:flutter/material.dart';

class PartnerDocumentUploadBox extends StatelessWidget {
  final String title;
  final File? file;
  final bool isUploaded;
  final VoidCallback onTap;

  const PartnerDocumentUploadBox({
    super.key,
    required this.title,
    this.file,
    this.isUploaded = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: Color(0xFF0B1C30),
          ),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: onTap,
          child: Container(
            height: 160,
            width: double.infinity,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: const Color(0xFFE5E7EB),
                style: BorderStyle.solid,
              ),
            ),
            child: file != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.file(file!, fit: BoxFit.cover),
                  )
                : isUploaded
                ? const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.check_circle,
                        size: 48,
                        color: Color(0xFF0F766E),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Đã tải lên trước đó',
                        style: TextStyle(
                          color: Color(0xFF0F766E),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Nhấn để chọn ảnh thay thế',
                        style: TextStyle(color: Color(0xFF6B7280)),
                      ),
                    ],
                  )
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.cloud_upload_outlined,
                        size: 48,
                        color: Color(0xFF9CA3AF),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Nhấn để chọn ảnh',
                        style: TextStyle(color: Color(0xFF6B7280)),
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}
