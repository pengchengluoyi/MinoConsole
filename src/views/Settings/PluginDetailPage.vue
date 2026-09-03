<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  fetchZentaoToken,
  getFigmaSettings,
  getPlugin,
  saveFigmaSettings,
  savePlugin,
  testFigmaToken,
  testZentaoPlugin,
} from '@/api/settings'
import { apiErrorMessage } from '@/utils/apiError'
import { statusLabel, statusType } from '@/utils/pluginCategories'
import RobotsTable from './RobotsTable.vue'
import './settings-ui.css'

const route = useRoute()
const router = useRouter()
const pluginId = computed(() => String(route.params.pluginId || ''))
const loading = ref(false)
const saving = ref(false)
const plugin = ref(null)

const zentao = reactive({ url: '', account: '', password: '', token: '' })
const figma = reactive({ access_token: '', default_file_url: '' })
const wiki = reactive({ space_id: '', root_node_token: '', folder_pattern: '' })

const isIm = computed(() => ['feishu', 'wecom', 'dingtalk', 'slack'].includes(pluginId.value))
const robotPlatform = computed(() => plugin.value?.robot_platform || (pluginId.value === 'feishu' ? 'lark' : pluginId.value))

const facts = computed(() => {
  const row = plugin.value || {}
  return [
    { label: '名称', value: row.name },
    { label: 'ID', value: row.id },
    { label: '分类', value: (row.categories || []).join(' · ') },
    { label: '状态', value: statusLabel(row) },
    { label: '说明', value: row.summary },
  ]
})

const applyPlugin = (row) => {
  plugin.value = row
  const cfg = row?.config || {}
  if (pluginId.value === 'zentao') {
    zentao.url = cfg.url || ''
    zentao.account = cfg.account || ''
    zentao.password = ''
    zentao.token = ''
  }
  if (pluginId.value === 'feishu') {
    const w = cfg.wiki && typeof cfg.wiki === 'object' ? cfg.wiki : cfg
    wiki.space_id = w.space_id || w.wiki_space_id || ''
    wiki.root_node_token = w.root_node_token || ''
    wiki.folder_pattern = w.folder_pattern || '{project}/版本/{version}'
  }
}

const load = async () => {
  if (!pluginId.value) return
  loading.value = true
  try {
    const res = await getPlugin(pluginId.value)
    applyPlugin(res?.data || null)
    if (pluginId.value === 'figma') {
      const fig = await getFigmaSettings().catch(() => null)
      figma.access_token = ''
      figma.default_file_url = fig?.data?.default_file_url || res?.data?.figma?.default_file_url || ''
    }
  } catch (e) {
    plugin.value = null
    ElMessage.error(apiErrorMessage(e, '加载插件失败'))
  } finally {
    loading.value = false
  }
}

const toggleEnabled = async (on) => {
  saving.value = true
  try {
    const res = await savePlugin(pluginId.value, { enabled: !!on })
    applyPlugin(res?.data || plugin.value)
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '保存失败'))
  } finally {
    saving.value = false
  }
}

const saveZentao = async () => {
  saving.value = true
  try {
    const res = await savePlugin(pluginId.value, {
      url: zentao.url,
      account: zentao.account,
      token: zentao.token || undefined,
    })
    applyPlugin(res?.data || plugin.value)
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '保存失败'))
  } finally {
    saving.value = false
  }
}

const fetchToken = async () => {
  saving.value = true
  try {
    const res = await fetchZentaoToken({
      url: zentao.url,
      account: zentao.account,
      password: zentao.password,
    })
    zentao.password = ''
    applyPlugin(res?.data?.plugin || plugin.value)
    ElMessage.success('已获取 Token')
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '获取 Token 失败'))
  } finally {
    saving.value = false
  }
}

const testZentao = async () => {
  saving.value = true
  try {
    await testZentaoPlugin({ url: zentao.url, account: zentao.account, token: zentao.token })
    ElMessage.success('已连通')
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '连通失败'))
  } finally {
    saving.value = false
  }
}

const saveFigma = async () => {
  saving.value = true
  try {
    await saveFigmaSettings({
      access_token: figma.access_token,
      default_file_url: figma.default_file_url,
    })
    figma.access_token = ''
    await load()
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '保存失败'))
  } finally {
    saving.value = false
  }
}

