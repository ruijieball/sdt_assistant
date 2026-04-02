IMAGE_NAME := sdt-assistant
VERSION := local
CONTAINER_NAME := sdt-assistant-container
# 1. 获取当前 Makefile 的绝对路径
THIS_MAKEFILE_PATH := $(abspath $(lastword $(MAKEFILE_LIST)))
# 2. 提取该文件所在的目录 (注意末尾会带一个斜杠 /)
THIS_MAKEFILE_DIR := $(dir $(THIS_MAKEFILE_PATH))
# 3. (可选) 去掉末尾的斜杠，使其更符合常规路径习惯
PROJECT_ROOT := $(patsubst %/,%,$(THIS_MAKEFILE_DIR))

# 以下环境变量请根据需要加入docker启动命令中，以下值皆为默认值
# http代理配置，默认无此环境变量
# HTTP_PROXY := http://127.0.0.1:7890
# HTTPS_PROXY := http://127.0.0.1:7890
# NO_PROXY := localhost,127.0.0.1,dashscope.aliyuncs.com,.hf-mirror.com,hf-mirror.con,.hf.co
# chromadb所需模型下载镜像地址
HF_ENDPOINT := https://hf-mirror.com
# HF_HUB_OFFLINE hugging face离线模式flag，若设置为1不会联网下载/更新模型，首次使用请设置为0以下载模型
HF_HUB_OFFLINE := 0
# chromadb所用的向量模型，首次启动会从hugging face下载
EMBEDDING_MODEL := Qwen/Qwen3-Embedding-0.6B
# 识别图片内容的大语言模型配置
LLM_API_URL := http://localhost:11434/v1/
LLM_API_KEY := ollama
LLM_MODEL := qwen3.5:9b
# 大语言模型超时时间时间
# 由于大语言模型以非流式返回结果，请设置相对较长的超时时间
LLM_TIMEOUT := 300



.PHONY: all build run stop clean logs shell

# 默认目标
all: build

# 构建镜像
build:
	docker build -t $(IMAGE_NAME):$(VERSION) .

# 运行容器 (后台模式 -d)
run:
	docker run -d \
		--name $(CONTAINER_NAME) \
		-p 127.0.0.1:8283:8283 \
		-e LLM_API_URL=$(LLM_API_URL) \
		-e LLM_API_KEY=$(LLM_API_KEY) \
		-e LLM_MODEL=$(LLM_MODEL) \
		-v $(PROJECT_ROOT)/data:/sdt_assistant/data \
		--restart unless-stopped \
		$(IMAGE_NAME):$(VERSION)

# 前台运行 (用于调试)
# -it参数方便首次下载chroma_models查看进度
run-dev:
	docker run --rm -it \
		-p 8283:8283 \
		-v $(PROJECT_ROOT)/data:/sdt_assistant/data \
		$(IMAGE_NAME):$(VERSION) \
		uvicorn main:app --host 0.0.0.0 --port ${PORT}

# 停止并移除容器
stop:
	docker stop $(CONTAINER_NAME) || true
	docker rm $(CONTAINER_NAME) || true

# 查看日志
logs:
	docker logs -f $(CONTAINER_NAME)

# 进入容器内部Shell
shell:
	docker exec -it $(CONTAINER_NAME) /bin/bash

# 新建容器并进入Shell
run-shell:
	docker run --rm -it \
		-p 8283:8283 \
		-v $(PROJECT_ROOT)/data:/sdt_assistant/data \
		$(IMAGE_NAME):$(VERSION) \
		/bin/bash

# 清理镜像
clean: stop
	docker rmi $(IMAGE_NAME):$(VERSION) || true

# 重启服务
restart: stop build run