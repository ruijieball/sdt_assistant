#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
沙雕图小助理 - FastAPI 入口
"""


import asyncio
import logging
from fastapi import FastAPI, UploadFile, HTTPException, Depends, Request, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from typing import Annotated
import uvicorn
from config import APP_TITLE, APP_DESCRIPTION, APP_VERSION, MAX_FILE_QUANTITY, IMG_MAX_BYTES, ACCEPTED_MIME_TYPE, LLM_TIMEOUT, LOG_FILE, MAX_BODY_SIZE,  UPLOAD_FOLDER
from sdt_llm_and_file import llm_create_yaml_and_save, llm_create_yaml_without_save, get_uploads_list, delete_id_folder, read_yaml
import sdt_chroma
import time
import os


app = FastAPI(
    title = APP_TITLE,
    description = APP_DESCRIPTION,
    version = APP_VERSION,
    # docs_url = None,
    # redoc_url = None
)
app.mount("/static", StaticFiles(directory="static"), name="static")

# 配置模板
templates = Jinja2Templates(directory="templates")

setattr(Request, "max_body_size", MAX_BODY_SIZE)

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


class UpdateParameters(BaseModel):
    id: str = Field(
        description = "需要更新的id"
        )
    document: str = Field(
        description = "需要更新documents信息，若yaml解析失败会返回错误",
        examples = ["description: 这是一个案例的输出（文本格式）\n\nocr: \n  - 举个栗子\n  - 识别到的其他文本1\n  - 识别到的其他文本2\n  - （为文本格式组成的列表）\n\ntags:\n  - 举个例子\n  - 举个栗子\n  - 其他标签1\n  - 其他标签2\n  - （为文本格式组成的列表）"]
        )
    metadata: dict | None = Field(
        default = None, 
        description = "自定义的metadata",
        examples=[{"file_names": "建议为None，系统自动填写，若填写错误会导致程序出错", "tags": ["测试", "示例"]}]
        )
    

class SecondChanceParameters(BaseModel):
    id: str = Field(
        description = "需要更新的id"
        )
    text: str = Field(
        description = "传给大语言模型的修改提示词",
        )


class UpdateResponse(BaseModel):
    result: str = Field(description="操作结果状态")
    process_time: float = Field(description="处理耗时（秒）")


class CommonResponse(BaseModel):
    result: str | list | dict = Field(description="操作结果")
    process_time: float = Field(description="处理耗时（秒）")


class AddResponse(BaseModel):
    result: str = Field(description="操作结果状态")
    add_document: str = Field(description="添加的文档内容")
    process_time: float = Field(description="处理耗时（秒）")


class SearchResponse(BaseModel):
    ids: list = Field(description="匹配的 id 列表，直接返回chromadb的二维数组结果")
    documents: list = Field(description="匹配的文档，直接返回chromadb的二维数组结果")
    distances: list = Field(description="距离分数列表，直接返回chromadb的二维数组结果")
    metadatas: list = Field(description="元数据列表，直接返回chromadb的二维数组结果") 
    process_time: float = Field(description="处理耗时（秒）")


class QueryResponse(BaseModel):
    result: str = Field(description="查询结果详情")
    process_time: float = Field(description="处理耗时（秒）")


async def validate_add_params(
    # user_content: Annotated[str, Form()] | None = None,
    user_files: list[UploadFile] | None = None
):
    '''
    # 检查是否上传参数为空
    if user_files == None and user_content == None:
        raise HTTPException(status_code = 400, detail = "请上传要识别的内容")
    
    # 检查usercontent长度
    if user_content != None and len(user_content) > 500:
        raise HTTPException(status_code = 413, detail = "输入信息过长，请精简需求")
    '''

    '''
    # 检查last_content是否合法
    # last_content和user_files互斥，即上传过图片素材后，不可修改要上传的素材
    from pydantic import TypeAdapter, ValidationError
    from openai.types.chat import ChatCompletionMessageParam
    last_content_validator = TypeAdapter(list[ChatCompletionMessageParam])
    if last_content != None:
        try:
            last_content_json = json.loads(last_content)
            last_content_result = last_content_validator.validate_python(last_content_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code = 400, detail="last_content: 非法json")
        except ValidationError:
            raise HTTPException(status_code = 400, detail="last_content: 数据校验失败")
        # 若last_content已有内容，则丢弃user_files中的内容
        user_files_result = None
    else:
        last_content_result = None
        user_files_result = user_files
    '''
    
    if user_files == None:
        # 检查是否上传素材
        raise HTTPException(status_code = 400, detail = "请上传素材")
        
    else:
        # 检查文件数量
        if len(user_files) > MAX_FILE_QUANTITY:
            raise HTTPException(status_code = 413, detail = f"上传素材数量过多，目前仅支持{MAX_FILE_QUANTITY}个及以下的素材")
        
    for file in user_files:
        # 依次检查每个文件大小和类型，遇到有问题的文件直接停止
        # 由于mutipart/form-data的content-length为总长度，所以如果有多个文件会无法获取大小
        # 所以如果获取不到，就放弃检查

        # 通过http header中的信息初步判断，在上传文件前会再进行magic bytes的判断
        if file.content_type not in ACCEPTED_MIME_TYPE:
            raise HTTPException(status_code = 400, detail = f"文件：{file.filename}格式不支持")
        
        file_size = int(file.headers.get("content-length", -1)) 
        if file_size == -1:
            file_size = file.size
        if file_size != None and file_size > IMG_MAX_BYTES:
            raise HTTPException(status_code = 413, detail = f"文件：{file.filename}需<{IMG_MAX_BYTES}字节，请检查")
    
    return user_files


@app.get("/", response_class=HTMLResponse, summary="前端页面", tags=["Frontend"])
async def root(request: Request):
    """返回前端主页面"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/add", summary = "上传素材并添加到数据库", tags = ["Add"], response_model = AddResponse)
