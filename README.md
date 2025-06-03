# Advanced Log Analyzer

A comprehensive log analysis system built with microservices architecture, featuring real-time log processing, anomaly detection, and a modern web interface.

## 🏗️ Architecture

The system consists of the following components:

- **Frontend**: Next.js application with Tailwind CSS
- **API**: FastAPI backend service
- **Elasticsearch**: Log storage and search engine
- **Fluent Bit**: Log collection and forwarding
- **MongoDB**: Metadata and configuration storage
- **Anomaly Detection**: Python-based anomaly detection scripts

## 📋 Prerequisites

- Docker and Docker Compose
- Git
- Node.js (for local development)
- Python 3.8+ (for local development)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Advanced_Log_Analyzer/Log_Analyzer
```

### 2. Build and Start Services

```bash
# Build and start all services
docker-compose up --build -d

# Or build specific services
docker-compose build <service-name>
docker-compose up <service-name> -d
```

### 3. Verify Services

Check that all services are running:

```bash
docker-compose ps
```

## 🌐 Service Access

Once the services are running, you can access them at the following endpoints:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Main web interface |
| **API** | http://localhost:8000 | REST API endpoints |
| **API Docs** | http://localhost:8000/docs | Interactive API documentation |
| **Elasticsearch** | http://localhost:9200 | Elasticsearch cluster |
| **Kibana** (if configured) | http://localhost:5601 | Elasticsearch visualization |
| **MongoDB** | mongodb://localhost:27017 | Database connection |

## 📁 Project Structure

```
Log_Analyzer/
├── api/                    # FastAPI backend service
│   ├── main.py            # Main API application (50KB)
│   ├── config.py          # Configuration settings
│   ├── requirements.txt   # Python dependencies
│   └── Dockerfile         # API container configuration
├── elasticsearch/         # Elasticsearch configuration
│   └── docker-compose-elasticsearch.yaml
├── fluent-bit/           # Log collection service
│   ├── fluent-bit.conf   # Main configuration
│   ├── parsers.conf      # Log parsing rules
│   └── Dockerfile        # Fluent Bit container
├── Frontend/             # Next.js web application
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility libraries
│   ├── public/           # Static assets
│   ├── styles/           # CSS styles
│   ├── package.json      # Node.js dependencies
│   └── Dockerfile        # Frontend container
├── mongo/                # MongoDB initialization
│   └── init.js           # Database initialization script
├── scripts/              # Utility scripts
│   └── anomaly_detector.py # Anomaly detection (23KB)
├── uploads/              # File upload directory
└── docker-compose.yaml   # Main orchestration file
```

## 🛠️ Development Setup

### Frontend Development

```bash
cd Frontend
npm install
npm run dev
# Access at http://localhost:3000
```

### API Development

```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# Access at http://localhost:8000
```

### Running Anomaly Detection

```bash
cd scripts
python anomaly_detector.py
```

## 🐳 Docker Commands

### Build Services

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build frontend
docker-compose build api
docker-compose build elasticsearch
```

### Start/Stop Services

```bash
# Start all services
docker-compose up -d

# Start specific services
docker-compose up frontend api -d

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### View Logs

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs frontend
docker-compose logs api
docker-compose logs elasticsearch

# Follow logs in real-time
docker-compose logs -f api
```

## 📊 Usage

### Log Upload
1. Access the frontend at http://localhost:3000
2. Use the upload interface to submit log files
3. Files are processed and stored in the `uploads/` directory

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Service health check |
| `POST` | `/api/logs/upload` | Upload log files |
| `POST` | `/api/logs/ingest` | Ingest log data |
| `POST` | `/api/logs/ingest/fluent-bit` | Fluent Bit log ingestion |
| `GET` | `/api/logs/query` | Query processed logs |
| `GET` | `/api/templates` | Get log parsing templates |
| `GET` | `/api/stats` | System statistics |
| `GET` | `/api/files` | List uploaded files |
| `GET` | `/api/files/{file_id}/stats` | Get file-specific statistics |
| `GET` | `/api/summary` | Log analysis summary |
| `GET` | `/docs` | Interactive API documentation |

### Log Processing Pipeline
1. **Upload**: Upload logs via frontend or API (`/api/logs/upload`)
2. **Ingestion**: Process logs through ingestion endpoints (`/api/logs/ingest`)
3. **Collection**: Fluent Bit forwards logs (`/api/logs/ingest/fluent-bit`)
4. **Storage**: Processed logs stored in Elasticsearch
5. **Analysis**: Query logs (`/api/logs/query`) and get summaries (`/api/summary`)
6. **Monitoring**: View statistics (`/api/stats`) and file details (`/api/files`)
7. **Visualization**: Results displayed in frontend dashboard

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# API Configuration
API_HOST=0.0.0.0
API_PORT=8000

# Database Configuration
MONGODB_URL=mongodb://mongo:27017
ELASTICSEARCH_URL=http://elasticsearch:9200

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Service Ports

Default port mappings:
- Frontend: 3000
- API: 8000
- Elasticsearch: 9200
- MongoDB: 27017
- Fluent Bit: 24224

## 🚨 Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check port usage
   netstat -tulpn | grep :8000
   # Change ports in docker-compose.yaml if needed
   ```

2. **Container Build Failures**
   ```bash
   # Clean Docker cache
   docker system prune -a
   # Rebuild without cache
   docker-compose build --no-cache
   ```

3. **Service Connection Issues**
   ```bash
   # Check container network
   docker network ls
   docker network inspect log_analyzer_default
   ```

4. **Elasticsearch Memory Issues**
   ```bash
   # Increase Docker memory limit to at least 4GB
   # Or add to docker-compose.yaml:
   environment:
     - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
   ```

### Health Checks

```bash
# Check service health
curl http://localhost:8000/health
curl http://localhost:9200/_cluster/health
curl http://localhost:3000
```

## 📝 Logs and Monitoring

- Application logs: `docker-compose logs`
- Uploaded files: `./uploads/`
- Elasticsearch data: Docker volume `elasticsearch_data`
- MongoDB data: Docker volume `mongodb_data`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with Docker
5. Submit a pull request

## 📄 License

MIT License

Copyright (c) 2025 Chetan Giri

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

**Note**: Make sure to configure your firewall and security settings appropriately when deploying to production environments.