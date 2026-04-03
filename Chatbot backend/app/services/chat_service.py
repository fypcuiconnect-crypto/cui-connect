import asyncio
import json
import logging
import uuid
from typing import List, Optional, AsyncGenerator, Dict, Any, TypedDict
from langchain_core.documents import Document
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

# Import Database
import app.core.database as db
from app.core.config import settings

logger = logging.getLogger(__name__)

# --- State Definition ---
class GraphState(TypedDict):
    question: str
    thread_id: str
    chat_summary: str      
    chat_history_recent: str 
    retrieved_docs: List[Document]
    compressed_context: str
    language: str  # ✅ NEW: Stores the detected language

# --- Helper: Sync Groq Call for Nodes ---
def run_groq_sync(model: str, system: str, user: str) -> str:
    """Helper for non-streaming Groq calls inside Graph Nodes"""
    if not db.groq_client:
        logger.warning("⚠️ Groq Client not initialized")
        return ""
    try:
        completion = db.groq_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ],
            temperature=0.1
        )
        return completion.choices[0].message.content
    except Exception as e:
        logger.error(f"❌ Groq Sync Error: {e}")
        return ""

# --- Graph Nodes ---
def simple_retrieval(state: GraphState) -> Dict[str, Any]:
    logger.info("🔍 [Node] Retrieval (Native Qdrant Mode)")
    if not db.retriever:
        return {"retrieved_docs": []}
    try:
        # ✅ NEW: Translate the query to English for better vector search accuracy
        logger.info("🌐 Translating query to English for vector search...")
        english_query = run_groq_sync(
            model=settings.MODEL_FAST,
            system=(
                "Translate the user's input into standard English to be used for a database search query. "
                "Only output the translated English text, nothing else. If it is already in English, just return the exact same text."
            ),
            user=f"Text: {state['question']}"
        ).strip()
        
        search_query = english_query if english_query else state["question"]
        logger.info(f"   -> Search Query: {search_query}")

        # Use the translated query for embedding
        query_vector = db.retriever.vectorstore.embeddings.embed_query(search_query)
        q_client = db.retriever.vectorstore.client
        
        try:
            search_results = q_client.query_points(
                collection_name="cui_rag_collection",
                query=query_vector,
                limit=10
            ).points
        except AttributeError:
            search_results = q_client.search(
                collection_name="cui_rag_collection",
                query_vector=query_vector,
                limit=10
            )

        deduped = []
        seen = set()
        for hit in search_results:
            payload = hit.payload or {}
            chunk_text = f"Dataset Query: {payload.get('query', '')}\nDataset Answer: {payload.get('completion', '')}"
            
            sig = hash(chunk_text)
            if sig not in seen:
                seen.add(sig)
                deduped.append(Document(page_content=chunk_text, metadata=payload))

        return {"retrieved_docs": deduped}
    except Exception as e:
        logger.error(f"Retrieval failed: {e}")
        return {"retrieved_docs": []}

def detect_language(state: GraphState) -> Dict[str, Any]:
    """✅ NEW NODE: Detects if the user is speaking English, Roman Urdu, or Urdu script"""
    logger.info("🗣️ [Node] Language Detection")
    detected = run_groq_sync(
        model=settings.MODEL_FAST,
        system=(
            "You are a strict language detector. Analyze the text and reply with EXACTLY ONE of these three labels:\n"
            "1. 'English' (if standard English)\n"
            "2. 'Roman Urdu' (if Urdu written in English alphabet, e.g., 'kya haal hai')\n"
            "3. 'Urdu Script' (if written in native Urdu letters, e.g., 'کیا حال ہے')\n"
            "Do not output any other words."
        ),
        user=f"Text: {state['question']}"
    )
    # Default to English if the model gets confused
    lang = detected.strip() if detected else "English"
    logger.info(f"   -> Detected Language: {lang}")
    return {"language": lang}
    