async def llm_chat(params: Annotated[tuple, Depends(validate_add_params)]):
    start_time = time.time()
    logger.info("收到/add请求")

    user_files = params
    try:
        result :dict = await asyncio.wait_for(
            llm_create_yaml_and_save(user_files),
            timeout = LLM_TIMEOUT + 5
        )
        if result.get("add_document") == "" or result.get("add_id") == "":
            raise HTTPException(status_code = 502, detail = "上传出错，请联系管理员检查")
    except asyncio.TimeoutError:
        raise HTTPException(status_code = 504, detail = "操作超时")

    sdt_chroma.upsert_documents(result["add_id"], result["add_document"], result["add_metadata"])
    
    end_time = time.time()
    process_time = end_time - start_time
    logger.info(f"/add/请求处理完成, process_time={process_time}")

    return {"result": "success", 
            "add_document": result["add_document"], 
            "process_time": process_time
            }


@app.get("/search", summary = "通过关键词搜索id", tags = ["Search"], response_model = SearchResponse)
def chroma_query(text: str = Query(description = "搜索关键词")):

    start_time = time.time()

    logger.info("收到请求/search?text={text}")

    result = sdt_chroma.text_query(text)

    end_time = time.time()
    process_time = end_time - start_time
    logger.info(f"/search请求处理完成, process_time={process_time}")
    
    return {
        "ids": result["ids"],
        "documents": result["documents"],
        "distances": result["distances"],
        "metadatas": result["metadatas"],
        "process_time": process_time
        }


@app.post("/second-chance", summary = "通过id和提示词，ai二次生成系统内已有素材的document并保存", tags = ["Add"], response_model = AddResponse)
async def second_chance(para: SecondChanceParameters):
    start_time = time.time()
    logger.info("收到/second-chance请求")

    id = para.id
    text = para.text
    former_result = sdt_chroma.query_all_by_id(id)

    if former_result == {}:
        raise HTTPException(status_code = 400, detail = "id错误请检查")

    try:
        result :dict = await asyncio.wait_for(
            llm_create_yaml_without_save(id, text, former_result),
            timeout = LLM_TIMEOUT + 5
        )
        if result.get("add_document") == "" or result.get("add_id") == "":
            raise HTTPException(status_code = 502, detail = "上传出错，请联系管理员检查")
    except asyncio.TimeoutError:
        raise HTTPException(status_code = 504, detail = "操作超时")
    
    sdt_chroma.upsert_documents(result["add_id"], result["add_document"], result["add_metadata"])

    end_time = time.time()
    process_time = end_time - start_time
    logger.info(f"/status请求处理完成")
    return {"result": "success", 
            "add_document": result["add_document"], 
            "process_time": process_time
            }



