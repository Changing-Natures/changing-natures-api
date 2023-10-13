FROM node:18

# Install pnpm and pm2
RUN npm install -g pnpm pm2

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy PM2 process file and your app's source code
COPY ecosystem.config.js .
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Start your app with PM2
CMD ["pm2-runtime", "ecosystem.config.js"]
