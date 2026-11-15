<template>
  <section class="users-page">
    <div class="users-content">
      <header class="page-heading">
        <div>
          <h1>{{ t('userManagement') }}</h1>
          <p v-if="loaded" class="result-count" aria-live="polite">
            {{ t('userManagementCount', { count: n(total) }) }}
          </p>
        </div>
        <el-button v-if="canAdd" type="primary" @click="addDialog.open()">
          <Icon icon="ion:add-outline" width="19" aria-hidden="true" />
          {{ t('addUser') }}
        </el-button>
      </header>

      <div class="users-panel">
        <div class="toolbar">
          <form class="search-form" role="search" @submit.prevent="search">
            <el-input v-model="emailInput" :aria-label="t('searchByEmail')" :placeholder="t('searchByEmail')" clearable @clear="search">
              <template #prefix><Icon icon="iconoir:search" width="17" aria-hidden="true" /></template>
            </el-input>
            <el-button native-type="submit">{{ t('userManagementSearch') }}</el-button>
          </form>

          <div class="filter-actions">
            <el-select
              v-model="params.status"
              class="status-select"
              :aria-label="t('tabStatus')"
              @change="restartList"
            >
              <el-option :label="t('userManagementAllStatuses')" :value="-1" />
              <el-option :label="t('active')" :value="0" />
              <el-option :label="t('banned')" :value="1" />
              <el-option :label="t('selectDeleted')" :value="-2" />
            </el-select>
            <el-select
              v-model="params.timeSort"
              class="sort-select"
              :aria-label="t('tabRegisteredAt')"
              @change="restartList"
            >
              <el-option :label="t('userManagementNewest')" :value="0" />
              <el-option :label="t('userManagementOldest')" :value="1" />
            </el-select>
            <el-popover trigger="click" placement="bottom-end" :width="260">
              <template #reference>
                <el-button class="count-filter" :type="countsFiltered ? 'primary' : ''" :plain="countsFiltered">
                  {{ t('userManagementCountFilter') }}
                </el-button>
              </template>
              <div v-for="metric in metrics" :key="metric.key" class="count-options">
                <strong>{{ t(metric.label) }}</strong>
                <el-checkbox-group v-model="countFilter[metric.key]" :aria-label="t(metric.label)">
                  <el-checkbox value="normal">{{ t('normal') }}</el-checkbox>
                  <el-checkbox value="deleted">{{ t('selectDeleted') }}</el-checkbox>
                </el-checkbox-group>
              </div>
            </el-popover>
            <el-button :aria-label="t('userManagementRefresh')" :title="t('userManagementRefresh')" :disabled="loading" @click="refresh">
              <Icon icon="ion:reload" width="17" aria-hidden="true" />
            </el-button>
          </div>
        </div>

        <div v-if="canDelete && users.length" class="selection-bar">
          <el-checkbox
            :model-value="allSelected"
            :indeterminate="selectedIds.length > 0 && !allSelected"
            :disabled="!selectableIds.length || loading || !!error || mutating"
            @change="selectPage"
          >{{ t('userManagementSelectPage') }}</el-checkbox>
          <template v-if="selectedIds.length">
            <span aria-live="polite">{{ t('chatSelectedCount', { count: n(selectedIds.length) }) }}</span>
            <el-button type="danger" plain :disabled="loading || !!error || mutating" @click="deleteUsers()">
              {{ t('adminDeleteUser') }}
            </el-button>
          </template>
        </div>

        <div v-if="error && loaded" class="list-error" role="status">
          <span>{{ t('listNotUpdated') }}</span>
          <el-button text @click="getUserList()">{{ t('listRetry') }}</el-button>
        </div>

        <div v-loading="loading" :aria-busy="loading" class="results">
          <table v-if="users.length" class="users-table" role="table" :aria-label="t('allUsers')">
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">{{ t('tabEmailAddress') }}</th>
                <th scope="col" role="columnheader">{{ t('tabStatus') }}</th>
                <th v-for="metric in metrics" :key="metric.key" scope="col" role="columnheader" class="metric-heading">
                  {{ t(metric.label) }}
                </th>
                <th scope="col" role="columnheader">{{ t('tabRegisteredAt') }}</th>
                <th scope="col" role="columnheader" class="actions-heading">{{ t('action') }}</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              <tr v-for="row in users" :key="row.userId" role="row" :class="{ 'is-selected': selectedIds.includes(row.userId) }">
                <td role="cell" class="identity-cell">
                  <div class="identity">
                    <el-checkbox
                      v-if="canDelete && row.type !== 0"
                      :model-value="selectedIds.includes(row.userId)"
                      :aria-label="row.email"
                      :disabled="loading || !!error || mutating"
                      @change="selectUser(row.userId, $event)"
                    />
                    <span v-else-if="canDelete" class="selection-spacer" aria-hidden="true"></span>
                    <UserAvatar :email="row.email" :size="36" aria-hidden="true" />
                    <div class="identity-copy">
                      <div class="identity-line">
                        <button v-if="canManage(row)" type="button" class="email-label email-link" dir="ltr" translate="no" :title="row.email" @click="detailsDialog.open(row)">
                          {{ row.email }}
                        </button>
                        <bdi v-else class="email-label" translate="no" :title="row.email">{{ row.email }}</bdi>
                        <OfficialBadge :profile="row" />
                        <span v-if="oauthPlatform(row)" class="provider" :title="oauthPlatform(row).label" :aria-label="oauthPlatform(row).label" role="img">
                          <img v-if="oauthPlatform(row).image" :src="oauthPlatform(row).image" alt="" />
                          <Icon v-else :icon="oauthPlatform(row).icon" width="15" aria-hidden="true" />
                        </span>
                      </div>
                      <div class="identity-meta">
                        <bdi v-if="row.identityUsername">@{{ row.identityUsername }}</bdi>
                        <span :class="{ 'admin-role': row.type === 0 }">{{ toRoleName(row.type) }}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td role="cell" class="status-cell">
                  <el-tag
                    v-if="row.isDel === 1 || row.status === 0 || row.status === 1"
                    :type="row.isDel === 1 ? 'info' : row.status === 0 ? 'success' : 'danger'"
                    effect="light" round disable-transitions
                  >{{ t(row.isDel === 1 ? 'selectDeleted' : row.status === 0 ? 'active' : 'banned') }}</el-tag>
                </td>
                <td v-for="metric in metrics" :key="metric.key" role="cell" class="metric-cell">
                  <span class="compact-label">{{ t(metric.label) }}</span>
                  <span>{{ n(metricCount(row, metric)) }}</span>
                </td>
                <td role="cell" class="date-cell">
                  <span class="compact-label">{{ t('tabRegisteredAt') }}</span>
                  <bdi>{{ row.createTime ? tzDayjs(row.createTime).format('YYYY-MM-DD HH:mm') : t('unknown') }}</bdi>
                </td>
                <td role="cell" class="actions-cell">
                  <el-dropdown v-if="canManage(row)" trigger="click" placement="bottom-end" @command="runAction(row, $event)">
                    <el-button class="row-action" :disabled="loading || !!error || mutating">
                      {{ t('action') }} <Icon icon="mingcute:down-small-fill" width="17" aria-hidden="true" />
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="details">{{ t('userDetails') }}</el-dropdown-item>
                        <el-dropdown-item command="mailboxes">{{ t('userAccount') }}</el-dropdown-item>
                        <el-dropdown-item v-if="canSetPassword" command="password">{{ t('changePassword') }}</el-dropdown-item>
                        <el-dropdown-item v-if="row.type !== 0 && canSetRole" command="role">{{ t('setRole') }}</el-dropdown-item>
                        <el-dropdown-item
                          v-if="canVerify && (row.officialVerified || (row.isDel !== 1 && row.status === 0))"
                          command="verified"
                        >{{ t(row.officialVerified ? 'officialManage' : 'officialGrant') }}</el-dropdown-item>
                        <el-dropdown-item v-if="row.type !== 0 && canSetStatus" command="status" divided>
                          {{ t(row.isDel === 1 ? 'restoreUser' : row.status === 0 ? 'banUser' : 'enableUser') }}
                        </el-dropdown-item>
                        <el-dropdown-item v-if="row.type !== 0 && canDelete" command="delete" divided class="danger-action">
                          {{ t('adminDeleteUser') }}
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else-if="!loading" class="empty-state" role="status">
            <span class="empty-icon"><Icon icon="si:user-alt-2-line" width="24" aria-hidden="true" /></span>
            <p>{{ t(error ? 'listLoadFailed' : 'userManagementEmpty') }}</p>
            <el-button v-if="error" @click="getUserList()">{{ t('listRetry') }}</el-button>
            <el-button v-else-if="params.email || params.status !== -1" @click="clearFilters">{{ t('reset') }}</el-button>
          </div>
        </div>

        <footer v-if="total > pageSizes[0]" class="pagination">
          <el-pagination
            background
            :size="isPhone ? 'small' : 'default'"
            :current-page="displayPage"
            :page-size="params.size"
            :page-sizes="pageSizes"
            :pager-count="5"
            :layout="isPhone ? 'prev, pager, next' : 'sizes, prev, pager, next'"
            :total="total"
            :disabled="loading || !!error"
            @size-change="sizeChange"
            @current-change="numChange"
          />
        </footer>
      </div>
    </div>

    <PasswordRoleDialogs ref="pwdRoleDialogs" :role-list="roleList" />
    <AddUserDialog ref="addDialog" :role-list="roleList" @added="getUserList()" />
    <AccountsDialog ref="accountsDialog" />
    <DetailsDialog ref="detailsDialog" :role-name="toRoleName" />
    <OfficialDialog ref="officialDialog" />
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { hasPerm } from '@/perm/perm.js'
import { userList, userDelete, userSetStatus, userRestore } from '@/request/user.js'
import { roleSelectUse } from '@/request/role.js'
import { tzDayjs } from '@/utils/day.js'
import { useRoleStore } from '@/store/role.js'
import { useUserStore } from '@/store/user.js'
import { useBreakpoint } from '@/composables/use-breakpoint.js'
import OfficialBadge from '@/components/official-badge.vue'
import UserAvatar from '@/components/user-avatar.vue'
import PasswordRoleDialogs from './dialogs/password-role-dialogs.vue'
import AddUserDialog from './dialogs/add-user-dialog.vue'
import AccountsDialog from './dialogs/accounts-dialog.vue'
import DetailsDialog from './dialogs/details-dialog.vue'
import OfficialDialog from './dialogs/official-dialog.vue'

