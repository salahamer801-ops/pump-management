import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
/* يُسجَّل مبكرًا: المتصفح يعلن جاهزية تثبيت التطبيق قبل فتح شاشة الإعدادات */
import "./lib/install";

createRoot(document.getElementById("root")!).render(<App />);
