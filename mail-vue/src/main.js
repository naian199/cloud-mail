import OfficialBadge from '@/components/official-badge.vue';
import {createApp,watch} from 'vue';
import {useUserStore} from '@/store/user';
import {syncPermissionRoutes} from '@/perm/perm';
import App from './App.vue';
import BrandLoading from '@/components/loading/index.vue';
import router from './router';
import './style.css';
import '@/icons/chat';
import { installMobileViewport } from '@/utils/mobile-viewport';
installMobileViewport();
import { installVisualViewport } from '@/utils/visual-viewport';
const stopVisualViewport = installVisualViewport();
if (import.meta.hot) import.meta.hot.dispose(stopVisualViewport);
import {initAppInstall} from '@/composables/use-app-install';
initAppInstall();
import { init } from '@/init/init.js';
import { createPinia } from 'pinia';
import piniaPersistedState from 'pinia-plugin-persistedstate';
import 'element-plus/theme-chalk/dark/css-vars.css';
import 'nprogress/nprogress.css';
import perm from "@/perm/perm.js";
const pinia = createPinia().use(piniaPersistedState)
import i18n from "@/i18n/index.js";
const app = createApp(App).use(pinia)
app.component('BrandLoading', BrandLoading)
app.component('OfficialBadge',OfficialBadge)
await init()
watch(()=>useUserStore().user.permKeys,permissions=>{
 const removed=syncPermissionRoutes(router,permissions||[]);
 if(removed.includes(router.currentRoute.value.name))void router.replace({name:'mail-chat'});
},{deep:true,immediate:true});
app.use(router).use(i18n).directive('perm',perm)
app.config.devtools = true;

app.mount('#app');
