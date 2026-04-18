#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam
from openai import APIConnectionError, APITimeoutError, AuthenticationError,  APIStatusError
from PIL import Image
from config import LLM_API_URL, LLM_API_KEY, LLM_MODEL, LLM_SYSTEM_MESSAGE, IMG_MAX_BYTES_BASE64, IMG_MAX_HEIGHT, IMG_MAX_WIDTH, LLM_TIMEOUT, ACCEPTED_MIME_TYPE, UPLOAD_FOLDER
from sdt_check_duplication import encode_dedup_image, add_dedup_entry
import sdt_check_duplication
import base64
import io
import os
import shutil
import aiofiles
import uuid
import yaml
from yaml import YAMLError
import time
import re
import logging

# openai模块会在DEBUG级别记录http请求信息（包含base64的图片），日志阅读体验极差
# 所以openai模块强制使用INFO级别
openai_logger = logging.getLogger("openai")
openai_logger.setLevel(logging.INFO)

logger = logging.getLogger(__name__)

def encode_image(content) -> str:
    return base64.b64encode(content).decode("utf-8")
    
    
def detect_image_type(content) -> str:
    """
    通过读取文件头字节检测图片的 MIME 类型
    支持：png, jpeg, webp, gif, bmp, tiff, jxl, heic, avif 等
    """
    header = content[:64]  # 读取前64字节以支持更复杂的检测
    
    if len(header) < 4:
        return "unknown"
    
    # PNG: 89 50 4E 47 0D 0A 1A 0A
    elif header[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    
    # JPEG: FF D8 FF
    elif header[:3] == b'\xff\xd8\xff':
        return "image/jpeg"
    
    # GIF: 47 49 46 38 (GIF8)
    elif header[:4] == b'GIF8':
        # 大模型暂不支持此格式
        return "image/gif"
    
    # BMP: 42 4D (BM)
    elif header[:2] == b'BM':
        return "image/bmp"
    
    # TIFF: 49 49 2A 00 (小端) 或 4D 4D 00 2A (大端)
    elif header[:4] == b'II\x2a\x00':
        return "image/tiff"
    elif header[:4] == b'MM\x00\x2a':
        return "image/tiff"
    
    # WebP: 52 49 46 46 ... 57 45 42 50 (RIFF....WEBP)
    elif header[:4] == b'RIFF' and len(header) >= 12 and header[8:12] == b'WEBP':
        return "image/webp"
    
    # JPEG XL: 00 00 00 0C 4A 58 4C 20 0D 0A 87 0A 或 FF 0A
    elif header[:12] == b'\x00\x00\x00\x0cJXL \r\n\x87\n':
        # 大模型暂不支持此格式
        return "image/jxl"
    elif header[:2] == b'\xff\x0a':
        # 大模型暂不支持此格式
        return "image/jxl"
    
    # HEIC/HEIF/AVIF: 检查 ftyp 标识 (ISO Base Media File Format)
    elif header[4:8] == b'ftyp' and len(header) >= 12:
        brand = header[8:12]
        if brand in (b'heic', b'heix', b'heim', b'hevc', b'mif1'):
            return "image/heic"
        if brand in (b'avif', b'avis'):
            # 大模型暂不支持此格式
            return "image/avif"
    
    return "unknown"


def image_resolution_ok(content, file_name) -> bool:
    # 检查图片分辨率
    try:
        img = Image.open(io.BytesIO(content))
        # 保证height为短边，width为长边
        height, width = sorted(img.size)
        if width > IMG_MAX_WIDTH or height >= IMG_MAX_HEIGHT:
            logger.warning(f"{file_name}分辨率过大：{width}x{height}，要求小于 {IMG_MAX_WIDTH}x{IMG_MAX_HEIGHT}")
            return False
    except Exception as e:
        logger.warning(f"{file_name}无法读取图片分辨率：{e}")
        return False
    
    return True


def make_image_url(content, file_name) -> str:
    image_type = detect_image_type(content)
    if image_type not in ACCEPTED_MIME_TYPE:
        logger.warning(f"{file_name}:图片类型错误")
        return ""
    elif not image_resolution_ok(content, file_name):
        return ""
    else:
        base64_image = encode_image(content)
        result = f"data:{image_type};base64,{base64_image}"
        if len(result) > IMG_MAX_BYTES_BASE64:
            logger.warning(f"{file_name}base64编码后尺寸过大")
            return ""
        else:
            return result


async def ask_llm(llm_messages) -> str:

    client = AsyncOpenAI(
        api_key = LLM_API_KEY,
        base_url = LLM_API_URL,
        timeout = LLM_TIMEOUT,
        max_retries = 0
    )
    logger.info("ask_llm输出中")
    try:
        completion = await client.chat.completions.create(
            model = LLM_MODEL,
            messages = llm_messages
        )

        # 记录token消耗
        usage = completion.usage
        if usage is not None:
            logger.info(f"Prompt Tokens: {usage.prompt_tokens}, Completion Tokens: {usage.completion_tokens}, Total Tokens: {usage.total_tokens}")

        # 获取模型回复
        response_text = completion.choices[0].message.content

        if response_text == None:
            logger.warning("ask_llm输出为空，请检查")
            return ""
        else:
            logger.info("ask_llm输出完成")
            return response_text
    except AuthenticationError as e:
        logger.error(f"认证失败：请检查 API_KEY 和 API_URL 配置是否正确")
        logger.debug(f"认证失败错误详情：{e}")
        return ""

    except APITimeoutError as e:
        logger.error(f"请求超时：大模型响应超时，请尝试重试或检查服务状态")
        logger.debug(f"请求超时错误详情：{e}")
        return ""

    except APIConnectionError as e:
        logger.error(f"网络连接失败：请检查网络连接或服务是否可用")
        logger.debug(f"网络连接失败错误详情：{e}")
        return ""
        
    except APIStatusError as e:
        logger.error(f"API错误,服务器返回错误状态：{e.status_code}")
        logger.debug(f"API错误错误详情：{e}")
        return ""
        
    except Exception as e:
        logger.error(f"未知错误：{type(e).__name__}")
        logger.debug(f"错误详情：{e}")
        return ""
    

def clean_markdown_tags(content: str) -> str:
    """
    清理 AI 生成的 Markdown 代码块标签，返回纯 YAML 内容
    支持格式：
    - ```yaml\n内容\n```
    - ```yml\n内容\n```
    - ```\n内容\n```
    """
    # 匹配 ```yaml 或 ```yml 或 ``` 开头的代码块
    pattern = r'^```(?:yaml|yml)?\s*\n(.*?)\n```$'
    match = re.search(pattern, content, re.DOTALL | re.IGNORECASE | re.MULTILINE)
    
    if match:
        # 如果找到代码块，提取其中的内容
        return match.group(1).strip()
    else:
        # 如果没有代码块标记，直接返回原内容
        return content.strip()
    

def read_yaml(id: str, document: str, former_metadata) -> dict:
    result :dict = {
        "add_id": "",
        "add_document": "", 
        "add_metadata": {}
        }
    
    add_metadata = {}

    # 清理ai产生的markdown标签
    document= clean_markdown_tags(document)

    yaml_result = {}
    try:
        yaml_result = yaml.safe_load(document)
        add_metadata["tags"] = yaml_result["tags"]
        add_metadata["file_names"] = former_metadata["file_names"]
        time_stamp = time.time()
        add_metadata["modification_time"] = time_stamp
        if "creation_time" not in former_metadata:
            add_metadata["creation_time"] = time_stamp
        else:
            add_metadata["creation_time"] = former_metadata["creation_time"]
        if "nsfw" in yaml_result["tags"] or "NSFW" in yaml_result["tags"] or "维系" in yaml_result["tags"]:
            add_metadata["sensitive"] = True
        else:
            add_metadata["sensitive"] = False
        if former_metadata.get("source") != "" and former_metadata.get("source") != None:
            add_metadata["source"] = former_metadata["source"]
    except (TypeError, KeyError) as e:
        logger.error(f"yaml读取错误")
        logger.debug(f"llm_result内容:{document}")
        logger.debug(f"yaml_result内容:{yaml_result}")
        logger.debug(f"{e}")
    except YAMLError as e:
        logger.error("yaml解析错误")
        logger.debug(f"llm_result内容:{document}")
        logger.debug(f"{e}")
    else:
        result["add_id"] = id
        result["add_document"] = document
        result["add_metadata"] = add_metadata
        logger.info("成功读取yaml")
        logger.debug(f"{repr(result)}")
    return result


async def llm_create_yaml_without_save(id: str, text: str, former_result: dict) -> dict:
    # /second-chance接口用
    llm_messages: list[ChatCompletionMessageParam] = [{"role": "system", "content": LLM_SYSTEM_MESSAGE}]
    result :dict = {
        "add_id": "",
        "add_document": "", 
        "add_metadata": {}
        }

    # 生成上一次与大语言模型的聊天记录
    # 添加首次上传的素材
    for file_name in former_result["metadata"]["file_names"]:
        async with aiofiles.open(os.path.join(UPLOAD_FOLDER, id, file_name), "rb") as f:
            content = await f.read()

        image_url :str = make_image_url(content, file_name)

        if image_url == "":
            return result

        llm_messages.append({
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": image_url}
                }
            ]
        })
    # 添加大语言模型的回复
    llm_messages.append({
        "role": "assistant",
        "content": former_result["document"]
    })
    # 添加本次用户的修改建议
    llm_messages.append({
        "role": "user",
        "content": text
    })

    llm_result :str = await ask_llm(llm_messages)
    
    if llm_result == "":
        return result
    
    result = read_yaml(id, llm_result, former_result["metadata"])

    return result



