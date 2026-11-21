import type { CapacitorConfig } from "@capacitor/cli";

// The staff app: a native iOS shell around the deployed /staff area (docs/mobile-app.md).
//
// There is no code fork. The WebView loads the live site, so every web deploy reaches the app at
// once; the binary only needs a new TestFlight build when the shell itself changes (Capacitor
// upgrade, icon, permissions). `webDir` holds nothing but the offline page bundled into the app.
//
// What the shell adds over the PWA is native push: @capacitor/push-notifications registers with
// APNs and src/lib/native-push.ts sends to it. The web app never imports @capacitor/*; it reaches
// the plugin through the `window.Capacitor` global the shell injects (src/lib/native-push-client.ts).
//
// server.url must be the host that serves the site directly. A cross-host redirect from here makes
// Capacitor open the page in Safari instead of the app. When lacordobesa.de goes live, change this
// URL and ship a new build; the old host keeps working until then.
const config: CapacitorConfig = {
  appId: "de.lacordobesa.staff",
  appName: "La Cordobesa",
  webDir: "mobile/www",
  // Lets the site tell the shell apart from Safari, should it ever need to.
  appendUserAgent: "LaCordobesaShell",
  backgroundColor: "#f3f8fb",
  server: {
    url: "https://lacordobesa.vercel.app/staff",
    allowNavigation: ["lacordobesa.vercel.app", "lacordobesa.de", "*.lacordobesa.de"],
  },
  ios: {
    contentInset: "never",
  },
  plugins: {
    // Without this iOS shows nothing for a push that arrives while the app is open, and drops it
    // instead of putting it in Notification Center: the plugin returns an empty option set when
    // the key is absent. muk.events learned this the hard way.
    PushNotifications: {
      presentationOptions: ["badge", "banner", "list", "sound"],
    },
  },
};

export default config;
