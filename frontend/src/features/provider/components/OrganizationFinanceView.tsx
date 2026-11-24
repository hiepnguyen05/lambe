import { useState } from 'react';
import {
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Receipt,
  Wallet,
  Users,
} from 'lucide-react';

interface MemberFinanceRow {
  memberId: string;
  memberName: string;
  membershipVersion: number;
  completedOrdersCount: number;
  totalServiceRevenue: number;
  platformCommission: number;
  cashCollectedAmount: number;
  unreconciledCashAmount: number;
  netOrganizationEarnings: number;
}

const SAMPLE_FINANCE_ROWS: MemberFinanceRow[] = [
  {
    memberId: 'mem-1',
    memberName: 'Nguyễn Thúy Hằng',
    membershipVersion: 1,
    completedOrdersCount: 24,
    totalServiceRevenue: 10800000,
    platformCommission: 1620000,
    cashCollectedAmount: 4500000,
    unreconciledCashAmount: 0,
    netOrganizationEarnings: 9180000,
  },
  {
    memberId: 'mem-2',
    memberName: 'Trần Minh Quân',
    membershipVersion: 1,
    completedOrdersCount: 18,
    totalServiceRevenue: 9200000,
    platformCommission: 1380000,
    cashCollectedAmount: 3200000,
    unreconciledCashAmount: 450000,
    netOrganizationEarnings: 7820000,
  },
  {
    memberId: 'mem-3',
    memberName: 'Lê Phương Anh',
    membershipVersion: 2,
    completedOrdersCount: 31,
    totalServiceRevenue: 14500000,
    platformCommission: 2175000,
    cashCollectedAmount: 6800000,
    unreconciledCashAmount: 0,
    netOrganizationEarnings: 12325000,
  },
  {
    memberId: 'mem-4',
    memberName: 'Vũ Hoàng Yến',
    membershipVersion: 1,
    completedOrdersCount: 12,
    totalServiceRevenue: 4800000,
    platformCommission: 720000,
    cashCollectedAmount: 1800000,
    unreconciledCashAmount: 200000,
    netOrganizationEarnings: 4080000,
  },
];