defineOptions({ name: 'user' })

const { t, n } = useI18n()
const { isPhone } = useBreakpoint()
const userStore = useUserStore()
const roleStore = useRoleStore()
const canAdd = computed(() => hasPerm('user:add'))
const canDelete = computed(() => hasPerm('user:delete'))
const canSetPassword = computed(() => hasPerm('user:set-pwd'))
const canSetRole = computed(() => hasPerm('user:set-type'))
const canSetStatus = computed(() => hasPerm('user:set-status'))
const canVerify = computed(() => hasPerm('user:verify'))

const pwdRoleDialogs = ref(null)
const addDialog = ref(null)
const accountsDialog = ref(null)
const detailsDialog = ref(null)
const officialDialog = ref(null)
const roleList = ref([])

const oauthPlatforms = {
  google: { label: 'Google', icon: 'devicon:google' },
  github: { label: 'GitHub', icon: 'codicon:github-inverted' },
  linuxdo: { label: 'LINUX DO', image: '/image/linuxdo.webp' }
}
function oauthPlatform(row) {
  return oauthPlatforms[row.platform] || (row.username ? oauthPlatforms.linuxdo : null)
}

const metrics = [
  { key: 'received', label: 'tabReceived', normal: 'receiveEmailCount', deleted: 'delReceiveEmailCount' },
  { key: 'sent', label: 'tabSent', normal: 'sendEmailCount', deleted: 'delSendEmailCount' },
  { key: 'mailboxes', label: 'tabMailboxes', normal: 'accountCount', deleted: 'delAccountCount' }
]
const countFilter = reactive(Object.fromEntries(metrics.map(({ key }) => [key, ['normal', 'deleted']])))
const countsFiltered = computed(() => metrics.some(({ key }) => countFilter[key].length !== 2))

