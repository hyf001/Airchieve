const { get, post, put, patch, del } = require('../utils/request')

const BASE = '/api/v1/storybooks'

const TERMINAL_STATUSES = { finished: true, error: true, terminated: true }

const STATUS_TEXT = {
  init: '初始化',
  creating: '生成中',
  updating: '更新中',
  finished: '已完成',
  error: '错误',
  terminated: '已中止',
}

function buildQuery(params) {
  const parts = []
  Object.keys(params).forEach(function(k) {
    const v = params[k]
    if (v !== undefined && v !== null && v !== '') {
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
    }
  })
  return parts.join('&')
}

// ── 创建 ──
const createStorybook = function(req) {
  const body = { instruction: req.instruction }
  if (req.cliType)     body.cli_type     = req.cliType
  if (req.pageCount)   body.page_count   = req.pageCount
  if (req.aspectRatio) body.aspect_ratio = req.aspectRatio
  if (req.imageSize)   body.image_size   = req.imageSize
  if (req.templateId)  body.template_id  = req.templateId
  if (req.images && req.images.length) body.images = req.images
  return post(BASE, body)
}

// ── 列表 ──
const listStorybooks = function(params) {
  const qs = buildQuery(params || {})
  return get(BASE + (qs ? '?' + qs : ''))
}

// ── 详情 ──
const getStorybook = function(id) {
  return get(BASE + '/' + id, false)
}

// ── 中止 ──
const terminateStorybook = function(id) {
  return post(BASE + '/' + id + '/terminate', {})
}

// ── 删除整本 ──
const deleteStorybook = function(id) {
  return del(BASE + '/' + id)
}

// ── 公开/私密 ──
const updateStorybookPublicStatus = function(id, isPublic) {
  return patch(BASE + '/' + id + '/public', { is_public: isPublic })
}

// ── 页面操作 ──
const savePage = function(storybookId, pageIndex, text, imageUrl) {
  return put(BASE + '/' + storybookId + '/pages/' + pageIndex, {
    text: text,
    image_url: imageUrl,
  })
}

const editPageImage = function(storybookId, imageUrl, instruction) {
  return post(BASE + '/image/edit', {
    instruction: instruction,
    image_to_edit: imageUrl,
    storybook_id: storybookId,
  }).then(function(r) { return r.image })
}

const deletePage = function(storybookId, pageIndex) {
  return del(BASE + '/' + storybookId + '/pages/' + pageIndex)
}

const reorderPages = function(storybookId, order) {
  return patch(BASE + '/' + storybookId + '/pages/reorder', { order: order })
}

const insertPages = function(storybookId, insertPosition, count, instruction) {
  return post(BASE + '/' + storybookId + '/pages/insert', {
    insert_position: insertPosition,
    count: count,
    instruction: instruction || '',
  })
}

// ── 封面 / 封底 ──
const generateCover = function(storybookId, selectedPageIndices) {
  return post(BASE + '/' + storybookId + '/cover/generate', {
    selected_page_indices: selectedPageIndices,
  })
}

const generateBackCover = function(storybookId, imageData) {
  return post(BASE + '/' + storybookId + '/backcover/generate', {
    image_data: imageData,
  })
}

module.exports = {
  createStorybook,
  listStorybooks,
  getStorybook,
  terminateStorybook,
  deleteStorybook,
  updateStorybookPublicStatus,
  savePage,
  editPageImage,
  deletePage,
  reorderPages,
  insertPages,
  generateCover,
  generateBackCover,
  TERMINAL_STATUSES,
  STATUS_TEXT,
}
