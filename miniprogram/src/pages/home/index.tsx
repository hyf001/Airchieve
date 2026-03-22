import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  createStorybook, type CreateStorybookRequest,
  type CliType, type AspectRatio, type ImageSize,
} from '../../services/storybookService'
import './index.scss'

export default function HomePage() {
  const { user, isAuthenticated } = useAuth()
  const [instruction, setInstruction] = useState('')
  const [cliType] = useState<CliType>('gemini')
  const [aspectRatio] = useState<AspectRatio>('16:9')
  const [imageSize] = useState<ImageSize>('1k')
  const [pageCount] = useState(10)
  const [creating, setCreating] = useState(false)

  const requireAuth = useCallback(() => {
    if (!isAuthenticated) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return false
    }
    return true
  }, [isAuthenticated])

  const handleCreate = async () => {
    if (!requireAuth()) return
    if (!instruction.trim()) {
      Taro.showToast({ title: '请输入故事内容', icon: 'none' })
      return
    }
    setCreating(true)
    try {
      const req: CreateStorybookRequest = {
        instruction: instruction.trim(),
        cli_type: cliType,
        aspect_ratio: aspectRatio,
        image_size: imageSize,
        page_count: pageCount,
      }
      const res = await createStorybook(req)
      Taro.switchTab({ url: '/pages/editor/index' })
      // 传递新建的 storybookId 给 editor 页（通过 eventChannel 或全局状态）
      Taro.setStorageSync('pending_storybook_id', res.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '创建失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setCreating(false)
    }
  }

  return (
    <View className='home-page'>
      {/* Header */}
      <View className='home-header'>
        <Text className='home-title'>AI 绘本</Text>
        {user && (
          <Text className='home-greeting'>Hi，{user.nickname}</Text>
        )}
      </View>

      {/* 创建区域 */}
      <View className='home-create'>
        <Text className='home-create-label'>描述你的故事</Text>
        <textarea
          className='home-textarea'
          placeholder='例如：一只勇敢的小兔子独自穿越魔法森林，找到了失散的家人…'
          value={instruction}
          onInput={(e) => setInstruction(e.detail.value)}
          maxlength={500}
        />
        <Text className='home-textarea-count'>{instruction.length}/500</Text>

        <View
          className={`home-create-btn ${creating ? 'home-create-btn--loading' : ''}`}
          onClick={creating ? undefined : handleCreate}
        >
          <Text className='home-create-btn-text'>
            {creating ? '生成中…' : '✨ 开始生成'}
          </Text>
        </View>
      </View>
    </View>
  )
}
