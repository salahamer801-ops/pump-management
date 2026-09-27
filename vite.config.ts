import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  /* الواجهة تصل إلى خدماتها عبر مسار نسبي /api — نفس الأصل في المعاينة والمنشور */
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: false,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      /* ملفات الهوية تُكاش مسبقًا: أيقونة فورية وشاشة بدء تظهر بلا انتظار */
      includeAssets: [
        "favicon.ico",
        "favicon-32.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-512-maskable.jpg",
        "brand/splash-logo.jpg",
      ],
      manifest: {
        name: "مشروع تنظيم المضخات",
        short_name: "تنظيم المضخات",
        description:
          "دفتر شخصي لإدارة حصص المياه الزراعية — المضخات والديالات والأدوار والحسابات.",
        lang: "ar",
        dir: "rtl",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        /* نفس لون شاشة البدء حتى تكون الإطلالة من أيقونة الجهاز سلسة */
        background_color: "#0a2440",
        theme_color: "#059669",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon-512-maskable.jpg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