function metricCount(row, metric) {
  return countFilter[metric.key].reduce((total, state) => total + (row[metric[state]] ?? 0), 0)
}

const pageSizes = [10, 15, 20, 25, 30, 50]
const params = reactive({ email: '', status: -1, timeSort: 0, num: 1, size: 15 })
try {
  const stored = JSON.parse(localStorage.getItem('user-params'))
  if (stored) {
    if ([-2, -1, 0, 1].includes(stored.status)) params.status = stored.status
    if ([0, 1].includes(stored.timeSort)) params.timeSort = stored.timeSort
    if (pageSizes.includes(stored.size)) params.size = stored.size
    if (!stored.email && Number.isSafeInteger(stored.num) && stored.num > 0) params.num = stored.num
  }
} catch {
  // Ignore invalid saved preferences.
}

const emailInput = ref('')
const users = ref([])
const total = ref(0)
const displayPage = ref(params.num)
const loading = ref(true)
const loaded = ref(false)
const error = ref(false)
const mutating = ref(false)
const selectedIds = ref([])
const selectableIds = computed(() => users.value.filter(row => row.type !== 0).map(row => row.userId))
const allSelected = computed(() => selectableIds.value.length > 0 && selectedIds.value.length === selectableIds.value.length)
let listRevision = 0

