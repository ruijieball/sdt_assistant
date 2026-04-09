#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import pickle
import logging
from config import DEDUP_FILE, UPLOAD_FOLDER, MAX_DISTANCE_THRESHOLD
import aiofiles
import asyncio
from imagededup.methods import PHash

logger = logging.getLogger(__name__)

async def read_pkl() -> dict | None:
    try:
        async with aiofiles.open(DEDUP_FILE, 'rb') as f:
            data:dict = pickle.loads(await f.read())
    except FileNotFoundError:
        return None
    except Exception as e:
        logger.warning(f"Error reading dedup data: {e}")
        return None
    return data


async def write_pkl(data: dict):
    async with aiofiles.open(DEDUP_FILE, 'wb') as f:
        await f.write(pickle.dumps(data))


async def add_dedup_entry(file_name: str, image_hash: str):
    data = await read_pkl() or {}
    data[file_name] = image_hash
    await write_pkl(data)


async def delete_dedup_entries(file_name_list: list[str]):
    data = await read_pkl() or {}
    change_flag = False
    for file_name in file_name_list:
        if file_name in data:
            del data[file_name]
            change_flag = True
    if change_flag:
        await write_pkl(data)

'''
def get_dedup_entry(file_name: str) -> str | None:
    data = await read_pkl() or {}
    return data.get(file_name)
'''

async def get_dedup_list() -> list:
    data = await read_pkl() or {}
    return list(data.keys())


async def encode_all_dedup_images():
    start = asyncio.get_event_loop().time()
    phasher = PHash()
    image_hash = await asyncio.to_thread(
        phasher.encode_images,
        image_dir=UPLOAD_FOLDER,
        recursive=True
    )
    await write_pkl(image_hash)
    elapsed = asyncio.get_event_loop().time() - start
    logger.info(f"encode_all_dedup_images耗时: {elapsed:.2f}秒")


async def encode_dedup_image(file_path) -> str:
    start = asyncio.get_event_loop().time()
    phasher = PHash()
    image_hash = await asyncio.to_thread(phasher.encode_image, image_file = file_path)
    elapsed = asyncio.get_event_loop().time() - start
    logger.info(f"encode_dedup_image耗时: {elapsed:.2f}秒")
    return image_hash


async def find_duplicate_images() -> dict:
    start = asyncio.get_event_loop().time()
    data = await read_pkl() or {}
    phasher = PHash()
    duplicates = await asyncio.to_thread(
        phasher.find_duplicates,
        encoding_map = data,
        scores = True,
        max_distance_threshold = MAX_DISTANCE_THRESHOLD,
    )
    result : dict = {}
    # 删除空的重复项
    for key in duplicates:
        if duplicates[key] != []:
            result[key] = duplicates[key]
    elapsed = asyncio.get_event_loop().time() - start
    logger.info(f"find_duplicate_images 耗时: {elapsed:.2f}秒")
    return result