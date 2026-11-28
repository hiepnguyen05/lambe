type PushCopy = { title: string; body: string };

const PUSH_CONTENT = {
  FEED_MODERATION_DECIDED: {
    title: 'Có kết quả kiểm duyệt bài đăng',
    body: 'Mở Lambe để xem quyết định và quyền khiếu nại.',
  },
  FEED_APPEAL_RESOLVED: {
    title: 'Khiếu nại đã được xem xét',
    body: 'Mở Lambe để xem kết quả.',
  },
  FEED_REPORT_RESOLVED: {
    title: 'Báo cáo đã được xử lý',
    body: 'Mở Lambe để xem kết quả xử lý.',
  },
  WALLET_LOW_BALANCE: {
    title: 'Cập nhật ví đối tác',
    body: 'Mở ứng dụng để xem thông báo vận hành.',
  },
  MEMBER_SUSPENDED: {
    title: 'Có thay đổi về thành viên',
    body: 'Mở khu vực quản lý đối tác để xem cập nhật.',
  },
  MEMBER_LEFT: {
    title: 'Có thay đổi về thành viên',
    body: 'Mở khu vực quản lý đối tác để xem cập nhật.',
  },
  MEMBER_ACCOUNT_RESTRICTED: {
    title: 'Có thay đổi về thành viên',
    body: 'Mở khu vực quản lý đối tác để xem cập nhật.',
  },
  PROVIDER_SUSPENDED: {
    title: 'Có cập nhật về hoạt động đối tác',
    body: 'Mở ứng dụng để xem trạng thái và liên hệ hỗ trợ.',
  },
  ORDER_REQUESTED: {
    title: 'Có đơn hàng mới',
    body: 'Bạn có yêu cầu đặt lịch mới.',
  },
  ORDER_ACCEPTED: {
    title: 'Đơn hàng được nhận',
    body: 'Chuyên viên đã nhận lịch của bạn.',
  },
  ORDER_REJECTED: {
    title: 'Đơn hàng chưa được nhận',
    body: 'Hãy chọn chuyên viên khác.',
  },
  ORDER_EXPIRED: {
    title: 'Yêu cầu đã hết hạn',
    body: 'Hãy đặt lại hoặc chọn chuyên viên khác.',
  },
  ORDER_EN_ROUTE: {
    title: 'Chuyên viên đang di chuyển',
    body: 'Theo dõi đơn hàng để xem tiến độ.',
  },
  ORDER_ARRIVED: {
    title: 'Chuyên viên đã đến',
    body: 'Chuyên viên đã đến địa chỉ đặt lịch.',
  },
  ORDER_IN_PROGRESS: {
    title: 'Dịch vụ đã bắt đầu',
    body: 'Đơn hàng của bạn đang được thực hiện.',
  },
  ORDER_WORK_PAUSED: {
    title: 'Dịch vụ đang tạm dừng',
    body: 'Chuyên viên đã tạm dừng thực hiện dịch vụ.',
  },
  ORDER_WORK_RESUMED: {
    title: 'Dịch vụ tiếp tục thực hiện',
    body: 'Chuyên viên đã tiếp tục thực hiện dịch vụ.',
  },
  ORDER_COMPLETED: {
    title: 'Dịch vụ hoàn tất',
    body: 'Bạn có thể xem lại và đánh giá đơn hàng.',
  },
  ORDER_CANCELLED: {
    title: 'Đơn hàng đã hủy',
    body: 'Mở ứng dụng để xem chi tiết.',
  },
  ORDER_DELAYED: {
    title: 'Đơn hàng cần được kiểm tra',
    body: 'Lịch phục vụ đang chậm hơn dự kiến. Mở đơn hàng để xem trạng thái mới nhất.',
  },
  CANCELLATION_REQUESTED: {
    title: 'Có yêu cầu hủy đơn',
    body: 'Vui lòng xem và phản hồi trong ứng dụng.',
  },
  CANCELLATION_APPROVED: {
    title: 'Đơn hàng đã được hủy',
    body: 'Mở ứng dụng để xem chi tiết.',
  },
  CANCELLATION_ESCALATED: {
    title: 'Yêu cầu hủy đang được hỗ trợ',
    body: 'Mở ứng dụng để xem tiến độ.',
  },
  CANCELLATION_DENIED: {
    title: 'Yêu cầu hủy chưa được chấp thuận',
    body: 'Mở ứng dụng để xem quyết định.',
  },
  ORDER_RESCHEDULE_REQUESTED: {
    title: 'Có đề nghị đổi giờ',
    body: 'Vui lòng xem lịch hẹn và phản hồi.',
  },
  ORDER_RESCHEDULE_ACCEPTED: {
    title: 'Giờ hẹn mới đã được chấp nhận',
    body: 'Mở ứng dụng để xem lịch hẹn.',
  },
  ORDER_RESCHEDULE_REJECTED: {
    title: 'Giờ hẹn mới chưa được chấp nhận',
    body: 'Mở ứng dụng để xem lịch hẹn.',
  },
  ORDER_RESCHEDULE_EXPIRED: {
    title: 'Đề xuất đổi giờ đã hết hạn',
    body: 'Lịch hẹn cũ vẫn được giữ. Mở đơn để thống nhất phương án xử lý.',
  },
  ORDER_RESCHEDULE_CANCELLED: {
    title: 'Đề xuất đổi giờ không còn hiệu lực',
    body: 'Đơn đã chuyển trạng thái. Mở đơn để xem tiến trình mới nhất.',
  },
  ORDER_ADD_ON_REQUESTED: {
    title: 'Có đề nghị thêm dịch vụ',
    body: 'Vui lòng xem và phản hồi trong đơn hàng.',
  },
  ORDER_ADD_ON_ACCEPTED: {
    title: 'Dịch vụ bổ sung đã được chấp nhận',
    body: 'Mở ứng dụng để xem đơn hàng.',
  },
  ORDER_ADD_ON_REJECTED: {
    title: 'Dịch vụ bổ sung chưa được chấp nhận',
    body: 'Mở ứng dụng để xem đơn hàng.',
  },
  ORDER_ADD_ON_CANCELLED: {
    title: 'Dịch vụ bổ sung đã hủy',
    body: 'Mở ứng dụng để xem đơn hàng.',
  },
  ORDER_ADD_ON_EXPIRED: {
    title: 'Đề nghị thêm dịch vụ đã hết hạn',
    body: 'Mở ứng dụng để xem đơn hàng.',
  },
  PAYMENT_DISPUTE_OPENED: {
    title: 'Có tranh chấp thanh toán',
    body: 'Mở đơn hàng để xem tiến độ xử lý.',
  },
  PAYMENT_DISPUTE_CONFIRM_PAID: {
    title: 'Thanh toán đã được xác nhận',
    body: 'Mở ứng dụng để xem kết quả xử lý.',
  },
  PAYMENT_DISPUTE_CONFIRM_UNPAID: {
    title: 'Thanh toán đang được xử lý',
    body: 'Mở ứng dụng để xem kết quả xử lý.',
  },
  ORDER_SAFETY_HOLD: {
    title: 'Đơn hàng tạm dừng để hỗ trợ',
    body: 'Vui lòng mở ứng dụng để xem hướng dẫn.',
  },
  ORDER_SAFETY_CLOSED: {
    title: 'Sự cố đã được xử lý',
    body: 'Mở ứng dụng để xem cập nhật.',
  },
  CHAT_MESSAGE: {
    title: 'Tin nhắn mới',
    body: 'Bạn có tin nhắn mới trên Lambe.',
  },
  APPLICATION_SUBMITTED: {
    title: 'Hồ sơ đối tác đã được gửi',
    body: 'Lambe đã tiếp nhận hồ sơ của bạn.',
  },
  APPLICATION_APPROVED: {
    title: 'Hồ sơ đối tác đã được duyệt',
    body: 'Mở ứng dụng để thiết lập hoạt động.',
  },
  APPLICATION_CHANGES_REQUESTED: {
    title: 'Hồ sơ đối tác cần bổ sung',
    body: 'Mở ứng dụng để xem các nội dung cần cập nhật.',
  },
  APPLICATION_REJECTED: {
    title: 'Có kết quả hồ sơ đối tác',
    body: 'Mở ứng dụng để xem kết quả xét duyệt.',
  },
  SERVICE_CHANGE_PENDING_REVIEW: {
    title: 'Đã nhận đề xuất dịch vụ',
    body: 'Lambe đang xét duyệt đề xuất của bạn.',
  },
  SERVICE_CHANGE_NEEDS_CHANGES: {
    title: 'Đề xuất dịch vụ cần bổ sung',
    body: 'Mở ứng dụng để xem nội dung cần cập nhật.',
  },
  SERVICE_CHANGE_APPROVED: {
    title: 'Đề xuất dịch vụ đã được duyệt',
    body: 'Mở ứng dụng để xem dịch vụ của bạn.',
  },
  SERVICE_CHANGE_REJECTED: {
    title: 'Có kết quả đề xuất dịch vụ',
    body: 'Mở ứng dụng để xem kết quả xét duyệt.',
  },
} satisfies Record<string, PushCopy>;

export function pushContent(event: string): PushCopy {
  return (
    PUSH_CONTENT[event as keyof typeof PUSH_CONTENT] ?? {
      title: 'Cập nhật từ Lambe',
      body: 'Có cập nhật mới, mở ứng dụng để xem chi tiết.',
    }
  );
}
