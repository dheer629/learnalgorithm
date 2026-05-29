FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY frontend frontend

CMD ["npm", "--workspace", "frontend", "run", "dev"]
