# Use Node.js 20 to meet engine requirements
FROM node:20-alpine

# Set working directory to project root
WORKDIR /project

# Install Python and build tools for native dependencies
RUN apk add --no-cache python3 make g++

# Copy the entire project structure
COPY . .

# Set working directory to frontend
WORKDIR /project/frontend

# Install dependencies
RUN npm ci

# Build the production assets
RUN npm run build

# Expose the port that Vite preview uses
EXPOSE 4173

# Start the production server (serves built files)
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"] 