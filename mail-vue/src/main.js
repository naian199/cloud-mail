import {createApp} from 'vue';
import App from './App.vue';
import BrandLoading from '@/components/loading/index.vue';
import router from './router';
import './style.css';
import '@/icons/chat';
import { installMobileViewport } from '@/utils/mobile-viewport';
installMobileViewport();
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
await init()
app.use(router).use(i18n).directive('perm',perm)
app.config.devtools = true;

app.mount('#app');
