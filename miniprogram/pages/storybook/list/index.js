const {
  listStorybooks,
  deleteStorybook,
  updateStorybookPublicStatus,
  STATUS_TEXT,
} = require('../../../services/storybookService')

Page({
  data: {
    works: [],
    loadingWorks: false,
    selectedAction: null, // 当前选中的操作按钮 {workId, actionType}
  },

  onLoad: function() {
    const app = getApp()
    if (!app.globalData.user) {
      wx.navigateTo({ url: '/pages/login/index' })
    }
  },

  onShow: function() {
    const user = getApp().globalData.user
    if (user) {
      this._loadWorks()
      // 清除选中状态
      this.setData({ selectedAction: null })
    }
  },

  onHide: function() {
    // 页面隐藏时清除选中状态
    this.setData({ selectedAction: null })
  },

  _loadWorks: function() {
    const user = getApp().globalData.user
    const self = this
    this.setData({ loadingWorks: true })
    listStorybooks({ creator: String(user.id), limit: 50 }).then(function(list) {
      const works = list.map(function(item) {
        const coverPage = item.pages && item.pages.find(function(p) {
          return p.page_type === 'cover' && p.image_url
        })
        const firstPage = item.pages && item.pages.find(function(p) { return p.image_url })
        return Object.assign({}, item, {
          statusText: STATUS_TEXT[item.status] || item.status,
          coverUrl: (coverPage || firstPage) ? (coverPage || firstPage).image_url : '',
          page_count: item.pages ? item.pages.length : 0,
        })
      })
      self.setData({ works: works, loadingWorks: false })
    }).catch(function() {
      self.setData({ loadingWorks: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  handleWorkCardTap: function(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ selectedAction: { workId: id, actionType: 'read' } })
    wx.navigateTo({ url: '/pages/storybook/reader/index?id=' + id })
  },

  handleEditWork: function(e) {
    const id = e.currentTarget.dataset.id
    console.log('[点击编辑] id:', id)
    this.setData({ selectedAction: { workId: id, actionType: 'edit' } })
    const url = '/pages/storybook/editor/index?id=' + id
    console.log('[点击编辑] 跳转URL:', url)
    wx.navigateTo({ url: url })
  },

  handleTogglePublic: function(e) {
    const id = e.currentTarget.dataset.id
    const isPublic = e.currentTarget.dataset.ispublic
    const self = this

    // 设置选中状态
    this.setData({ selectedAction: { workId: id, actionType: 'togglePublic' } })

    updateStorybookPublicStatus(id, !isPublic).then(function() {
      const works = self.data.works.map(function(w) {
        return w.id === id ? Object.assign({}, w, { is_public: !isPublic }) : w
      })
      self.setData({ works: works })
      wx.showToast({ title: !isPublic ? '已设为公开' : '已设为私密', icon: 'success' })
    }).catch(function() {
      self.setData({ selectedAction: null })
      wx.showToast({ title: '操作失败', icon: 'none' })
    })
  },

  handleDeleteWork: function(e) {
    const id = e.currentTarget.dataset.id
    const self = this
    wx.showModal({
      title: '删除作品',
      content: '删除后不可恢复，确定删除吗？',
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: function(res) {
        if (!res.confirm) return
        deleteStorybook(id).then(function() {
          const works = self.data.works.filter(function(w) { return w.id !== id })
          self.setData({ works: works })
          wx.showToast({ title: '已删除', icon: 'success' })
        }).catch(function() {
          wx.showToast({ title: '删除失败', icon: 'none' })
        })
      },
    })
  },

  handleDownloadPDF: function(e) {
    const id = e.currentTarget.dataset.id
    const self = this

    // 设置选中状态
    this.setData({ selectedAction: { workId: id, actionType: 'download' } })

    // 获取作品详情
    const work = this.data.works.find(function(w) { return w.id === id })
    if (!work || !work.pages || work.pages.length === 0) {
      this.setData({ selectedAction: null })
      wx.showToast({ title: '作品暂无页面', icon: 'none' })
      return
    }

    // 显示纸张选择
    wx.showActionSheet({
      itemList: ['A4 (210×297mm)', 'A5 (148×210mm)', 'B5 (176×250mm)', '16K (185×260mm)'],
      success: function(res) {
        const paperTypes = ['A4', 'A5', 'B5', '16K']
        const paperType = paperTypes[res.tapIndex]
        self.setData({ selectedAction: null })
        self._downloadStorybookPDF(id, work.title, paperType)
      },
      fail: function() {
        self.setData({ selectedAction: null })
      }
    })
  },

  _downloadStorybookPDF: function(id, title, paperType) {
    // TODO: 待实现 - 需要后端API支持生成PDF文件
    wx.showModal({
      title: '功能开发中',
      content: 'PDF下载功能正在开发中，敬请期待！\n\n我们将支持：\n• 选择A4/A5/B5/16K纸张\n• 每页一张图片\n• 自动排版生成PDF',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  noop: function() {},
})
