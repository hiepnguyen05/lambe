import { apiRequest } from '../../../lib/api-client';

export interface AdminUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  width?: number;
  height?: number;
  resourceType: string;
}

export async function uploadAdminImage(
  file: File,
  folder: 'categories' | 'services' | 'general' | 'icons' | 'profiles' | 'portfolios' = 'categories',
): Promise<AdminUploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiRequest<{ data: AdminUploadResult }>(
    `/admin/upload/image?folder=${encodeURIComponent(folder)}`,
    {
      method: 'POST',
      body: formData,
    },
  );

  return res.data;
}
