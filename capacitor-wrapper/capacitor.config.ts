import type { CapacitorConfig } from "@capacitor/cli";
const target = process.env.CAPACITOR_APP_URL;
if (!target) throw new Error("Configure APK_WEB_URL with the actual deployed HTTPS website before building an APK");
const origin = new URL(target);
if (origin.protocol !== "https:") throw new Error("Remote app URL must use HTTPS");
const config: CapacitorConfig = {
 appId: "vn.nptduy.studiobuilder",
 appName: "NuvoraCraft Studio Builder",
 webDir: "www",
 server: { url: origin.href, allowNavigation: [origin.hostname], cleartext: false },
};
export default config;