def batch_compress(state: GraphState) -> Dict[str, Any]:
    """✅ UPDATED NODE: Safely compresses context using Bullet Point Extraction to prevent data loss"""
    logger.info("⚖️ [Node] Compression (Safe Fact Extraction)")
    if not state["retrieved_docs"]:
        return {"compressed_context": "No relevant documents."}

    raw_context = "\n\n---\n\n".join([d.page_content for d in state["retrieved_docs"]])
    
    system_prompt = (
        "You are a precise data extractor. Read the provided Context and extract all information relevant to the User's Question.\n"
        "CRITICAL RULES:\n"
        "1. Extract the facts as concise bullet points to save space.\n"
        "2. NEVER delete or summarize lists. If there is a list of programs, rules, or items, copy them verbatim.\n"
        "3. Preserve all specific names, numbers, dates, and locations exactly as written.\n"
        "4. Do not include conversational filler."
    )
    
    compressed = run_groq_sync(
        model=settings.MODEL_FAST,
        system=system_prompt,
        user=f"Question: {state['question']}\n\nContext:\n{raw_context}"
    )
    
    return {"compressed_context": compressed if compressed else raw_context}

def history_management(state: GraphState) -> Dict[str, Any]:
    logger.info("🗄️ [Node] History")
    
    current_summary = "No previous summary."
    if db.supabase:
        try:
            res = db.supabase.table("chats").select("summary").eq("id", state["thread_id"]).single().execute()
            if res.data: current_summary = res.data.get("summary") or "No previous summary."
        except: pass

    active_msgs = []
    if db.supabase:
        try:
            res = db.supabase.table("messages").select("*")\
                .eq("chat_id", state["thread_id"]).eq("is_summarized", False)\
                .order("created_at", desc=False).execute()
            active_msgs = res.data or []
        except: pass

    if len(active_msgs) > 10:
        msgs_to_summarize = active_msgs[:5]
        msgs_to_keep = active_msgs[5:]
        text_chunk = "\n".join([f"{m['role']}: {m['content']}" for m in msgs_to_summarize])
        
        new_summary = run_groq_sync(
            model=settings.MODEL_FAST,
            system="Update the summary with these new lines. Preserve key facts.",
            user=f"Current Summary:\n{current_summary}\n\nNew Lines:\n{text_chunk}"
        )

        if new_summary and db.supabase:
            current_summary = new_summary
            ids = [m['id'] for m in msgs_to_summarize]
            try:
                db.supabase.rpc("update_chat_summary_atomic", {
                    "p_chat_id": state["thread_id"],
                    "p_new_summary": current_summary,
                    "p_msg_ids": ids
                }).execute()
            except Exception as e:
                logger.error(f"RPC Error: {e}")

        formatted_recent = [f"{'Human' if m['role']=='user' else 'AI'}: {m['content']}" for m in msgs_to_keep]
    else:
        formatted_recent = [f"{'Human' if m['role']=='user' else 'AI'}: {m['content']}" for m in active_msgs]

    return {
        "chat_summary": current_summary,
        "chat_history_recent": "\n".join(formatted_recent)
    }

# --- Graph Setup ---
workflow = StateGraph(GraphState)
workflow.add_node("retrieve", simple_retrieval)
workflow.add_node("compress", batch_compress)
workflow.add_node("detect_language", detect_language) # ✅ Added to Graph
workflow.add_node("history", history_management)

workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "compress")
workflow.add_edge("compress", "detect_language")       # ✅ Flow updated
workflow.add_edge("detect_language", "history")        # ✅ Flow updated
workflow.add_edge("history", END)
app_graph = workflow.compile(checkpointer=MemorySaver())

