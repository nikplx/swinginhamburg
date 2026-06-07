FROM node:lts-alpine3.20 AS builder
WORKDIR /app

# Copy dependency files first to leverage Docker caching
COPY package*.json ./

# Install ALL dependencies (including devDependencies needed for building)
RUN npm install

# Copy the rest of the source code
COPY . .
COPY ./cms/src/payload-types.ts ./cms/src/payload-types.ts

# Build the application
RUN npm run build

# Prune devDependencies to keep production dependencies only
RUN npm prune --production


# Stage 2: Production runtime
FROM node:lts-alpine3.20 AS runtime
WORKDIR /app

# Separate the environment variables for safety
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# Copy only the compiled code and production node_modules from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]