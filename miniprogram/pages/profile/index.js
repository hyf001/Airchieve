const MEMBERSHIP_LABEL = {
  free: '免费版',
  lite: 'Lite',
  pro: 'Pro',
  max: 'Max',
}

Page({
  data: {
    user: null,
    isAuthenticated: false,
    membershipLabel: '',
  },

  onShow: function() {
    const app = getApp()
    const user = app.globalData.user
    this.setData({
      user: user,
      isAuthenticated: !!user,
      membershipLabel: user ? (MEMBERSHIP_LABEL[user.membership_level] || '免费版') : '',
    })
  },

  goLogin: function() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  handleLogout: function() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      confirmColor: '#ef4444',
      success: function(res) {
        if (res.confirm) {
          getApp().logout()
        }
      },
    })
  },
})
