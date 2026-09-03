import request from '@/utils/request'
import { recordAudit } from '@/utils/auditLog'

export const getAuthStatus = () =>
  request({ url: '/auth/status', method: 'get' })

export const loginAccount = ({ account = '', password }) => {
  const ident = String(account || '').trim()
  return request({
    url: '/auth/login',
    method: 'post',
    data: {
      username: ident,
      password,
    },
  })
}

export const logoutAccount = () =>
  request({ url: '/auth/logout', method: 'post' })

export const listAuthUsers = () =>
  request({ url: '/auth/users', method: 'get' })

// Nexus /auth/users 目前只有列表、创建、删除。没有改角色、禁用或 PATCH。

export const createAuthUser = async ({ username, password, name = '', email = '', role = '' }) => {
  const res = await request({
    url: '/auth/users',
    method: 'post',
    data: { username, password, name, email, role },
  })
  recordAudit('添加成员', username || email || name)
  return res
}

export const deleteAuthUser = async (userId, label = '') => {
  const res = await request({ url: `/auth/users/${userId}`, method: 'delete' })
  recordAudit('删除成员', label || userId)
  return res
}

export const listAgentSessions = () =>
  request({ url: '/auth/agent-sessions', method: 'get' })

export const saveAgentSessions = (sessions) =>
  request({ url: '/auth/agent-sessions', method: 'put', data: { sessions } })
