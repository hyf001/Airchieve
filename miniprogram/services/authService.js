const { get, post } = require('../utils/request')

const AUTH  = '/api/v1/auth'
const USERS = '/api/v1/users'

const loginByWechatMini = function(code, nickname, avatarUrl) {
  return post(AUTH + '/login/wechat-mini', {
    code: code,
    nickname: nickname,
    avatar_url: avatarUrl || '',
  }, false)
}

const getMe = function() {
  return get(USERS + '/me')
}

const getPointsOverview = function() {
  return get(USERS + '/me/points')
}

module.exports = { loginByWechatMini, getMe, getPointsOverview }
