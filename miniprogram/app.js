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

  _clearAuth() {
    this.globalData.token = null
    this.globalData.user  = null
    wx.removeStorageSync('auth_token')
    wx.removeStorageSync('auth_user')
  },
})
