FROM python:slim

# 设置工作目录
WORKDIR /sdt_assistant

# 安装系统依赖 (如果需要编译某些 python 包，如 psycopg2, pillow 等)
# 如果不需要编译型依赖，可以跳过 RUN apt-get 步骤以减小镜像体积
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     gcc \
#     && rm -rf /var/lib/apt/lists/*

# 复制依赖文件并安装 Python 依赖
# 单独复制 requirements.txt 可以利用 Docker 缓存层，
# 当代码变动但依赖未变动时，无需重新安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip -i "https://mirrors.aliyun.com/pypi/simple/" && \
    pip install --no-cache-dir -r requirements.txt -i "https://mirrors.aliyun.com/pypi/simple/"

# 创建非 root 用户并切换 (安全最佳实践)
# 避免以 root 身份运行应用，防止容器逃逸风险
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /sdt_assistant
USER appuser

# 复制项目代码
# 此时以 appuser 身份复制，确保文件权限正确
COPY --chown=appuser:appuser . .

# 暴露端口
EXPOSE 8283

# 健康检查
HEALTHCHECK --interval=300s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8283/status')" || exit 1


# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8283"]

CMD ["gunicorn", "main:app",  \
  "--bind", "0.0.0.0:8283",  \
  "--workers", "4", \
  "--worker-class", "uvicorn.workers.UvicornWorker", \
  "--timeout", "600", \
  "--access-logfile", "-", \
  "--error-logfile", "-"]