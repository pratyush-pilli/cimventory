
# Purchase Module Deployment Guide

This document provides comprehensive instructions for setting up and running the Purchase Module, which consists of a Django backend and a React frontend. The application is deployed as systemd services on a Linux server for production use.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Directory Structure](#directory-structure)
3. [Production Environment Setup](#production-environment-setup)
   - [Database Configuration](#database-configuration)
   - [Backend Setup](#backend-django)
   - [Frontend Setup](#frontend-react)
4. [Systemd Service Deployment](#deployment-using-systemd)
   - [Frontend Service](#1-create-systemd-service-for-frontend)
   - [Backend Service](#2-create-systemd-service-for-backend)
   - [Service Management](#service-management-commands)

---

## Prerequisites

Ensure the following components are installed on your system:

| Component       | Purpose                          |
|-----------------|----------------------------------|
| Python 3.x      | Django backend runtime           |
| Node.js & npm   | React frontend dependencies      |
| virtualenv      | Python environment isolation     |
| serve           | Node.js static file server       |
| systemd         | Service management               |
| Docker          | PostgreSQL container management  |

---

## Directory Structure

```plaintext
purchase-module/
├── frontend/                # React frontend (built and served using 'serve')
├── purchase_module/         # Django backend
└── my_env/                  # Python virtual environment
```

---

## Production Environment Setup

### Database Configuration

The project uses Docker for PostgreSQL in production. The database configuration is defined in `docker-compose.yml`:

```yaml
version: '3.9'

services:
  db:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_DB: purchase_module
      POSTGRES_USER: purchase
      POSTGRES_PASSWORD: purchase
    ports:
      - "5434:5432"  # External port 5434 maps to internal 5432
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Database Management Commands:**

```bash
# Start the database container
docker-compose up -d db

# Check container status
docker-compose ps

# View logs if needed
docker-compose logs db
```

Update your production `.env` file to match the Docker database configuration:

```env
DATABASE_URL=postgres://purchase:purchase@db:5434/purchase_module
```

---

### Backend (Django)

1. **Create and Activate Virtual Environment:**

   ```bash
   pip install virtualenv
   cd purchase_module/purchase_module
   virtualenv my_env
   source my_env/bin/activate
   ```

2. **Install Backend Dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

3. **Update Production Settings:**

   Edit `purchase_module/settings.py`:

   ```python
   ALLOWED_HOSTS = ['199.199.50.60']
   CORS_ALLOWED_ORIGINS = [
       "http://199.199.50.60:3465"
   ]
   ```

---

### Frontend (React)

1. **Navigate to Frontend Directory:**

   ```bash
   cd frontend
   ```

2. **Install Frontend Dependencies:**

   ```bash
   npm install
   ```

3. **Build Production Bundle:**

   ```bash
   npm run build
   ```

---

## Deployment Using Systemd

### 1. Create systemd Service for Frontend

**Path:** `/etc/systemd/system/purchase_frontend.service`

```ini
[Unit]
Description=Frontend service of purchase module
After=network.target

[Service]
User=cimcon
Group=www-data
WorkingDirectory=/home/cimcon/pratyush/purchase_module/purchase-module/frontend
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/usr/bin/serve -s /home/cimcon/pratyush/purchase_module/purchase-module/frontend/dist -p 3465
ExecReload=/bin/kill -s HUP $MAINPID
ExecStop=/bin/kill -s TERM $MAINPID
Restart=on-failure
RestartSec=60s

[Install]
WantedBy=multi-user.target
```

### 2. Create systemd Service for Backend

**Path:** `/etc/systemd/system/purchase_backend.service`

```ini
[Unit]
Description=Purchase module backend service
After=network.target

[Service]
User=cimcon
Group=www-data
WorkingDirectory=/home/cimcon/pratyush/purchase_module/purchase-module/purchase_module
Environment="PATH=/home/cimcon/pratyush/purchase_module/purchase-module/purchase_module/my_env/bin"
ExecStart=python3 manage.py runserver 199.199.50.60:3456
ExecReload=/bin/kill -s HUP $MAINPID
ExecStop=/bin/kill -s TERM $MAINPID
Restart=on-failure
RestartSec=60s
StandardOutput=append:/var/log/purchase_backend.log
StandardError=append:/var/log/purchase_backend_error.log
Type=simple

[Install]
WantedBy=multi-user.target
```

### Service Management Commands

```bash
# Reload systemd configuration
sudo systemctl daemon-reexec
sudo systemctl daemon-reload

# Enable services to start on boot
sudo systemctl enable purchase_frontend.service
sudo systemctl enable purchase_backend.service

# Start services
sudo systemctl start purchase_frontend.service
sudo systemctl start purchase_backend.service

# Check service status
sudo systemctl status purchase_frontend.service
sudo systemctl status purchase_backend.service

# View logs
journalctl -u purchase_backend.service -f  # Follow logs in real-time
```

---

## Verification

After successful deployment, verify the services are running:

1. **Frontend:** Access at `http://199.199.50.60:3465`
2. **Backend:** API available at `http://199.199.50.60:3456`

For troubleshooting, check the logs:

```bash
journalctl -u purchase_backend.service --since "1 hour ago"
tail -f /var/log/purchase_backend_error.log
```

---

**Documentation Version:** 1.0  
**Last Updated:** [10-04-2025]