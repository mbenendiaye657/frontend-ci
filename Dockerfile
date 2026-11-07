# ───────── Étape 1 : dépendances (mise en cache tant que package*.json ne change pas) ─────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ───────── Étape 2 : tests unitaires (utilisée par Jenkins : docker build --target test) ─────────
FROM deps AS test
COPY . .
RUN npm test

# ───────── Étape 3 : build de production ─────────
FROM deps AS build
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ───────── Étape 4 : image finale (nginx sert les fichiers statiques et relaie /api) ─────────
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
