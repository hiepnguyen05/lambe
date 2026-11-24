import 'package:flutter/material.dart';

class ServiceChoiceField extends StatelessWidget {
  final String label;
  final String? selected;
  final List<(String, String)> options;
  final ValueChanged<String> onChanged;
  final bool enabled;
  const ServiceChoiceField({
    super.key,
    required this.label,
    this.selected,
    required this.options,
    required this.onChanged,
    this.enabled = true,
  });
  @override
  Widget build(BuildContext context) {
    final matches = options.where((v) => v.$1 == selected);
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      subtitle: Text(
        matches.isEmpty ? 'Chọn từ danh sách hệ thống' : matches.first.$2,
      ),
      trailing: const Icon(Icons.expand_more),
      enabled: enabled,
      onTap: !enabled
          ? null
          : () async {
              final result = await showModalBottomSheet<String>(
                context: context,
                isScrollControlled: true,
                useSafeArea: true,
                builder: (_) => _ChoiceSheet(label: label, options: options),
              );
              if (result != null && context.mounted) onChanged(result);
            },
    );
  }
}

class _ChoiceSheet extends StatefulWidget {
  final String label;
  final List<(String, String)> options;
  const _ChoiceSheet({required this.label, required this.options});
  @override
  State<_ChoiceSheet> createState() => _ChoiceSheetState();
}

class _ChoiceSheetState extends State<_ChoiceSheet> {
  String _query = '';
  @override
  Widget build(BuildContext context) {
    final items = widget.options
        .where((v) => v.$2.toLowerCase().contains(_query))
        .toList(growable: false);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        16,
        16,
        16,
        MediaQuery.viewInsetsOf(context).bottom + 12,
      ),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .65,
        child: Column(
          children: [
            Text(widget.label, style: Theme.of(context).textTheme.titleLarge),
            TextField(
              decoration: const InputDecoration(
                labelText: 'Tìm trong danh sách',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (value) =>
                  setState(() => _query = value.trim().toLowerCase()),
            ),
            Expanded(
              child: items.isEmpty
                  ? const Center(child: Text('Không có lựa chọn phù hợp.'))
                  : ListView.builder(
                      itemCount: items.length,
                      itemBuilder: (context, index) => ListTile(
                        title: Text(items[index].$2),
                        onTap: () => Navigator.pop(context, items[index].$1),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
