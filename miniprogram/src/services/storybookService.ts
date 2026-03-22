import { get, post, put, patch, del } from '../utils/request'

const BASE = '/api/v1/storybooks'

// ============ Types ============

export type StorybookStatus = 'init' | 'creating' | 'updating' | 'finished' | 'error' | 'terminated'
export type CliType       = 'gemini' | 'claude' | 'openai'
export type AspectRatio   = '1:1' | '16:9' | '4:3'
export type ImageSize     = '1k' | '2k' | '4k'
export type PageType      = 'cover' | 'content' | 'back_cover'

export interface StorybookPage {
  text: string
  image_url: string
  storyboard?: {
    scene: string
    characters: string
    shot: string
    color: string
    lighting: string
  } | null
  page_type?: PageType
}

export interface Storybook {
  id: number
  title: string
  description: string | null
  creator: string
  pages: StorybookPage[] | null
  status: StorybookStatus
  error_message?: string | null
  instruction?: string | null
  template_id?: number | null
  cli_type?: CliType
  aspect_ratio?: AspectRatio
  image_size?: ImageSize
}

export interface StorybookListItem {
  id: number
  title: string
  description: string | null
  creator: string
  status: StorybookStatus
  is_public: boolean
  created_at: string
  pages: StorybookPage[] | null
  cli_type?: CliType
  aspect_ratio?: AspectRatio
  image_size?: ImageSize
}

export interface CreateStorybookRequest {
  instruction: string
  template_id?: number
  images?: string[]
  cli_type?: CliType
  page_count?: number
  aspect_ratio?: AspectRatio
  image_size?: ImageSize
}

// ============ API ============

export const createStorybook = (req: CreateStorybookRequest) =>
  post<{ id: number; title: string; status: StorybookStatus }>(BASE, {
    instruction: req.instruction,
    template_id: req.template_id,
    images: req.images || [],
    cli_type: req.cli_type,
    page_count: req.page_count,
    aspect_ratio: req.aspect_ratio,
    image_size: req.image_size,
  })

export const listStorybooks = (params?: {
  creator?: string
  status?: string
  is_public?: boolean
  limit?: number
  offset?: number
}): Promise<StorybookListItem[]> => {
  const q = new URLSearchParams()
  if (params?.creator)    q.append('creator', params.creator)
  if (params?.status)     q.append('status', params.status)
  if (params?.is_public !== undefined) q.append('is_public', String(params.is_public))
  if (params?.limit)      q.append('limit', String(params.limit))
  if (params?.offset)     q.append('offset', String(params.offset))
  const qs = q.toString()
  return get<StorybookListItem[]>(`${BASE}${qs ? `?${qs}` : ''}`, false)
}

export const getStorybook = (id: number): Promise<Storybook> =>
  get<Storybook>(`${BASE}/${id}`, false)

export const editPageImage = (
  storybookId: number,
  imageUrl: string,
  instruction: string,
  referencedImage?: string,
): Promise<string> =>
  post<{ image: string }>(`${BASE}/image/edit`, {
    instruction,
    image_to_edit: imageUrl,
    referenced_image: referencedImage,
    storybook_id: storybookId,
  }).then(r => r.image)

export const savePage = (
  storybookId: number,
  pageIndex: number,
  text: string,
  imageUrl: string,
): Promise<StorybookPage> =>
  put<StorybookPage>(`${BASE}/${storybookId}/pages/${pageIndex}`, { text, image_url: imageUrl })

export const editStorybookPage = (
  storybookId: number,
  pageIndex: number,
  instruction: string,
) =>
  patch<{ storybook_id: number; status: StorybookStatus }>(
    `${BASE}/${storybookId}/pages/${pageIndex}`, { instruction }
  )

export const deletePage = (storybookId: number, pageIndex: number): Promise<Storybook> =>
  del<Storybook>(`${BASE}/${storybookId}/pages/${pageIndex}`)

export const reorderPages = (storybookId: number, order: number[]): Promise<Storybook> =>
  patch<Storybook>(`${BASE}/${storybookId}/pages/reorder`, { order })

export const insertPages = (
  storybookId: number,
  insertPosition: number,
  count: number,
  instruction?: string,
) =>
  post<{ storybook_id: number; status: StorybookStatus }>(
    `${BASE}/${storybookId}/pages/insert`,
    { insert_position: insertPosition, count, instruction: instruction || '' }
  )

export const terminateStorybook = (storybookId: number) =>
  post<{ success: boolean; message: string }>(`${BASE}/${storybookId}/terminate`, {})

export const generateCover = (storybookId: number, selectedPageIndices: number[]) =>
  post<{ storybook_id: number; status: string }>(
    `${BASE}/${storybookId}/cover/generate`,
    { selected_page_indices: selectedPageIndices }
  )

export const generateBackCover = (storybookId: number, imageData: string) =>
  post<{ storybook_id: number; status: string }>(
    `${BASE}/${storybookId}/backcover/generate`,
    { image_data: imageData }
  )

export const deleteStorybook = (storybookId: number): Promise<void> =>
  del(`${BASE}/${storybookId}`)

export const updateStorybookPublicStatus = (storybookId: number, isPublic: boolean): Promise<void> =>
  patch(`${BASE}/${storybookId}/public`, { is_public: isPublic })
