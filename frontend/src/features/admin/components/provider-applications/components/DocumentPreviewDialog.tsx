import { useEffect, useState, type ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileWarning,
  LoaderCircle,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  ProviderDocument,
  ProviderDocumentAccess,
} from '../../../hooks/useProviderApplications';
import { ReviewStatusBadge } from './ProviderApplicationUi';
import {
  documentLabels,
  formatDate,
} from './providerApplicationFormatters';

interface DocumentPreviewDialogProps {
  documents: ProviderDocument[];
  document: ProviderDocument;
  access: ProviderDocumentAccess;
  isLoading: boolean;
  reviewActions?: ReactNode;
  onNavigate: (document: ProviderDocument) => void;
  onClose: () => void;
}

const imageFormats = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp']);

export function DocumentPreviewDialog({
  documents,
  document,
  access,
  isLoading,
  reviewActions,
  onNavigate,
  onClose,
}: DocumentPreviewDialogProps) {
  const index = documents.findIndex((item) => item.id === document.id);
  const previous = index > 0 ? documents[index - 1] : null;
  const next = index >= 0 && index < documents.length - 1 ? documents[index + 1] : null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) onClose();
      if (event.key === 'ArrowLeft' && previous && !isLoading) onNavigate(previous);
      if (event.key === 'ArrowRight' && next && !isLoading) onNavigate(next);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, next, onClose, onNavigate, previous]);

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-950/80 p-2 sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-preview-title"
        className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
      >
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="document-preview-title" className="truncate font-bold text-slate-900">
                {documentLabels[document.type] || document.type}
              </h2>
              <ReviewStatusBadge status={document.status} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Tài liệu {index + 1}/{documents.length} · Tải lên {formatDate(document.createdAt, true)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={access.url}
              target="_blank"
              rel="noreferrer"
              title="Mở bản gốc trong tab mới"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              title="Đóng"
              disabled={isLoading}
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden overflow-y-auto border-r border-slate-200 bg-slate-50 p-2 md:block">
            {documents.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                disabled={isLoading}
                onClick={() => onNavigate(item)}
                className={`mb-1 w-full rounded-md px-3 py-2.5 text-left transition ${
                  item.id === document.id
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span className="block text-xs font-semibold opacity-75">Tài liệu {itemIndex + 1}</span>
                <span className="mt-0.5 block truncate text-sm font-semibold">
                  {documentLabels[item.type] || item.type}
                </span>
              </button>
            ))}
          </aside>

          <div className="relative min-h-0 overflow-hidden bg-slate-900">
            <DocumentCanvas key={document.id} access={access} />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 text-sm font-semibold text-white">
                <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                Đang tải tài liệu...
              </div>
            )}
            <button
              type="button"
              title="Tài liệu trước"
              disabled={!previous || isLoading}
              onClick={() => previous && onNavigate(previous)}
              className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/65 text-white hover:bg-slate-950 disabled:hidden"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              title="Tài liệu tiếp theo"
              disabled={!next || isLoading}
              onClick={() => next && onNavigate(next)}
              className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/65 text-white hover:bg-slate-950 disabled:hidden"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0 text-sm text-slate-600">
            {document.reviewNote ? (
              <span><strong>Nhận xét:</strong> {document.reviewNote}</span>
            ) : (
              <span>Chưa có nhận xét cho tài liệu này.</span>
            )}
          </div>
          {reviewActions && <div className="shrink-0">{reviewActions}</div>}
        </footer>
      </section>
    </div>
  );
}

function DocumentCanvas({ access }: { access: ProviderDocumentAccess }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const format =
    access.fileFormat?.toLowerCase() ||
    access.url.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1]?.toLowerCase() ||
    '';

  if (format === 'pdf') {
    return (
      <iframe
        title="Nội dung tài liệu PDF"
        src={access.url}
        referrerPolicy="no-referrer"
        className="h-full min-h-[420px] w-full bg-white"
      />
    );
  }

  if (!imageFormats.has(format) || loadFailed) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center text-slate-200">
        <FileWarning className="h-10 w-10 text-amber-400" />
        <p className="mt-3 font-semibold">Không thể xem trước định dạng này.</p>
        <a
          href={access.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          <ExternalLink className="h-4 w-4" />
          Mở bản gốc
        </a>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[420px] overflow-auto p-6 sm:p-10">
      <div className="flex min-h-full min-w-full items-center justify-center">
        <img
          src={access.url}
          alt="Tài liệu đăng ký đối tác"
          referrerPolicy="no-referrer"
          onError={() => setLoadFailed(true)}
          style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
          className="max-h-[calc(100vh-13rem)] max-w-full object-contain shadow-2xl transition-transform"
        />
      </div>
      <div className="sticky bottom-2 mx-auto mt-3 flex w-fit items-center gap-1 rounded-md bg-slate-950/80 p-1 text-white shadow-lg">
        <button
          type="button"
          title="Thu nhỏ"
          disabled={scale <= 0.5}
          onClick={() => setScale((value) => Math.max(0.5, value - 0.25))}
          className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-white/15 disabled:opacity-35"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="w-14 text-center text-xs font-semibold">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          title="Phóng to"
          disabled={scale >= 3}
          onClick={() => setScale((value) => Math.min(3, value + 0.25))}
          className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-white/15 disabled:opacity-35"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Xoay ảnh"
          onClick={() => setRotation((value) => (value + 90) % 360)}
          className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-white/15"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
