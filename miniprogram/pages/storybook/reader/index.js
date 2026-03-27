const {
  getStorybook,
  TERMINAL_STATUSES,
} = require('../../../services/storybookService')

const POLL_INTERVAL = 5000

Page({
  data: {
    current: null,
    currentPageIndex: 0,
    currentPage: null,
    pageTotal: 0,
    pageViewHeight: 0,
    touchStartX: 0,
    touchStartY: 0,

    // 全屏和横屏状态
    isFullscreen: false,
    isLandscape: false,
  },

  _pollTimer: null,
  _pollingId: null,

  onLoad: function(options) {
    const app = getApp()
    if (!app.globalData.user) {
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
    const app = getApp()
    const currentUserId = app.globalData.user ? String(app.globalData.user.id) : null
    const bookCreator = book.creator !== undefined ? String(book.creator) : null
    const isOwner = currentUserId && bookCreator && currentUserId === bookCreator
    this.setData({
      current: { id: book.id, title: book.title, status: book.status, pages: pages, aspect_ratio: book.aspect_ratio, creator: book.creator },
      currentPageIndex: newIdx,
      currentPage: pages[newIdx] || null,
      pageTotal: pages.length,
      pageViewHeight: pageViewHeight,
      isOwner: isOwner,
    })
  },

  // ── 翻页控制 ──
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

  // ── 触摸滑动翻页 ──
  onReadTouchStart: function(e) {
    if (e.touches.length !== 1) return
    this.setData({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY,
    })
  },

  // 阻止触摸移动的默认行为（防止页面拖动）
  preventTouchMove: function() {
    return false
  },

  onReadTouchEnd: function(e) {
    if (e.changedTouches.length !== 1) return
    const endX = e.changedTouches[0].clientX
    const endY = e.changedTouches[0].clientY
    const deltaX = endX - this.data.touchStartX
    const deltaY = endY - this.data.touchStartY

    // 横屏模式下，元素旋转了 90 度，需要交换 X 和 Y 的判断
    // 用户左右滑动（屏幕坐标）对应旋转后元素的上下滑动
    const isLandscape = this.data.isLandscape
    const primaryDelta = isLandscape ? deltaY : deltaX
    const secondaryDelta = isLandscape ? deltaX : deltaY
    const absPrimaryDelta = Math.abs(primaryDelta)
    const absSecondaryDelta = Math.abs(secondaryDelta)

    // 最小滑动距离阈值
    const MIN_SWIPE_DISTANCE = 50
    if (absPrimaryDelta < MIN_SWIPE_DISTANCE || absSecondaryDelta > absPrimaryDelta) return

    // 横屏模式：向上滑动（deltaY < 0）→ 下一页
    // 竖屏模式：向左滑动（deltaX < 0）→ 下一页
    if (primaryDelta < 0) {
      this.nextPage()
    } else {
      // 横屏模式：向下滑动（deltaY > 0）→ 上一页
      // 竖屏模式：向右滑动（deltaX > 0）→ 上一页
      this.prevPage()
    }
  },

  onPageImageError: function(e) {
    const { currentPage } = this.data
    const url = currentPage && currentPage.image_url || ''
    console.error('[reader] image load error', url.substring(0, 100), e.detail)
  },

  // ── 全屏和横屏控制 ──
  toggleFullscreen: function() {
    const isFullscreen = !this.data.isFullscreen
    // 退出全屏时，同时退出横屏模式，避免状态冲突
    const updates = { isFullscreen }
    if (!isFullscreen && this.data.isLandscape) {
      updates.isLandscape = false
    }
    this.setData(updates)
    wx.showToast({ title: isFullscreen ? '已进入全屏' : '已退出全屏', icon: 'none', duration: 1500 })
  },

  toggleLandscape: function() {
    const isLandscape = !this.data.isLandscape
    this.setData({ isLandscape })
    wx.showToast({ title: isLandscape ? '已切换横屏' : '已切换竖屏', icon: 'none', duration: 1500 })
  },

  // ── 切换到编辑模式 ──
  handleEditMode: function() {
    const { current } = this.data
    if (!current || !current.id) return
    wx.navigateTo({ url: '/pages/storybook/editor/index?id=' + current.id })
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
