// 后端 API 地址 —— 生产环境改为正式域名
const isDev = process.env.NODE_ENV === 'development'

export const API_BASE_URL = isDev
  ? 'http://localhost:8000'
  : 'https://www.nanbende.com'  
