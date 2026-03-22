const {
  getStorybook,
  terminateStorybook,
  savePage,
  editPageImage,
  deletePage,
  reorderPages,
  insertPages,
  generateCover,
  generateBackCover,
  TERMINAL_STATUSES,
} = require('../../../services/storybookService')

const POLL_INTERVAL = 5000

const BACK_COVER_COLORS = [
  { label: '天蓝', value: '#EBF5FB' },
  { label: '淡绿', value: '#E9F7EF' },
  { label: '薰衣草', value: '#F4ECF7' },
  { label: '米白', value: '#FEF9E7' },
  { label: '浅橙', value: '#FEF5E7' },
  { label: '粉红', value: '#FDEDEC' },
]

Page({
  data: {
    current: null,
    currentPageIndex: 0,
    currentPage: null,
    pageTotal: 0,
    mode: 'read',
    pageViewHeight: 0,
    readonly: false,

    editThumbScrollId: 'edit-thumb-0',
    editSelectedIdx: 0,
    editDraftText: '',
    editImageHistory: [],
    editActiveImgIdx: -1,
    editDisplayImage: '',
    editShowImgInput: false,
    editImgInstruction: '',
    editGenerating: false,
    editSaving: false,
    editError: '',

    reorderDraft: [],
    reorderSubmitting: false,

    regenInsertPos: 0,
    regenCount: 1,
    regenInstruction: '',
    regenSubmitting: false,

    coverPages: [],
    coverSelected: [],
    coverGenerating: false,

    backCoverColors: BACK_COVER_COLORS,
    backCoverBg: '#EBF5FB',
    backCoverMsg: '宝贝，愿你在故事的世界里快乐成长，\n每一天都充满阳光和欢笑。',
    backCoverCreating: false,
    backCoverHasExisting: false,
  },

  _pollTimer: null,
  _pollingId: null,

  onLoad: function(options) {
    const readonly = options.readonly === '1'
    this.setData({ readonly })
    const app = getApp()
    if (!readonly && !app.globalData.user) {
      wx.navigateTo({ url: '/pages/login/index' })
      return
    }
    const id = Number(options.id)
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      wx.navigateBack()
      return
    }
    this.openStorybook(id)
  },

  onUnload: function() {
    this._stopPolling()
  },

  openStorybook: async function(id) {
    this._stopPolling()
    wx.showLoading({ title: '加载中…', mask: false })
    try {
      const book = await getStorybook(id)
      wx.hideLoading()
      this._applyBook(book)
      wx.setNavigationBarTitle({ title: book.title || '作品详情' })
      if (!TERMINAL_STATUSES[book.status]) {
        this._startPolling(id)
      }
    } catch {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  _applyBook: function(book) {
    var pages = book.pages || []
    var newIdx = Math.min(this.data.currentPageIndex, pages.length > 0 ? pages.length - 1 : 0)
    var ar = book.aspect_ratio || '16:9'
    var ratio = ar === '4:3' ? 3 / 4 : ar === '1:1' ? 1 : 9 / 16
    var info = wx.getSystemInfoSync()
    var marginPx = 64 * info.windowWidth / 750
    var pageViewHeight = Math.round((info.windowWidth - marginPx) * ratio)
    this.setData({
      current: { id: book.id, title: book.title, status: book.status, pages: pages, aspect_ratio: book.aspect_ratio, is_public: book.is_public },
      currentPageIndex: newIdx,
      currentPage: pages[newIdx] || null,
      pageTotal: pages.length,
      mode: 'read',
      pageViewHeight: pageViewHeight,
    })
  },

  // ── 模式切换 ──
  setMode: function(e) {
    const mode = e.currentTarget.dataset.mode
    const { current } = this.data
    if (!current || !current.pages || current.pages.length === 0) return
    const updates = { mode }
    if (mode === 'edit') {
      const page = current.pages[0]
      Object.assign(updates, {
        editSelectedIdx: 0,
        editDraftText: page ? page.text : '',
        editDisplayImage: page ? page.image_url : '',
        editImageHistory: [],
        editActiveImgIdx: -1,
        editShowImgInput: false,
        editImgInstruction: '',
        editError: '',
      })
    } else if (mode === 'reorder') {
      updates.reorderDraft = current.pages.map(function(_, i) { return i })
      updates.reorderSubmitting = false
    } else if (mode === 'regen') {
      updates.regenInsertPos = current.pages.length
      updates.regenCount = 1
      updates.regenInstruction = ''
      updates.regenSubmitting = false
    } else if (mode === 'cover') {
      updates.coverPages = this._buildCoverPages(current.pages)
      updates.coverSelected = this._defaultCoverSelection(current.pages)
      updates.coverGenerating = false
    } else if (mode === 'backcover') {
      updates.backCoverCreating = false
      updates.backCoverHasExisting = current.pages.some(function(p) { return p.page_type === 'back_cover' })
    }
    this.setData(updates)
  },

  _buildCoverPages: function(pages) {
    var result = pages
      .map(function(p, i) { return Object.assign({}, p, { originalIndex: i }) })
      .filter(function(p) { return p.page_type === 'content' })
    if (result.length === 0) {
      result = pages.map(function(p, i) { return Object.assign({}, p, { originalIndex: i }) })
    }
    return result
  },

  _defaultCoverSelection: function(pages) {
    const contentIdx = pages
      .map(function(p, i) { return p.page_type === 'content' ? i : -1 })
      .filter(function(i) { return i >= 0 })
    const n = contentIdx.length
    if (n === 0) return pages.slice(0, Math.min(3, pages.length)).map(function(_, i) { return i })
    if (n <= 3) return contentIdx
    const mid = Math.floor(n / 2)
    return [contentIdx[0], contentIdx[mid], contentIdx[n - 1]]
  },

  // ── 阅读模式 ──
  onPageImageError: function(e) {
    const { currentPage } = this.data
    const url = currentPage && currentPage.image_url || ''
    console.error('[detail] image load error', url.substring(0, 100), e.detail)
  },

  handleDotTap: function(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const pages = (this.data.current && this.data.current.pages) || []
    if (idx < 0 || idx >= pages.length) return
    this.setData({ currentPageIndex: idx, currentPage: pages[idx] })
  },

  prevPage: function() {
    const idx = this.data.currentPageIndex
    if (idx <= 0) return
    const newIdx = idx - 1
    this.setData({ currentPageIndex: newIdx, currentPage: this.data.current.pages[newIdx] })
  },

  nextPage: function() {
    const { currentPageIndex, current } = this.data
    const pages = (current && current.pages) || []
    if (currentPageIndex >= pages.length - 1) return
    const newIdx = currentPageIndex + 1
    this.setData({ currentPageIndex: newIdx, currentPage: pages[newIdx] })
  },

  handleTerminate: function() {
    const self = this
    wx.showModal({
      title: '停止生成',
      content: '确定要停止生成吗？已生成的页面将保留。',
      confirmText: '停止',
      confirmColor: '#ef4444',
      success: async function(res) {
        if (!res.confirm) return
        try {
          await terminateStorybook(self.data.current.id)
          self._stopPolling()
          const updated = Object.assign({}, self.data.current, { status: 'terminated' })
          self.setData({ current: updated })
          wx.showToast({ title: '已停止', icon: 'success' })
        } catch {
          wx.showToast({ title: '停止失败', icon: 'none' })
        }
      },
    })
  },

  handleSaveToAlbum: function() {
    const { currentPage } = this.data
    if (!currentPage || !currentPage.image_url) return
    wx.downloadFile({
      url: currentPage.image_url,
      success: function(res) {
        if (res.statusCode !== 200) { wx.showToast({ title: '下载失败', icon: 'none' }); return }
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: function() { wx.showToast({ title: '已保存到相册', icon: 'success' }) },
          fail: function(err) {
            if (err.errMsg && err.errMsg.indexOf('auth') >= 0) {
              wx.showModal({ title: '需要相册权限', content: '请在设置中允许访问相册', confirmText: '去设置', success: function(r) { if (r.confirm) wx.openSetting() } })
            } else {
              wx.showToast({ title: '保存失败', icon: 'none' })
            }
          },
        })
      },
      fail: function() { wx.showToast({ title: '下载失败', icon: 'none' }) },
    })
  },

  // ── 编辑模式 ──
  handleEditSelectPage: function(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const page = this.data.current.pages[idx]
    this.setData({
      editSelectedIdx: idx,
      editThumbScrollId: 'edit-thumb-' + idx,
      editDraftText: page ? page.text : '',
      editDisplayImage: page ? page.image_url : '',
      editImageHistory: [],
      editActiveImgIdx: -1,
      editShowImgInput: false,
      editImgInstruction: '',
      editError: '',
    })
  },

  handleEditToggleImgInput: function() {
    this.setData({ editShowImgInput: !this.data.editShowImgInput, editError: '' })
  },

  onEditImgInstructionInput: function(e) { this.setData({ editImgInstruction: e.detail.value }) },
  onEditDraftTextInput: function(e) { this.setData({ editDraftText: e.detail.value }) },

  handleEditGenerateImage: async function() {
    const { editImgInstruction, editImageHistory, editActiveImgIdx, editDisplayImage, current, editSelectedIdx } = this.data
    if (!editImgInstruction.trim() || this.data.editGenerating) return
    this.setData({ editGenerating: true, editError: '' })
    try {
      const baseImage = editActiveImgIdx >= 0 ? editImageHistory[editActiveImgIdx].url : editDisplayImage
      const newUrl = await editPageImage(current.id, baseImage, editImgInstruction)
      const newHistory = editImageHistory.concat([{ url: newUrl, instruction: editImgInstruction }])
      this.setData({ editImageHistory: newHistory, editActiveImgIdx: newHistory.length - 1, editDisplayImage: newUrl, editImgInstruction: '', editShowImgInput: false, editGenerating: false })
    } catch (err) {
      this.setData({ editError: err.message || '图片生成失败', editGenerating: false })
    }
  },

  handleEditSelectImage: function(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const { editImageHistory, current, editSelectedIdx } = this.data
    const displayImage = idx === -1 ? current.pages[editSelectedIdx].image_url : editImageHistory[idx].url
    this.setData({ editActiveImgIdx: idx, editDisplayImage: displayImage })
  },

  handleEditReset: function() {
    const page = this.data.current.pages[this.data.editSelectedIdx]
    if (!page) return
    this.setData({ editDraftText: page.text, editImageHistory: [], editActiveImgIdx: -1, editDisplayImage: page.image_url })
  },

  handleEditSave: async function() {
    const { current, editSelectedIdx, editDraftText, editActiveImgIdx, editImageHistory } = this.data
    if (this.data.editSaving) return
    this.setData({ editSaving: true })
    try {
      const origUrl = current.pages[editSelectedIdx].image_url
      const finalUrl = editActiveImgIdx >= 0 ? editImageHistory[editActiveImgIdx].url : origUrl
      const saved = await savePage(current.id, editSelectedIdx, editDraftText, finalUrl)
      const pages = current.pages.slice()
      pages[editSelectedIdx] = saved
      const updatedCurrent = Object.assign({}, current, { pages })
      this.setData({ current: updatedCurrent, currentPage: pages[this.data.currentPageIndex], editDisplayImage: saved.image_url, editImageHistory: [], editActiveImgIdx: -1, editSaving: false })
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' })
      this.setData({ editSaving: false })
    }
  },

  handleEditDeletePage: function() {
    const { editSelectedIdx, current } = this.data
    const self = this
    wx.showModal({
      title: '确认删除',
      content: '确定要删除第 ' + (editSelectedIdx + 1) + ' 页吗？',
      confirmColor: '#ef4444',
      success: async function(res) {
        if (!res.confirm) return
        try {
          const updated = await deletePage(current.id, editSelectedIdx)
          const newIdx = Math.min(editSelectedIdx, Math.max(0, (updated.pages || []).length - 1))
          self._applyBook(updated)
          const newPage = (updated.pages || [])[newIdx]
          self.setData({ editSelectedIdx: newIdx, editDraftText: newPage ? newPage.text : '', editDisplayImage: newPage ? newPage.image_url : '', editImageHistory: [], editActiveImgIdx: -1 })
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      },
    })
  },

  // ── 排序模式 ──
  handleReorderMove: function(e) {
    const pos = Number(e.currentTarget.dataset.pos)
    const dir = Number(e.currentTarget.dataset.dir)
    const draft = this.data.reorderDraft.slice()
    const newPos = pos + dir
    if (newPos < 0 || newPos >= draft.length) return
    const tmp = draft[pos]; draft[pos] = draft[newPos]; draft[newPos] = tmp
    this.setData({ reorderDraft: draft })
  },

  handleReorderConfirm: async function() {
    if (this.data.reorderSubmitting) return
    this.setData({ reorderSubmitting: true })
    try {
      const updated = await reorderPages(this.data.current.id, this.data.reorderDraft)
      this._applyBook(updated)
      this.setData({ mode: 'read', reorderSubmitting: false })
      wx.showToast({ title: '排序已保存', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: err.message || '排序失败', icon: 'none' })
      this.setData({ reorderSubmitting: false })
    }
  },

  handleReorderCancel: function() { this.setData({ mode: 'read' }) },

  // ── 续写模式 ──
  handleRegenSelectPos: function(e) { this.setData({ regenInsertPos: Number(e.currentTarget.dataset.pos) }) },
  handleRegenCountChange: function(e) { this.setData({ regenCount: Number(e.detail.value) }) },
  onRegenInstructionInput: function(e) { this.setData({ regenInstruction: e.detail.value }) },

  handleRegenConfirm: async function() {
    if (this.data.regenSubmitting) return
    this.setData({ regenSubmitting: true })
    try {
      const { current, regenInsertPos, regenCount, regenInstruction } = this.data
      await insertPages(current.id, regenInsertPos, regenCount, regenInstruction || undefined)
      const updatedCurrent = Object.assign({}, current, { status: 'updating' })
      this.setData({ current: updatedCurrent, mode: 'read', regenSubmitting: false })
      this._startPolling(current.id)
      wx.showToast({ title: '生成任务已提交', icon: 'none' })
    } catch (err) {
      wx.showToast({ title: err.message || '插入页失败', icon: 'none' })
      this.setData({ regenSubmitting: false })
    }
  },

  handleRegenCancel: function() { this.setData({ mode: 'read' }) },

  // ── 封面模式 ──
  handleCoverTogglePage: function(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    var selected = this.data.coverSelected.slice()
    const pos = selected.indexOf(idx)
    if (pos >= 0) {
      if (selected.length > 1) selected.splice(pos, 1)
    } else if (selected.length >= 3) {
      selected = selected.slice(1).concat([idx])
    } else {
      selected.push(idx)
    }
    this.setData({ coverSelected: selected })
  },

  handleCoverGenerate: async function() {
    if (this.data.coverGenerating || this.data.coverSelected.length === 0) return
    this.setData({ coverGenerating: true })
    try {
      await generateCover(this.data.current.id, this.data.coverSelected)
      const updatedCurrent = Object.assign({}, this.data.current, { status: 'updating' })
      this.setData({ current: updatedCurrent, mode: 'read', coverGenerating: false })
      this._startPolling(this.data.current.id)
      wx.showToast({ title: '封面生成中', icon: 'none' })
    } catch (err) {
      wx.showToast({ title: err.message || '生成失败', icon: 'none' })
      this.setData({ coverGenerating: false })
    }
  },

  // ── 封底模式 ──
  handleBackCoverSelectBg: function(e) { this.setData({ backCoverBg: e.currentTarget.dataset.value }) },
  onBackCoverMsgInput: function(e) { this.setData({ backCoverMsg: e.detail.value }) },

  handleBackCoverCreate: async function() {
    if (this.data.backCoverCreating) return
    this.setData({ backCoverCreating: true })
    const self = this
    try {
      const imageData = await this._generateBackCoverImage()
      await generateBackCover(self.data.current.id, imageData)
      wx.showToast({ title: '封底创建成功', icon: 'success' })
      const updated = await getStorybook(self.data.current.id)
      self._applyBook(updated)
      self.setData({ mode: 'read', backCoverCreating: false })
    } catch (err) {
      wx.showToast({ title: err.message || '创建失败', icon: 'none' })
      this.setData({ backCoverCreating: false })
    }
  },

  _generateBackCoverImage: function() {
    const { backCoverMsg, backCoverBg, current } = this.data
    const canvas = wx.createOffscreenCanvas({ type: '2d', width: 560, height: 315 })
    const ctx = canvas.getContext('2d')
    const self = this
    ctx.fillStyle = backCoverBg
    ctx.fillRect(0, 0, 560, 315)
    ctx.font = 'bold 26px sans-serif'
    ctx.fillStyle = '#1e293b'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('《' + (current.title || 'AI 绘本') + '》', 280, 72)
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(100, 100); ctx.lineTo(460, 100)
    ctx.stroke()
    ctx.font = '18px sans-serif'
    ctx.fillStyle = '#475569'
    const lines = self._wrapCanvasText(ctx, backCoverMsg || '', 380)
    lines.forEach(function(line, i) { ctx.fillText(line, 280, 136 + i * 30) })
    ctx.font = '13px sans-serif'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText('AI 绘本 · 让故事更精彩', 280, 298)
    return new Promise(function(resolve, reject) {
      wx.canvasToTempFilePath({
        canvas: canvas,
        fileType: 'png',
        success: function(res) {
          try {
            const base64 = wx.getFileSystemManager().readFileSync(res.tempFilePath, 'base64')
            resolve('data:image/png;base64,' + base64)
          } catch (e) { reject(e) }
        },
        fail: reject,
      })
    })
  },

  _wrapCanvasText: function(ctx, text, maxWidth) {
    const lines = []
    const paragraphs = text.split('\n')
    paragraphs.forEach(function(para) {
      if (!para.trim()) { lines.push(''); return }
      var line = ''
      for (var i = 0; i < para.length; i++) {
        var test = line + para[i]
        if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = para[i] }
        else { line = test }
      }
      if (line) lines.push(line)
    })
    return lines
  },

  // ── 轮询 ──
  _startPolling: function(id) {
    this._stopPolling()
    this._pollingId = id
    this._pollTick()
  },

  _stopPolling: function() {
    if (this._pollTimer) { clearTimeout(this._pollTimer); this._pollTimer = null }
    this._pollingId = null
  },

  _pollTick: async function() {
    const id = this._pollingId
    if (!id) return
    try {
      const book = await getStorybook(id)
      if (this._pollingId !== id) return
      this._applyBook(book)
      if (!TERMINAL_STATUSES[book.status]) {
        const self = this
        this._pollTimer = setTimeout(function() { self._pollTick() }, POLL_INTERVAL)
      }
    } catch {
      if (this._pollingId === id) {
        const self = this
        this._pollTimer = setTimeout(function() { self._pollTick() }, POLL_INTERVAL)
      }
    }
  },
})
