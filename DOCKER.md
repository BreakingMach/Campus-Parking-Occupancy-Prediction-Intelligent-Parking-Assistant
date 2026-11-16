# Docker Deployment Guide

## LPU Campus Parking Intelligence System

This document explains how to build, run, and manage the containerized application.

---

## 1. Prerequisites

- **Docker**: Engine version 20.10+ or [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / macOS / Linux).
- **Docker Compose**: V2 included with modern Docker Desktop (`docker compose`).
- Minimum recommended resources:
  - **RAM**: 4 GB (2 GB minimal for CPU inference).
  - **Disk**: 4 GB free space.

---

## 2. Quick Start with Docker Compose

The easiest way to start the complete system:

```bash
# 1. Build and launch in detached mode
docker compose up --build -d

# 2. View live logs
docker compose logs -f

# 3. Stop the container
docker compose down
```

Once running, access:
- **Web Dashboard**: [http://localhost:8000](http://localhost:8000)
- **API Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Interactive OpenAPI Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

On Windows, you can also double-click `docker-start.bat`.
On Linux/macOS, you can run `./docker-start.sh`.

---

## 3. Standalone Docker Commands

If you prefer building and running with the raw `docker` CLI:

### Build Image
```bash
docker build -t campus-parking-intelligence:latest .
```

### Run Container
```bash
docker run -d \
  --name campus-parking-app \
  -p 8000:8000 \
  -v "$(pwd)/artifacts:/app/artifacts" \
  --restart unless-stopped \
  campus-parking-intelligence:latest
```

### Verify Container Health
```bash
docker ps
curl http://localhost:8000/api/health
```

### Inspect Container Logs
```bash
docker logs -f campus-parking-app
```

---

## 4. Development Mode (Hot-Reload)

For active frontend or Python development without rebuilding images on every file change:

```bash
docker compose -f docker-compose.dev.yml up --build
```

This mounts your local `./frontend`, `./api`, `./computer_vision`, and `./models` directories into `/app` inside the container with Uvicorn's `--reload` flag enabled.

---

## 5. GPU Acceleration (Optional)

If your host has an NVIDIA GPU with the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installed:

```bash
# Build CUDA 12 image
docker build -f Dockerfile.gpu -t campus-parking-intelligence:gpu .

# Run with full GPU pass-through
docker run -d \
  --gpus all \
  --name campus-parking-gpu \
  -p 8000:8000 \
  campus-parking-intelligence:gpu
```

---

## 6. Architecture & Security Highlights

1. **Non-Root Execution**: Container runs under a dedicated low-privilege `appuser` (UID 1000).
2. **Lean CPU PyTorch**: CPU-specific PyTorch wheels are installed first, reducing image layer footprint from ~5GB to ~1.2GB and speeding up build time.
3. **Optimized Build Context**: `.dockerignore` filters out raw Roboflow training datasets and virtual environments, keeping build transfers instant.
4. **Automated Healthchecks**: Built-in `HEALTHCHECK` continually verifies system responsiveness and model availability via `/api/health`.
5. **Client-Side Video Ingestion**: Webcam feeds are streamed directly from the client's browser canvas to the containerized `/api/detect-frame` endpoint via HTTP/WebRTC, eliminating the need for complex host camera device passthrough inside Docker.
