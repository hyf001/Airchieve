const { createStorybook, listStorybooks } = require('../../services/storybookService')
const { listTemplates } = require('../../services/templateService')

Page({
  data: {
    // ── 创作输入 ──
    instruction: '',
    charCount: 0,
    creating: false,

    // ── 参数（展开/收起） ──
    showSettings: false,
    cliType: 'gemini',
    pageCount: 5,
    aspectRatio: '1:1',
    imageSize: '1k',

    // ── 图片上传 ──
    uploadedImages: [],

    // ── 模板 ──
    templates: [],
    loadingTemplates: true,
    selectedTemplateId: null,

    // ── 公开绘本展示 ──
    publicBooks: [],
    loadingPublicBooks: true,

    // ── 用户 ──
    user: null,
  },

  onShow: function() {
    const app = getApp()
    this.setData({ user: app.globalData.user })
  },

  onLoad: function() {
    this._loadTemplates()
    this._loadPublicBooks()
  },

  // ── 模板加载 ──
  _loadTemplates: async function() {
    try {
      const list = await listTemplates({ is_active: true, limit: 30 })
      this.setData({ templates: list, loadingTemplates: false })
    } catch {
      this.setData({ loadingTemplates: false })
    }
  },

  // ── 公开绘本加载 ──
  _loadPublicBooks: async function() {
    try {
      const list = await listStorybooks({ is_public: true, status: 'finished', limit: 10 })
      // 预处理：取封面图（page_type===cover 或第一页）
      const books = list.map(function(book) {
        const pages = book.pages || []
        const coverPage = pages.find(function(p) { return p.page_type === 'cover' }) || pages[0]
        return Object.assign({}, book, {
          coverImage: coverPage ? coverPage.image_url : '',
        })
      }).filter(function(b) { return b.coverImage })
      this.setData({ publicBooks: books, loadingPublicBooks: false })
    } catch {
      this.setData({ loadingPublicBooks: false })
    }
  },

  // ── 输入 ──
  onInstructionInput: function(e) {
    const val = e.detail.value
    this.setData({ instruction: val, charCount: val.length })
  },

  // ── 设置面板 ──
  toggleSettings: function() {
    this.setData({ showSettings: !this.data.showSettings })
  },

  setCliType: function(e) {
    this.setData({ cliType: e.currentTarget.dataset.value })
  },

  setPageCount: function(e) {
    this.setData({ pageCount: Number(e.currentTarget.dataset.value) })
  },

  setAspectRatio: function(e) {
    this.setData({ aspectRatio: e.currentTarget.dataset.value })
  },

  setImageSize: function(e) {
    this.setData({ imageSize: e.currentTarget.dataset.value })
  },

  // ── 图片上传 ──
  handleChooseImage: function() {
    const remaining = 9 - this.data.uploadedImages.length
    if (remaining <= 0) {
      wx.showToast({ title: '最多上传 9 张', icon: 'none' })
      return
    }
    const self = this
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        const fs = wx.getFileSystemManager()
        const newImages = res.tempFiles.map(function(file) {
          const base64 = fs.readFileSync(file.tempFilePath, 'base64')
          return 'data:image/jpeg;base64,' + base64
        })
        self.setData({ uploadedImages: self.data.uploadedImages.concat(newImages) })
      },
    })
  },

  handleRemoveImage: function(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const imgs = this.data.uploadedImages.filter(function(_, i) { return i !== idx })
    this.setData({ uploadedImages: imgs })
  },

  // ── 模板选择 ──
  handleSelectTemplate: function(e) {
    const id = Number(e.currentTarget.dataset.id)
    this.setData({
      selectedTemplateId: this.data.selectedTemplateId === id ? null : id,
    })
  },

  // ── 创建绘本 ──
  handleCreate: async function() {
    const app = getApp()
    if (!app.globalData.token) {
      wx.navigateTo({ url: '/pages/login/index' })
      return
    }
    const instruction = this.data.instruction.trim()
    if (!instruction) {
      wx.showToast({ title: '请输入故事内容', icon: 'none' })
      return
    }
    this.setData({ creating: true })
    try {
      const res = await createStorybook({
        instruction:   instruction,
        cliType:       this.data.cliType,
        pageCount:     this.data.pageCount,
        aspectRatio:   this.data.aspectRatio,
        imageSize:     this.data.imageSize,
        templateId:    this.data.selectedTemplateId || undefined,
        images:        this.data.uploadedImages,
      })
      wx.navigateTo({ url: '/pages/editor/detail/index?id=' + res.id })
    } catch (err) {
      wx.showToast({ title: err.message || '创建失败', icon: 'none', duration: 2500 })
    } finally {
      this.setData({ creating: false })
    }
  },
})
