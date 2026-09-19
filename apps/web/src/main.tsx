import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import './styles/index.css'

/**
 * QueryClient 是服务端状态的唯一入口。
 * 任务列表用 refetchInterval 轮询做兜底，SSE 到达时用 setQueryData 覆盖 ——
 * 两条通道写同一份缓存，避免「对话里已更新、任务页还是旧状态」。
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

const root = document.getElementById('root')
if (!root) throw new Error('#root 不存在')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
