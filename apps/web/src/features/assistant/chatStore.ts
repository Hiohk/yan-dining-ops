import { create } from 'zustand'

/**
 * 跨页预填的**唯一**状态：首页快捷入口点一下，先把要发的话放这儿，再跳 /chat。
 *
 * 对话本身（消息、流式、错误、对话 id）全部由 `useOpenhexChat` 持有 ——
 * 上一轮这里是脚本状态机（stepIndex + FLOW），接入 OpenHex 后整段删掉了：
 * 推进对话是 Agent 的职责，前端再留一份状态就一定会有两份真相。
 * 页面组件当时只依赖 `send` 一个入口，所以那次替换没有动到任何视图代码。
 *
 * 这个文件之所以还留着，是因为「跳转前先记下要发什么」是**路由之间**的事，
 * 而 hook 活在页面内部，跨页传不过去。
 */

interface ChatState {
  /** 待发送的预填文本（首页快捷入口跳转过来时用） */
  pending: string | null
  setPending: (text: string | null) => void
  /**
   * 取走待发送文本：**读与清在同一次同步调用里完成**，返回取到的值（没有则 null）。
   *
   * 为什么不让组件 `if (pending) { send(pending); setPending(null) }` ——
   * `pending` 是渲染闭包里的值，StrictMode 下 effect 会跑两次，而第二次执行时
   * 组件还没重渲染，闭包里拿到的仍是旧的 `pending`，于是同一句话被发两遍。
   * 上一轮实测过这个后果：从首页点「预定餐厅」进来会直接跳过一步。
   * 接到 OpenHex 之后后果更重 —— 会真的向平台发出两条用户消息。
   * 改走 store 直读，第二次就必然是 null。
   */
  consumePending: () => string | null
}

export const useChatStore = create<ChatState>((set, get) => ({
  pending: null,

  setPending: (text) => set({ pending: text }),

  consumePending: () => {
    const text = get().pending
    // zustand 的 set 是同步的，所以紧接着的第二次调用一定读到 null
    if (text) set({ pending: null })
    return text
  },
}))
