FROM node:lts-alpine3.20 AS runtime
WORKDIR /app

COPY . .
COPY ./cms/src/payload-types.ts ./cms/src/payload-types.ts

RUN npm install
RUN npm run build

ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]