const testFigma = async () => {
  saving.value = true
  try {
    await testFigmaToken(figma.access_token)
    ElMessage.success('Token 可用')
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '测试失败'))
  } finally {
    saving.value = false
  }
}

const saveWiki = async () => {
  saving.value = true
  try {
    const res = await savePlugin(pluginId.value, {
      wiki: {
        space_id: wiki.space_id,
        root_node_token: wiki.root_node_token,
        folder_pattern: wiki.folder_pattern,
      },
    })
    applyPlugin(res?.data || plugin.value)
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '保存失败'))
  } finally {
    saving.value = false
  }
}

onMounted(load)
watch(pluginId, load)
</script>

<template>
  <div class="settings-panel wide-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <el-button text class="plugin-back" @click="router.push({ name: 'Plugins' })">← 插件策略</el-button>
        <h2 class="settings-page-title">{{ plugin?.name || '插件' }}</h2>
      </div>
      <div v-if="plugin" class="header-side">
        <el-tag size="small" :type="statusType(plugin)">{{ statusLabel(plugin) }}</el-tag>
        <el-switch
          :model-value="plugin.enabled !== false"
          :loading="saving"
          @change="toggleEnabled"
        />
      </div>
    </header>

    <el-empty v-if="!plugin && !loading" description="暂无数据">
      <el-button type="primary" @click="router.push({ name: 'Plugins' })">返回</el-button>
    </el-empty>

    <template v-else-if="plugin">
      <section class="settings-card">
        <div class="settings-kicker">插件</div>
        <dl class="plugin-dl">
          <div v-for="item in facts" :key="item.label" class="plugin-dl-row">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value || '—' }}</dd>
          </div>
        </dl>
      </section>

      <RobotsTable v-if="isIm" :platform="robotPlatform" />

      <section v-if="pluginId === 'feishu'" class="settings-card">
        <div class="settings-kicker">Wiki</div>
        <el-form label-position="top" class="settings-form-stack">
          <el-form-item label="知识空间 ID">
            <el-input v-model="wiki.space_id" />
          </el-form-item>
          <el-form-item label="根节点 token">
            <el-input v-model="wiki.root_node_token" />
          </el-form-item>
          <el-form-item label="文件夹规则">
            <el-input v-model="wiki.folder_pattern" />
          </el-form-item>
          <el-button type="primary" :loading="saving" @click="saveWiki">保存</el-button>
        </el-form>
      </section>

      <section v-if="pluginId === 'zentao'" class="settings-card">
        <div class="settings-kicker">连接</div>
        <el-form label-position="top" class="settings-form-stack">
          <el-form-item label="地址">
            <el-input v-model="zentao.url" />
          </el-form-item>
          <el-form-item label="账号">
            <el-input v-model="zentao.account" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="zentao.password" type="password" show-password />
          </el-form-item>
          <div class="row-actions">
            <el-button type="primary" :loading="saving" @click="saveZentao">保存</el-button>
            <el-button :loading="saving" @click="fetchToken">获取 Token</el-button>
            <el-button :loading="saving" @click="testZentao">测试连接</el-button>
          </div>
        </el-form>
      </section>

      <section v-if="pluginId === 'figma'" class="settings-card">
        <div class="settings-kicker">连接</div>
        <el-form label-position="top" class="settings-form-stack">
          <el-form-item label="Access Token">
            <el-input v-model="figma.access_token" type="password" show-password />
          </el-form-item>
          <el-form-item label="默认文件">
            <el-input v-model="figma.default_file_url" />
          </el-form-item>
          <div class="row-actions">
            <el-button type="primary" :loading="saving" @click="saveFigma">保存</el-button>
            <el-button :loading="saving" @click="testFigma">测试 Token</el-button>
          </div>
        </el-form>
      </section>

      <section v-if="pluginId === 'wechat'" class="settings-card">
        <div class="settings-kicker">连接</div>
        <p class="settings-page-desc">{{ plugin.config?.chat_listener?.error || '暂无数据' }}</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.plugin-back {
  margin: 0 0 6px -8px;
  color: var(--settings-muted);
}

.header-side {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plugin-dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px 16px;
  margin: 8px 0 0;
}

.plugin-dl-row dt {
  color: var(--settings-muted);
  font-size: 12px;
}

.plugin-dl-row dd {
  margin: 4px 0 0;
  color: var(--settings-text);
  font-size: 13px;
  word-break: break-all;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
