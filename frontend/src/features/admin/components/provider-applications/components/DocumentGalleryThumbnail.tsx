import { useState } from 'react';
import { FileText, ImageOff, Images, LoaderCircle, RefreshCw } from 'lucide-react';
import type {
  ProviderDocument,
  ProviderDocumentAccess,
} from '../../../hooks/useProviderApplications';

interface DocumentGalleryThumbnailProps {
  documents: ProviderDocument[];
  accesses: Record<string, ProviderDocumentAccess>;
  isLoading: boolean;
  hasError: boolean;
  disabled?: boolean;
  onOpen: () => void;
  onRetry: () => void;
}

const imageFormats = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp']);

export function DocumentGalleryThumbnail({
  documents,
  accesses,
  isLoading,
  hasError,
  disabled = false,
  onOpen,
  onRetry,
}: DocumentGalleryThumbnailProps) {
  const visibleDocuments = documents.slice(0, 4);

  return (
    <div className="w-full sm:w-52">
      <button
        type="button"
        title={`Xem ${documents.length} ảnh hồ sơ năng lực`}
        disabled={disabled || documents.length === 0}
        onClick={onOpen}
        className="group relative grid aspect-[4/3] w-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-md border border-slate-200 bg-slate-100 text-slate-500 transition hover:border-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-60"
      >
        {visibleDocuments.map((document, index) => (
          <GalleryTile
            key={document.id}
            access={accesses[document.id]}
            isLoading={isLoading}
            className={getTileClassName(visibleDocuments.length, index)}
          />
        ))}

        {documents.length > 4 && (
          <span className="pointer-events-none absolute bottom-0 right-0 flex h-1/2 w-1/2 items-center justify-center bg-slate-950/70 text-sm font-bold text-white">
            +{documents.length - 4}
          </span>
        )}

        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-slate-950/75 px-2 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Images className="h-3.5 w-3.5" />
          Xem tất cả ảnh
        </span>
      </button>

      {hasError && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:underline"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tải lại ảnh
        </button>
      )}
    </div>
  );
}

function GalleryTile({
  access,
  isLoading,
  className,
}: {
  access?: ProviderDocumentAccess;
  isLoading: boolean;
  className: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const format =
    access?.fileFormat?.toLowerCase() ||
    access?.url.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1]?.toLowerCase() ||
    '';
  const canRenderImage = Boolean(access && imageFormats.has(format) && !imageFailed);

  return (
    <span className={`flex min-h-0 items-center justify-center overflow-hidden bg-slate-200 ${className}`}>
      {canRenderImage ? (
        <img
          src={access?.url}
          alt="Ảnh hồ sơ năng lực"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      ) : isLoading ? (
        <LoaderCircle className="h-5 w-5 animate-spin text-teal-700" />
      ) : access && !imageFailed ? (
        <FileText className="h-5 w-5 text-slate-500" />
      ) : (
        <ImageOff className="h-5 w-5 text-slate-400" />
      )}
    </span>
  );
}

function getTileClassName(total: number, index: number) {
  if (total === 1) return 'col-span-2 row-span-2';
  if (total === 2) return 'row-span-2';
  if (total === 3 && index === 0) return 'row-span-2';
  return '';
}
