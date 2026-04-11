#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
from config import DB_FOLDER, DB_NAME, SENTENCE_TRANSFORMERS_HOME, HF_ENDPOINT, HF_HUB_OFFLINE, EMBEDDING_MODEL
os.environ["SENTENCE_TRANSFORMERS_HOME"] = SENTENCE_TRANSFORMERS_HOME
os.environ["HF_ENDPOINT"] = HF_ENDPOINT
# 强制开启离线模式，设置为 "1" 或 "true" 会禁止任何网络请求，直接读本地
os.environ["HF_HUB_OFFLINE"] = HF_HUB_OFFLINE
os.makedirs(SENTENCE_TRANSFORMERS_HOME, exist_ok=True)
import chromadb
import chromadb.utils.embedding_functions as embedding_functions
import logging

logger = logging.getLogger(__name__)


logger.info(f"初始化 EmbeddingFunction，使用模型: {EMBEDDING_MODEL}")
custom_ef = embedding_functions.SentenceTransformerEmbeddingFunction( # type: ignore
    model_name = EMBEDDING_MODEL
)
os.makedirs(DB_FOLDER, exist_ok=True)
client = chromadb.PersistentClient(path = DB_FOLDER)
# 使用 type: ignore 来绕过类型检查问题（这是 chromadb 库的已知类型问题）
collection_text = client.get_or_create_collection(name = DB_NAME, embedding_function = custom_ef) # type: ignore
# collection_img = client.get_or_create_collection(name = "image_test")

def upsert_documents(id :str, document :str, metadata):

    collection_text.upsert(ids = [id], documents = [document], metadatas = [metadata])
    logger.info(f"{id}添加成功")

    return


def update_metadata(id: str, metadata):

    collection_text.update(ids = [id], metadatas = [metadata])
    logger.info(f"{id}的metadata更新成功")

    return

def text_query(text):
    query_result = collection_text.query(
        query_texts = [text],
        include=["metadatas", "documents", "distances"],
        n_results = 5
        )
    return query_result

def delete_documents(id: str):
    collection_text.delete(ids=[id])
    return

def get_id_list() -> set[str]:
    result = collection_text.get(include=[]) 
    all_ids = result["ids"]
    return set(all_ids)

def query_document_by_id(id: str) -> str:
    result = collection_text.get(ids=[id])
    if result == None or result["documents"] == None or result["documents"] == []:
        return ""
    else:
        return result["documents"][0]

def query_metadata_by_id(id: str) -> dict:
    result = collection_text.get(ids=[id])
    if result == None or result["metadatas"] == None or result["metadatas"] == []:
        return {}
    else:
        return dict(result["metadatas"][0])

def query_all_by_id(id: str) -> dict:
    result = collection_text.get(ids=[id])
    if result == None or len(result["ids"]) == 0 or result["documents"] == None or result["metadatas"] == None:
        return {}
    else:
        return {"id": id,
                "document": result["documents"][0],
                "metadata": result["metadatas"][0]
        }