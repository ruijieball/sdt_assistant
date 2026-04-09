# 🏜️ Sandiao Assistant (Meme Image Assistant)

> Let LLM understand your meme images and save them, so every meme can be found precisely!

## ✨ Highlights

Do you struggle with these problems?

- 😫 Saved thousands of meme images but can't find them when needed?
- 🔍 Searching by filename? But filenames are just random timestamps...
- 🏷️ Manually tagging? Gave up after a few attempts...
- 📱 Want to search and send memes directly in WeChat chat?

**This project is built to solve these pain points!**

Leveraging the powerful image understanding capabilities of LLMs, it automatically identifies:
- 🎭 Emotional expressions (e.g., confused, shocked, helpless, sarcastic...)
- 📝 Text content
- 🎬 Meme sources and characters
- 💡 Usage scenarios

Compared to traditional image-based search, semantic understanding helps you find the exact meme you need!

## 🏗️ Architecture

| Layer | Technology |
|-------|------------|
| Backend | FastAPI + Uvicorn/Gunicorn |
| Template Engine | Jinja2 |
| Storage | Local File System |
| Frontend | Vanilla JavaScript + CSS |
| Vector Database | ChromaDB |
| LLM | OpenAI Compatible API / Local Ollama |
| Image Deduplication | imagededup |
| WeChat Plugin | [sdt_bridge](https://github.com/ruijieball/sdt_bridge) |

## 🚀 Quick Start

### Requirements

- Python 3.14+ (for non-Docker deployment)
- Docker (recommended)
- LLM API (OpenAI compatible / local Ollama)
- Memory >2GB (for vector model loading)

### Docker Deployment (Recommended)

```bash
# Clone the project
git clone https://github.com/ruijieball/sdt_assistant.git
cd sdt_assistant

# Edit Makefile to configure your LLM API settings
vi Makefile

# Deploy using Makefile
make build   # Build Docker image
make run     # Start service (background mode)
make logs    # View running logs
make stop    # Stop service

# Start using: http://localhost:8283/
```

On first startup, ChromaDB vector model (default: Qwen3-Embedding-0.6B) will be downloaded automatically. Please wait patiently.

### Manual Deployment

```bash
# Install dependencies
pip install -r requirements.txt

# Edit config.py to configure your LLM API settings
vi config.py

# Start the service
python main.py

# Start using: http://localhost:8283/
```

## 📱 WeChat Integration

Use with the companion project [sdt_bridge](https://github.com/ruijieball/sdt_bridge) to search and send memes directly in WeChat!

## Configuration

Environment variables configured in `Makefile` will be passed to `config.py`. Modify these key configurations:

| Config | Description | Default |
|--------|-------------|---------|
| `LLM_API_URL` | LLM API URL | `http://localhost:11434/v1/` |
| `LLM_API_KEY` | API Key | `ollama` |
| `LLM_MODEL` | LLM Model Name | `qwen3.5:9b` |
| `LLM_TIMEOUT` | LLM Request Timeout (seconds) | `300` |
| `EMBEDDING_MODEL` | Vector Embedding Model | `Qwen/Qwen3-Embedding-0.6B` |
| `HF_ENDPOINT` | HuggingFace Mirror (recommended for China) | `https://hf-mirror.com` |

## 📖 API Documentation

After starting the server, visit `http://localhost:8283/docs` for full API documentation.

Main endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main page |
| `/add` | POST | Upload image and save with recognition |
| `/search` | GET | Semantic search for images |

## Notes

- Personal project, built with vibe coding. Feel free to fork and customize!
- Perfect for NAS deployment with fully local data storage

## Screenshot

## 界面截图

![screenshot01](screenshot/screenshot01.jpg)

![screenshot02](screenshot/screenshot02.jpg)

## 📄 License

MIT License