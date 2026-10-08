import { useState } from 'react';
import { FileText, ImageOff, LoaderCircle, RefreshCw } from 'lucide-react';
import type { ProviderDocumentAccess } from '../../../hooks/useProviderApplications';

interface DocumentThumbnailProps {
  access?: ProviderDocumentAccess;
  isLoading: boolean;
  hasError: boolean;
  label: string;
  onOpen: () => void;
  onRetry: () => void;
}

const imageFormats = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp']);

export function DocumentThumbnail({
  access,
  isLoading,
  hasError,
  label,
  onOpen,
  onRetry,
}: DocumentThumbnailProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const format =
    access?.fileFormat?.toLowerCase() ||
    access?.url.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1]?.toLowerCase() ||
    '';
  const canRenderImage = Boolean(access && imageFormats.has(format) && !imageFailed);

  return (
    <div className="w-full sm:w-52">
      <button
        type="button"
        disabled={!access}
        onClick={onOpen}
        className="group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100 text-slate-500 disabled:cursor-default"
      >
        {canRenderImage ? (
          <img
            src={access?.url}
            alt={label}
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : isLoading ? (
          <span className="flex flex-col items-center gap-2 text-xs font-medium">
            <LoaderCircle className="h-5 w-5 animate-spin text-teal-700" />
            Đang tải ảnh
          </span>
        ) : access ? (
          <span className="flex flex-col items-center gap-2 px-3 text-xs font-medium">
            {imageFailed ? <ImageOff className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
            {imageFailed ? 'Ảnh không tải được' : `Tài liệu ${format.toUpperCase() || 'khác'}`}
          </span>
        ) : (
          <span className="flex flex-col items-center gap-2 px-3 text-xs font-medium">
            <ImageOff className="h-6 w-6" />
            Chưa lấy được ảnh
          </span>
        )}
        {canRenderImage && (
          <span className="absolute inset-x-0 bottom-0 bg-slate-950/70 px-2 py-1.5 text-center text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
            Xem ảnh lớn
          </span>
        )}
      </button>
      {(hasError || imageFailed) && (
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
