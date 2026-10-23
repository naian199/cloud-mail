import {useUserStore} from "@/store/user.js";
import {useSettingStore} from "@/store/setting.js";
import {useAccountStore} from "@/store/account.js";
import {loginUserInfo} from "@/request/my.js";
import {permsToRouter} from "@/perm/perm.js";
import router from "@/router";
import {websiteConfig} from "@/request/setting.js";
import i18n, { activateLanguage, chooseLanguage } from "@/i18n/index.js";

export async function init() {
    document.title = '\u200B'

    const settingStore = useSettingStore();
    const userStore = useUserStore();
    const accountStore = useAccountStore();

    const token = localStorage.getItem('token');
    try {
        const previous = JSON.parse(localStorage.getItem('setting') || '{}');
        if (previous.lang && !('languageManual' in previous)) settingStore.languageManual = true;
    } catch {}
    const initialLanguage = chooseLanguage(settingStore.languageManual ? settingStore.lang : null, navigator.languages || [navigator.language]);
    try { await activateLanguage(initialLanguage); settingStore.lang = initialLanguage; }
    catch { await activateLanguage('en'); settingStore.lang = 'en'; }

    let setting = null;

    if (token) {
        const userPromise = loginUserInfo().catch(e => {
            console.error(e);
            return null;
        });

        const [s, user] = await Promise.all([websiteConfig(), userPromise]);
        setting = s;
        settingStore.settings = setting;
        settingStore.domainList = setting.domainList;
        document.title = setting.title;

        if (user) {
            accountStore.currentAccountId = user.account.accountId;
            accountStore.currentAccount = user.account;
            userStore.user = user;
            if (user.locale && user.locale !== settingStore.lang) {
                try { await activateLanguage(user.locale); settingStore.lang = user.locale; settingStore.languageManual = true; } catch {}
            }

            const routers = permsToRouter(user.permKeys);
            routers.forEach(routerData => {
                router.addRoute('layout', routerData);
            });
        }

    } else {
        setting = await websiteConfig();
        settingStore.settings = setting;
        settingStore.domainList = setting.domainList;
        document.title = setting.title;
    }
}
