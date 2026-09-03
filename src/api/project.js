import request from '@/utils/request'

export const listProjects = () =>
  request({ url: '/project/list', method: 'get' })

export const getAppDetail = (appId) =>
  request({ url: `/project/app/${appId}`, method: 'get' })
