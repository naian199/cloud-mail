export const adminSections = [
  {
    id: 'accounts',
    label: 'adminAccounts',
    pages: [
      { name: 'user', label: 'allUsers', icon: 'group', permission: 'user:query' },
      { name: 'role', label: 'permissions', icon: 'lock', permission: 'role:query' },
      { name: 'reg-key', label: 'inviteCode', icon: 'key', permission: 'reg-key:query' }
    ]
  },
  {
    id: 'content',
    label: 'adminContent',
    pages: [
      { name: 'app-review', label: 'appReviewTitle', icon: 'shield', permission: 'app:review' },
      { name: 'all-email', label: 'allMail', icon: 'external-mail', permission: 'all-email:query' }
    ]
  },
  {
    id: 'operations',
    label: 'adminOperations',
    pages: [
      { name: 'sys-setting', label: 'SystemSettings', icon: 'settings', permission: 'setting:query' },
      { name: 'analysis', label: 'analytics', icon: 'analytics', permission: 'analysis:query' }
    ]
  }
];

const adminPages = adminSections.flatMap(({ pages }) => pages);
export const isAdminRoute = (name) => name === 'admin' || adminPages.some((page) => page.name === name);
export const canOpenAdmin = (permissions = []) =>
  permissions.includes('*') || adminPages.some((page) => permissions.includes(page.permission));
