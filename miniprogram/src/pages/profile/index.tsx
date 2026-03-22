import { View, Text, Image, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAuth } from '../../contexts/AuthContext'
import './index.scss'

const MEMBERSHIP_LABEL: Record<string, string> = {
  free: '免费版', lite: 'Lite', pro: 'Pro', max: 'Max',
}

export default function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuth()

  if (!isAuthenticated || !user) {
    return (
      <View className='profile-login-prompt'>
        <Text className='profile-login-text'>登录后查看个人信息</Text>
        <Button
          className='profile-login-btn'
          onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}
        >
          去登录
        </Button>
      </View>
    )
  }

  return (
    <View className='profile-page'>
      {/* 用户信息 */}
      <View className='profile-card'>
        <Image
          className='profile-avatar'
          src={user.avatar_url || '/assets/default-avatar.png'}
          mode='aspectFill'
        />
        <View className='profile-info'>
          <Text className='profile-nickname'>{user.nickname}</Text>
          <Text className='profile-membership'>
            {MEMBERSHIP_LABEL[user.membership_level] || '免费版'}
          </Text>
        </View>
      </View>

      {/* 积分/次数 */}
      <View className='profile-stats'>
        <View className='profile-stat'>
          <Text className='profile-stat-value'>{user.points_balance}</Text>
          <Text className='profile-stat-label'>积分余量</Text>
        </View>
        <View className='profile-stat-divider' />
        <View className='profile-stat'>
          <Text className='profile-stat-value'>{user.free_creation_remaining}</Text>
          <Text className='profile-stat-label'>免费次数</Text>
        </View>
      </View>

      {/* 操作 */}
      <View className='profile-actions'>
        <Button className='profile-logout-btn' onClick={logout}>退出登录</Button>
      </View>
    </View>
  )
}
