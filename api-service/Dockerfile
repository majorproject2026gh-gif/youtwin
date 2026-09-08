FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 4000
CMD ["npm", "start"]
