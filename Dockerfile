FROM node:16-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY dist/ ./dist/
COPY .env ./.env

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]