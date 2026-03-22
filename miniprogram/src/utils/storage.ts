import Taro from '@tarojs/taro'

// 与 Web 端 localStorage 保持相同的 key 和接口形态
export const storage = {
  get(key: string): string | null {
    try {
      return Taro.getStorageSync(key) || null
    } catch {
      return null
    }
  },

  set(key: string, value: string): void {
    try {
      Taro.setStorageSync(key, value)
    } catch {
      // ignore
    }
  },

  remove(key: string): void {
    try {
      Taro.removeStorageSync(key)
    } catch {
      // ignore
    }
  },
}
