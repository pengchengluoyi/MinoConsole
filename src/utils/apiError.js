/** 从 axios / FastAPI 错误里抽出一句给人看的原因。 */
export const apiErrorMessage = (error, fallback = '请求失败') => {
  const status = error?.response?.status
  const data = error?.response?.data
  const detail = data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  if (Array.isArray(detail)) {
    const bits = detail
      .map((row) => row?.msg || row?.message || (typeof row === 'string' ? row : ''))
      .filter(Boolean)
    if (bits.length) return bits.join('；')
  }
  if (typeof data?.msg === 'string' && data.msg.trim()) return data.msg.trim()
  if (status === 401) return '请先登录'
  if (status === 403) return '没有权限做这项操作'
  if (status === 404) return '服务端没有这项接口'
  if (status === 405) return '服务端尚未开放这项操作'
  if (status === 409) return '已存在同名条目'
  if (error?.message === 'Network Error') return '无法连接服务器'
  const msg = String(error?.message || '').trim()
  if (msg && !/^Request failed with status code \d+$/i.test(msg)) return msg
  return fallback
}

/** 创建 / 保存 / 上下线在服务端还没搬迁时的诚实提示。 */
export const writeUnavailableMessage = (error, fallback = '写入失败') => {
  const status = error?.response?.status
  if (status === 404 || status === 405 || status === 501) {
    return '服务端尚未开放这项写入。'
  }
  return apiErrorMessage(error, fallback)
}
