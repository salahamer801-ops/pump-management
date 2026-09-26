FROM node:20-alpine

WORKDIR /app

# اعتماديات الإنتاج فقط، بنسخة مقفلة من package-lock.json
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY server/src ./src

ENV NODE_ENV=production

# المنفذ يأتي من بيئة الاستضافة (PORT) — والافتراضي في الكود 3001
EXPOSE 3001

CMD ["node", "src/index.js"]
