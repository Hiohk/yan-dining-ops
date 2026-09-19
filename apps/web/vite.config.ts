import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // 监听 0.0.0.0，让手机等局域网设备能通过本机 IP 访问（移动端 H5 真机调试需要）。
    // 后端仍只听 127.0.0.1，不影响：真机的 /api 请求由 vite 代理转发到本机后端。
    host: true,
    proxy: {
      // 开发期把 /api 代理到本地 FastAPI，保证与生产同样走同源路径
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // 移动端首屏体积预算：< 180KB gzip
    rollupOptions: {
      output: {
        // 把 React 运行时单独成 chunk：业务代码每次发版都变，这一块长期命中缓存
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) {
            return 'react'
          }
          return undefined
        },
      },
    },
  },
})
