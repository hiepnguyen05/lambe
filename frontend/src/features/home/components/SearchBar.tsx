import { useState, type FormEvent } from 'react'

interface SearchBarProps {
  onSearch?: (query: string) => void
  onOpenFilter?: () => void
}

export function SearchBar({ onSearch, onOpenFilter }: SearchBarProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (onSearch) {
      onSearch(query)
    }
  }

  return (
    <section className="search-bar-section">
      <form className="search-bar-form" onSubmit={handleSubmit}>
        <span className="material-symbols-outlined search-bar-icon">
          search
        </span>
        <input
          type="text"
          placeholder="Tìm dịch vụ hoặc chuyên viên gần bạn..."
          className="search-bar-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="search-filter-btn"
          aria-label="Bộ lọc tìm kiếm"
          onClick={onOpenFilter}
        >
          <span className="material-symbols-outlined">tune</span>
        </button>
      </form>
    </section>
  )
}
