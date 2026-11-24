import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/beauty_feed/data/feed_mapper.dart';

import 'feed_fixture.dart';

void main() {
  test(
    'managed platform approval and organization approval are independent',
    () {
      final json = postJson(review: 'APPROVED');
      json['moderation'] = {'status': 'PENDING', 'note': null};
      final pending = feedPostFromJson(json, managed: true);
      expect(pending.published, false);
      expect(pending.moderationLabel, 'Chờ nền tảng kiểm duyệt');
      json['moderation'] = {
        'status': 'REJECTED',
        'note': 'Cần xác nhận consent',
      };
      final rejected = feedPostFromJson(json, managed: true);
      expect(rejected.published, false);
      expect(rejected.moderationNote, 'Cần xác nhận consent');
      json['moderation'] = {'status': 'APPROVED', 'note': null};
      expect(feedPostFromJson(json, managed: true).published, true);
    },
  );
}