export function OrganizationFinanceView() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'this_month'>('this_month');
  const [rows] = useState<MemberFinanceRow[]>(SAMPLE_FINANCE_ROWS);

  const totalRevenue = rows.reduce((acc, r) => acc + r.totalServiceRevenue, 0);
  const totalCommission = rows.reduce((acc, r) => acc + r.platformCommission, 0);
  const totalCashCollected = rows.reduce((acc, r) => acc + r.cashCollectedAmount, 0);
  const totalUnreconciled = rows.reduce((acc, r) => acc + r.unreconciledCashAmount, 0);
  const totalNetEarnings = rows.reduce((acc, r) => acc + r.netOrganizationEarnings, 0);

  const exportExcelCSV = () => {
    const headers = [
      'Mã Nhân Viên',
      'Họ Và Tên',
      'Phiên Gia Nhập',
      'Số Đơn Hoàn Tất',
      'Tổng Doanh Thu (VNĐ)',
      'Hoa Hồng Nền Tảng (VNĐ)',
      'Tiền Mặt Thu Hộ (VNĐ)',
      'Tiền Mặt Chưa Bàn Giao (VNĐ)',
      'Thực Thu Cơ Sở (VNĐ)',
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.memberId,
          `"${r.memberName}"`,
          r.membershipVersion,
          r.completedOrdersCount,
          r.totalServiceRevenue,
          r.platformCommission,
          r.cashCollectedAmount,
          r.unreconciledCashAmount,
          r.netOrganizationEarnings,
        ].join(',')
      ),
    ].join('\n');

    // Create a UTF-8 BOM blob so Excel opens Vietnamese characters correctly
    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_Cao_Tai_Chinh_Lambe_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Range selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-teal-700" />
            Báo Cáo Tài Chính & Đối Soát Nhân Viên
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi dòng tiền, doanh thu theo thợ, hoa hồng khấu trừ và tiền
            mặt thu hộ thực tế.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200">
            <button
              type="button"
              onClick={() => setDateRange('7d')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRange === '7d'
                  ? 'bg-white text-teal-800 shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              onClick={() => setDateRange('this_month')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRange === 'this_month'
                  ? 'bg-white text-teal-800 shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              Tháng này
            </button>
            <button
              type="button"
              onClick={() => setDateRange('30d')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRange === '30d'
                  ? 'bg-white text-teal-800 shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              30 ngày qua
            </button>
          </div>

          <button
            type="button"
            onClick={exportExcelCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>Xuất file Excel / CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Tổng doanh thu cơ sở</span>
            <DollarSign className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {totalRevenue.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>85 đơn hàng hoàn tất</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Thực nhận về cơ sở</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            {totalNetEarnings.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Sau khi trừ hoa hồng nền tảng (15%)
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Tiền mặt thợ đã thu</span>
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-700">
            {totalCashCollected.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Thu trực tiếp từ khách hàng tại cơ sở / tại nhà
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Tiền mặt chưa bàn giao</span>
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">
            {totalUnreconciled.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-amber-800 font-medium mt-1">
            Cần đối soát với 2 nhân sự
          </div>
        </div>
      </div>

      {/* Staff Financial Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-700" />
            Chi Tiết Doanh Thu & Đối Soát Từng Kỹ Thuật Viên
          </h3>
          <span className="text-xs text-slate-500">
            {rows.length} nhân viên trong kỳ
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100/60 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Kỹ thuật viên</th>
                <th className="py-3 px-4 text-center">Đơn hoàn tất</th>
                <th className="py-3 px-4 text-right">Doanh thu đóng góp</th>
                <th className="py-3 px-4 text-right">Hoa hồng Lambe</th>
                <th className="py-3 px-4 text-right">Tiền mặt đã thu</th>
                <th className="py-3 px-4 text-right">Chưa đối soát</th>
                <th className="py-3 px-4 text-right font-bold text-teal-900">
                  Thực thu cơ sở
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => (
                <tr key={row.memberId} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">
                      {row.memberName}
                    </div>
                    <div className="text-xs text-slate-400">
                      Phiên #{row.membershipVersion} • ID: {row.memberId}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-medium">
                    {row.completedOrdersCount}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-800">
                    {row.totalServiceRevenue.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500">
                    {row.platformCommission.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="py-3 px-4 text-right text-blue-700 font-medium">
                    {row.cashCollectedAmount.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="py-3 px-4 text-right">
                    {row.unreconciledCashAmount > 0 ? (
                      <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
                        {row.unreconciledCashAmount.toLocaleString('vi-VN')} đ
                      </span>
                    ) : (
                      <span className="text-slate-400">0 đ</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-teal-800">
                    {row.netOrganizationEarnings.toLocaleString('vi-VN')} đ
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50/80 font-bold border-t-2 border-slate-300">
              <tr>
                <td className="py-3 px-4 text-slate-900">Tổng cộng</td>
                <td className="py-3 px-4 text-center">85</td>
                <td className="py-3 px-4 text-right text-slate-900">
                  {totalRevenue.toLocaleString('vi-VN')} đ
                </td>
                <td className="py-3 px-4 text-right text-slate-600">
                  {totalCommission.toLocaleString('vi-VN')} đ
                </td>
                <td className="py-3 px-4 text-right text-blue-800">
                  {totalCashCollected.toLocaleString('vi-VN')} đ
                </td>
                <td className="py-3 px-4 text-right text-amber-800">
                  {totalUnreconciled.toLocaleString('vi-VN')} đ
                </td>
                <td className="py-3 px-4 text-right text-teal-900 text-base">
                  {totalNetEarnings.toLocaleString('vi-VN')} đ
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

