FROM node:18-slim

WORKDIR /app

# Install dependencies for image processing and PostgreSQL
RUN apt-get update && apt-get install -y \
    postgresql-client \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
