# Viettel MetaHub

**Viettel MetaHub** là nền tảng quản lý metadata, được xây dựng trên nền tảng [DataHub](https://datahubproject.io/). Dự án bổ sung giao diện người dùng tuỳ chỉnh và lớp tìm kiếm ngữ nghĩa tiếng Việt (AI Semantic Search) dựa trên vector embedding, giúp người dùng tìm kiếm tài sản dữ liệu (dataset, dashboard, pipeline, v.v.) một cách thông minh và chính xác hơn.

---

## Mục lục

- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Thành phần dự án](#thành-phần-dự-án)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Hướng dẫn cài đặt & chạy](#hướng-dẫn-cài-đặt--chạy)
  - [Chạy toàn bộ stack bằng Docker Compose](#chạy-toàn-bộ-stack-bằng-docker-compose)
  - [Chạy local (phát triển)](#chạy-local-phát-triển)
- [Cấu hình biến môi trường](#cấu-hình-biến-môi-trường)
- [API Backend](#api-backend)
- [Tìm kiếm AI Semantic Search](#tìm-kiếm-ai-semantic-search)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)

---

## Kiến trúc hệ thống

```
┌──────────────────────────────────────────────────────────────┐
│                     Người dùng (Browser)                     │
└────────────────────────┬─────────────────────────────────────┘
                         │ :9000
                         ▼
         ┌───────────────────────────────┐
         │   Viettel MetaHub Frontend    │
         │   (React + Vite, port 9000)   │
         │   nginx proxy:                │
         │   /api/v2/* → DataHub GMS     │
         │   /api/search/* → Backend     │
         └───────┬───────────────┬───────┘
                 │               │
        :9002    │               │ :8001
                 ▼               ▼
    ┌────────────────┐  ┌─────────────────────────┐
    │  DataHub       │  │  Viettel MetaHub Backend │
    │  Frontend      │  │  (FastAPI, port 8001)    │
    │  (Play, :9002) │  │  - Keyword search        │
    └───────┬────────┘  │  - AI Semantic Search    │
            │           └───────────┬──────────────┘
            │ :8080                 │ :6333
            ▼                      ▼
    ┌────────────────┐     ┌────────────────┐
    │  DataHub GMS   │     │   Qdrant       │
    │  (GraphQL API) │     │ (Vector DB)    │
    └───────┬────────┘     └────────────────┘
            │
     ┌──────┴──────────────────────────┐
     │                                 │
     ▼                                 ▼
┌──────────┐  ┌─────────────┐  ┌─────────────┐
│  MySQL   │  │Elasticsearch│  │    Kafka    │
│ (metadata│  │  (index)    │  │  (broker)   │
│  store)  │  └─────────────┘  └─────────────┘
└──────────┘
```

---

## Thành phần dự án

| Thư mục | Mô tả |
|---|---|
| `viettel-metahub-frontend/` | Giao diện người dùng — React 18 + TypeScript + Ant Design, chạy trên Vite |
| `viettel-metahub-backend/` | API backend — FastAPI + Python 3.12, cung cấp tìm kiếm từ khoá và AI semantic |
| `docker/` | Cấu hình Docker Compose cho toàn bộ hệ thống (DataHub + dịch vụ bổ sung) |

---

## Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu |
|---|---|
| Docker | 24+ |
| Docker Compose | v2.20+ |
| Node.js *(chỉ khi dev local)* | 20+ |
| Python *(chỉ khi dev local)* | 3.12+ |

> **Lưu ý:** Khi chạy toàn bộ stack lần đầu, hệ thống cần tải xuống embedding model `intfloat/multilingual-e5-large` (~1.1 GB). Backend sẽ mất khoảng **2–3 phút** để sẵn sàng.

---

## Hướng dẫn cài đặt & chạy

### Chạy toàn bộ stack bằng Docker Compose

Đây là cách khuyến nghị để chạy đầy đủ hệ thống trên môi trường staging hoặc production.

**1. Clone dự án**

```bash
git clone <repository-url>
cd project-vdt
```

**2. Cấu hình biến môi trường (tuỳ chọn)**

```bash
# Tạo file .env trong thư mục docker/ để override các giá trị mặc định
cd docker
cp ../.env.example .env   # nếu có sẵn file mẫu
```

**3. Khởi chạy toàn bộ hệ thống**

```bash
cd docker
docker compose -f docker-compose-viettel-metahub.yml up -d
```

**4. Kiểm tra trạng thái**

```bash
docker compose -f docker-compose-viettel-metahub.yml ps
```

**5. Truy cập ứng dụng**

| Dịch vụ | URL |
|---|---|
| 🌐 Viettel MetaHub UI | http://localhost:9000 |
| 🔧 DataHub GMS API | http://localhost:8080 |
| 🤖 Semantic Search Backend | http://localhost:8001 |
| 📊 Elasticsearch | http://localhost:9200 |
| 🗄️ Qdrant Dashboard | http://localhost:6333/dashboard |

**6. Dừng hệ thống**

```bash
docker compose -f docker-compose-viettel-metahub.yml down
```

> Để xoá toàn bộ dữ liệu (volumes), thêm flag `-v`:
> ```bash
> docker compose -f docker-compose-viettel-metahub.yml down -v
> ```

---

### Chạy local (phát triển)

#### Backend (FastAPI)

```bash
cd viettel-metahub-backend

# Tạo virtualenv và cài dependencies
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt

# Cấu hình biến môi trường
copy .env.example .env
# Chỉnh sửa .env theo môi trường của bạn

# Chạy server
uvicorn app.main:app --reload --port 8000
```

API docs tự động: http://localhost:8000/docs

#### Frontend (React + Vite)

```bash
cd viettel-metahub-frontend

# Cài dependencies
npm install

# Cấu hình proxy tới DataHub
copy .env.example .env.local
# Chỉnh VITE_PROXY_TARGET=http://localhost:9002

# Chạy dev server
npm run dev
```

Ứng dụng sẽ chạy tại: http://localhost:5173

---

## Cấu hình biến môi trường

### Backend (`viettel-metahub-backend/.env`)

| Biến | Mặc định | Mô tả |
|---|---|---|
| `DATAHUB_GRAPHQL_URL` | `http://localhost:9002/api/v2/graphql` | URL GraphQL của DataHub |
| `DATAHUB_GMS_URL` | `http://localhost:8080` | URL GMS của DataHub |
| `DATAHUB_TOKEN` | *(trống)* | Personal Access Token của DataHub |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Danh sách origin cho phép CORS |
| `MAX_SEARCH_RESULTS` | `20` | Số kết quả tìm kiếm tối đa |
| `QDRANT_URL` | `http://localhost:6333` | URL của Qdrant vector database |
| `QDRANT_COLLECTION` | `datahub_entities` | Tên collection trong Qdrant |
| `EMBEDDING_MODEL` | `intfloat/multilingual-e5-large` | Model embedding đa ngôn ngữ |
| `VECTOR_SCORE_THRESHOLD` | `0.83` | Ngưỡng điểm tương đồng tối thiểu |
| `VECTOR_MIN_SPREAD` | `0.008` | Ngưỡng phân tán điểm tối thiểu |

### Frontend (`viettel-metahub-frontend/.env.local`)

| Biến | Mặc định | Mô tả |
|---|---|---|
| `VITE_PROXY_TARGET` | `http://localhost:9002` | URL proxy đến DataHub frontend (Play server) |

---

## API Backend

Backend cung cấp các endpoint sau (base URL: `http://localhost:8001`):

### `GET /health`
Kiểm tra trạng thái dịch vụ.

```json
{
  "status": "ok",
  "service": "viettel-metahub-backend",
  "model_ready": true
}
```

### `GET /api/search`
Tìm kiếm tài sản dữ liệu trong DataHub.

| Tham số | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `q` | string | `*` | Từ khoá tìm kiếm (tiếng Việt hoặc tiếng Anh) |
| `types` | string | `DATASET,DASHBOARD,...` | Loại entity cần tìm (phân cách bằng dấu phẩy) |
| `start` | integer | `0` | Vị trí bắt đầu phân trang |
| `count` | integer | `10` | Số kết quả mỗi trang (tối đa 100) |
| `domain` | string | — | Lọc theo domain URN |
| `tag` | string | — | Lọc theo tag URN |
| `platform` | string | — | Lọc theo nền tảng (mysql, kafka, ...) |
| `start_date` | integer | — | Lọc từ ngày (epoch ms) |
| `end_date` | integer | — | Lọc đến ngày (epoch ms) |
| `ai_search` | boolean | `false` | Bật tìm kiếm ngữ nghĩa AI (Qdrant) |

### `POST /api/search/ingest/all`
Đánh chỉ mục lại toàn bộ entities vào Qdrant (chạy nền).

### `POST /api/search/ingest?platform={platform}`
Đánh chỉ mục lại entities của một platform cụ thể vào Qdrant (chạy nền).

---

## Tìm kiếm AI Semantic Search

Tính năng **AI Semantic Search** sử dụng vector embedding để tìm kiếm theo nghĩa ngữ cảnh thay vì khớp từ khoá chính xác.

### Cách hoạt động

1. **Embedding**: Câu truy vấn của người dùng được chuyển thành vector sử dụng model `intfloat/multilingual-e5-large` (hỗ trợ tiếng Việt tốt).
2. **Vector Search**: Vector truy vấn được so sánh với các vector entities đã được đánh chỉ mục trong **Qdrant**.
3. **Lọc kết quả**: Các kết quả có điểm tương đồng thấp hoặc phân tán điểm quá nhỏ sẽ bị loại bỏ để tránh kết quả nhiễu.
4. **Fallback**: Nếu Qdrant không khả dụng, hệ thống tự động fallback về tìm kiếm từ khoá thông thường.

### Bật AI Search

- Trên UI: Bật toggle **"AI Search"** trên thanh tìm kiếm.
- Qua API: Thêm tham số `?ai_search=true` vào request.

### Đánh chỉ mục dữ liệu (Ingest)

Trước khi sử dụng AI Search, cần đánh chỉ mục dữ liệu vào Qdrant:

```bash
# Đánh chỉ mục toàn bộ
curl -X POST http://localhost:8001/api/search/ingest/all

# Đánh chỉ mục theo platform
curl -X POST "http://localhost:8001/api/search/ingest?platform=mysql"
```

---

## Cấu trúc thư mục

```
project-vdt/
├── docker/                                 # Docker Compose & cấu hình hạ tầng
│   ├── docker-compose-viettel-metahub.yml  # Stack chính (khuyến nghị dùng)
│   ├── docker-compose.yml                  # DataHub quickstart gốc
│   ├── mysql/                              # Cấu hình MySQL
│   ├── elasticsearch/                      # Cấu hình Elasticsearch
│   ├── kafka*/                             # Cấu hình Kafka & Schema Registry
│   └── ...
│
├── viettel-metahub-backend/                # FastAPI backend
│   ├── app/
│   │   ├── main.py                         # Entrypoint ứng dụng
│   │   ├── config.py                       # Cấu hình từ biến môi trường
│   │   ├── api/
│   │   │   └── search.py                   # API endpoints tìm kiếm
│   │   └── services/
│   │       ├── datahub_client.py           # Client giao tiếp DataHub GraphQL
│   │       ├── semantic_search.py          # Logic tìm kiếm (keyword + vector)
│   │       ├── embedding_service.py        # Tạo vector embedding
│   │       ├── vector_store.py             # Giao tiếp Qdrant
│   │       └── ingest_service.py           # Đánh chỉ mục dữ liệu vào Qdrant
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
└── viettel-metahub-frontend/               # React frontend
    ├── src/
    │   ├── App.tsx                          # Component gốc & routing
    │   ├── main.tsx                         # Entrypoint React
    │   ├── api/                             # Các hàm gọi API
    │   ├── components/                      # Components tái sử dụng
    │   ├── pages/                           # Các trang chính
    │   ├── styles/                          # CSS toàn cục
    │   ├── theme/                           # Cấu hình theme Ant Design
    │   ├── types/                           # TypeScript type definitions
    │   └── utils/                           # Hàm tiện ích
    ├── nginx.conf                           # Cấu hình nginx proxy
    ├── Dockerfile
    ├── package.json
    └── .env.example
```

---

## Công nghệ sử dụng

### Frontend
| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| React | 18.3 | UI framework |
| TypeScript | 5.2 | Type safety |
| Vite | 5.2 | Build tool & dev server |
| Ant Design | 5.17 | UI component library |
| React Router | 6.23 | Client-side routing |
| Styled Components | 6.1 | CSS-in-JS styling |
| Axios | 1.7 | HTTP client |
| nginx | - | Reverse proxy & static serving |

### Backend
| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| Python | 3.12 | Runtime |
| FastAPI | 0.115 | Web framework |
| Uvicorn | 0.32 | ASGI server |
| Pydantic | 2.10 | Data validation |
| fastembed | 0.4 | Vector embedding |
| qdrant-client | 1.12 | Qdrant vector DB client |
| httpx | 0.27 | Async HTTP client |

### Hạ tầng
| Công nghệ | Mục đích |
|---|---|
| DataHub | Nền tảng quản lý metadata |
| Qdrant | Vector database cho AI Search |
| Elasticsearch 7.10 | Full-text search index của DataHub |
| MySQL 8.2 | Lưu trữ metadata chính |
| Apache Kafka | Message broker |
| Confluent Schema Registry | Quản lý schema Kafka |
| Docker / Docker Compose | Container hoá & orchestration |

---

