const { loginByWechatMini } = require('../../services/authService')

Page({
  data: {
    avatarUrl: '',
    nickname: '',
    nicknameFocus: false,
    loading: false,
    error: '',
  },

  onLoad: function(options) {
    this._redirect = options.redirect ? decodeURIComponent(options.redirect) : ''
  },

  onChooseAvatar: function(e) {
    this.setData({ avatarUrl: e.detail.avatarUrl, nicknameFocus: true })
  },

  onNicknameInput: function(e) {
    this.setData({ nickname: e.detail.value, nicknameFocus: false })
  },

  onNicknameConfirm: function(e) {
    const nickname = e.detail.value
    this.setData({ nickname, nicknameFocus: false }, () => {
      this.handleLogin()
    })
  },

  handleLogin: function() {
    if (this.data.loading) return
    this.setData({ loading: true, error: '' })

    const self = this
    wx.login({
      success: async function(loginRes) {
        try {
          const nickname = self.data.nickname.trim() || '微信用户'
          const avatarUrl = self.data.avatarUrl
          const res = await loginByWechatMini(loginRes.code, nickname, avatarUrl)
          getApp().login(res.access_token, res.user)
          self.setData({ loading: false })
          if (self._redirect) {
            wx.redirectTo({ url: self._redirect })
          } else {
            wx.switchTab({ url: '/pages/home/index' })
          }
        } catch (err) {
          self.setData({
            loading: false,
            error: err.message || '登录失败，请重试',
          })
        }
      },
      fail: function(err) {
        self.setData({
          loading: false,
          error: err.errMsg || '获取登录凭证失败',
        })
      },
    })
  },
})
