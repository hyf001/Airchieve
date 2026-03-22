const { get } = require('../utils/request')

const listTemplates = function(params) {
  const parts = []
  if (params) {
    if (params.is_active !== undefined) parts.push('is_active=' + params.is_active)
    if (params.limit) parts.push('limit=' + params.limit)
  }
  return get('/api/v1/templates' + (parts.length ? '?' + parts.join('&') : ''), false)
}

const getTemplate = function(id) {
  return get('/api/v1/templates/' + id, false)
}

module.exports = { listTemplates, getTemplate }
