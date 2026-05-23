import os
import uuid
import certifi
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Response
from pydantic import BaseModel
import httpx
from typing import Optional, List, Dict, Any

os.environ['SSL_CERT_FILE'] = certifi.where()
from agent_graph import agent_graph
from langchain_core.messages import HumanMessage
from fastapi import WebSocket, WebSocketDisconnect
from websocket_manager import manager
from database.pdf_service import generate_and_upload_report_pdf
from webhook_poller import poller

app = FastAPI(title="NyaySahayak API", description="AI Agentic Legal Assistant", root_path="/apis")

from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
import database.firebase_db as firebase_db
import database.supabase_db as supabase_db
import database.vector_db as vdb
from fastapi.responses import RedirectResponse, StreamingResponse
from io import BytesIO

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://hiringassistant-ai.vercel.app",
        "https://nyaysahayak-gold.vercel.app",
        "https://vps-3965724c.vps.ovh.net",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────
# Startup and Shutdown Events
# ─────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Start the webhook poller when the app starts"""
    import asyncio
    # Run the poller in a background task
    asyncio.create_task(poller.start())
    print("✅ Webhook poller started")

@app.on_event("shutdown")
async def shutdown_event():
    """Stop the webhook poller when the app shuts down"""
    await poller.stop()
    print("✅ Webhook poller stopped")

class UserQuery(BaseModel):
    query: str
    user_id: str
    user_name: Optional[str] = "User"  # Display name for lawyer case forwarding
    location: Optional[dict] = None  # Optional location data {lat: float, lon: float}
    session_history: Optional[List[Dict[str, Any]]] = None  # Last N messages from the chat for context
    session_id: Optional[str] = None  # Session ID for this conversation

class AuthPayload(BaseModel):
    uid: str
    email: str
    role: Optional[str] = None

class ChatHistoryPayload(BaseModel):
    uid: str
    session_id: str
    session_data: List[Dict[str, Any]]

class CasePayload(BaseModel):
    uid: str
    case_id: str
    structured_report: Dict[str, Any]
    session_data: List[Dict[str, Any]]

class CaseCompletionPayload(BaseModel):
    """Payload for saving a completed case with situation summary and Q&A."""
    uid: str
    case_id: str
    session_id: str
    structured_report: Dict[str, Any]
    situation_summary: Dict[str, Any]
    collected_answers: Dict[str, str]
    session_data: List[Dict[str, Any]]
    user_language: str = "english"
    pdf_url: Optional[str] = None
    generate_pdf: bool = True

class CasePDFGenerationPayload(BaseModel):
    """Payload for generating and uploading PDF for a case."""
    case_id: str
    user_id: str
    session_id: Optional[str] = None
    collected_answers: Optional[Dict[str, str]] = None
    structured_report: Optional[Dict[str, Any]] = None

@app.get("/")
async def root():
    return {"message": "Welcome to NyaySahayak API"}

