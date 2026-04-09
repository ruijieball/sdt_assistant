# 沙雕图小助理 - 配置文件
import os

# 软件描述
APP_TITLE = "沙雕图小助理"
APP_DESCRIPTION = "上传沙雕图，然后再快速查到沙雕图"
APP_VERSION = "0.1.0"
DB_NAME = "sdt_chromadb"

# 基础路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, 'data', 'run.log')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'data', 'uploads')
DB_FOLDER = os.path.join(BASE_DIR, 'data', 'chroma_db')
DEDUP_FILE = os.path.join(BASE_DIR, 'data', 'dedup.pkl')

# 汉明距离阈值，数值越小越严格，通常10以下被认为是相似图片
MAX_DISTANCE_THRESHOLD = int(os.getenv('MAX_DISTANCE_THRESHOLD', "15"))

# 素材上传限制
MAX_FILE_QUANTITY = 5
ACCEPTED_MIME_TYPE = [
    "image/bmp",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
    "image/heic"
]
MAX_BODY_SIZE = 35 * 1024 * 1024  # 35MB
IMG_MAX_BYTES = 7 * 1024 * 1024  # 7MB
IMG_MAX_BYTES_BASE64 = 10 * 1024 * 1024  # 10MB
IMG_MAX_WIDTH = 3800
IMG_MAX_HEIGHT = 2000

# embedding模型配置
HF_HUB_OFFLINE = os.getenv('HF_HUB_OFFLINE', "0")
HF_ENDPOINT = os.getenv('HF_ENDPOINT', "https://hf-mirror.com")
SENTENCE_TRANSFORMERS_HOME = os.path.join(BASE_DIR, 'data', 'chroma_models')
# EMBEDDING_MODEL = "BAAI/bge-m3"
# EMBEDDING_MODEL = "google/embeddinggemma-300m"
EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', "Qwen/Qwen3-Embedding-0.6B")

# 大语言模型配置
CUSTOM_LLM = {
    "ALIYUN": {
        "CUSTOM_API_URL": 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        "CUSTOM_API_KEY": '',
        "CUSTOM_MODEL": 'qwen3.5-flash'
    },
    "OLLAMA": {
        "CUSTOM_API_URL": 'http://localhost:11434/v1/',
        "CUSTOM_API_KEY": 'ollama',
        "CUSTOM_MODEL": 'gemma4:e2b'

    },
        "OPENAI": {
        "CUSTOM_API_URL": 'https://api.openai.com/v1',
        "CUSTOM_API_KEY": '',
        "CUSTOM_MODEL": 'GPT-4.1 mini'

    }
}
CUSTOM_LLM_SELECT = os.getenv('CUSTOM_LLM_SELECT', "OLLAMA")
LLM_API_URL = os.getenv('LLM_API_URL', CUSTOM_LLM[CUSTOM_LLM_SELECT]["CUSTOM_API_URL"])
LLM_API_KEY = os.getenv('LLM_API_KEY', CUSTOM_LLM[CUSTOM_LLM_SELECT]["CUSTOM_API_KEY"])
LLM_MODEL = os.getenv('LLM_MODEL', CUSTOM_LLM[CUSTOM_LLM_SELECT]["CUSTOM_MODEL"])
# 大模型超时时间时间
# 由于大模型以非流式返回结果，请设置相对较长的超时时间
LLM_TIMEOUT = int(os.getenv('LLM_TIMEOUT', 300))
LLM_SYSTEM_MESSAGE = """你是一个数据库的索引系统，用户会上传一个或一组的图片/视频/音频的内容，你需要识别这些素材的内容，并按照下面的规则给到yaml格式的输出，方便后续的关键词或语义搜索，注意一些特殊符号需要转义，如果有特殊符号一定要用半角引号包裹以保证yaml合法。强调一下：输出只包含yaml格式的内容，不要包含其他格式和无异议的内容。
yaml字段包含description, ocr,tags三个字段，含义如下：
内容描述（description）：用中文描述图片/视频/音频的主要内容，如果这是一张梗图，需要特别描述梗在哪里。并说明素材中包含的情绪和聊天中可能的使用场景
文本识别（ocr）：如果图片/视频中包含文字（语言不限），排除转载的水印等无意义的信息后，输出所有有意义的文字，若没有识别到则留空（输出[]）
搜索标签（tags）：根据图片内容生成的可能用于搜索的关键词，2-5个，字数8字以内。如果素材有谐音梗、地狱梗（以他人的灾难、疾病、残障、种族歧视、死亡等悲剧性事件为笑点的梗）、双关梗等梗等分类则打上相应标签。如果涉及中国政治和中国政治人物，则打上“维系”的标签，如果涉及nsfw（not safe for work），也打上nsfw的标签
yaml输出模板：
description: 这是一个案例的输出（文本格式）

ocr: 
  - 举个栗子
  - 识别到的其他文本1
  - 识别到的其他文本2
  - （为文本格式组成的列表）

tags:
  - 举个例子
  - 举个栗子
  - 其他标签1
  - 其他标签2
  - （为文本格式组成的列表）
"""