function selectPage(selected) {
  selectedIds.value = selected ? [...selectableIds.value] : []
}

function selectUser(id, selected) {
  selectedIds.value = selected ? [...selectedIds.value, id] : selectedIds.value.filter(value => value !== id)
}

async function refreshRoles() {
  try {
    roleList.value = await roleSelectUse()
  } catch {
    // The request layer displays the error. Keep the last loaded role names.
  }
}

function toRoleName(type) {
  return type === 0 ? t('admin') : roleList.value.find(role => role.roleId === type)?.name || t('unknown')
}

function canManage(row) {
  return row.type !== 0 || userStore.user.type === 0
}

function search() {
  params.email = emailInput.value.trim()
  restartList()
}

function clearFilters() {
  params.status = -1
  params.timeSort = 0
  emailInput.value = ''
  search()
}

function restartList() {
  params.num = 1
  getUserList()
}

function refresh() {
  refreshRoles()
  getUserList()
}

function sizeChange(size) {
  if (size === params.size) return
  params.size = size
  restartList()
}

function numChange(page) {
  if (page === params.num) return
  params.num = page
  getUserList()
}

async function getUserList() {
  const revision = ++listRevision
  loading.value = true
  error.value = false
  selectedIds.value = []
  const query = { ...params }
  if (query.status === -2) {
    delete query.status
    query.isDel = 1
  }
  try {
    const data = await userList(query)
    if (revision !== listRevision) return
    const lastPage = Math.max(1, Math.ceil(data.total / query.size))
    if (query.num > lastPage) {
      params.num = lastPage
      return getUserList()
    }
    users.value = data.list
    total.value = data.total
    displayPage.value = query.num
    loaded.value = true
    try {
      localStorage.setItem('user-params', JSON.stringify({ ...params, num: query.email ? 1 : query.num, email: '' }))
    } catch {
      // The list works when local storage is unavailable.
    }
  } catch {
    if (revision === listRevision) error.value = true
  } finally {
    if (revision === listRevision) loading.value = false
  }
}

function runAction(row, action) {
  if (!canManage(row)) return
  switch (action) {
    case 'details': return detailsDialog.value.open(row)
    case 'mailboxes': return accountsDialog.value.open(row.userId)
    case 'password': return pwdRoleDialogs.value.openSetPwd(row)
    case 'role': return pwdRoleDialogs.value.openSetType(row)
    case 'verified': return officialDialog.value.open(row)
    case 'delete': return deleteUsers(row)
    case 'status': return updateStatus(row)
  }
}

async function deleteUsers(row) {
  if (loading.value || error.value || mutating.value) return
  const ids = row ? [row.userId] : [...selectedIds.value]
  if (!ids.length) return
  await confirmChange(
    row ? t('delConfirm', { msg: row.email }) : t('delUsersConfirm'),
    () => userDelete(ids),
    'delSuccessMsg'
  )
}

