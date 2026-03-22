const {
  listStorybooks,
  deleteStorybook,
  updateStorybookPublicStatus,
  STATUS_TEXT,
} = require('../../services/storybookService')

Page({
  data: {
    works: [],
    loadingWorks: false,
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
    }
  },

  _loadWorks: async function() {
    const user = getApp().globalData.user
    this.setData({ loadingWorks: true })
    try {
      const list = await listStorybooks({ creator: String(user.id), limit: 50 })
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
      this.setData({ works: works, loadingWorks: false })
    } catch {
      this.setData({ loadingWorks: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  handleWorkCardTap: function(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/editor/detail/index?id=' + id })
  },

  handleTogglePublic: function(e) {
    const id = e.currentTarget.dataset.id
    const isPublic = e.currentTarget.dataset.ispublic
    const self = this
    updateStorybookPublicStatus(id, !isPublic).then(function() {
      const works = self.data.works.map(function(w) {
        return w.id === id ? Object.assign({}, w, { is_public: !isPublic }) : w
      })
      self.setData({ works: works })
      wx.showToast({ title: !isPublic ? '已设为公开' : '已设为私密', icon: 'success' })
    }).catch(function() {
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

  noop: function() {},
})
