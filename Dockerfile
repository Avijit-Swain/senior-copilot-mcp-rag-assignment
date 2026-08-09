# syntax=docker/dockerfile:1

FROM python:3.12-slim AS backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app:/app/mcp-servers/alarm-management \
    MCP_SERVER_COMMAND=python \
    MCP_SERVER_ARGS="-m alarm_mcp.server" \
    ALARM_DB_PATH=/app/test-data/alarm_management.sqlite3 \
    VECTOR_INDEX_PATH=/app/rag/index \
    DOCUMENT_PATH=/app/rag/documents

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["python", "apps/backend/server.py", "--host", "0.0.0.0", "--port", "8080"]


FROM node:22-slim AS frontend

WORKDIR /app/apps/frontend

COPY apps/frontend/package*.json ./
RUN npm ci

COPY apps/frontend ./
ARG VITE_BACKEND_URL=http://127.0.0.1:8080
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
