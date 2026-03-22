import { View, Text } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  listStorybooks, getStorybook,
  type Storybook, type StorybookListItem,
} from '../../services/storybookService'
import { usePolling } from '../../hooks/usePolling'
import './index.scss'

const TERMINAL = new Set(['finished', 'error', 'terminated'])

const STATUS_TEXT: Record<string, string> = {
  init: '初始化', creating: '生成中', updating: '更新中',
  finished: '已完成', error: '错误', terminated: '已中止',
}

export default function EditorPage() {
  const { user } = useAuth()
  const [list, setList] = useState<StorybookListItem[]>([])
  const [current, setCurrent] = useState<Storybook | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)

  const handlePollResult = useCallback((book: Storybook) => {
    setCurrent(book)
    setList(prev => prev.map(item =>
      item.id === book.id ? { ...item, status: book.status } : item
    ))
    if (book.pages && book.pages.length > 0) {
      setCurrentPageIndex(book.pages.length - 1)
    }
    return { stop: TERMINAL.has(book.status) }
  }, [])

  const { start: startPolling, stop: stopPolling } = usePolling(getStorybook, handlePollResult)

  const loadList = useCallback(async () => {
    if (!user) return []
    try {
      const data = await listStorybooks({ creator: String(user.id), limit: 20 })
      setList(data)
      return data
    } catch {
      return []
    }
  }, [user])

  const openStorybook = useCallback(async (id: number) => {
    stopPolling()
    try {
      const book = await getStorybook(id)
      setCurrent(book)
      setCurrentPageIndex(0)
      if (!TERMINAL.has(book.status)) {
        startPolling(id)
      }
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
  }, [startPolling, stopPolling])

  useLoad(async () => {
    if (!user) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    setLoadingList(true)
    const data = await loadList()
    setLoadingList(false)

    // 处理从 home 页传入的新绘本 id
    const pendingId = Taro.getStorageSync('pending_storybook_id')
    if (pendingId) {
      Taro.removeStorageSync('pending_storybook_id')
      openStorybook(pendingId)
    } else if (data.length > 0) {
      openStorybook(data[0].id)
    }
  })

  const pages = current?.pages || []
  const page = pages[currentPageIndex]

  return (
    <View className='editor-page'>
      {/* 绘本列表（横向滚动） */}
      <scroll-view className='editor-list' scroll-x>
        {loadingList ? (
          <Text className='editor-list-empty'>加载中…</Text>
        ) : list.length === 0 ? (
          <Text className='editor-list-empty'>暂无绘本，去首页创建</Text>
        ) : list.map(item => (
          <View
            key={item.id}
            className={`editor-list-item ${current?.id === item.id ? 'editor-list-item--active' : ''}`}
            onClick={() => openStorybook(item.id)}
          >
            <Text className='editor-list-item-title' numberOfLines={2}>{item.title}</Text>
            <Text className={`editor-list-item-status editor-list-item-status--${item.status}`}>
              {STATUS_TEXT[item.status] || item.status}
            </Text>
          </View>
        ))}
      </scroll-view>

      {/* 当前绘本内容 */}
      {current ? (
        <View className='editor-content'>
          <Text className='editor-book-title'>{current.title}</Text>

          {pages.length === 0 ? (
            <View className='editor-generating'>
              <Text className='editor-generating-text'>正在生成中，请稍候…</Text>
            </View>
          ) : (
            <>
              {/* 当前页展示 */}
              <View className='editor-page-view'>
                <image
                  className='editor-page-image'
                  src={page?.image_url || ''}
                  mode='aspectFill'
                />
                {page?.page_type !== 'cover' && page?.page_type !== 'back_cover' && (
                  <View className='editor-page-text-overlay'>
                    <Text className='editor-page-text'>{page?.text}</Text>
                  </View>
                )}
              </View>

              {/* 翻页控制 */}
              <View className='editor-pagination'>
                <View
                  className={`editor-page-btn ${currentPageIndex === 0 ? 'editor-page-btn--disabled' : ''}`}
                  onClick={() => currentPageIndex > 0 && setCurrentPageIndex(i => i - 1)}
                >
                  <Text>‹</Text>
                </View>
                <Text className='editor-page-indicator'>
                  {currentPageIndex + 1} / {pages.length}
                </Text>
                <View
                  className={`editor-page-btn ${currentPageIndex >= pages.length - 1 ? 'editor-page-btn--disabled' : ''}`}
                  onClick={() => currentPageIndex < pages.length - 1 && setCurrentPageIndex(i => i + 1)}
                >
                  <Text>›</Text>
                </View>
              </View>
            </>
          )}
        </View>
      ) : (
        <View className='editor-empty'>
          <Text>选择左侧绘本查看</Text>
        </View>
      )}
    </View>
  )
}
