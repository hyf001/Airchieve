import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { AuthProvider } from './contexts/AuthContext'
import './app.scss'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    console.log('App launched.')
  })

  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}

export default App
