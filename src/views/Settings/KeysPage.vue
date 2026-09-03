<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getMailSettings, saveMailSettings, testMailSettings } from '@/api/settings'
import './settings-ui.css'

const mailSaving = ref(false)
const mailTesting = ref(false)
const loading = ref(false)
const mailForm = reactive({
  host: '',
  port: 587,
  username: '',
  password: '',
  from_email: '',
  from_name: 'Mino',
  use_tls: true,
  configured: false,
  password_masked: '',
})

const load = async () => {
  loading.value = true
  try {
    const mail = await getMailSettings()
    Object.assign(mailForm, {
      host: mail?.data?.host || '',
      port: mail?.data?.port || 587,
      username: mail?.data?.username || '',
      password: '',
      from_email: mail?.data?.from_email || '',
      from_name: mail?.data?.from_name || 'Mino',
      use_tls: mail?.data?.use_tls !== false,
      configured: !!mail?.data?.configured,
      password_masked: mail?.data?.password_masked || '',
    })
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '读取发信配置失败')
  } finally {
    loading.value = false
  }
}

const saveMail = async () => {
  mailSaving.value = true
  try {
    const res = await saveMailSettings({
      host: mailForm.host,
      port: Number(mailForm.port) || 587,
      username: mailForm.username,
      password: mailForm.password,
      from_email: mailForm.from_email,
      from_name: mailForm.from_name,
      use_tls: mailForm.use_tls,
    })
    mailForm.password = ''
    mailForm.configured = !!res?.data?.configured
    mailForm.password_masked = res?.data?.password_masked || ''
    ElMessage.success('发信配置已保存')
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '保存失败')
  } finally {
    mailSaving.value = false
  }
}

const testMail = async () => {
  mailTesting.value = true
  try {
    if (mailForm.password || mailForm.host) {
      await saveMailSettings({
        host: mailForm.host,
        port: Number(mailForm.port) || 587,
        username: mailForm.username,
        password: mailForm.password,
        from_email: mailForm.from_email,
        from_name: mailForm.from_name,
        use_tls: mailForm.use_tls,
      })
      mailForm.password = ''
    }
    const res = await testMailSettings(mailForm.from_email)
    ElMessage.success(`测试信已发到 ${res?.data?.to || mailForm.from_email}`)
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '测试失败')
  } finally {
    mailTesting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="settings-panel keys-page wide-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">发信</h2>
      </div>
      <div class="settings-summary-pill" :class="mailForm.configured ? '' : 'is-muted'">
        {{ mailForm.configured ? '已配置 SMTP' : '未配置' }}
      </div>
    </header>

    <section class="settings-card">
      <div class="mail-grid">
        <label>SMTP 主机<input v-model="mailForm.host" placeholder="smtp.163.com" /></label>
        <label>端口<input v-model.number="mailForm.port" type="number" placeholder="587" /></label>
        <label>账号<input v-model="mailForm.username" autocomplete="off" placeholder="发信账号" /></label>
        <label>
          密码 / 授权码
          <input v-model="mailForm.password" type="password" autocomplete="new-password" :placeholder="mailForm.password_masked || '不改请留空'" />
        </label>
        <label>发件人邮箱<input v-model="mailForm.from_email" placeholder="name@company.com" /></label>
        <label>发件人名称<input v-model="mailForm.from_name" placeholder="Mino" /></label>
      </div>
      <div class="mail-row">
        <span>STARTTLS</span>
        <el-switch v-model="mailForm.use_tls" />
      </div>
      <div class="mail-actions">
        <button type="button" class="settings-action-pill" :disabled="mailSaving" @click="saveMail">
          保存
          <span class="settings-action-arrow">→</span>
        </button>
        <el-button size="small" :loading="mailTesting" :disabled="!mailForm.host" @click="testMail">发一封测试</el-button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.keys-page {
  width: 100%;
  min-width: 0;
}

.mail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
}
.mail-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--settings-text);
}
.mail-grid input {
  height: 38px;
  border: 1px solid var(--settings-border);
  border-radius: 10px;
  padding: 0 10px;
  background: var(--settings-card);
  color: var(--settings-text);
}
.mail-grid input:focus {
  outline: none;
  border-color: var(--settings-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--settings-primary) 18%, transparent);
}
.mail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0;
  color: var(--settings-muted);
  font-size: 13px;
}
.mail-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

@media (max-width: 720px) {
  .mail-grid { grid-template-columns: 1fr; }
}
</style>
