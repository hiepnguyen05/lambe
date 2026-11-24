import { useState } from 'react';
import {
  Users,
  Sparkles,
  Save,
  Check,
  AlertCircle,
  Search,
  Filter,
} from 'lucide-react';

interface MatrixService {
  providerServiceId: string;
  name: string;
  priceAmount: number;
  durationMinutes: number;
  categoryName: string;
}

interface MatrixMember {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  experienceYears: number;
  assignedServiceIds: string[];
}

interface ServiceMemberMatrixTableProps {
  services?: MatrixService[];
  members?: MatrixMember[];
  onSaveAssignment?: (memberId: string, serviceIds: string[], reason: string) => Promise<void>;
}

const DEFAULT_SERVICES: MatrixService[] = [
  {
    providerServiceId: 'srv-1',
    name: 'Chăm sóc da chuyên sâu 12 bước',
    priceAmount: 450000,
    durationMinutes: 75,
    categoryName: 'Chăm sóc da',
  },
  {
    providerServiceId: 'srv-2',
    name: 'Massage trị liệu cổ vai gáy',
    priceAmount: 250000,
    durationMinutes: 45,
    categoryName: 'Massage dưỡng sinh',
  },
  {
    providerServiceId: 'srv-3',
    name: 'Gội đầu dưỡng sinh thảo dược',
    priceAmount: 180000,
    durationMinutes: 50,
    categoryName: 'Massage dưỡng sinh',
  },
  {
    providerServiceId: 'srv-4',
    name: 'Tạo mẫu & Uốn tóc Hàn Quốc',
    priceAmount: 600000,
    durationMinutes: 120,
    categoryName: 'Tóc & Salon',
  },
  {
    providerServiceId: 'srv-5',
    name: 'Làm móng Gel & Vẽ Art 3D',
    priceAmount: 320000,
    durationMinutes: 60,
    categoryName: 'Nail Art',
  },
];

const DEFAULT_MEMBERS: MatrixMember[] = [
  {
    id: 'mem-1',
    displayName: 'Nguyễn Thúy Hằng',
    experienceYears: 4,
    assignedServiceIds: ['srv-1', 'srv-2', 'srv-3'],
  },
  {
    id: 'mem-2',
    displayName: 'Trần Minh Quân',
    experienceYears: 5,
    assignedServiceIds: ['srv-4'],
  },
  {
    id: 'mem-3',
    displayName: 'Lê Phương Anh',
    experienceYears: 3,
    assignedServiceIds: ['srv-1', 'srv-5'],
  },
  {
    id: 'mem-4',
    displayName: 'Vũ Hoàng Yến',
    experienceYears: 2,
    assignedServiceIds: ['srv-2', 'srv-3'],
  },
];

export function ServiceMemberMatrixTable({
  services = DEFAULT_SERVICES,
  members = DEFAULT_MEMBERS,
  onSaveAssignment,
}: ServiceMemberMatrixTableProps) {
  const [currentAssignments, setCurrentAssignments] = useState<
    Record<string, Set<string>>
  >(() => {
    const map: Record<string, Set<string>> = {};
    members.forEach((m) => {
      map[m.id] = new Set(m.assignedServiceIds);
    });
    return map;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const categories = Array.from(new Set(services.map((s) => s.categoryName)));

  const filteredServices = services.filter((s) => {
    const matchesSearch = s.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' || s.categoryName === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleAssignment = (memberId: string, providerServiceId: string) => {
    setCurrentAssignments((prev) => {
      const set = new Set(prev[memberId] || []);
      if (set.has(providerServiceId)) {
        set.delete(providerServiceId);
      } else {
        set.add(providerServiceId);
      }
      return { ...prev, [memberId]: set };
    });
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      if (onSaveAssignment) {
        for (const m of members) {
          const serviceIds = Array.from(currentAssignments[m.id] || []);
          await onSaveAssignment(
            m.id,
            serviceIds,
            'Cập nhật ma trận phân quyền từ cổng quản lý Web'
          );
        }
      } else {
        // Fallback simulation
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      setSaveSuccessMsg('Đã lưu toàn bộ ma trận phân công dịch vụ thành công!');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch {
      // Error handling
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-700" />
            Ma Trận Phân Công Dịch Vụ - Nhân Viên
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Bật/tắt dịch vụ chuyên môn cấp phép cho từng kỹ thuật viên thực hiện
            theo thẩm định tay nghề.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50"
          >
            {isSaving ? (
              <span>Đang lưu...</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Lưu ma trận phân công</span>
              </>
            )}
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-sm font-medium">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Filter and Search controls */}
      <div className="p-4 bg-slate-50/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm tên dịch vụ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none bg-white"
            >
              <option value="ALL">Tất cả danh mục ({services.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>
            Thay đổi phân công sẽ tự động tắt phiên online hiện hành của thợ
            được điều chỉnh.
          </span>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider">
              <th className="py-3.5 px-4 min-w-[280px]">
                Dịch vụ cơ sở ({filteredServices.length})
              </th>
              <th className="py-3.5 px-4 min-w-[120px]">Thời lượng & Giá</th>
              {members.map((m) => (
                <th
                  key={m.id}
                  className="py-3.5 px-4 text-center min-w-[140px] border-l border-slate-200/80"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-bold text-slate-900 capitalize">
                      {m.displayName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {m.experienceYears} năm KN •{' '}
                      {(currentAssignments[m.id] || new Set()).size} món
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {filteredServices.map((service) => (
              <tr
                key={service.providerServiceId}
                className="hover:bg-slate-50/70 transition"
              >
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-900 text-sm">
                    {service.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {service.categoryName}
                  </div>
                </td>
                <td className="py-3 px-4 text-xs">
                  <div className="font-semibold text-teal-800">
                    {service.priceAmount.toLocaleString('vi-VN')} đ
                  </div>
                  <div className="text-slate-400">{service.durationMinutes} phút</div>
                </td>
                {members.map((m) => {
                  const isChecked = (
                    currentAssignments[m.id] || new Set()
                  ).has(service.providerServiceId);
                  return (
                    <td
                      key={m.id}
                      className="py-3 px-4 text-center border-l border-slate-200/80 cursor-pointer hover:bg-teal-50/40"
                      onClick={() =>
                        toggleAssignment(m.id, service.providerServiceId)
                      }
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          toggleAssignment(m.id, service.providerServiceId)
                        }
                        className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-700 cursor-pointer"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer bar */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Tổng cộng: {members.length} kỹ thuật viên • {services.length} dịch vụ
          </span>
        </div>
        <span>Cập nhật gần nhất: Hôm nay</span>
      </div>
    </div>
  );
}
