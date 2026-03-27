const BASE_URL = 'https://www.nanbende.com'

function extractDetail(data, fallback) {
  const d = data && data.detail
  if (!d) return fallback
  if (typeof d === 'string') return d
  if (Array.isArray(d)) {
    return d.map(e => (e && e.msg) ? e.msg : String(e)).join('；')
  }
  return fallback
}

function request(path, options) {
  const method = (options && options.method) || 'GET'
  const data   = options && options.data
  const auth   = options && options.auth !== undefined ? options.auth : true

  const app = getApp()
  const header = { 'Content-Type': 'application/json' }
  if (auth && app.globalData.token) {
    header['Authorization'] = 'Bearer ' + app.globalData.token
  }

  return new Promise(function(resolve, reject) {
    wx.request({
      url: BASE_URL + path,
      method: method,
      data: data !== undefined ? JSON.stringify(data) : undefined,
      header: header,
      success: function(res) {
        if (res.statusCode === 401) {
          getApp().handleAuthRequired()
          reject(new Error('请先登录'))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
          return
        }
        if (res.statusCode === 402) {
          const err = new Error(extractDetail(res.data, '积分不足'))
          err.name = 'InsufficientPointsError'
          reject(err)
          return
        }
        const msg = extractDetail(res.data, '请求失败 (' + res.statusCode + ')')
        reject(new Error(msg))
      },
      fail: function(err) {
        reject(new Error(err.errMsg || '网络请求失败'))
      },
    })
  })
}

const get   = function(path, auth) { return request(path, { auth: auth !== false }) }
const post  = function(path, data, auth) { return request(path, { method: 'POST', data: data, auth: auth !== false }) }
const put   = function(path, data) { return request(path, { method: 'PUT', data: data }) }
const patch = function(path, data) { return request(path, { method: 'PATCH', data: data }) }
const del   = function(path) { return request(path, { method: 'DELETE' }) }

module.exports = { get, post, put, patch, del }
