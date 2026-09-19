import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { HomePage } from './features/assistant/HomePage'

/**
 * 路由。首页与对话页直接引入（首屏必须最快），
 * 其余路由 React.lazy 拆包 —— 移动端首屏 JS 预算是 180KB gzip。
 */
const ChatPage = lazy(() =>
  import('./features/assistant/ChatPage').then((m) => ({ default: m.ChatPage })),
)
const TasksPage = lazy(() =>
  import('./features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })),
)
const SkillsPage = lazy(() =>
  import('./features/skills/SkillsPage').then((m) => ({ default: m.SkillsPage })),
)
const ProfilePage = lazy(() =>
  import('./features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const RestaurantSearchPage = lazy(() =>
  import('./features/restaurants/RestaurantSearchPage').then((m) => ({
    default: m.RestaurantSearchPage,
  })),
)
const InvitationPage = lazy(() =>
  import('./features/invitation/InvitationPage').then((m) => ({ default: m.InvitationPage })),
)

function Fallback() {
  return <div className="lto-app" aria-busy="true" />
}

const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  {
    path: '/chat',
    element: (
      <Suspense fallback={<Fallback />}>
        <ChatPage />
      </Suspense>
    ),
  },
  {
    path: '/tasks',
    element: (
      <Suspense fallback={<Fallback />}>
        <TasksPage />
      </Suspense>
    ),
  },
  {
    path: '/skills',
    element: (
      <Suspense fallback={<Fallback />}>
        <SkillsPage />
      </Suspense>
    ),
  },
  {
    path: '/me',
    element: (
      <Suspense fallback={<Fallback />}>
        <ProfilePage />
      </Suspense>
    ),
  },
  {
    path: '/restaurants',
    element: (
      <Suspense fallback={<Fallback />}>
        <RestaurantSearchPage />
      </Suspense>
    ),
  },
  {
    path: '/invitation',
    element: (
      <Suspense fallback={<Fallback />}>
        <InvitationPage />
      </Suspense>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export function App() {
  return <RouterProvider router={router} />
}
