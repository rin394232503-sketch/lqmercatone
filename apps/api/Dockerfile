FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy Prisma schema and generate client
COPY packages/db/schema.prisma ./prisma/
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy source
COPY apps/api/src ./src
COPY apps/api/tsconfig.json ./tsconfig.json
COPY apps/api/nest-cli.json ./nest-cli.json

# Build
RUN npm run build

# Production start
CMD ["node", "dist/main"]
