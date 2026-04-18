## 0.1.7（2026.4.18）

### Bug Fixes

- **LLM Pipeline Dedup Cleanup**: Fixed cleanup logic in the LLM document creation pipeline to also remove dedup entries when the model returns errors or empty results, preventing orphaned database records pointing to non-existent folders.

---

## 0.1.6 (2026.4.12)

### Improvements

- **Metadata Update API Enhancement**: Refactored the `/update-metadata` endpoint to use a Pydantic request model (`UpdateMetadataRequest`) instead of query parameters, improving type safety and validation.
- **Robust Metadata Value Handling**: Enhanced parsing logic for metadata values in the `/update-metadata` endpoint:
  - Added proper error handling for boolean conversion of the `sensitive` field.
  - Changed list-type fields (`tags`, `file_names`) to expect native Python lists directly instead of JSON strings, simplifying the client-side payload.
- **LLM Pipeline Stability**: Improved error logging and cleanup logic in the LLM document creation pipeline (`sdt_llm_and_file.py`) to ensure temporary folders are removed even if the result is empty or an exception occurs.
- **Frontend Simplification**: Removed the "📄 查看文档" (View Document) button from image detail modals in both the main search and deduplication views, streamlining the user interface.

---

## 0.1.5 (2026.4.12)

### Improvements

- **ChromaDB Rebuild Script**: Added a `run-rebuild-chromadb` target in the Makefile to facilitate rebuilding the ChromaDB vector database, useful after schema or metadata changes.

---

## 0.1.4 (2026.4.11)

### New Features

- **Safe Search**: Added safe search functionality to filter out sensitive content in search results. A toggle switch is available on the search page.
- **Metadata Update API**: Introduced a new `/update-metadata` endpoint to allow updating specific metadata fields (`creation_time`, `modification_time`, `sensitive`, `tags`, `file_names`, `source`) for any given ID.

### Improvements

- **Metadata Standardization**: Standardized metadata keys from `creation time`/`modification time` to `creation_time`/`modification_time` for consistency.
- **Automatic Sensitive Tagging**: Automatically sets the `sensitive` metadata flag to `true` if AI-generated tags contain "nsfw", "NSFW", or "维系".
- **Robust Error Handling**: Enhanced error handling in the LLM processing pipeline to clean up orphaned upload folders on failure or empty results.
- **Null Safety**: Added null checks in the `/search` endpoint to prevent crashes when ChromaDB returns empty results.
- **Frontend Enhancements**: 
  - Display sensitive content indicators (🔞) across search results, detail modals, deduplication lists, and the image browser.
  - Show the `source` metadata field where applicable in the UI.
- **Bug Fixes**: Corrected a typo from "unknow" to "unknown" in image type detection.

---

## 0.1.3 (2026.4.11)

### New Features

- **View Images**: Added new page to view all uploaded images in one place

---

## 0.1.2 (2026.4.9)

### New Features

**Image Deduplication**
- Detect and clean up duplicate/similar images to save storage space

---

## 0.1.1 (2026.4.3)

### Improvements

- **Makefile**: Fixed log display to show correct timezone
- **Documentation**: Improved README documentation
- **AI Prompts**: Optimized AI prompt templates for better content recognition

---

## 0.1.0 (2026.4.2)

Initial Release

### New Features

**Meme Image Management**
- Upload meme images with AI-powered content recognition and auto-generated descriptions
- Batch upload support (up to 5 images) with real-time preview
- Semantic search for meme images by keywords
- AI second-chance optimization to regenerate descriptions for existing images
- Manually update image descriptions and tags
- Query or delete images by ID

**System Management**
- Clean up orphaned data and folders
- System health status check

**Frontend Pages**
- Add Images: Drag-and-drop upload, preview, one-click recognition
- Search: Keyword search with results display
- Second Chance: Re-recognition with ID and custom prompts
- Image Preview Modal: View full-size images and details
