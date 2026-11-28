import 'package:mobile/core/widgets/guided_tour/guided_tour_overlay.dart';

class GuidanceTour {
  final String id, title, audience;
  final List<GuidedTourStep> steps;
  final int version;
  const GuidanceTour(
    this.id,
    this.title,
    this.audience,
    this.steps, {
    this.version = 1,
  });
}

const guidanceTours = <String, GuidanceTour>{
  'customer_home': GuidanceTour(
    'customer_home',
    'Bắt đầu đặt dịch vụ',
    'customer',
    [
      GuidedTourStep(
        'Chọn nơi phục vụ',
        'Chọn địa chỉ nơi bạn muốn chuyên viên đến làm dịch vụ. Địa chỉ này có thể khác vị trí hiện tại của bạn.',
        target: 'customer_location',
      ),
      GuidedTourStep(
        'Tìm dịch vụ phù hợp',
        'Chọn danh mục hoặc tìm kiếm dịch vụ. Bạn có thể xem giá, thời lượng và thông tin chuyên viên trước khi đặt.',
        target: 'customer_services',
      ),
      GuidedTourStep(
        'Quản lý lịch hẹn',
        'Mục Lịch hẹn hiển thị yêu cầu chờ xác nhận và các đơn đang thực hiện. Bạn có thể xem lại hướng dẫn trong Hồ sơ → Hướng dẫn sử dụng.',
      ),
    ],
  ),
  'customer_booking': GuidanceTour(
    'customer_booking',
    'Chọn địa chỉ và thời gian',
    'customer',
    [
      GuidedTourStep(
        'Kiểm tra địa chỉ và liên hệ',
        'Đánh dấu đúng vị trí phục vụ trên bản đồ, nhập người nhận và số điện thoại để chuyên viên liên hệ.',
        target: 'booking_address',
      ),
      GuidedTourStep(
        'Đặt ngay hay đặt trước?',
        'Đặt ngay tìm chuyên viên theo GPS hiện tại. Đặt trước tìm theo khu vực phục vụ và lịch làm việc của chuyên viên.',
        target: 'booking_time',
      ),
      GuidedTourStep(
        'Chọn người thực hiện',
        'Xem giá, đánh giá và lịch trống. Nếu giờ bạn chọn chưa phù hợp, xem các khung giờ được đề xuất.',
      ),
    ],
  ),
  'customer_confirm': GuidanceTour(
    'customer_confirm',
    'Xác nhận yêu cầu đặt lịch',
    'customer',
    [
      GuidedTourStep(
        'Kiểm tra trước khi gửi',
        'Đối chiếu địa chỉ, thời gian, người liên hệ, ưu đãi và tổng tiền cuối cùng. Chỉ gửi khi báo giá đã tải thành công.',
        target: 'booking_summary',
      ),
      GuidedTourStep(
        'Chờ chuyên viên phản hồi',
        'Gửi yêu cầu chưa có nghĩa chuyên viên đã nhận. Kết quả xác nhận sẽ được cập nhật trong đơn; nếu bị từ chối hoặc hết hạn, bạn có thể chọn người khác.',
      ),
    ],
  ),
  'customer_tracking': GuidanceTour(
    'customer_tracking',
    'Theo dõi lịch hẹn',
    'customer',
    [
      GuidedTourStep(
        'Xem tiến trình đơn',
        'Trạng thái cho biết chuyên viên đã nhận, đang di chuyển, đã đến hay đang thực hiện. Mở bản đồ khi chuyên viên bắt đầu di chuyển.',
        target: 'customer_order',
      ),
      GuidedTourStep(
        'Liên hệ và xử lý thay đổi',
        'Nhắn tin cho chuyên viên khi cần. Đọc kỹ yêu cầu đổi lịch, dịch vụ bổ sung hoặc yêu cầu hủy trước khi xác nhận.',
      ),
    ],
  ),
  'customer_review': GuidanceTour(
    'customer_review',
    'Sau khi hoàn thành dịch vụ',
    'customer',
    [
      GuidedTourStep(
        'Kiểm tra thanh toán',
        'Đối chiếu tổng tiền và các dịch vụ bổ sung đã chấp thuận. Nếu có chênh lệch, sử dụng mục hỗ trợ của đơn.',
      ),
      GuidedTourStep(
        'Chia sẻ đánh giá',
        'Đánh giá người thực hiện và chất lượng dịch vụ từ đơn đã hoàn thành. Phản hồi của bạn giúp những khách hàng tiếp theo lựa chọn.',
      ),
    ],
  ),
  'provider_start': GuidanceTour(
    'provider_start',
    'Chuẩn bị nhận khách',
    'provider',
    [
      GuidedTourStep(
        'Chọn bán kính nhận đơn',
        'Chọn khoảng cách bạn có thể di chuyển để phục vụ khách. Bạn có thể điều chỉnh bán kính tại đây khi cần.',
        target: 'provider_radius',
      ),
      GuidedTourStep(
        'Khu vực cố định và GPS',
        'Đặt trước dùng tâm khu vực đã lưu. Đặt ngay dùng GPS khi bạn bật hoạt động. Hãy kiểm tra đúng tâm và bán kính phục vụ.',
        target: 'provider_service_area',
      ),
      GuidedTourStep(
        'Bật nhận đơn',
        'Bật công tắc khi sẵn sàng nhận khách. Bạn cần lịch làm, dịch vụ hợp lệ, số dư khả dụng đủ và GPS hoạt động. Nếu chưa bật được, ứng dụng sẽ thông báo lý do cần xử lý.',
        target: 'provider_online',
      ),
    ],
  ),
  'provider_workflow': GuidanceTour(
    'provider_workflow',
    'Quy trình thực hiện đơn',
    'provider',
    [
      GuidedTourStep(
        '1. Phản hồi yêu cầu',
        'Xem dịch vụ, thời gian và thu nhập dự kiến rồi nhận hoặc từ chối trước khi hết thời gian phản hồi. Đây là nội dung minh họa; không tạo hoặc xử lý đơn thật.',
      ),
      GuidedTourStep(
        '2. Di chuyển và đến nơi',
        'Kiểm tra địa chỉ, bắt đầu di chuyển đúng lịch. Chỉ xác nhận đã đến khi GPS đáp ứng khoảng cách yêu cầu.',
      ),
      GuidedTourStep(
        '3. Chụp ảnh và làm dịch vụ',
        'Tải ảnh trước khi làm theo yêu cầu rồi bắt đầu dịch vụ. Dịch vụ bổ sung cần khách chấp thuận trước khi thực hiện.',
      ),
      GuidedTourStep(
        '4. Kết quả và thanh toán',
        'Tải ảnh kết quả, đối chiếu tổng tiền. Chỉ xác nhận đã thu tiền khi thực tế đã nhận đủ. Ví hiển thị khoản hoa hồng và thu nhập của đơn.',
      ),
      GuidedTourStep(
        '5. Khi có vấn đề',
        'Dùng liên hệ, yêu cầu hủy hoặc báo sự cố trong đơn. Nếu không an toàn, dừng công việc và dùng mục hỗ trợ phù hợp.',
      ),
    ],
  ),
  'provider_order_accepted': GuidanceTour(
    'provider_order_accepted',
    'Đơn đầu tiên đã nhận',
    'provider',
    [
      GuidedTourStep(
        'Kiểm tra lịch hẹn',
        'Kiểm tra địa chỉ, dịch vụ và liên hệ khách nếu cần. Đây là đơn đặt ngay; hãy chuẩn bị khởi hành để đến đúng giờ dự kiến.',
        target: 'provider_order_body',
      ),
      GuidedTourStep(
        'Bắt đầu di chuyển',
        'Khi khởi hành, bấm Bắt đầu di chuyển để cập nhật cho khách. Đọc hướng dẫn khi đang đứng yên; không thao tác khi lái xe.',
        target: 'provider_order_action',
      ),
    ],
  ),
  'provider_order_scheduled': GuidanceTour(
    'provider_order_scheduled',
    'Lịch hẹn đã xác nhận',
    'provider',
    [
      GuidedTourStep(
        'Đã lưu lịch hẹn của bạn',
        'Kiểm tra ngày giờ, dịch vụ, địa chỉ và thông tin khách. Bạn có thể quay lại mục Lịch hẹn để xem đơn; nhận đơn đặt trước không đồng nghĩa phải di chuyển ngay.',
        target: 'provider_order_body',
      ),
      GuidedTourStep(
        'Khởi hành theo lịch',
        'Nút khởi hành sẽ mở theo thời điểm hiển thị trong đơn. Khi thực sự xuất phát, bấm Bắt đầu di chuyển; lúc đó khách mới theo dõi hành trình. Nếu cần đổi giờ, dùng yêu cầu đổi lịch để khách xác nhận.',
        target: 'provider_order_action',
      ),
    ],
  ),
  'provider_order_arrived': GuidanceTour(
    'provider_order_arrived',
    'Chuẩn bị thực hiện dịch vụ',
    'provider',
    [
      GuidedTourStep(
        'Ảnh trước thực hiện',
        'Chụp và tải ảnh trước khi làm theo yêu cầu của đơn. Đợi tải thành công trước khi bắt đầu dịch vụ.',
        target: 'provider_order_body',
      ),
      GuidedTourStep(
        'Bắt đầu làm việc',
        'Xác nhận bắt đầu sau khi đã thống nhất dịch vụ với khách. Thời gian làm việc được theo dõi từ bước này.',
        target: 'provider_order_action',
      ),
    ],
  ),
  'provider_order_work': GuidanceTour(
    'provider_order_work',
    'Trong khi làm dịch vụ',
    'provider',
    [
      GuidedTourStep(
        'Theo dõi thời gian',
        'Bạn có thể tạm dừng và tiếp tục khi cần. Đơn vẫn ở trạng thái đang thực hiện.',
        target: 'provider_order_body',
      ),
      GuidedTourStep(
        'Dịch vụ bổ sung',
        'Gửi đề xuất để khách xem và chấp thuận trước. Kiểm tra tổng tiền cập nhật trong đơn.',
      ),
      GuidedTourStep(
        'Ảnh kết quả',
        'Khi làm xong, tải ảnh kết quả theo yêu cầu rồi chuyển sang kiểm tra thanh toán.',
      ),
    ],
  ),
  'provider_order_settlement': GuidanceTour(
    'provider_order_settlement',
    'Kiểm tra thanh toán',
    'provider',
    [
      GuidedTourStep(
        'Đối chiếu tổng tiền',
        'Kiểm tra dịch vụ ban đầu, dịch vụ bổ sung được duyệt và ưu đãi. Chỉ xác nhận đã nhận tiền khi đã thu đủ thực tế.',
        target: 'provider_order_body',
      ),
      GuidedTourStep(
        'Chưa thu đủ tiền?',
        'Sử dụng chức năng xử lý thanh toán hoặc hỗ trợ trong đơn. Không xác nhận hoàn thành để bỏ qua khoản tiền chưa nhận.',
      ),
    ],
  ),
  'provider_order_complete': GuidanceTour(
    'provider_order_complete',
    'Đơn đã hoàn thành',
    'provider',
    [
      GuidedTourStep(
        'Xem kết quả của đơn',
        'Xem lại lịch sử, ảnh và thanh toán của đơn. Thu nhập và ví được hiển thị theo quyền của đối tác hoặc chủ cơ sở. Bạn có thể tiếp tục nhận khách nếu còn đủ điều kiện.',
        target: 'provider_order_body',
      ),
    ],
  ),
  'organization_start': GuidanceTour(
    'organization_start',
    'Thiết lập cơ sở',
    'organization',
    [
      GuidedTourStep(
        'Chuẩn bị đội ngũ',
        'Mời nhân viên, hoàn tất xác minh và phân công đúng dịch vụ cho từng người. Kiểm tra lịch làm và khu vực phục vụ của cơ sở.',
      ),
      GuidedTourStep(
        'Điều phối nhận đơn',
        'Theo dõi nhân viên hoạt động, lịch hẹn và ví cơ sở. Công tắc tổng kiểm soát việc nhận đơn của cơ sở; nhân viên quản lý trạng thái cá nhân theo quyền được cấp.',
      ),
    ],
  ),
  'worker_start': GuidanceTour(
    'worker_start',
    'Bắt đầu làm việc tại cơ sở',
    'worker',
    [
      GuidedTourStep(
        'Kiểm tra quyền thực hiện',
        'Kiểm tra tư cách thành viên, chuyên môn đã xác minh và các dịch vụ được cơ sở phân công.',
      ),
      GuidedTourStep(
        'Lịch và trạng thái cá nhân',
        'Xem lịch cá nhân, bán kính được phép và bật hoạt động khi sẵn sàng. Nếu bị chặn, kiểm tra thiết lập hoặc liên hệ chủ cơ sở.',
      ),
      GuidedTourStep(
        'Thực hiện đơn',
        'Nhận đơn được giao, cập nhật hành trình, ảnh trước/sau và thanh toán theo quy trình. Ví và cấu hình cơ sở thuộc quyền của chủ cơ sở.',
      ),
    ],
  ),
};
