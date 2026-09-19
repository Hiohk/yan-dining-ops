/// <reference types="vite/client" />

/**
 * 前端可见的环境变量白名单。**故意逐个列出**，而不是让 `ImportMetaEnv`
 * 的宽松索引签名放过一切：这个文件本身就是一道提醒 ——
 * 任何密钥（`mysta_…`、`sk_…`）都不该出现在这里，凡是写进来的都会进构建产物。
 */
interface ImportMetaEnv {
  /** OpenHex Agent ID（UUID，非密钥，可以进前端） */
  readonly VITE_OPENHEX_AGENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
