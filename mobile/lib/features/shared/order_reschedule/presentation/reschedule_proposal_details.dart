import 'package:flutter/material.dart';

import '../domain/order_reschedule.dart';
import 'reschedule_time_picker.dart';

class RescheduleProposalDetails extends StatelessWidget {
  final RescheduleProposal proposal;
  final DateTime now;
  const RescheduleProposalDetails({
    super.key,
    required this.proposal,
    required this.now,
  });
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(proposal.label(now), style: Theme.of(context).textTheme.titleSmall),
      Text('Giờ đề xuất: ${rescheduleTimeLabel(proposal.startAt)}'),
      Text('Kết thúc dự kiến: ${rescheduleTimeLabel(proposal.endAt)}'),
      if (proposal.isPending(now))
        Text('Phản hồi trước: ${rescheduleTimeLabel(proposal.expiresAt)}'),
      if (proposal.isPending(now))
        const Text('Lịch hiện tại vẫn được giữ cho đến khi thợ chấp nhận.'),
    ],
  );
}