async function updateStatus(row) {
  if (loading.value || error.value || mutating.value) return
  if (row.isDel === 1) {
    return confirmChange(t('restoreConfirm', { msg: row.email }), () => userRestore(row.userId, 0), 'restoreSuccessMsg')
  }
  const status = row.status === 0 ? 1 : 0
  const action = () => userSetStatus({ userId: row.userId, status })
  if (status === 1) return confirmChange(t('banRestore', { msg: row.email }), action, 'saveSuccessMsg')
  return changeUser(action, 'saveSuccessMsg')
}

async function confirmChange(message, action, successMessage) {
  mutating.value = true
  try {
    await ElMessageBox.confirm(message, {
      confirmButtonText: t('confirm'),
      cancelButtonText: t('cancel'),
      type: 'warning'
    })
    await changeUser(action, successMessage)
  } catch {
    // Dismissing the confirmation leaves the list in place.
  } finally {
    mutating.value = false
  }
}

async function changeUser(action, successMessage) {
  mutating.value = true
  try {
    await action()
    ElMessage.success(t(successMessage))
    await getUserList()
  } catch {
    // The request layer displays the error.
  } finally {
    mutating.value = false
  }
}

watch(() => roleStore.refresh, refreshRoles)
watch(() => userStore.refreshList, () => getUserList())
onMounted(refresh)
</script>

<style lang="scss" scoped>
.users-page {
  overflow: auto;
  min-height: 0;
  min-width: 0;
  background: var(--el-bg-color-page);
}

.users-content {
  container-type: inline-size;
  box-sizing: border-box;
  width: 100%;
  max-width: 1320px;
  margin-inline: auto;
  padding: clamp(14px, 2.6vw, 38px) clamp(12px, 2.6vw, 38px) 32px;
}

.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-block-end: 20px;

  h1 {
    margin: 0;
    color: var(--el-text-color-primary);
    font-size: clamp(21px, 2.1vw, 29px);
    font-weight: 670;
    line-height: 1.2;
  }

  .el-button {
    min-height: 38px;
    white-space: normal;

    :deep(span) { gap: 5px; }
  }
}

.result-count {
  margin: 7px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.users-panel {
  border: 1px solid var(--el-border-color-light);
  border-radius: 16px;
  background: var(--el-bg-color-overlay);
}

.toolbar,
.selection-bar,
.list-error,
.pagination {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 16px;
}

.toolbar {
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-lighter);

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper),
  .el-button {
    min-height: 38px;
    border-radius: 8px;
  }
}

.search-form {
  display: flex;
  flex: 1 1 260px;
  max-width: 390px;
  min-width: 0;
  gap: 8px;
}

.filter-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;

  .el-button { margin: 0; }
}

.status-select { width: 136px; }
.sort-select { width: 156px; }

.count-options {
  padding: 6px 4px;

  :deep(.el-checkbox-group) { display: flex; flex-wrap: wrap; column-gap: 16px; }
  :deep(.el-checkbox) { margin-inline-end: 0; }
}

.selection-bar {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  min-height: 34px;
  padding-block: 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  .el-button { margin-inline-start: auto; }
}

.list-error {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  overflow-wrap: anywhere;
}

.results { min-height: 170px; }
.users-table {
  width: 100%;
  table-layout: fixed;
  border-spacing: 0;
  color: var(--el-text-color-primary);
  font-size: 13px;

  th,
  td {
    padding: 12px;
    text-align: start;
    vertical-align: middle;
  }

  th {
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-lighter);
    font-size: 12px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  th:nth-child(2) { width: 88px; }
  th:nth-child(6) { width: 128px; }
  th:last-child { width: 88px; }

  td { border-top: 1px solid var(--el-border-color-lighter); }
  tbody tr:hover { background: var(--el-fill-color-lighter); }
  tbody .is-selected,
  tbody .is-selected:hover { background: var(--el-color-primary-light-9); }

  .identity-cell { padding-inline: 16px 8px; }
  th:first-child { padding-inline-start: 16px; }
  .metric-heading,
  .metric-cell { text-align: center; }
  .metric-heading { width: 9%; }
  .metric-cell,
  .date-cell { font-variant-numeric: tabular-nums; }
  .date-cell { color: var(--el-text-color-secondary); }
  .actions-heading,
  .actions-cell { text-align: end; padding-inline-end: 16px; }
}

