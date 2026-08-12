FROM node:24.15.0-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && find /workspace/dist -type f -name '*.map' -delete

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY deploy/nginx.preproduction.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html
EXPOSE 8080
