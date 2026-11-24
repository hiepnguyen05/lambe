import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/order_add_ons_controller.dart';
import '../domain/order_add_on.dart';
import 'add_on_format.dart';

class AddOnDraft {
  final AddOnOption option;
  final String note;
  const AddOnDraft(this.option, this.note);
}

class AddOnPicker extends ConsumerStatefulWidget {
  final AddOnScope scope;
  final String currency;
  const AddOnPicker({super.key, required this.scope, required this.currency});
  @override
  ConsumerState<AddOnPicker> createState() => _AddOnPickerState();
}

class _AddOnPickerState extends ConsumerState<AddOnPicker> {
  final _note = TextEditingController();
  AddOnOption? _selected;
  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _selected = null);
    await ref
        .read(orderAddOnsProvider(widget.scope).notifier)
        .refresh(options: true);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(orderAddOnsProvider(widget.scope));
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          16,
          16,
          MediaQuery.viewInsetsOf(context).bottom + 12,
        ),
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.75,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Chọn dịch vụ phát sinh',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const Text(
                      'Chỉ gửi đề nghị; khách cần đồng ý trước khi làm thêm.',
                    ),
                    SizedBox(
                      height: 4,
                      child: state.busy
                          ? const LinearProgressIndicator()
                          : null,
                    ),
                    if (state.error != null)
                      Text(
                        state.error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    if (state.error != null)
                      TextButton(
                        onPressed: state.busy ? null : _load,
                        child: const Text('Tải lại dịch vụ'),
                      ),
                  ],
                ),
              ),
              if (state.options == null || state.options!.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      state.options == null
                          ? (state.error == null
                                ? 'Đang tải danh sách từ máy chủ…'
                                : 'Chưa tải được danh sách dịch vụ.')
                          : 'Không có dịch vụ có thể đề nghị thêm.',
                    ),
                  ),
                )
              else
                SliverList.builder(
                  itemCount: state.options!.length,
                  itemBuilder: (context, index) {
                    final option = state.options![index];
                    return ListTile(
                      enabled:
                          option.available &&
                          !state.busy &&
                          state.error == null,
                      selected:
                          _selected?.providerServiceId ==
                          option.providerServiceId,
                      leading: Icon(
                        _selected?.providerServiceId == option.providerServiceId
                            ? Icons.radio_button_checked
                            : Icons.radio_button_off,
                      ),
                      title: Text(option.serviceName),
                      subtitle: Text(
                        '${addOnMoney(option.priceAmount, widget.currency)} · ${option.durationMinutes} phút'
                        '${option.available ? '' : '\n${_reason(option.reason)}'}',
                      ),
                      onTap: () => setState(() => _selected = option),
                    );
                  },
                ),
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_selected != null)
                      Text(
                        'Tổng đề xuất: ${addOnMoney(_selected!.proposedTotalAmount, widget.currency)}'
                        '\nHoa hồng thêm: ${addOnMoney(_selected!.commissionAmount, widget.currency)}'
                        '\nKết thúc dự kiến: ${addOnTime(_selected!.proposedEndAt)} (giờ Việt Nam)',
                      ),
                    TextField(
                      controller: _note,
                      maxLength: 500,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        labelText: 'Ghi chú cho khách (không bắt buộc)',
                      ),
                    ),
                    FilledButton(
                      onPressed:
                          _selected == null || state.busy || state.error != null
                          ? null
                          : () => Navigator.pop(
                              context,
                              AddOnDraft(_selected!, _note.text),
                            ),
                      child: const Text('Xem lại đề nghị'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _reason(String? reason) => switch (reason) {
    'PROVIDER_TIME_CONFLICT' => 'Không đủ thời gian trước lịch tiếp theo.',
    'OUTSIDE_WORKING_HOURS' => 'Vượt giờ làm việc.',
    _ => 'Chưa đủ điều kiện thêm dịch vụ vào đơn này.',
  };
  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }
}
