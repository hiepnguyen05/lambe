interface CategoryItem {
  id: string
  title: string
  icon: string
  isHot?: boolean
}

const CATEGORIES: CategoryItem[] = [
  { id: 'goi-dau', title: 'Gội đầu\ndưỡng sinh', icon: 'spa' },
  { id: 'nail', title: 'Làm móng\n& Nail', icon: 'brush' },
  { id: 'massage', title: 'Massage\n& Spa', icon: 'self_improvement' },
  { id: 'makeup', title: 'Makeup\n& Tóc', icon: 'face_retouching_natural' },
  { id: 'facial', title: 'Chăm sóc da\nFacial', icon: 'health_and_beauty' },
  { id: 'cat-toc', title: 'Cắt gội\nnam nữ', icon: 'content_cut' },
  { id: 'tho-gap', title: 'Thợ gấp\n30 phút', icon: 'bolt', isHot: true },
  { id: 'xem-tat-ca', title: 'Xem\ntất cả', icon: 'grid_view' },
]

interface CategoriesGridProps {
  onSelectCategory?: (categoryId: string) => void
}

export function CategoriesGrid({ onSelectCategory }: CategoriesGridProps) {
  return (
    <section className="categories-section">
      <div className="section-header">
        <h2 className="section-title">Danh mục dịch vụ</h2>
        <button
          type="button"
          className="section-link-btn"
          onClick={() => onSelectCategory?.('all')}
        >
          <span>Tất cả</span>
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      <div className="categories-grid">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="category-card"
            onClick={() => onSelectCategory?.(cat.id)}
          >
            {cat.isHot && <span className="category-hot-badge">HOT</span>}

            <div
              className={`category-icon-box ${
                cat.id === 'xem-tat-ca' ? 'category-icon-box--all' : ''
              }`}
            >
              <span className="material-symbols-outlined category-icon">
                {cat.icon}
              </span>
            </div>

            <span className="category-label">
              {cat.title.split('\n').map((line, idx) => (
                <span key={idx}>
                  {line}
                  {idx === 0 && <br />}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