@app.post("/process-query")
async def process_query(user_query: UserQuery):
    """
    Endpoint to process user queries through the agentic flow.
    """
    print(f"\n{'='*50}")
    print(f"🚀 NEW QUERY RECEIVED")
    print(f"User ID: {user_query.user_id}")
    print(f"Query: {user_query.query}")
    if user_query.location:
        print(f"Location: {user_query.location}")
    print(f"{'='*50}\n")
    
    try:
        inputs = {
            "messages": [HumanMessage(content=user_query.query)],
            "user_details": {
                "user_id": user_query.user_id,
                "location": user_query.location,
                "session_id": user_query.session_id,
                "query": user_query.query
            }
        }
        
        # Invoke the graph with thread_id for persistence
        config = {"configurable": {"thread_id": user_query.user_id}}
        result = await agent_graph.ainvoke(inputs, config=config)
        
        final_response = result.get("final_response", "No response generated.")
        
        return {
            "status": "success",
            "query": user_query.query,
            "response": final_response,
            "structured_report": result.get("structured_report"),
            "suggested_actions": result.get("suggested_actions"),
            "trace": [str(m.content) for m in result.get("messages", [])]
        }
    except Exception as e:
        print(f"Error processing query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- New WebSocket Endpoint for Moderators ---

@app.websocket("/ws/moderator")
async def websocket_moderator_endpoint(websocket: WebSocket):
    await manager.connect(websocket, channel="moderator")
    try:
        while True:
            # Keep connection alive parsing incoming text if needed
            # For this MVP, backend just needs to push. Wait for disconnect.
            data = await websocket.receive_text()
            print(f"Received message from moderator frontend: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel="moderator")
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, channel="moderator")

# --- New WebSocket Endpoint for Sahayaks ---

@app.websocket("/ws/sahayak")
async def websocket_sahayak_endpoint(websocket: WebSocket):
    """WebSocket endpoint for sahayak guides to receive new case notifications"""
    await manager.connect(websocket, channel="sahayak")
    try:
        while True:
            # Keep connection alive parsing incoming text if needed
            # For this MVP, backend just needs to push. Wait for disconnect.
            data = await websocket.receive_text()
            print(f"Received message from sahayak frontend: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel="sahayak")
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, channel="sahayak")

# --- Firebase Role Management & Auth Endpoints ---

@app.post("/api/auth/login")
async def auth_login(payload: AuthPayload):
    """
    Called by the frontend after a successful Firebase Auth sign-in to ensure 
    the user record and role exists. Supabase is the primary source of truth;
    Firebase is attempted with a short timeout and silently skipped if unavailable.
    """
    import asyncio

    # ── 1. Resolve existing role with Supabase precedence ──────────────────
    # Supabase is the source of truth; Firebase role can be stale.
    role_from_supabase = None
    role_from_firebase = None

    try:
        role_from_supabase = await run_in_threadpool(supabase_db.get_user_role, payload.uid)
    except Exception:
        pass

    if firebase_db.is_available():
        try:
            role_from_firebase = await asyncio.wait_for(
                run_in_threadpool(firebase_db.get_user_role, payload.uid),
                timeout=3.0
            )
        except (asyncio.TimeoutError, Exception):
            pass

    requested_role = (payload.role or "").strip().lower() or None
    role_priority = {
        "victim": 0,
        "sahayak": 1,
        "guide": 1,
        "nyay_guide": 1,
        "lawyer": 1,
        "moderator": 2,
        "admin": 3,
    }

    def _normalize_role_value(value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        raw = str(value).strip().lower()
        alias_map = {
            "nyay guide": "sahayak",
            "nyay_guide": "sahayak",
            "guide": "sahayak",
        }
        return alias_map.get(raw, raw)

    existing_role_candidates = [
        _normalize_role_value(role_from_supabase),
        _normalize_role_value(role_from_firebase),
    ]
    existing_role_candidates = [r for r in existing_role_candidates if r]
    existing_role = None
    if existing_role_candidates:
        existing_role = max(existing_role_candidates, key=lambda r: role_priority.get(r, 0))

    requested_role = _normalize_role_value(requested_role)

    # ── 3. Determine role and respond ──────────────────────────────────────
    if existing_role:
        normalized_existing = str(existing_role).strip().lower()

        # Default login/refresh path: keep authoritative existing role.
        if requested_role is None or requested_role == "victim" or requested_role == normalized_existing:
            await run_in_threadpool(supabase_db.create_or_update_user, payload.uid, payload.email, normalized_existing)
            return {"status": "success", "role": normalized_existing, "message": "User exists"}

        # Explicit role change request: only allow non-downgrade transitions.
        if role_priority.get(requested_role, 0) >= role_priority.get(normalized_existing, 0):
            await run_in_threadpool(supabase_db.create_or_update_user, payload.uid, payload.email, requested_role)
            if firebase_db.is_available():
                asyncio.create_task(run_in_threadpool(firebase_db.create_user_record, payload.uid, payload.email, requested_role))
            return {"status": "success", "role": requested_role, "message": "User role updated"}

        # Reject downgrade attempts and return current role.
        await run_in_threadpool(supabase_db.create_or_update_user, payload.uid, payload.email, normalized_existing)
        return {"status": "success", "role": normalized_existing, "message": "Role unchanged"}

    # New user or role upgrade
    role_to_save = requested_role or "victim"
    # Supabase write — always done, fast and reliable
    await run_in_threadpool(supabase_db.create_or_update_user, payload.uid, payload.email, role_to_save)

    # Read authoritative role post-upsert. This prevents transient lookup failures
    # from making moderators appear as victims in the login response.
    resolved_role = role_to_save
    try:
        role_after_sync = await run_in_threadpool(supabase_db.get_user_role, payload.uid)
        if role_after_sync:
            resolved_role = role_after_sync
    except Exception:
        pass

    # Firebase write — fire-and-forget in background so it doesn't delay response
    if firebase_db.is_available():
        asyncio.create_task(run_in_threadpool(firebase_db.create_user_record, payload.uid, payload.email, resolved_role))
    return {"status": "success", "role": resolved_role, "message": "User created/updated"}

@app.post("/api/chat/history")
async def sync_chat_history(payload: ChatHistoryPayload):
    """
    Syncs local chat history to Firebase after the victim logs in.
    """
    success = await run_in_threadpool(supabase_db.save_chat_history, payload.uid, payload.session_id, payload.session_data)
    if success:
        return {"status": "success", "message": "Chat history synced"}
    raise HTTPException(status_code=500, detail="Failed to sync chat history")

@app.get("/api/chat/sessions")
async def get_all_chat_sessions(uid: str):
    """
    Retrieves all distinct chat sessions (cases) from Supabase for a given user.
    """
    sessions = await run_in_threadpool(supabase_db.get_all_chat_sessions, uid)
    return {"status": "success", "sessions": sessions}
@app.get("/api/chat/history")
async def get_chat_history(uid: str, session_id: Optional[str] = None):
    """
    Retrieves chat history from Supabase for a given user, optionally filtered by session_id.
    """
    history = await run_in_threadpool(supabase_db.get_chat_history, uid, session_id)
    return {"status": "success", "history": history}

@app.get("/api/scams/nearby")
async def get_nearby_scams(lat: float, lon: float):
    """
    Reverse geocodes coordinates and fetches active local scams across India.
    Returns clustered mock scam data for heatmap visualization.
    """
    from agents.common_utils import get_user_location_context
    
    city, state, loc_str = get_user_location_context({'lat': lat, 'lon': lon})
    
    if city == "Unknown" or city == "India":
        city = "Unknown"
        
    # Fetch mock data from Supabase for all-India heatmap
    mock_scams = await run_in_threadpool(supabase_db.get_all_mock_scams, 1000)
    
    return {
        "status": "success", 
        "city": city,
        "state": state,
        "location_string": loc_str,
        "scams": mock_scams
    }

class TTSPayload(BaseModel):
    text: str
    target_language_code: str = "hi-IN"
    speaker: str = "shubh"
    pace: float = 1.0
    speech_sample_rate: int = 22050
    enable_preprocessing: bool = False
    model: str = "bulbul:v3"
    temperature: float = 0.6
    enable_cached_responses: bool = False
    output_audio_codec: str = "mp3"
    output_audio_bitrate: str = "128k"

@app.post("/api/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language_code: str = Form("unknown"),
):
    """Proxy for Sarvam STT using saaras:v3 model"""
    sarvam_key = os.getenv("SARVAM_API_KEY")
    if not sarvam_key:
        raise HTTPException(status_code=500, detail="SARVAM_API_KEY not configured")
        
    audio_content = await file.read()
    
    print(f"Received audio file {file.filename} of size {len(audio_content)} bytes, language_code={language_code}")
    # Save debug copy
    with open("debug_recording.webm", "wb") as f:
        f.write(audio_content)
    
    async with httpx.AsyncClient() as client:
        files = {"file": (file.filename or "recording.webm", audio_content, file.content_type or "audio/webm")}
        data = {
            "model": "saaras:v3",
            "language_code": language_code,
            "mode": "transcribe",
        }
        
        try:
            response = await client.post(
                "https://api.sarvam.ai/speech-to-text",
                headers={"api-subscription-key": sarvam_key},
                files=files,
                data=data,
                timeout=30.0
            )
        except httpx.RequestError as exc:
            print(f"Failed to reach Sarvam STT payload: {exc}")
            raise HTTPException(status_code=503, detail=f"Service Unavailable: Cannot reach transcription service. ({type(exc).__name__})")
        
        print(f"Sarvam STT Response ({response.status_code}): {response.text}")
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"STT failed: {response.text}")
            
        return response.json()

@app.post("/api/synthesize")
async def synthesize_speech(payload: TTSPayload):
    """Proxy for Sarvam Streaming TTS"""
    sarvam_key = os.getenv("SARVAM_API_KEY")
    if not sarvam_key:
        raise HTTPException(status_code=500, detail="SARVAM_API_KEY not configured")
        
    # We use httpx.AsyncClient streams to proxy the audio stream to the client
    client = httpx.AsyncClient()
    
    async def fetch_stream():
        try:
            async with client.stream(
                "POST", 
                "https://api.sarvam.ai/text-to-speech/stream",
                headers={"api-subscription-key": sarvam_key, "Content-Type": "application/json"},
                json=payload.dict(),
                timeout=30.0
            ) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    print(f"Sarvam Stream TTS Error ({response.status_code}):", error_text.decode('utf-8', errors='ignore'))
                    # Instead of raising HTTPException inside the generator (which fails), we'll yield empty
                    return
                
                async for chunk in response.aiter_bytes():
                    yield chunk
        finally:
            await client.aclose()
            
    return StreamingResponse(fetch_stream(), media_type="audio/mpeg")

@app.post("/api/cases")
async def save_case(payload: CasePayload):
    """
    Saves a completed AI chat session and its structured report as a standalone Case.
    """
    success = await run_in_threadpool(
        supabase_db.save_user_case,
        payload.uid,
        payload.case_id,
        payload.structured_report,
        payload.session_data
    )
    if success:
        return {"status": "success", "message": "User Case saved"}
    raise HTTPException(status_code=500, detail="Failed to save User Case")

@app.get("/api/cases")
async def get_cases(uid: str):
    """
    Retrieves all formalized cases for a user.
    """
    cases = await run_in_threadpool(supabase_db.get_user_cases, uid)
    return {"status": "success", "cases": cases}

@app.post("/api/cases/complete")
async def save_complete_case(payload: CaseCompletionPayload):
    """
    Saves a completed case with full situation summary and collected Q&A answers.
    Optionally generates and uploads PDF to Cloudinary.
    
    This endpoint should be called after the question_processor completes or if no questions were needed.
    Stores complete case context including user's language, location, and all collected information.
    """
    try:
        from database.supabase_case_enhance import save_case_with_situation_summary, update_case_with_pdf

        print(
            "🧾 CASE_COMPLETE_REQUEST "
            f"case_id={payload.case_id} "
            f"session_id={payload.session_id} "
            f"uid={payload.uid} "
            f"generate_pdf={payload.generate_pdf} "
            f"has_pdf_url={bool(payload.pdf_url)} "
            f"answers_count={len(payload.collected_answers or {})} "
            f"summary_len={len(str((payload.structured_report or {}).get('summary', '')))}"
        )
        
        # Save the case with all details
        success = await run_in_threadpool(
            save_case_with_situation_summary,
            payload.uid,
            payload.case_id,
            payload.session_id,
            payload.structured_report,
            payload.situation_summary,
            payload.collected_answers,
            payload.session_data,
            pdf_url=payload.pdf_url,
            user_language=payload.user_language
        )
        
        if not success:
            print(f"❌ CASE_COMPLETE_SAVE_FAILED case_id={payload.case_id}")
            raise HTTPException(status_code=500, detail="Failed to save case")

        print(f"✅ CASE_COMPLETE_SAVED case_id={payload.case_id}")
        
        pdf_url = payload.pdf_url
        if payload.generate_pdf:
            # Generate and upload PDF
            try:
                pdf_result = generate_and_upload_report_pdf(
                    case_data=payload.structured_report,
                    case_id=payload.case_id,
                    user_id=payload.uid,
                    answers=payload.collected_answers if payload.collected_answers else None
                )
                
                if pdf_result.get("success"):
                    source_pdf_url = pdf_result.get("url")
                    pdf_url = source_pdf_url
                    # Update case with PDF URL
                    await run_in_threadpool(
                        update_case_with_pdf,
                        payload.case_id,
                        pdf_url,
                        f"cases/{payload.case_id}"
                    )
                    await run_in_threadpool(
                        supabase_db.update_pending_intervention_pdf,
                        payload.case_id,
                        pdf_url,
                        "moderator"
                    )
                    print(f"✅ PDF generated and uploaded: {source_pdf_url}")
                else:
                    print(f"⚠️ PDF generation failed: {pdf_result.get('error')}")
            except Exception as pdf_err:
                print(f"⚠️ Error generating PDF: {pdf_err}")
                # Don't fail the entire operation if PDF generation fails
        
        return {
            "status": "success",
            "case_id": payload.case_id,
            "pdf_url": pdf_url,
            "message": "Case completed and saved successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error saving complete case: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cases/{case_id}")
async def get_complete_case(case_id: str, user_id: str):
    """
    Retrieves complete case information including structured report, 
    situation summary, collected answers, and PDF URL.
    """
    try:
        from database.supabase_case_enhance import get_case_complete
        
        case = await run_in_threadpool(get_case_complete, case_id)
        
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Verify user ownership
        if case.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to case")
        
        return {
            "status": "success",
            "case": case
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error retrieving case: {e}")
        raise HTTPException(status_code=500, detail=str(e))
async def generate_case_pdf(case_id: str, user_id: str, answers: Optional[Dict[str, str]] = None):
    """
    Generate and upload PDF report for a case to Cloudinary.
    
    - Retrieves the case's structured_report from Supabase
    - Generates PDF from case data + optional answers to follow-up questions
    - Uploads to Cloudinary with folder structure: cases/{case_id}
    - Updates case's pdf_url in Supabase
    - Returns download URL
    """
    try:
        # Fetch case from database
        cases = await run_in_threadpool(supabase_db.get_user_cases, user_id)
        case_data = None
        for case in cases:
            if case.get("case_id") == case_id:
                case_data = case.get("structured_report")
                break
        
        if not case_data:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Generate and upload PDF
        result = generate_and_upload_report_pdf(
            case_data=case_data,
            case_id=case_id,
            user_id=user_id,
            answers=answers
        )
        
        if result.get("success"):
            direct_pdf_url = result.get("url")
            # Update case PDF URL in Supabase
            await run_in_threadpool(supabase_db.update_case_pdf_url, case_id, direct_pdf_url)
            await run_in_threadpool(supabase_db.update_pending_intervention_pdf, case_id, direct_pdf_url, "moderator")
            
            # Also add as attachment for future reference
            await run_in_threadpool(
                supabase_db.add_case_attachment,
                case_id,
                direct_pdf_url,
                "pdf",
                f"case_report_{case_id}.pdf",
                user_id
            )
            
            return {
                "status": "success",
                "message": "PDF generated and uploaded successfully",
                "pdf_url": direct_pdf_url,
                "public_id": result.get("public_id")
            }
        else:
            raise HTTPException(status_code=500, detail=f"PDF generation failed: {result.get('error')}")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating case PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cases/{case_id}/pdf")
async def get_case_pdf(case_id: str):
    """
    Redirects to the exact stored case PDF URL.
    """
    try:
        pdf_url = await run_in_threadpool(supabase_db.get_case_pdf_url, case_id)
        if isinstance(pdf_url, str) and ".pdf.pdf" in pdf_url:
            pdf_url = pdf_url.replace(".pdf.pdf", ".pdf")

        internal_path = f"/api/cases/{case_id}/pdf"
        internal_abs = f"http://localhost:8000{internal_path}"
        if isinstance(pdf_url, str):
            normalized = pdf_url.strip()
            if normalized in {internal_path, internal_abs}:
                pdf_url = None

        if not pdf_url:
            raise HTTPException(status_code=404, detail="PDF has not been generated yet")

        return RedirectResponse(url=pdf_url, status_code=307)
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error retrieving case PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/interventions/{collection_name}")
async def get_interventions(collection_name: str):
    """
    Retrieves all pending interventions for a specific team (e.g. sahayak).
    """
    cases = await run_in_threadpool(supabase_db.get_pending_interventions, collection_name)
    return {"status": "success", "cases": cases}

import json

@app.websocket("/ws/user/{uid}")
async def websocket_user_endpoint(websocket: WebSocket, uid: str):
    await manager.connect(websocket, channel=uid)
    try:
        while True:
            # Keep connection alive — incoming messages are ignored
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel=uid)
    except Exception as e:
        # Catch ALL other exceptions to prevent silent crashes
        print(f"⚠️ WebSocket error for uid '{uid}': {e}")
        manager.disconnect(websocket, channel=uid)


from fastapi import Request

@app.post("/api/webhooks/supabase/interventions")
async def supabase_webhook_interventions(request: Request):
    """
    Webhook receiver from Supabase for changes to the interventions table.
    """
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return {"status": "error", "message": "Invalid JSON payload"}

    table = payload.get("table")
    action_type = payload.get("type")
    record = payload.get("record", {})
    
    if table == "interventions":
        if action_type == "INSERT":
            # Safely parse structured_report — it may be dict, string, or None
            s_report = record.get("structured_report") or {}
            if isinstance(s_report, str):
                try:
                    import json as _json
                    s_report = _json.loads(s_report)
                except Exception:
                    s_report = {}

            case_data = {
                "type": "new_intervention",
                "case_id": record.get("id"),
                "user_id": record.get("user_id"),
                "incident_type": s_report.get("incident_type", "Unknown"),
                "risk_level": s_report.get("risk_level", "High"),
                "structured_report": s_report,
                "timestamp": record.get("created_at"),
                "collection": record.get("collection_name") or "moderator",
                "status": record.get("status", "pending"),
                "session_id": record.get("session_id"),
                "user_statement": record.get("user_statement") or "",
                "location": record.get("location") or {},
                "pdf_url": s_report.get("pdf_url"),
                "routing_recommendation": supabase_db.get_intervention_routing_recommendation(
                    s_report,
                    record.get("user_statement") or "",
                    record.get("location") or {},
                ),
            }

            try:
                from dateutil import parser
                dt = parser.parse(record.get("created_at"))
                case_data["timestamp"] = int(dt.timestamp() * 1000)
            except Exception:
                import time
                case_data["timestamp"] = int(time.time() * 1000)

            # Use await so we don't miss connected moderators
            await manager.broadcast(json.dumps(case_data), channel="moderator")
            print(f"📢 Broadcasted new_intervention to 'moderator' channel: case {record.get('id')}")
            return {"status": "success", "message": "Broadcasted new intervention to moderators"}

        elif action_type == "UPDATE":
            # Broadcast updates to moderator queue so dashboard stays in sync without reload.
            s_report = record.get("structured_report") or {}
            if isinstance(s_report, str):
                try:
                    import json as _json
                    s_report = _json.loads(s_report)
                except Exception:
                    s_report = {}

            moderator_update = {
                "type": "intervention_updated",
                "case_id": record.get("id"),
                "user_id": record.get("user_id"),
                "incident_type": s_report.get("incident_type", "Unknown"),
                "risk_level": s_report.get("risk_level", "High"),
                "structured_report": s_report,
                "timestamp": record.get("updated_at") or record.get("created_at"),
                "collection": record.get("collection_name") or "moderator",
                "status": record.get("status", "pending"),
                "session_id": record.get("session_id"),
                "user_statement": record.get("user_statement") or "",
                "location": record.get("location") or {},
                "pdf_url": s_report.get("pdf_url"),
                "routing_recommendation": supabase_db.get_intervention_routing_recommendation(
                    s_report,
                    record.get("user_statement") or "",
                    record.get("location") or {},
                ),
            }
            await manager.broadcast(json.dumps(moderator_update), channel="moderator")

            # Broadcast status updates/resolutions directly to the specific user
            if record.get("status") in ["reviewed", "resolved"]:
                routing_from_options = None
                raw_opts = record.get("moderator_options")
                if isinstance(raw_opts, list):
                    for opt in raw_opts:
                        if isinstance(opt, dict) and opt.get("type") == "routing_bundle" and isinstance(opt.get("routing_recommendation"), dict):
                            routing_from_options = opt.get("routing_recommendation")
                            break
                update_data = {
                    "type": "intervention_resolved",
                    "case_id": record.get("id"),
                    "moderator_response": record.get("moderator_response"),
                    "moderator_options": record.get("moderator_options"),
                    "status": record.get("status"),
                    "session_id": record.get("session_id"),
                    "routing_recommendation": routing_from_options,
                }
                user_id = record.get("user_id")
                if user_id:
                    await manager.broadcast(json.dumps(update_data), channel=user_id)

                # Also notify all moderator clients to remove this case from queue.
                await manager.broadcast(json.dumps({
                    "type": "intervention_resolved",
                    "case_id": record.get("id"),
                    "status": record.get("status"),
                    "collection": record.get("collection_name") or "moderator"
                }), channel="moderator")
                return {"status": "success", "message": f"Broadcasted resolution to user {user_id}"}

    return {"status": "ignored"}


class ResolveInterventionPayload(BaseModel):
    case_id: str
    moderator_response: str
    moderator_options: list
    routing_recommendation: Optional[Dict[str, Any]] = None

@app.post("/api/interventions/resolve")
async def resolve_intervention(payload: ResolveInterventionPayload):
    """
    Resolves a pending intervention case by adding the moderator's text and options.
    After updating the DB, directly broadcasts the resolution to the user via WebSocket
    so the user sees the response immediately without relying solely on the Supabase webhook.
    """
    result = await run_in_threadpool(
        supabase_db.resolve_intervention_case,
        payload.case_id,
        payload.moderator_response,
        payload.moderator_options,
        payload.routing_recommendation,
    )
    if result and result.get("success"):
        user_id = result.get("user_id")
        if user_id:
            update_data = {
                "type": "intervention_resolved",
                "case_id": result.get("case_id"),
                "session_id": result.get("session_id"),
                "moderator_response": result.get("moderator_response"),
                "moderator_options": result.get("moderator_options"),
                "status": "reviewed",
                "routing_recommendation": result.get("routing_recommendation"),
            }
            # Broadcast directly to the user's WS channel — no webhook needed
            import json
            await manager.broadcast(json.dumps(update_data), channel=user_id)
            print(f"✅ Broadcasted intervention_resolved directly to user WS channel '{user_id}'")
        return {"status": "success", "message": "Intervention resolved and user notified"}
    raise HTTPException(status_code=500, detail="Failed to resolve intervention")

class LawyerRegistrationPayload(BaseModel):
    uid: str
    name: str
    specialization: str
    lawyerType: str # New field for engagement model
    experience: int
    hourlyRate: int
    bio: str
    location: str
    avatar: str = "https://images.unsplash.com/photo-1556157382-97dee2dcb9d9?q=80&w=2670&auto=format&fit=crop"
    barRegistrationNumber: str = ""
    contactNumber: str = ""
    email: str = ""

@app.post("/api/lawyers/register")
async def register_lawyer(payload: LawyerRegistrationPayload):
    """
    Saves lawyer professional details to Supabase and indexes in Vector DB.
    """
    try:
        data = payload.dict()
        uid = data.pop('uid')
        
        # 1. Upsert into Supabase public "lawyers" directory
        await run_in_threadpool(supabase_db.register_lawyer_directory, uid, data)
        
        # 2. Update Vector DB (Pinecone) for semantic search
        from database.vector_db import VectorDB
        vdb = VectorDB()
        vdb.add_lawyer(
            lawyer_id=uid,
            bio=payload.bio,
            metadata={
                "name": payload.name,
                "specialization": payload.specialization,
                "lawyerType": payload.lawyerType,
                "experience": payload.experience,
                "hourlyRate": payload.hourlyRate,
                "location": payload.location
            }
        )
        
        return {"status": "success", "message": "Lawyer profile registered and indexed successfully"}
    except Exception as e:
        print(f"Error registering lawyer details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save lawyer details: {str(e)}")

class LawyerSearchQuery(BaseModel):
    query: str
    top_k: int = 5
    filters: Optional[Dict[str, Any]] = None

@app.post("/api/lawyers/search")
async def search_lawyers_endpoint(payload: LawyerSearchQuery):
    """
    Performs vector search for lawyers and returns enriched Firestore data.
    """
    try:
        from database.vector_db import VectorDB
        vector_db_inst = VectorDB()
        
        # 1. Get relevant lawyer IDs from Vector DB
        lawyer_ids = vector_db_inst.search_lawyers(payload.query, top_k=payload.top_k, filters=payload.filters)
        
        if not lawyer_ids:
            return {"status": "success", "lawyers": []}
            
        # 2. Fetch full details from Supabase directory
        lawyers = await run_in_threadpool(supabase_db.get_lawyers_by_ids, lawyer_ids)
        
        return {"status": "success", "lawyers": lawyers}
    except Exception as e:
        print(f"Error in lawyer search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/lawyers")
async def get_lawyers():
    """
    Returns a list of all users with the 'lawyer' role.
    """
    lawyers = await run_in_threadpool(supabase_db.search_lawyers)
    # In a real app we'd fetch their professional_details too, but Pyrebase returns the whole node if configured
    return {"status": "success", "lawyers": lawyers}

@app.get("/api/lawyer/profile/{uid}")
async def get_lawyer_profile_endpoint(uid: str):
    """
    Fetches the lawyer profile details by user ID from Supabase.
    """
    try:
        profile = await run_in_threadpool(supabase_db.get_lawyer_profile, uid)
        if profile:
            return {"status": "success", "profile": profile}
        else:
            raise HTTPException(status_code=404, detail="Lawyer profile not found")
    except Exception as e:
        print(f"Error fetching lawyer profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class LawyerProfileUpdatePayload(BaseModel):
    name: Optional[str] = None
    specialization: Optional[str] = None
    lawyerType: Optional[str] = None
    experience: Optional[int] = None
    hourlyRate: Optional[int] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    avatar: Optional[str] = None
    barRegistrationNumber: Optional[str] = None
    contactNumber: Optional[str] = None

@app.put("/api/lawyer/profile/{uid}")
async def update_lawyer_profile_endpoint(uid: str, payload: LawyerProfileUpdatePayload):
    """
    Updates the lawyer profile details in Supabase.
    """
    try:
        update_data = {k: v for k, v in payload.dict().items() if v is not None}
        if not update_data:
            return {"status": "success", "message": "No data to update"}

        updated_profile = await run_in_threadpool(supabase_db.update_lawyer_profile, uid, update_data)
        
        # Optionally, update Pinecone if relevant fields are updated
        # But for now, we rely on Supabase as source of truth for dashboard.
        
        if updated_profile:
            return {"status": "success", "profile": updated_profile, "message": "Profile updated successfully"}
        else:
            raise HTTPException(status_code=404, detail="Failed to update lawyer profile")
    except Exception as e:
        print(f"Error updating lawyer profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/lawyer/cases/{uid}")
async def get_lawyer_cases_endpoint(uid: str):
    """
    Fetches pending and assigned cases for a lawyer.
    """
    try:
        cases = await run_in_threadpool(supabase_db.get_lawyer_cases, uid)
        return {"status": "success", "cases": cases}
    except Exception as e:
        print(f"Error fetching lawyer cases: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class AcceptCasePayload(BaseModel):
    lawyer_id: str

@app.post("/api/lawyer/cases/{case_id}/accept")
async def accept_lawyer_case_endpoint(case_id: str, payload: AcceptCasePayload):
    """
    Lawyer accepts a pending case.
    """
    try:
        success = await run_in_threadpool(supabase_db.accept_lawyer_case, case_id, payload.lawyer_id)
        if success:
            return {"status": "success", "message": "Case accepted"}
        else:
            raise HTTPException(status_code=400, detail="Failed to accept case")
    except Exception as e:
        print(f"Error accepting lawyer case: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ─── Sahayak Endpoints ────────────────────────────────────────

@app.get("/api/sahayak/session-case")
async def get_sahayak_case_for_session(session_id: str):
    """
    Returns the sahayak case associated with a chat session, including
    the assigned guide's profile if accepted. Used to restore the panel on history load.
    """
    case = await run_in_threadpool(supabase_db.get_sahayak_case_by_session, session_id)
    if case:
        return {"status": "success", "case": case}
    return {"status": "not_found", "case": None}

@app.get("/api/sahayak/profile/{uid}")
async def get_sahayak_profile_endpoint(uid: str):
    """Fetch a Nyay Guide's profile."""
    try:
        profile = await run_in_threadpool(supabase_db.get_sahayak_profile, uid)
        return {"status": "success", "profile": profile}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SahayakProfilePayload(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    contactNumber: Optional[str] = None
    location: Optional[str] = None
    occupation: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    languages: Optional[List[str]] = None
    availability: Optional[str] = None

@app.post("/api/sahayak/profile/{uid}")
async def upsert_sahayak_profile_endpoint(uid: str, payload: SahayakProfilePayload):
    """Create or update a Nyay Guide's profile."""
    try:
        data = {k: v for k, v in payload.dict().items() if v is not None}
        success = await run_in_threadpool(supabase_db.upsert_sahayak_profile, uid, data)
        if success:
            return {"status": "success", "message": "Profile saved"}
        raise HTTPException(status_code=400, detail="Failed to save profile")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sahayak/profiles")
async def get_all_sahayak_profiles_endpoint():
    """Returns all Nyay Guide profiles (for victim browsing)."""
    try:
        profiles = await run_in_threadpool(supabase_db.get_all_sahayak_profiles)
        return {"status": "success", "profiles": profiles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sahayak/cases/{uid}")
async def get_sahayak_cases_endpoint(uid: str):
    """Fetch pending and assigned cases for a Nyay Guide."""
    try:
        cases = await run_in_threadpool(supabase_db.get_sahayak_cases, uid)
        return {"status": "success", "cases": cases}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AcceptSahayakCasePayload(BaseModel):
    sahayak_id: str
    sahayak_name: Optional[str] = ""

@app.post("/api/sahayak/cases/{case_id}/accept")
async def accept_sahayak_case_endpoint(case_id: str, payload: AcceptSahayakCasePayload):
    """Sahayak accepts a pending case."""
    try:
        success = await run_in_threadpool(supabase_db.accept_sahayak_case, case_id, payload.sahayak_id, payload.sahayak_name or "")
        if success:
            return {"status": "success", "message": "Case accepted"}
        raise HTTPException(status_code=400, detail="Failed to accept case")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- New Agentic Endpoints ---


from fastapi import UploadFile, File, Form
from fastapi.responses import StreamingResponse
import json
import asyncio
import time

# ... (transcribe_endpoint omitted for brevity, logic remains same)

import re as _re

# All known agent name patterns to strip from streamed answer tokens
_AGENT_PREFIX_RE = _re.compile(
    r'^(?:(?:civil|cyber|domestic|scam|document|sahayak|legal[_ ]?moderator|lawyer[_ ]?forwarder|supervisor|assistant|ai)[\s_]?agent[:\s]*|(?:civil|cyber|domestic|scam|document|sahayak|assistant)[:\s]+)',
    _re.IGNORECASE
)

def _strip_agent_prefix(text: str) -> str:
    """Strip leading agent-name prefixes from a streaming token or accumulated text."""
    return _AGENT_PREFIX_RE.sub('', text, count=1).lstrip()

# Only these nodes should stream token-by-token text to the user.
# Internal orchestration/summary nodes (supervisor, question_processor, report_generator)
# must never narrate their intermediate model output into chat.
USER_FACING_STREAM_NODES = {
    "cyber",
    "civil",
    "domestic",
    "scam",
    "document",
    "sexual_offense",
}

@app.post("/chat/stream")
async def chat_stream(user_query: UserQuery):
    """
    Streams the agent graph execution events to the frontend in NDJSON format.
    Enhanced error handling to prevent HTML responses being treated as JSON.
    """
    async def event_stream():
        print(f"🚀 STREAMING QUERY: {user_query.query}")
        if user_query.location:
            print(f"📍 Location: {user_query.location}")

        latest_case_context: Dict[str, Any] = {
            "case_id": None,
            "structured_report": None,
            "suggested_actions": [],
            "situation_summary": {},
            "collected_answers": {},
            "user_language": "english",
            "intervention_required": False,
            "routing_recommendation": None,
            "show_routing_consent": False,
        }

        # Build smart compressed history for context.
        # Strategy: user messages verbatim (short), assistant replies = first sentence only (~100 chars).
        # All injected as a single SystemMessage "chat summary" to avoid bloating the context window.
        from langchain_core.messages import AIMessage, SystemMessage as LCSystemMessage

        def _compress_assistant(text_in: Any, max_chars: int = 120) -> str:
            """Extract first meaningful sentence from an assistant reply, strip markdown."""
            import re
            text = str(text_in) if text_in is not None else ""
            # Strip markdown bold/italic/headings/links
            text = re.sub(r'\*{1,2}([^*]+)\*{1,2}', r'\1', text)  # bold/italic
            text = re.sub(r'#+\s*', '', text)  # headings
            text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)  # links
            text = re.sub(r'`[^`]*`', '', text)  # inline code
            text = text.strip()
            # Take up to first sentence boundary within max_chars
            for sep in ['. ', '.\n', '! ', '? ', '\n\n']:
                idx = text.find(sep)
                if 0 < idx <= max_chars:
                    return text[0:idx + 1].strip()  # type: ignore # Pyre doesn't understand string slice types
            if len(text) > max_chars:
                return text[:max_chars].rsplit(' ', 1)[0].strip() + '...'  # type: ignore # Pyre doesn't understand string slice types
            return text

        history_messages = []
        history_list: List[Dict[str, Any]] = user_query.session_history or []

        if len(history_list) >= 2:
            summary_lines: List[str] = []
            # Slice manually if linter complains about list slicing
            num_msgs = len(history_list)
            start_idx = max(0, num_msgs - 8)
            last_msgs = [history_list[i] for i in range(start_idx, num_msgs)]
            for msg in last_msgs: 
                role = msg.get("role", "user")
                content = msg.get("content", "").strip()
                if not content:
                    continue
                if role == "user":
                    summary_lines.append(f"User: {content}")
                elif role == "assistant":
                    summary_lines.append(f"Assistant (summary): {_compress_assistant(content)}")

            if summary_lines:
                summary_text = "The following is a compressed summary of the conversation so far. Use it only to maintain context for the current user query.\n\n" + "\n".join(summary_lines)
                history_messages = [LCSystemMessage(content=summary_text)]

        inputs = {
            "messages": history_messages + [HumanMessage(content=user_query.query)],
            "user_details": {
                "user_id": user_query.user_id,
                "location": user_query.location,
                "session_id": user_query.session_id,
                "query": user_query.query
            },
            "user_id": user_query.user_id or "",
            "user_name": user_query.user_name or "User",
            "session_id": user_query.session_id or ""
        }

        # Use session_id as thread if provided, else fall back to user_id
        thread_id = user_query.session_id or user_query.user_id
        
        # Accumulate streamed answer to strip prefix from start of full response
        accumulated_answer: str = ""
        prefix_stripped: bool = False
        generated_pdf_cases: set[str] = set()
        
        try:
            # Stream events from the graph
            config = {"configurable": {"thread_id": thread_id}}
            async for event in agent_graph.astream_events(inputs, config=config, version="v1"):
                try:
                    kind = event["event"]
                    name = event["name"]
                    
                    # Filter out uninteresting events
                    if kind == "on_chain_start":
                        if name == "Agent": # Wrapper
                            continue
                        
                        # Notify frontend about active agent
                        if name in ["cyber", "civil", "domestic", "scam", "document", "sahayak", "legal_moderator", "lawyer_forwarder", "question_processor", "sexual_offense", "report_generator"]:
                            yield json.dumps({"type": "agent_start", "agent": name}) + "\n"
                            # Reset prefix tracking per agent
                            accumulated_answer = ""
                            prefix_stripped = False

                        yield json.dumps({"type": "log", "agent": "System", "content": f"Starting {name}..."}) + "\n"
                    
                    elif kind == "on_chain_end":
                        if name in ["report_generator", "legal_moderator", "sahayak", "lawyer_forwarder", "question_processor", "nodal_guide", "sexual_offense"]:
                            output = event["data"].get("output", {})
                            if isinstance(output, dict):
                                latest_case_context["case_id"] = output.get("case_id") or latest_case_context.get("case_id")
                                latest_case_context["structured_report"] = output.get("structured_report") or latest_case_context.get("structured_report")
                                latest_case_context["suggested_actions"] = output.get("suggested_actions") or latest_case_context.get("suggested_actions") or []
                                latest_case_context["situation_summary"] = output.get("situation_summary") or latest_case_context.get("situation_summary") or {}
                                latest_case_context["collected_answers"] = output.get("collected_answers") or latest_case_context.get("collected_answers") or {}
                                latest_case_context["user_language"] = output.get("user_language") or latest_case_context.get("user_language") or "english"
                                latest_case_context["intervention_required"] = bool(output.get("intervention_required", latest_case_context.get("intervention_required", False)))
                                latest_case_context["routing_recommendation"] = output.get("routing_recommendation") or latest_case_context.get("routing_recommendation")
                                latest_case_context["show_routing_consent"] = bool(output.get("show_routing_consent", latest_case_context.get("show_routing_consent", False)))
                                latest_case_context["female_nyayguide_profiles"] = output.get("female_nyayguide_profiles") or latest_case_context.get("female_nyayguide_profiles") or []
                                latest_case_context["show_female_nyayguide_panel"] = bool(output.get("show_female_nyayguide_panel", latest_case_context.get("show_female_nyayguide_panel", False)))
                                latest_case_context["female_lawyer_profiles"] = output.get("female_lawyer_profiles") or latest_case_context.get("female_lawyer_profiles") or []
                                latest_case_context["show_female_lawyer_panel"] = bool(output.get("show_female_lawyer_panel", latest_case_context.get("show_female_lawyer_panel", False)))

                                # If the agent generated a static response instead of an LLM stream, yield it now
                                if name in ["legal_moderator", "lawyer_forwarder", "sahayak", "nodal_guide"] and output.get("final_response"):
                                    yield json.dumps({"type": "answer", "content": output.get("final_response")}) + "\n"
                                
                                # Handle question_processor responses (pending questions or follow-up)
                                if name == "question_processor":
                                    if output.get("pending_questions"):
                                        yield json.dumps({
                                            "type": "pending_questions",
                                            "questions": output.get("pending_questions", []),
                                            "current_index": output.get("current_question_idx", 0),
                                            "collected_answers": output.get("collected_answers", {})
                                        }) + "\n"
                                    if output.get("final_response") and not output.get("pdf_ready"):
                                        yield json.dumps({"type": "answer", "content": output.get("final_response")}) + "\n"
                                    
                                    # ✅ AUTO PDF GENERATION: When Q&A collection completes (pdf_ready=True)
                                    if output.get("pdf_ready") and not bool(output.get("sexual_offense_intake_flow", False)):
                                        print(f"📄 PDF Ready flag detected - triggering automatic PDF generation...")
                                        pdf_url = None
                                        try:
                                            # Extract required data for PDF generation
                                            raw_case_id = output.get("case_id") or latest_case_context.get("case_id")
                                            try:
                                                case_id = str(uuid.UUID(str(raw_case_id))) if raw_case_id else str(uuid.uuid4())
                                            except Exception:
                                                case_id = str(uuid.uuid4())
                                            structured_report = output.get("structured_report") or latest_case_context.get("structured_report") or {}
                                            collected_answers = output.get("collected_answers") or latest_case_context.get("collected_answers") or {}
                                            
                                            # Generate and upload PDF automatically
                                            pdf_result = await run_in_threadpool(
                                                generate_and_upload_report_pdf,
                                                structured_report,
                                                case_id,
                                                user_query.user_id,
                                                collected_answers if collected_answers else None
                                            )
                                            
                                            if pdf_result.get("success"):
                                                source_pdf_url = pdf_result.get("url")
                                                pdf_url = source_pdf_url
                                                print(f"✅ PDF auto-generated and uploaded: {source_pdf_url}")
                                                
                                                # Optionally update case in DB with PDF URL
                                                try:
                                                    from database.supabase_case_enhance import update_case_with_pdf
                                                    await run_in_threadpool(
                                                        update_case_with_pdf,
                                                        case_id,
                                                        pdf_url,
                                                        f"cases/{case_id}"
                                                    )
                                                    print(f"✅ Case updated with PDF URL for case_id={case_id}")
                                                except Exception as pdf_update_err:
                                                    print(f"⚠️ Warning: Could not update case with PDF URL: {pdf_update_err}")

                                                # If intervention is pending for this case, update it with PDF for moderator review.
                                                try:
                                                    await run_in_threadpool(
                                                        supabase_db.update_pending_intervention_pdf,
                                                        case_id,
                                                        pdf_url,
                                                        "moderator"
                                                    )
                                                except Exception as intervention_pdf_err:
                                                    print(f"⚠️ Warning: Could not update pending intervention with PDF: {intervention_pdf_err}")
                                            else:
                                                print(f"⚠️ PDF generation returned success=False: {pdf_result}")
                                        except Exception as pdf_gen_err:
                                            print(f"⚠️ Warning: Auto PDF generation failed (user can still download later): {pdf_gen_err}")
                                        
                                        # Send pdf_ready event to frontend with URL
                                        print(
                                            "📦 COMPLETION_EVENT "
                                            f"case_id={case_id} "
                                            f"pdf_ready={bool(pdf_url)} "
                                            f"pdf_url={pdf_url if pdf_url else 'None'} "
                                            f"answers_count={len(collected_answers or {})}"
                                        )
                                        yield json.dumps({
                                            "type": "pdf_ready",
                                            "pdf_url": pdf_url,
                                            "case_id": case_id,
                                            "message": "Case document ready for download",
                                            "case_completed": True,
                                            "structured_report": structured_report,
                                            "situation_summary": output.get("situation_summary") or latest_case_context.get("situation_summary") or {},
                                            "collected_answers": collected_answers,
                                            "user_language": output.get("user_language") or latest_case_context.get("user_language") or "english"
                                        }) + "\n"

                                        # After Q&A completion, now reveal report/risk/actions and moderation status
                                        yield json.dumps({
                                            "type": "data",
                                            "structured_report": output.get("structured_report") or latest_case_context.get("structured_report"),
                                            "suggested_actions": output.get("suggested_actions") or latest_case_context.get("suggested_actions") or [],
                                            "intervention_required": output.get("intervention_required", latest_case_context.get("intervention_required", False)),
                                            "case_id": case_id,
                                            "pending_questions": [],
                                            "current_question_idx": output.get("current_question_idx", 0),
                                            "case_completed": True
                                        }) + "\n"

                                        if output.get("intervention_required"):
                                            yield json.dumps({
                                                "type": "data",
                                                "intervention_required": True,
                                                "case_id": case_id,
                                                "intervention_collection": "moderator",
                                                "intervention_pending": True
                                            }) + "\n"

                                # ✅ AUTO PDF GENERATION: report-only flows (no follow-up questions)
                                if name == "report_generator":
                                    has_pending_questions = bool(output.get("pending_questions"))
                                    case_id = output.get("case_id") or latest_case_context.get("case_id")
                                    structured_report = output.get("structured_report") or latest_case_context.get("structured_report") or {}

                                    if (
                                        not has_pending_questions
                                        and case_id
                                        and structured_report
                                        and case_id not in generated_pdf_cases
                                    ):
                                        print(f"📄 REPORT_COMPLETE detected (no follow-up questions) - triggering automatic PDF generation...")
                                        generated_pdf_cases.add(case_id)
                                        pdf_url = None
                                        try:
                                            pdf_result = await run_in_threadpool(
                                                generate_and_upload_report_pdf,
                                                structured_report,
                                                case_id,
                                                user_query.user_id,
                                                output.get("collected_answers") or latest_case_context.get("collected_answers") or None
                                            )

                                            if pdf_result.get("success"):
                                                source_pdf_url = pdf_result.get("url")
                                                pdf_url = source_pdf_url
                                                print(f"✅ PDF auto-generated and uploaded: {source_pdf_url}")
                                                try:
                                                    from database.supabase_case_enhance import update_case_with_pdf
                                                    await run_in_threadpool(
                                                        update_case_with_pdf,
                                                        case_id,
                                                        pdf_url,
                                                        f"cases/{case_id}"
                                                    )
                                                    print(f"✅ Case updated with PDF URL for case_id={case_id}")
                                                except Exception as pdf_update_err:
                                                    print(f"⚠️ Warning: Could not update case with PDF URL: {pdf_update_err}")

                                                # If intervention is pending for this case, update it with PDF for moderator review.
                                                try:
                                                    await run_in_threadpool(
                                                        supabase_db.update_pending_intervention_pdf,
                                                        case_id,
                                                        pdf_url,
                                                        "moderator"
                                                    )
                                                except Exception as intervention_pdf_err:
                                                    print(f"⚠️ Warning: Could not update pending intervention with PDF: {intervention_pdf_err}")
                                            else:
                                                print(f"⚠️ PDF generation returned success=False: {pdf_result}")
                                        except Exception as pdf_gen_err:
                                            print(f"⚠️ Warning: Auto PDF generation failed for report-only flow: {pdf_gen_err}")

                                        print(
                                            "📦 COMPLETION_EVENT "
                                            f"case_id={case_id} "
                                            f"pdf_ready={bool(pdf_url)} "
                                            f"pdf_url={pdf_url if pdf_url else 'None'} "
                                            f"answers_count={len(output.get('collected_answers') or latest_case_context.get('collected_answers') or {})}"
                                        )
                                        yield json.dumps({
                                            "type": "pdf_ready",
                                            "pdf_url": pdf_url,
                                            "case_id": case_id,
                                            "message": "Case document ready for download",
                                            "case_completed": True,
                                            "structured_report": structured_report,
                                            "situation_summary": output.get("situation_summary") or latest_case_context.get("situation_summary") or {},
                                            "collected_answers": output.get("collected_answers") or latest_case_context.get("collected_answers") or {},
                                            "user_language": output.get("user_language") or latest_case_context.get("user_language") or "english"
                                        }) + "\n"
                                
                                if (
                                    output.get("structured_report")
                                    or output.get("suggested_actions")
                                    or output.get("intervention_required")
                                    or output.get("show_female_nyayguide_panel")
                                    or output.get("show_female_lawyer_panel")
                                ):
                                    has_pending_questions = bool(output.get("pending_questions"))
                                    if has_pending_questions:
                                        yield json.dumps({
                                            "type": "data",
                                            "structured_report": None,
                                            "suggested_actions": [],
                                            "intervention_required": False,
                                            "case_id": output.get("case_id"),
                                            "pending_questions": output.get("pending_questions"),
                                            "current_question_idx": output.get("current_question_idx")
                                        }) + "\n"
                                    else:
                                        yield json.dumps({
                                            "type": "data", 
                                            "structured_report": output.get("structured_report"),
                                            "suggested_actions": output.get("suggested_actions"),
                                            "intervention_required": output.get("intervention_required", False),
                                            "case_id": output.get("case_id"),
                                            "pending_questions": output.get("pending_questions"),
                                            "current_question_idx": output.get("current_question_idx"),
                                            "case_completed": bool(name == "report_generator" and not bool(output.get("pending_questions"))),
                                            "routing_recommendation": output.get("routing_recommendation"),
                                            "show_routing_consent": bool(output.get("show_routing_consent", False)),
                                            "show_female_nyayguide_panel": bool(output.get("show_female_nyayguide_panel", False)),
                                            "female_nyayguide_profiles": output.get("female_nyayguide_profiles", []),
                                            "show_female_lawyer_panel": bool(output.get("show_female_lawyer_panel", False)),
                                            "female_lawyer_profiles": output.get("female_lawyer_profiles", []),
                                        }) + "\n"

                                        if output.get("show_routing_consent") and output.get("routing_recommendation"):
                                            yield json.dumps({
                                                "type": "routing_consent_modal",
                                                "routing": output.get("routing_recommendation")
                                            }) + "\n"
                                
                                # Emit recommended lawyers data for victim-side lawyer browser panel
                                if name == "lawyer_forwarder" and output.get("recommended_lawyers"):
                                    yield json.dumps({
                                        "type": "lawyer_recommendations",
                                        "lawyers": output.get("recommended_lawyers", []),
                                        "lawyer_case_id": output.get("lawyer_case_id"),
                                        "show_lawyer_panel": output.get("show_lawyer_panel", False)
                                    }) + "\n"

                                # Emit sahayak data for victim-side sahayak browser panel
                                if name == "sahayak" and output.get("recommended_sahayaks") is not None:
                                    yield json.dumps({
                                        "type": "sahayak_recommendations",
                                        "sahayaks": output.get("recommended_sahayaks", []),
                                        "sahayak_case_id": output.get("sahayak_case_id"),
                                        "show_sahayak_panel": output.get("show_sahayak_panel", False)
                                    }) + "\n"

                                # Emit nodal guide panel event when user consented
                                if name == "nodal_guide" and output.get("show_nodal_guide_panel"):
                                    yield json.dumps({
                                        "type": "nodal_guide_panel",
                                        "profiles": output.get("nodal_guide_profiles", []),
                                        "show_nodal_guide_panel": True
                                    }) + "\n"

                                # Emit female nyayguide panel event for direct trauma-safe flow.
                                if output.get("show_female_nyayguide_panel"):
                                    yield json.dumps({
                                        "type": "female_nyayguide_panel",
                                        "profiles": output.get("female_nyayguide_profiles", []),
                                        "show_female_nyayguide_panel": True,
                                        "case_id": output.get("case_id")
                                    }) + "\n"

                    elif kind == "on_chat_model_stream":
                        stream_node = event.get("metadata", {}).get("langgraph_node")
                        # Stream only from user-facing specialist nodes.
                        if stream_node not in USER_FACING_STREAM_NODES:
                            continue

                        content = event["data"]["chunk"].content
                        if isinstance(content, list):
                            content = "".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
                        elif not isinstance(content, str):
                            content = str(content)
                            
                        if content:
                            if not prefix_stripped:
                                # Accumulate until we have enough to strip prefix
                                accumulated_answer = "".join([accumulated_answer, str(content)])
                                # Try to strip prefix once we have at least 40 chars
                                if len(accumulated_answer) >= 40 or any(c in accumulated_answer for c in ['.', '!', '?', '\n']):
                                    clean = _strip_agent_prefix(accumulated_answer)
                                    prefix_stripped = True
                                    if clean:
                                        yield json.dumps({"type": "answer", "content": clean}) + "\n"
                            else:
                                yield json.dumps({"type": "answer", "content": content}) + "\n"
                    
                    elif kind == "on_tool_start":
                        yield json.dumps({"type": "log", "agent": "Tool", "content": f"Executing tool: {name}..."}) + "\n"
                    
                    elif kind == "on_tool_end":
                        yield json.dumps({"type": "log", "agent": "Tool", "content": f"Tool {name} finished."}) + "\n"
                
                except Exception as e:
                    print(f"Error processing event: {e}")
                    yield json.dumps({"type": "error", "content": f"Error processing event: {str(e)}"}) + "\n"

        except Exception as e:
            import traceback
            error_msg = f"Agent graph error: {str(e)}"
            print(f"❌ {error_msg}")
            traceback.print_exc()
            yield json.dumps({"type": "error", "content": error_msg}) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")

@app.post("/chat/audio-stream")
async def chat_audio_stream(
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Streams the agent graph execution events for AUDIO input directly (no transcription).
    """
    async def event_stream():
        # Read audio file
        audio_content = await file.read()
        mime_type = "audio/webm" # Default from VoiceInput
        if file.filename.endswith(".wav"): mime_type = "audio/wav"
        elif file.filename.endswith(".mp3"): mime_type = "audio/mp3"
        elif file.filename.endswith(".m4a"): mime_type = "audio/mp4"

        print(f"🚀 STREAMING AUDIO QUERY ({mime_type}) for user {user_id}")
        
        import base64
        audio_b64 = base64.b64encode(audio_content).decode("utf-8")

        # Pass the raw audio natively to the agent graph
        message = HumanMessage(content=[
            {"type": "text", "text": "Please listen to this audio query and respond. Output an informative and helpful response."},
            {"type": "media", "mime_type": mime_type, "data": audio_b64}
        ])

        inputs = {
            "messages": [message],
            "user_details": {
                "user_id": user_id,
                "session_id": user_query.session_id if 'user_query' in locals() else None # audio stream doesn't have UserQuery by default, need to check its signature.
            }
        }
        
        # Accumulate streamed answer to strip prefix from start of full response
        accumulated_answer: str = ""
        prefix_stripped: bool = False
        
        try:
            # Stream events from the graph
            config = {"configurable": {"thread_id": user_id}}
            async for event in agent_graph.astream_events(inputs, config=config, version="v1"):
                kind = event["event"]
                name = event["name"]
                
                # Filter out uninteresting events
                if kind == "on_chain_start":
                    if name == "Agent": # Wrapper
                        continue
                    
                    # Notify frontend about active agent
                    if name in ["cyber", "civil", "domestic", "scam", "document", "sahayak", "legal_moderator", "lawyer_forwarder"]:
                        yield json.dumps({"type": "agent_start", "agent": name}) + "\n"
                        # Reset prefix tracking per agent
                        accumulated_answer = ""
                        prefix_stripped = False

                    yield json.dumps({"type": "log", "agent": "System", "content": f"Starting {name}..."}) + "\n"
                
                elif kind == "on_chain_end":
                    if name in ["report_generator", "legal_moderator", "sahayak", "lawyer_forwarder"]:
                        output = event["data"].get("output", {})
                        if isinstance(output, dict) and (output.get("structured_report") or output.get("suggested_actions") or output.get("intervention_required")):
                            yield json.dumps({
                                "type": "data", 
                                "structured_report": output.get("structured_report"),
                                "suggested_actions": output.get("suggested_actions"),
                                "intervention_required": output.get("intervention_required", False),
                                "case_id": output.get("case_id")
                            }) + "\n"

                elif kind == "on_chat_model_stream":
                    stream_node = event.get("metadata", {}).get("langgraph_node")
                    # Stream only from user-facing specialist nodes.
                    if stream_node not in USER_FACING_STREAM_NODES:
                        continue

                    content = event["data"]["chunk"].content
                    if isinstance(content, list):
                        content = "".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
                    elif not isinstance(content, str):
                        content = str(content)

                    if content:
                        if not prefix_stripped:
                            # Accumulate until we have enough to strip prefix
                            accumulated_answer = "".join([accumulated_answer, str(content)])
                            # Try to strip prefix once we have at least 40 chars
                            if len(accumulated_answer) >= 40 or any(c in accumulated_answer for c in ['.', '!', '?', '\n']):
                                clean = _strip_agent_prefix(accumulated_answer)
                                prefix_stripped = True
                                if clean:
                                    yield json.dumps({"type": "answer", "content": clean}) + "\n"
                        else:
                            yield json.dumps({"type": "answer", "content": content}) + "\n"
                
                elif kind == "on_tool_start":
                    yield json.dumps({"type": "log", "agent": "Tool", "content": f"Executing tool: {name}..."}) + "\n"
                
                elif kind == "on_tool_end":
                    yield json.dumps({"type": "log", "agent": "Tool", "content": f"Tool {name} finished."}) + "\n"

        except Exception as e:
            yield json.dumps({"type": "error", "content": str(e)}) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