async def llm_create_yaml_and_save(user_files) -> dict:
    # add接口用
    llm_messages: list[ChatCompletionMessageParam] = [{"role": "system", "content": LLM_SYSTEM_MESSAGE}]
    result :dict = {
        "add_id": "",
        "add_document": "", 
        "add_metadata": {}
        }
    add_metadata = {}
    file_name_list :list[str] = []

    folder_name = str(uuid.uuid7().hex)
    os.makedirs(os.path.join(UPLOAD_FOLDER, folder_name))
    
    try: 
        for file in user_files:

            content = await file.read()
            file_name = file.filename

            image_url :str = make_image_url(content, file_name)

            if image_url == "":
                return result

            llm_messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": image_url}
                    }
                ]
            })

            file_extension = detect_image_type(content).split('/')[1]
            file_name = str(uuid.uuid7().hex) + '.' + file_extension
            file_name_list.append(file_name)
            full_file_path = os.path.join(UPLOAD_FOLDER, folder_name, file_name)

            async with aiofiles.open(full_file_path, "wb") as f:
                await f.write(content)

            await add_dedup_entry(folder_name + '/' + file_name, await encode_dedup_image(full_file_path))

            logger.info(f"存储素材：{folder_name}/{file_name}")

        llm_result :str = await ask_llm(llm_messages)

        if llm_result == "":
            return result
        
        add_metadata["file_names"] = file_name_list
        result = read_yaml(folder_name, llm_result, add_metadata)
        
        return result
    
    except Exception as e:
        logger.info("大模型返回结果错误，清理已创建的文件夹")
        logger.debug(e)
        # 失败时清理已创建的文件夹和dedup数据
        to_delete = [folder_name + '/' + item for item in file_name_list]
        await sdt_check_duplication.delete_dedup_entries(to_delete)
        await delete_id_folder(folder_name)
        return result

    finally:
        # 如果 result 为空，也需要清理文件夹
        if result["add_id"] == "" and os.path.isdir(os.path.join(UPLOAD_FOLDER, folder_name)):
            logger.info("大模型返回结果错误，清理已创建的文件夹")
            to_delete = [folder_name + '/' + item for item in file_name_list]
            await sdt_check_duplication.delete_dedup_entries(to_delete)
            await delete_id_folder(folder_name)


async def delete_id_folder(id: str):
    to_be_removed_path = os.path.join(UPLOAD_FOLDER, id)
    try:
        if os.path.isdir(to_be_removed_path):
            # 处理文件夹
            shutil.rmtree(to_be_removed_path)
        elif os.path.isfile(to_be_removed_path):
            # 处理文件
            os.remove(to_be_removed_path)
        elif not os.path.exists(to_be_removed_path):
            logger.info(f"已忽略不存在的待删除文件:{to_be_removed_path}")
        else:
            # 既不是文件也不是目录（例如坏掉的符号链接）
            os.remove(to_be_removed_path)
    except Exception as e:
        logger.error(f"删除{to_be_removed_path}发生未知错误: {e}")

async def get_uploads_list() -> set[str]:
    return set(os.listdir(UPLOAD_FOLDER))