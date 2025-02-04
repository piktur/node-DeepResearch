FROM node:alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV GEMINI_API_KEY=""
ENV JINA_API_KEY=""
ENV BRAVE_API_KEY=""

EXPOSE 3000

CMD ["npm", "run", "dev"]
