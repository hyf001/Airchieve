const { getMe } = require('./services/authService')

App({
  globalData: {
    token: null,
    user: null,
  },

  onLaunch() {
    const token = wx.getStorageSync('auth_token')
    const user  = wx.getStorageSync('auth_user')
    if (token && user) {
      this.globalData.token = token
      this.globalData.user  = user
      this._verifyToken()
    }
  },

  async _verifyToken() {
    try {
      const freshUser = await getMe()
      this.globalData.user = freshUser
      wx.setStorageSync('auth_user', freshUser)
    } catch {
      this._clearAuth()
    }
  },

  login(token, user) {
    this.globalData.token = token
    this.globalData.user  = user
    wx.setStorageSync('auth_token', token)
    wx.setStorageSync('auth_user', user)
  },

  logout() {
    this._clearAuth()
    wx.reLaunch({ url: '/pages/login/index' })
  },

  handleAuthRequired() {
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]

    // 检查当前是否已经在登录页
    if (currentPage && currentPage.route && currentPage.route.includes('login/index')) {
      return
    }

    // 保存当前页面路径，登录后返回
    const redirect = currentPage ? '/' + currentPage.route + (currentPage.options ? '?' + Object.keys(currentPage.options).map(k => k + '=' + encodeURIComponent(currentPage.options[k])).join('&') : '') : ''

    wx.navigateTo({
      url: '/pages/login/index' + (redirect ? '?redirect=' + encodeURIComponent(redirect) : ''),
      fail: function() {
        // 如果 navigateTo 失败（可能是页面栈满），使用 redirectTo
        wx.redirectTo({
          url: '/pages/login/index' + (redirect ? '?redirect=' + encodeURIComponent(redirect) : '')
        })
      }
    })
  },

  _clearAuth() {
    this.globalData.token = null
    this.globalData.user  = null
    wx.removeStorageSync('auth_token')
    wx.removeStorageSync('auth_user')
  },
})
