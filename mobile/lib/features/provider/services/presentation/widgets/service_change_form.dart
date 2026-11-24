import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../di/provider_services_providers.dart';
import '../../domain/provider_offering.dart';
import '../../domain/service_change.dart';
import '../../domain/service_change_draft.dart';
import 'service_choice_field.dart';
import 'service_format.dart';

class ServiceChangeForm extends StatefulWidget {
  final ServiceEditorOptions options;
  final ServiceChange? existing;
  final String? offeringId;
  final bool disabled;
  final Future<void> Function(ServiceChangeDraft, ServiceDefinition?) onSave;
  const ServiceChangeForm({
    super.key,
    required this.options,
    this.existing,
    this.offeringId,
    required this.disabled,
    required this.onSave,
  });
  @override
  State<ServiceChangeForm> createState() => _ServiceChangeFormState();
}

class _ServiceChangeFormState extends State<ServiceChangeForm> {
  final _price = TextEditingController(),
      _duration = TextEditingController(),
      _description = TextEditingController(),
      _name = TextEditingController();
  late ServiceChangeType _type;
  String? _target, _category, _error;
  @override
  void initState() {
    super.initState();
    final current = widget.existing;
    _type =
        current?.type ??
        (widget.offeringId == null
            ? ServiceChangeType.addExisting
            : ServiceChangeType.updateOffering);
    if (current != null) {
      _target = current.type == ServiceChangeType.updateOffering
          ? current.offeringId
          : current.serviceId;
      _category =
          widget.options.categories.any((v) => v.id == current.categoryId)
          ? current.categoryId
          : null;
      _price.text = '${current.price}';
      _duration.text = current.duration?.toString() ?? '';
      _description.text = current.description ?? '';
      _name.text = current.proposedName ?? '';
    } else if (widget.offeringId != null) {
      _selectTarget(widget.offeringId!);
    }
  }

  ProviderOffering? get _offering {
    final matches = widget.options.offerings.where((v) => v.id == _target);
    return matches.isEmpty ? null : matches.first;
  }

  ServiceDefinition? get _definition {
    if (widget.existing != null) return widget.existing!.service;
    if (_type == ServiceChangeType.updateOffering) return _offering?.service;
    final matches = widget.options.services.where((v) => v.id == _target);
    return matches.isEmpty ? null : matches.first;
  }

  void _selectTarget(String value) {
    _target = value;
    if (_type == ServiceChangeType.updateOffering) {
      _price.text = _offering?.price.toString() ?? '';
      _duration.text = _offering?.duration?.toString() ?? '';
      _description.text = _offering?.description ?? '';
    } else {
      _price.clear();
      _duration.clear();
      _description.clear();
    }
  }

  Future<void> _save() async {
    final draft = ServiceChangeDraft(
      type: _type,
      price: int.tryParse(_price.text) ?? 0,
      duration: _duration.text.trim().isEmpty
          ? null
          : int.tryParse(_duration.text) ?? -1,
      description: _description.text,
      offeringId: _type == ServiceChangeType.updateOffering ? _target : null,
      serviceId: _type == ServiceChangeType.addExisting ? _target : null,
      categoryId: _type == ServiceChangeType.proposeNew ? _category : null,
      name: _type == ServiceChangeType.proposeNew ? _name.text : null,
    );
    final error = draft.validate(definition: _definition);
    setState(() => _error = error);
    if (error == null) await widget.onSave(draft, _definition);
  }

  @override
  Widget build(BuildContext context) {
    final definition = _definition;
    final existing = widget.existing;
    final ownedIds = widget.options.offerings.map((v) => v.serviceId).toSet();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Lưu bản nháp trước, bổ sung tài liệu rồi gửi kiểm duyệt. Giá đang cung cấp chỉ đổi sau khi được duyệt.',
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<ServiceChangeType>(
          initialValue: _type,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Loại đề xuất'),
          items: [
            for (final type in ServiceChangeType.values)
              DropdownMenuItem(value: type, child: Text(type.label)),
          ],
          onChanged:
              widget.disabled || existing != null || widget.offeringId != null
              ? null
              : (value) => setState(() {
                  _type = value!;
                  _target = null;
                  _category = null;
                  _price.clear();
                  _duration.clear();
                  _description.clear();
                  _name.clear();
                  _error = null;
                }),
        ),
        if (_type != ServiceChangeType.proposeNew) ...[
          if (existing != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(existing.name),
            )
          else
            ServiceChoiceField(
              label: _type == ServiceChangeType.addExisting
                  ? 'Dịch vụ trong danh mục'
                  : 'Dịch vụ đang cung cấp',
              selected: _target,
              enabled: !widget.disabled && widget.offeringId == null,
              options: _type == ServiceChangeType.addExisting
                  ? [
                      for (final service in widget.options.services.where(
                        (v) => !ownedIds.contains(v.id),
                      ))
                        (
                          service.id,
                          '${service.name} · ${service.category.name}',
                        ),
                    ]
                  : [
                      for (final offering in widget.options.offerings)
                        (offering.id, offering.service.name),
                    ],
              onChanged: (value) => setState(() => _selectTarget(value)),
            ),
          if (definition != null)
            Text(
              'Khoảng giá: ${serviceMoney(definition.minPrice)} – ${serviceMoney(definition.maxPrice)}\n'
              '${definition.defaultDuration == null ? '' : 'Thời lượng mặc định: ${definition.defaultDuration} phút\n'}'
              '${definition.requiresCertificate == true ? 'Yêu cầu chứng chỉ nghề.\n' : ''}'
              '${(definition.minPortfolioImages ?? 0) > 0 ? 'Tối thiểu ${definition.minPortfolioImages} ảnh sản phẩm.\n' : ''}'
              '${(definition.minExperienceYears ?? 0) > 0 ? 'Tối thiểu ${definition.minExperienceYears} năm kinh nghiệm.' : ''}',
            ),
        ] else ...[
          ServiceChoiceField(
            label: 'Danh mục dịch vụ mới',
            selected: _category,
            enabled: !widget.disabled,
            options: [
              for (final item in widget.options.categories)
                (item.id, item.name),
            ],
            onChanged: (value) => setState(() => _category = value),
          ),
          TextField(
            controller: _name,
            enabled: !widget.disabled,
            maxLength: 100,
            decoration: const InputDecoration(labelText: 'Tên dịch vụ mới'),
          ),
          const Text(
            'Dịch vụ mới chưa có giá sàn/trần. Bộ phận kiểm duyệt sẽ chuẩn hóa hoặc ghép vào dịch vụ có sẵn.',
          ),
        ],
        const SizedBox(height: 12),
        TextField(
          controller: _price,
          enabled: !widget.disabled,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          maxLength: 10,
          decoration: const InputDecoration(labelText: 'Giá đề xuất (đồng)'),
        ),
        TextField(
          controller: _duration,
          enabled: !widget.disabled,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          maxLength: 3,
          decoration: const InputDecoration(
            labelText: 'Thời lượng đề xuất (phút)',
            helperText: '15–720 phút; để trống dùng mặc định của dịch vụ',
          ),
        ),
        TextField(
          controller: _description,
          enabled: !widget.disabled,
          maxLines: 4,
          maxLength: 1000,
          decoration: const InputDecoration(
            labelText: 'Mô tả dịch vụ (không bắt buộc)',
          ),
        ),
        if (_error != null)
          Text(
            _error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: widget.disabled ? null : _save,
          icon: const Icon(Icons.save_outlined),
          label: const Text('Lưu bản nháp'),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _price.dispose();
    _duration.dispose();
    _description.dispose();
    _name.dispose();
    super.dispose();
  }
}
