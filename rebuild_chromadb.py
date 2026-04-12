#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
from config import DB_FOLDER, DB_NAME, SENTENCE_TRANSFORMERS_HOME, HF_ENDPOINT, HF_HUB_OFFLINE, EMBEDDING_MODEL, LOG_FILE
os.environ["SENTENCE_TRANSFORMERS_HOME"] = SENTENCE_TRANSFORMERS_HOME
os.environ["HF_ENDPOINT"] = HF_ENDPOINT
# 强制开启离线模式，设置为 "1" 或 "true" 会禁止任何网络请求，直接读本地
os.environ["HF_HUB_OFFLINE"] = HF_HUB_OFFLINE
os.makedirs(SENTENCE_TRANSFORMERS_HOME, exist_ok=True)
import chromadb
import chromadb.utils.embedding_functions as embedding_functions
import shutil
import time
import logging

logging.basicConfig(
    level = logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        # 1. 输出到控制台 (默认是 sys.stderr，也可以指定 sys.stdout)
        logging.StreamHandler(), 
        # 2. 输出到本地文件
        logging.FileHandler(LOG_FILE, encoding='utf-8')
    ]
)

logger = logging.getLogger(__name__)


logger.info(f"初始化 EmbeddingFunction，使用模型: {EMBEDDING_MODEL}")
custom_ef = embedding_functions.SentenceTransformerEmbeddingFunction( # type: ignore
    model_name = EMBEDDING_MODEL
)

backup_folder = DB_FOLDER + "_backup" + time.strftime("%Y%m%d%H%M%S")

def load_backup_chromadb() -> dict:
    if os.path.exists(backup_folder) and os.path.isdir(backup_folder):
        client_old = chromadb.PersistentClient(path = backup_folder)
        # 使用 type: ignore 来绕过类型检查问题（这是 chromadb 库的已知类型问题）
        collection_old = client_old.get_or_create_collection(name = DB_NAME, embedding_function = custom_ef) # type: ignore
        result = collection_old.get(ids = None)
        data = {
            'ids': result['ids'],
            'documents': result['documents'],
            'metadatas': result['metadatas']
        }
        logger.info(f"成功从 {backup_folder} 读取到 {len(data['ids'])} 条记录")
        return data
    else:
        logger.error(f"{backup_folder} 不存在或不是一个目录，无法读取数据")
        return {}
    

def move_chromadb_folder():
    if os.path.exists(DB_FOLDER) and os.path.isdir(DB_FOLDER):
        shutil.move(DB_FOLDER, backup_folder)
        logger.info(f"已将原 {DB_FOLDER} 移动到 {backup_folder} 以备份数据")
    else:
        logger.warning(f"{DB_FOLDER} 不存在或不是一个目录，无需移动备份")


def fix_timestamps(metadata: dict) -> dict:
    # 把metadata中的creation time改名为creation_time，modification time改名为modification_time
    if 'creation time' in metadata:
        metadata['creation_time'] = metadata.pop('creation time')
    if 'modification time' in metadata:
        metadata['modification_time'] = metadata.pop('modification time')
    return metadata


def write_db(data: dict):
    os.makedirs(DB_FOLDER)
    client_new = chromadb.PersistentClient(path = DB_FOLDER)
    # 使用 type: ignore 来绕过类型检查问题（这是 chromadb 库的已知类型问题）
    collection_new = client_new.get_or_create_collection(name = DB_NAME, embedding_function = custom_ef) # type: ignore
    for id, document, metadata in zip(data.get('ids', []), data.get('documents', []), data.get('metadatas', [])):
        collection_new.upsert(ids = [id], documents = [document], metadatas = [metadata])
    logger.info(f"成功将 {len(data.get('ids', []))} 条记录写入到新的 ChromaDB 数据库中")


def main():
    move_chromadb_folder()
    logger.info(f"正在原始读取ChromaDB的数据...")
    backup_data = load_backup_chromadb()
    # 0.1.4版本调整的时间戳名称，把metadata中的creation time改名为creation_time，modification time改名为modification_time
    backup_data["metadatas"] = [fix_timestamps(metadata) for metadata in backup_data.get('metadatas', [])]

    logger.info(f"正在将数据写入新的 ChromaDB 数据库...")
    write_db(backup_data)

    logger.info(f"ChromaDB 数据库重建完成，已成功恢复 {len(backup_data.get('ids', []))} 条记录")


if __name__ == "__main__":
    main()