# --- Service Class ---
class ChatService:
    
    @staticmethod
    def _build_system_instruction(detected_language: str) -> str:
        """✅ Helper to generate the strict prompt dynamically based on the language node"""
        return (
            "You are the official, helpful AI assistant for COMSATS University Islamabad (CUI), Attock Campus. Your name is CUIConnectBot.\n"
            "Your primary task is to answer user queries accurately using ONLY the provided 'Context', 'Long-Term Summary', and 'Recent History'.\n\n"
            
            f"### 🌍 STRICT LANGUAGE ENFORCEMENT: [TARGET = {detected_language}]\n"
            f"You MUST generate your entire response in {detected_language}. Do not use any other language.\n"
            "- If the target is English, use professional English.\n"
            "- If the target is Roman Urdu, use Roman Urdu (e.g., 'Admission kab open honge?').\n"
            "- If the target is Urdu Script, use native Urdu letters (e.g., 'یونیورسٹی کہاں واقع ہے؟').\n\n"
            
            "### 🛑 ACCURACY & RAG RULES:\n"
            "- Ground your answers strictly in the provided Context.\n"
            "- If the answer is not in the Context, politely say: 'I do not have enough information to answer that.' (Translate this phrase into the target language).\n"
            "- Never mention that you are reading from a 'context' or 'database'."
        )

    @staticmethod
    async def process_message_stream(user_id: str, message: str, thread_id: str = None) -> AsyncGenerator[str, None]:
        if not db.supabase or not db.groq_client:
            yield f"data: {json.dumps({'error': 'System unavailable'})}\n\n"
            return

        try:
            if not thread_id:
                short_id = str(uuid.uuid4())[:8]
                unique_title = f"{message[:30]}..." if len(message) > 30 else message
                final_title = f"{unique_title} ({short_id})"

                res = await asyncio.to_thread(
                    db.supabase.table("chats").insert({
                        "user_id": user_id, 
                        "title": final_title 
                    }).execute
                )
                if not res.data:
                    raise Exception("Failed to create chat row")
                thread_id = res.data[0]["id"]
            
            await asyncio.to_thread(
                db.supabase.table("messages").insert({
                    "chat_id": thread_id, "role": "user", "content": message
                }).execute
            )
        except Exception as e:
            logger.error(f"❌ DB Init Error: {e}")
            yield f"data: {json.dumps({'error': f'DB Error: {str(e)}'})}\n\n"
            return

        config = {"configurable": {"thread_id": thread_id}}
        try:
            state = await asyncio.to_thread(app_graph.invoke, {"question": message, "thread_id": thread_id}, config)
        except Exception as e:
            logger.error(f"Graph Error: {e}")
            state = {"chat_summary": "", "chat_history_recent": "", "compressed_context": "", "language": "English"}

        # ✅ Dynamically fetch the system prompt based on detected language
        system_instruction = ChatService._build_system_instruction(state.get("language", "English"))
        
        user_content = (
            f"Summary: {state.get('chat_summary')}\nHistory: {state.get('chat_history_recent')}\n"
            f"Context: {state.get('compressed_context')}\nQuestion: {message}"
        )

        full_response = ""
        try:
            stream = await asyncio.to_thread(
                db.groq_client.chat.completions.create,
                model=settings.MODEL_PRO,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": user_content}
                ],
                stream=True
            )

            for chunk in stream:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    yield f"data: {json.dumps({'content': content, 'thread_id': thread_id})}\n\n"
                    await asyncio.sleep(0)

        except Exception as e:
            logger.critical(f"Streaming Error: {e}")
            yield f"data: {json.dumps({'error': f'AI Error: {str(e)}'})}\n\n"
            
        finally:
            if full_response:
                try:
                    await asyncio.to_thread(
                        db.supabase.table("messages").insert({
                            "chat_id": thread_id, "role": "assistant", "content": full_response
                        }).execute
                    )
                except: pass
            yield "data: [DONE]\n\n"

    @staticmethod
    async def edit_message_stream(user_id: str, message_id: str, new_content: str) -> AsyncGenerator[str, None]:
        if not db.supabase or not db.groq_client:
            yield f"data: {json.dumps({'error': 'System unavailable'})}\n\n"
            return
            
        try:
            msg_res = await asyncio.to_thread(
                db.supabase.table("messages").select("*").eq("id", message_id).single().execute
            )
            if not msg_res.data:
                yield f"data: {json.dumps({'error': 'Message not found'})}\n\n"
                return
            
            original_msg = msg_res.data
            thread_id = original_msg['chat_id']
            created_at = original_msg['created_at']
            
            future_msgs = await asyncio.to_thread(
                db.supabase.table("messages").select("id").eq("chat_id", thread_id).gt("created_at", created_at).execute
            )
            
            ids_to_delete = [m['id'] for m in future_msgs.data]
            if ids_to_delete:
                await asyncio.to_thread(
                    db.supabase.table("messages").delete(count="exact").in_("id", ids_to_delete).execute
                )

            await asyncio.to_thread(
                db.supabase.table("messages").update({"content": new_content, "is_summarized": False}).eq("id", message_id).execute
            )
            
            await asyncio.to_thread(db.supabase.table("chats").update({"summary": ""}).eq("id", thread_id).execute)
            
        except Exception as e:
            logger.error(f"Edit DB Error: {e}")
            yield f"data: {json.dumps({'error': f'Database error: {str(e)}'})}\n\n"
            return

        config = {"configurable": {"thread_id": thread_id}}
        try:
            state = await asyncio.to_thread(app_graph.invoke, {"question": new_content, "thread_id": thread_id}, config)
        except Exception as e:
             logger.error(f"Graph Error: {e}")
             state = {"chat_summary": "", "chat_history_recent": "", "compressed_context": "", "language": "English"}

        # ✅ FIXED: Now uses the EXACT SAME strict language instructions for edited messages!
        system_instruction = ChatService._build_system_instruction(state.get("language", "English"))
        
        user_content = (
            f"Summary: {state.get('chat_summary')}\nHistory: {state.get('chat_history_recent')}\n"
            f"Context: {state.get('compressed_context')}\nQuestion: {new_content}"
        )

        full_response = ""
        try:
            stream = await asyncio.to_thread(
                db.groq_client.chat.completions.create,
                model=settings.MODEL_PRO,
                messages=[
                    {"role": "system", "content": system_instruction}, 
                    {"role": "user", "content": user_content}
                ],
                stream=True
            )

            for chunk in stream:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    yield f"data: {json.dumps({'content': content, 'thread_id': thread_id})}\n\n"
                    await asyncio.sleep(0)
        except Exception as e:
             logger.error(f"AI Stream Error: {e}")
             yield f"data: {json.dumps({'error': f'AI Error: {str(e)}'})}\n\n"

        if full_response:
             try:
                await asyncio.to_thread(
                    db.supabase.table("messages").insert({
                        "chat_id": thread_id, "role": "assistant", "content": full_response
                    }).execute
                )
             except Exception as e:
                logger.error(f"Save AI Response Error: {e}")
                
        yield "data: [DONE]\n\n"

    # --- Frontend APIs ---

    @staticmethod
    async def get_user_chats(user_id: str) -> List[dict]:
        try:
            if not db.supabase: return []
            res = await asyncio.to_thread(
                db.supabase.table("chats").select("id, title, created_at")\
                    .eq("user_id", user_id).order("created_at", desc=True).execute
            )
            return res.data or []
        except: return []

    @staticmethod
    async def get_chat_history(user_id: str, thread_id: str) -> Optional[List[dict]]:
        try:
            if not db.supabase: return []
            res = await asyncio.to_thread(
                db.supabase.table("messages").select("*")\
                    .eq("chat_id", thread_id).order("created_at", desc=False).execute
            )
            return res.data or []
        except: return []

    @staticmethod
    async def delete_chat(user_id: str, thread_id: str) -> bool:
        try:
            if not db.supabase: return False
            res = await asyncio.to_thread(
                db.supabase.table("chats").delete(count="exact").eq("id", thread_id).eq("user_id", user_id).execute
            )
            # 🔍 ADD THIS LOG
            print(f"SUPABASE DEBUG: Trying to delete {thread_id} for user {user_id}. Count found: {res.count}")

            return res.count is not None and res.count > 0
        except Exception as e: 
            logger.error(f"Delete Chat Error: {e}")
            return False

    @staticmethod
    async def rename_chat(user_id: str, thread_id: str, new_title: str) -> Optional[dict]:
        try:
            if not db.supabase: return None
            res = await asyncio.to_thread(
                db.supabase.table("chats").update({"title": new_title}).eq("id", thread_id).eq("user_id", user_id).execute
            )
            if res.data and len(res.data) > 0:
                return res.data[0]
            
            refresh = await asyncio.to_thread(
                 db.supabase.table("chats").select("id, title, created_at").eq("id", thread_id).eq("user_id", user_id).execute
            )
            return refresh.data[0] if refresh.data else None
        except Exception as e: 
            logger.error(f"Rename Chat Error: {e}")
            return None