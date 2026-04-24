FROM node:22-alpine

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend ./

ENV NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
