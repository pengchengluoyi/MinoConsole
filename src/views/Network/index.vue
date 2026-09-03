<script setup>
import { computed, onMounted, ref } from 'vue'
import { getHealthHttp, getServerInfoHttp } from '@/api/me'
import { nexusOrigin, usesWebProxy, pingServer } from '@/utils/config'
import '../Settings/settings-ui.css'

const loading = ref(true)
const reachable = ref(false)
const version = ref('')
const lanHost = ref('mino.local')
const httpUrl = ref('http://mino.local:10104')
const nodeWs = ref('ws://mino.local:10104/node')
const mdnsOn = ref(false)
const origin = usesWebProxy() ? (typeof window !== 'undefined' ? window.location.origin : '') : nexusOrigin()

const statusText = computed(() => {
  if (!reachable.value) return '无法连接'
  if (mdnsOn.value) return `${lanHost.value} 已广播`
  return `${lanHost.value} 可达`
})

onMounted(async () => {
  loading.value = true
  reachable.value = await pingServer(1500)
  try {
    const info = await getServerInfoHttp()
    const data = info?.data || info || {}
    version.value = data.version || ''
    if (data.lan_host) lanHost.value = data.lan_host
    if (data.http_url) httpUrl.value = data.http_url
    if (data.node_ws_url) nodeWs.value = data.node_ws_url
    mdnsOn.value = !!data.mdns?.registered
    reachable.value = true
  } catch { /* keep ping */ }
  try {
    const health = await getHealthHttp()
    if (health?.nexus_version) version.value = health.nexus_version
  } catch { /* ignore */ }
  loading.value = false
})
</script>

<template>
  <div class="settings-panel network-page wide-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">网络 / 内网域名</h2>
      </div>
      <div class="settings-summary-pill" :class="reachable ? '' : 'is-err'">
        {{ statusText }}
      </div>
    </header>

    <section class="settings-card">
      <div class="settings-kicker">mDNS</div>
      <h3 class="net-title">{{ lanHost }}</h3>
      <p class="settings-page-desc">Nexus 启动后注册这个内网名。客户端不填 IP。</p>
      <p class="settings-page-desc">HTTP {{ httpUrl }}</p>
      <p class="settings-page-desc">Scout {{ nodeWs }}</p>
      <p class="settings-page-desc">本页当前连接 {{ origin }}{{ version ? ` · ${version}` : '' }}</p>
    </section>
  </div>
</template>

<style scoped>
.net-title {
  margin: 8px 0 6px;
  font-size: 18px;
  font-weight: 700;
  color: var(--settings-text);
}
</style>
