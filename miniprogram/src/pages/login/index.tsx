import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { loginByWechatMini } from '../../services/authService'
import './index.scss'

export default function LoginPage() {
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 记录来源页，登录成功后跳回
  const [redirectUrl, setRedirectUrl] = useState('')
  useLoad((options) => {
    if (options.redirect) {
      setRedirectUrl(decodeURIComponent(options.redirect as string))
    }
  })

  const handleWechatLogin = async () => {
    setLoading(true)
    setError('')
    try {
      // 1. 获取 code
      const { code } = await Taro.login()

      // 2. 获取用户昵称和头像（需要用户手动触发，此处通过 Button open-type 触发）
      //    nickname 和 avatar_url 由 onGetUserProfile 回调提供，这里先用空值兜底
      const res = await loginByWechatMini(code, '微信用户')

      login(res.access_token, res.user)

      if (redirectUrl) {
        Taro.redirectTo({ url: redirectUrl })
      } else {
        Taro.switchTab({ url: '/pages/home/index' })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 微信要求昵称头像通过 Button open-type="getUserInfo" 获取
  const handleGetUserProfile = async () => {
    setLoading(true)
    setError('')
    try {
      const profileRes = await Taro.getUserProfile({ desc: '用于完善您的账号信息' })
      const { code } = await Taro.login()
      const res = await loginByWechatMini(
        code,
        profileRes.userInfo.nickName,
        profileRes.userInfo.avatarUrl,
      )
      login(res.access_token, res.user)

      if (redirectUrl) {
        Taro.redirectTo({ url: redirectUrl })
      } else {
        Taro.switchTab({ url: '/pages/home/index' })
      }
    } catch (err) {
      // 用户拒绝授权时降级为匿名登录
      handleWechatLogin()
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='login-page'>
      <View className='login-hero'>
        <Image className='login-logo' src='/assets/logo.png' mode='aspectFit' />
        <Text className='login-title'>AI 绘本</Text>
        <Text className='login-subtitle'>用一句话，生成专属故事书</Text>
      </View>

      <View className='login-actions'>
        {error ? <Text className='login-error'>{error}</Text> : null}

        <Button
          className='login-btn'
          loading={loading}
          disabled={loading}
          onClick={handleGetUserProfile}
        >
          微信一键登录
        </Button>

        <Text className='login-hint'>登录即表示同意《用户协议》和《隐私政策》</Text>
      </View>
    </View>
  )
}