.identity,
.identity-line,
.identity-meta,
.provider {
  display: flex;
  align-items: center;
  min-width: 0;
}

.identity { gap: 9px; }
.identity-copy { min-width: 0; }
.identity-line { gap: 4px; }
.selection-spacer { width: 14px; flex: none; }
.provider { flex: none; }
.provider img { width: 15px; height: 15px; border-radius: 50%; }

.email-label {
  padding-block: 2px;
  text-align: start;
  color: var(--el-text-color-primary);
  font: inherit;
  font-weight: 620;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.email-link {
  padding-inline: 0;
  border: 0;
  background: none;
  cursor: pointer;

  &:hover { color: var(--el-color-primary); text-decoration: underline; }
}

.identity-meta {
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-block-start: 3px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  overflow-wrap: anywhere;

  .admin-role { color: var(--el-color-primary); }
}

.row-action {
  min-height: 34px;
  max-width: 100%;
  padding-inline: 9px;
  white-space: normal;

  :deep(span) { gap: 2px; }
  :deep(svg) { flex: none; }
}

.danger-action { color: var(--el-color-danger); }
.compact-label { display: none; }

.empty-state {
  min-height: 210px;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 12px;
  padding: 18px;
  text-align: center;
  color: var(--el-text-color-secondary);

  p { margin: 0; }
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.pagination {
  justify-content: end;
  border-top: 1px solid var(--el-border-color-lighter);
  :deep(.el-select) { width: 135px; }
}

@container (max-width: 860px) {
  .search-form { max-width: none; }
  .users-table {
    display: block;

    thead {
      position: absolute;
      clip-path: inset(50%);
      width: 1px;
      height: 1px;
      overflow: hidden;
    }

    tbody { display: grid; }

    tr {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
      gap: 10px;
      padding: 14px;
      border-top: 1px solid var(--el-border-color-lighter);
    }

    tbody tr:first-child { border-top: 0; }

    td,
    .identity-cell,
    .actions-cell {
      text-align: start;
      min-width: 0;
      border: 0;
      padding: 0;
    }

    .identity-cell,
    .date-cell { grid-column: 1 / -2; }
    .status-cell { grid-column: -2; justify-self: end; }
    .actions-cell { grid-column: -2; grid-row: 3; justify-self: end; }
    .actions-cell:empty { display: none; }

    .date-cell { grid-row: 3; align-self: center; }
    .metric-cell { grid-row: 2; }
    .metric-cell:nth-child(3) { grid-column: 1; }
    .metric-cell:nth-child(4) { grid-column: 2; }
    .metric-cell:nth-child(5) { grid-column: 3 / -1; }

    .metric-cell {
      background: var(--el-fill-color-light);
      padding: 7px 9px;
      border-radius: 7px;
      overflow-wrap: anywhere;
    }

    .compact-label {
      display: block;
      margin-block-end: 2px;
      color: var(--el-text-color-secondary);
      font-size: 11px;
    }

    .date-cell .compact-label { display: none; }
  }
}

@container (max-width: 480px) {
  .toolbar,
  .selection-bar { padding-inline: 12px; }

  .filter-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
    width: 100%;

    .status-select,
    .sort-select { width: 100%; }
    .count-filter { grid-column: 1 / 3; justify-self: start; }
    .el-button:last-child { grid-column: 3; justify-self: end; }
  }

  .filter-actions .sort-select { grid-column: 2 / -1; }

  .users-table {
    tr { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px 7px; padding: 12px; }
    .identity { gap: 6px; }
    .identity-cell { grid-column: 1 / -1; }
    .status-cell { grid-column: 1 / 3; grid-row: 4; justify-self: start; }
    .actions-cell { grid-column: 3 / -1; grid-row: 4; }
    .date-cell { grid-column: 1 / -1; grid-row: 3; }
    .metric-cell:nth-child(5) { grid-column: 3; }
  }
}
</style>
