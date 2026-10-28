# Dockerfile nhiều tầng: build frontend + server, chạy bằng Node với NODE_ENV=production
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Chỉ dependency production cho runtime
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force
# Server bundle, frontend build, và migration SQL
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
USER node
EXPOSE 3000
# Migration chạy khi khởi động (AUTO_MIGRATE mặc định bật). Biến bắt buộc: DATABASE_URL, JWT_SECRET
CMD ["node", "dist/server.js"]
