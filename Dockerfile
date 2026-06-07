# --- Stage 1: Builder ---
FROM node:lts-alpine3.20 AS builder
WORKDIR /app

# 1. Copy only package files first to cache the npm install layer
COPY package*.json ./
RUN npm ci

# 2. Copy the rest of the source code and build
COPY . .
RUN npm run build

# 3. Strip out devDependencies to save space
RUN npm prune --omit=dev


# --- Stage 2: Runtime ---
FROM node:lts-alpine3.20 AS runtime
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# 4. Copy ONLY the necessary compiled files and production dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Note: If your app requires a 'public' or 'assets' folder at runtime, 
# copy it here as well (e.g., COPY --from=builder /app/public ./public)

EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]