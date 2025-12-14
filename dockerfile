FROM node:18-alpine

WORKDIR /app

# Copy package.json + lock
COPY package*.json ./

# Cài production deps
RUN npm install 

# Copy toàn bộ backend source
COPY backend ./backend
COPY public ./public
COPY Database.sql .
COPY create_data ./create_data

EXPOSE 5000

CMD ["npm", "start"]