@app.get("/prune", summary = "清理未关联的素材和向量数据库", tags = ["System"], response_model = CommonResponse)
async def prune():
    start_time = time.time()

    logger.info("收到/prune请求")

    set_folder_name = await get_uploads_list()
    set_chroma_id = sdt_chroma.get_id_list()

    orphan_documents = set_chroma_id - set_folder_name
    orphan_folders = set_folder_name - set_chroma_id
    logger.debug(f"发现orphan_documents:{repr(orphan_documents)}")
    logger.debug(f"发现orphan_folders:{repr(orphan_folders)}")

    vaild_ids = set.intersection(set_folder_name, set_chroma_id)

    for id in orphan_documents:
        sdt_chroma.delete_documents(id)

    for id in orphan_folders:
        await delete_id_folder(id)

    result = f"清理orphan_documents共{len(orphan_documents)}个,清理orphan_folders共{len(orphan_folders)}个。系统共有条目{len(vaild_ids)}个。"

    end_time = time.time()
    process_time = end_time - start_time
    logger.warning(f"/prune请求处理完成, 清理orphan_documents共{len(orphan_documents)}个,清理orphan_folders共{len(orphan_folders)}个。系统共有条目{len(vaild_ids)}个。process_time={process_time}")
    return {
        "result": result,
        "process_time": process_time
        }


@app.get("/delete", summary = "根据id删除素材", tags = ["System"], response_model = CommonResponse)
async def delete_id(id: str = Query(description = "需要删除的id")):
    start_time = time.time()

    logger.info(f"收到请求/delete?id={id}")

    sdt_chroma.delete_documents(id)
    await delete_id_folder(id)

    end_time = time.time()
    process_time = end_time - start_time
    logger.info(f"/delete请求处理完成,删除{id}, process_time={process_time}")
    return {
        "result": f"删除{id}",
        "process_time": process_time
        }


@app.post("/update", summary = "更新id的document和metadata", tags = ["Add"], response_model=UpdateResponse)
def update_document(para: UpdateParameters):
    start_time = time.time()
    logger.info(f"收到请求/update")

    id = para.id
    document = para.document
    metadata = para.metadata

    if not os.path.isdir(os.path.join(UPLOAD_FOLDER, id)):
        raise HTTPException(status_code = 400, detail = "id错误请检查")

    # metadata更新优先级：用户上传的metadata>chroma数据库内的>默认值空的字典
    add_metadata = {}
    if metadata == None:
        add_metadata = sdt_chroma.query_metadata_by_id(id)
    else:
        add_metadata = metadata
    
    if add_metadata.get("file_names") == None:
        add_metadata["file_names"] = list(os.listdir(os.path.join(UPLOAD_FOLDER, id)))
        
    result = read_yaml(id, document, add_metadata)
    if result.get("add_document") == "" or result.get("add_id") == "":
        raise HTTPException(status_code = 400, detail = "document解析失败请检查")

    sdt_chroma.upsert_documents(result["add_id"], result["add_document"], result["add_metadata"])

    end_time = time.time()
    process_time = end_time - start_time
    logger.info(f"/update请求处理完成, process_time={process_time}")
    return {
        "result": "OK",
        "process_time": process_time
        }


@app.get("/query-id", summary = "通过id返回素材document", tags = ["Search"], response_model = QueryResponse)
def query_id(id: str = Query(description = "需要查询的id")):
    start_time = time.time()
    logger.info(f"收到请求/query-id?id={id}")

    result :str = sdt_chroma.query_document_by_id(id)

    end_time = time.time()
    process_time = end_time - start_time
    logger.info(f"/query-id请求处理完成, process_time={process_time}")
    return {
        "result": result,
        "process_time": process_time
        }


@app.get("/check-duplication", summary = "检查重复素材", tags = ["System"], response_model = CommonResponse)
async def check_duplication():
    start_time = time.time()
    logger.info(f"收到请求/check-duplication")

    end_time = time.time()
    process_time = end_time - start_time
    logger.info(f"/check-duplication请求处理完成, process_time={process_time}")
    return {
        "result": "待开发",
        "process_time": process_time
        }


@app.get("/status", tags = ["System"], response_model = CommonResponse)
async def get_status():
    start_time = time.time()

    end_time = time.time()
    process_time = end_time - start_time
    logger.info(f"/status请求处理完成")
    return {
        "result": "OK",
        "process_time": process_time
        }
    

@app.get("/favicon.ico", tags = ["Frontend"])
async def favicon():
    return FileResponse("static/favicon.ico")


# 添加上传文件访问路由
@app.get("/uploads/{id}/{filename}", summary="访问上传的文件", tags=["Frontend"])
async def get_upload_file(id: str, filename: str):
    """访问上传的图片文件"""
    file_path = os.path.join(UPLOAD_FOLDER, id, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="文件不存在")


if __name__ == '__main__':
    logger.info("http服务启动")
    uvicorn.run(app, host = "127.0.0.1", port = 8283)
