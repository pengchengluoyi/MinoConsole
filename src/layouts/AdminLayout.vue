<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  DataBoard, User, Avatar, Files, Share, Message, Monitor, Menu,
  Lock, Document, Collection, Connection, Cpu, Link, Notebook, Guide,
} from '@element-plus/icons-vue'
import { useSessionStore } from '@/store/session'
import { roleLabel } from '@/utils/iam'
import '../views/Settings/settings-ui.css'
import './admin-layout.css'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const navOpen = ref(false)

const groups = [
  {
    id: 'overview',
    label: '概览',
    items: [
      { id: 'dashboard', label: '工作台', icon: DataBoard, to: '/dashboard' },
      { id: 'health', label: '运行状态', icon: Monitor, to: '/health' },
    ],
  },
  {
    id: 'inventory',
    label: '库存',
    items: [
      { id: 'catalog', label: '项目与应用', icon: Collection, to: '/catalog' },
      { id: 'nodes', label: '节点与设备', icon: Cpu, to: '/nodes' },
    ],
  },
  {
    id: 'perms',
    label: '权限',
    items: [
      { id: 'members', label: '成员', icon: Avatar, to: '/members' },
      { id: 'permissions', label: '权限配置', icon: Lock, to: '/permissions' },
      { id: 'audit', label: '操作记录', icon: Document, to: '/audit' },
    ],
  },
  {
    id: 'caps',
    label: '能力',
    items: [
      { id: 'skills', label: '技能', icon: Guide, to: '/skills' },
      { id: 'jobs', label: 'Jobs', icon: Document, to: '/jobs' },
      { id: 'roles', label: '角色', icon: User, to: '/roles' },
      { id: 'stack', label: '编排', icon: Share, to: '/stack' },
      { id: 'packs', label: '扩展包', icon: Files, to: '/packs' },
      { id: 'knowledge', label: '知识审核', icon: Notebook, to: '/knowledge' },
      { id: 'plugins', label: '插件策略', icon: Connection, to: '/plugins' },
    ],
  },
  {
    id: 'system',
    label: '系统',
    items: [
      { id: 'mail', label: '发信', icon: Message, to: '/mail' },
      { id: 'network', label: '网络 / 内网域名', icon: Link, to: '/network' },
    ],
  },
]

const isActive = (item) => {
  if (item.id === 'skills') {
    return route.path === '/skills' || route.path.startsWith('/skills/')
  }
  if (item.id === 'jobs') {
    return route.path === '/jobs' || route.path.startsWith('/jobs/')
  }
  if (item.id === 'roles') {
    return route.path === '/roles' || route.path.startsWith('/roles/')
  }
  if (item.id === 'catalog') {
    return route.path === '/catalog' || route.path.startsWith('/catalog/')
  }
  if (item.id === 'nodes') {
    return route.path === '/nodes' || route.path.startsWith('/nodes/')
  }
  if (item.id === 'plugins') {
    return route.path === '/plugins' || route.path.startsWith('/plugins/')
  }
  if (item.id === 'health') {
    return route.path === '/health' || route.path === '/system'
  }
  if (item.id === 'permissions') {
    return route.path === '/permissions' || route.path === '/access'
  }
  return route.path === item.to || route.path.startsWith(`${item.to}/`)
}

const nexusText = computed(() => {
  if (!session.nexus.reachable) return '无法连接'
  const ver = session.nexus.version
  return ver ? `Nexus ${ver}` : 'Nexus 已连接'
})

const go = (item) => {
  navOpen.value = false
  router.push(item.to)
}

const onLogout = async () => {
  await session.logout()
  router.replace('/login')
}

let timer
onMounted(() => {
  session.refresh()
  timer = setInterval(() => session.refreshNexus(), 30000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="admin-shell" :class="{ 'is-nav-open': navOpen }">
    <div v-if="navOpen" class="admin-scrim" @click="navOpen = false" />

    <aside class="admin-sidebar">
      <div class="admin-brand">
        <div class="admin-brand-mark">MC</div>
        <div class="admin-brand-copy">
          <strong>Mino Console</strong>
          <span>平台管理后台</span>
        </div>
      </div>

      <nav class="admin-nav">
        <div v-for="group in groups" :key="group.id" class="admin-nav-group">
          <div class="admin-nav-kicker">{{ group.label }}</div>
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            class="admin-nav-btn"
            :class="{ 'is-active': isActive(item) }"
            @click="go(item)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </button>
        </div>
      </nav>
    </aside>

    <div class="admin-body">
      <header class="admin-topbar">
        <button
          type="button"
          class="admin-menu-btn"
          :title="navOpen ? '收起导航' : '打开导航'"
          @click="navOpen = !navOpen"
        >
          <el-icon><Menu /></el-icon>
        </button>
        <div class="admin-topbar-title">Mino Console</div>
        <span class="admin-topbar-spacer" />
        <div class="admin-nexus-pill" :class="{ 'is-off': !session.nexus.reachable }">
          <i />
          {{ nexusText }}
        </div>
        <div class="admin-user">
          <div class="admin-user-meta">
            <strong>{{ session.displayName }}</strong>
            <span>{{ roleLabel(session.role) }}</span>
          </div>
          <el-button text @click="onLogout">退出</el-button>
        </div>
      </header>

      <main class="admin-main">
        <div id="settings-overlay-portal" class="admin-overlay-portal" />
        <router-view />
      </main>
    </div>
  </div>
</template>
