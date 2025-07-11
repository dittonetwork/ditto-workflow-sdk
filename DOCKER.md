# Docker Setup for Workflow SDK Dashboard

This document explains how to run the Workflow SDK dashboard using Docker.

## Prerequisites

- Docker
- Docker Compose

## Technical Details

- **Node.js Version**: 20 (required for some dependencies)
- **Build Tools**: Python, make, and g++ (for native dependencies like `bufferutil`)

## Running the Dashboard

### Using Docker Compose (Recommended)

1. **Start the dashboard service:**
   ```bash
   docker-compose up -d
   ```

2. **Access the dashboard:**
   Open your browser and navigate to: `http://localhost:4173`

3. **View logs:**
   ```bash
   docker-compose logs -f workflow-dashboard
   ```

4. **Stop the service:**
   ```bash
   docker-compose down
   ```

### Using Docker directly

1. **Build the image:**
   ```bash
   docker build -t workflow-dashboard ./frontend
   ```

2. **Run the container:**
   ```bash
   docker run -p 4173:4173 \
     -v $(pwd):/project \
     -v /project/frontend/node_modules \
     workflow-dashboard
   ```

## Deployment Notes

- The container copies the entire project structure (including SDK source code)
- Builds production assets and serves them using Vite's preview mode
- Node modules are cached in a separate volume for performance
- The production server is configured to accept connections from any host (0.0.0.0)
- Assets are optimized, minified, and ready for production use

## Ports

- **4173**: Frontend production server (Vite preview)

## Environment Variables

The service runs in production mode by default. You can modify the environment in the docker-compose.yml file if needed.

## Troubleshooting

### Build Failures

If you encounter build failures related to:
- **Python not found**: The Dockerfile now includes Python installation
- **Native dependencies**: Build tools (make, g++) are included for compilation
- **Node version conflicts**: Updated to Node.js 20 to meet package requirements

### Common Issues

1. **Port already in use**: If port 4173 is occupied, change it in docker-compose.yml
2. **Permission issues**: Ensure Docker has proper permissions
3. **Build cache**: Clear Docker build cache with `docker system prune -a` 