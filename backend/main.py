import os
from datetime import date
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import stripe

import database as db
import parser as syllabus_parser
import scheduler

stripe.api_key          = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET   = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID         = os.getenv("STRIPE_PRICE_ID", "")
FRONTEND_URL            = os.getenv("FRONTEND_URL", "http://localhost:5173")

app = FastAPI(title="Syllabuddy API")

_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins],
    allow_methods=["*"],
    allow_headers=["*"],
)

db.init_db()


def _is_premium() -> bool:
    return db.get_setting("premium") == "true"

def _max_classes() -> int:
    return 9999 if _is_premium() else 1


# ── Classes ──────────────────────────────────────────────────────────────────

@app.get("/classes")
def list_classes():
    return db.get_classes()


@app.delete("/classes/{class_id}")
def remove_class(class_id: int):
    db.delete_class(class_id)
    return {"ok": True}


# ── Upload + Parse ───────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_syllabus(file: UploadFile = File(...)):
    if db.get_class_count() >= _max_classes():
        raise HTTPException(
            status_code=403,
            detail="Free plan is limited to 1 class. Upgrade to Syllabuddy Premium for unlimited classes.",
        )
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    pdf_bytes = await file.read()
    try:
        parsed = syllabus_parser.parse_syllabus(pdf_bytes)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    class_id = db.create_class(parsed["class_name"], _next_color())
    tasks = [
        {
            "class_id":        class_id,
            "title":           t["title"],
            "type":            t["type"],
            "due_date":        t["due_date"],
            "description":     t.get("description", ""),
            "estimated_hours": t.get("estimated_hours", 1.0),
        }
        for t in parsed.get("tasks", [])
    ]
    db.insert_tasks(tasks)
    return {"class_id": class_id, "class_name": parsed["class_name"], "task_count": len(tasks)}


# ── Tasks ─────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    class_id: int
    title: str
    type: str
    due_date: str
    description: str = ""
    estimated_hours: float = 1.0


@app.post("/tasks")
def add_task(task: TaskCreate):
    task_id = db.create_task(task.model_dump())
    return db.get_task(task_id)


@app.get("/tasks")
def list_tasks(class_id: int | None = None, include_hidden: bool = False):
    return db.get_tasks(class_id, include_hidden=include_hidden)


@app.get("/tasks/sidebar/{class_id}")
def sidebar_tasks(class_id: int):
    return db.get_tasks_for_sidebar(class_id)


@app.post("/tasks/{task_id}/toggle")
def toggle_task(task_id: int):
    hidden = db.toggle_task_hidden(task_id)
    return {"id": task_id, "hidden": hidden}


@app.delete("/tasks/{task_id}")
def remove_task(task_id: int):
    db.delete_task(task_id)
    return {"ok": True}


@app.patch("/tasks/{task_id}")
def edit_task(task_id: int, fields: dict):
    db.update_task(task_id, fields)
    return db.get_task(task_id)


# ── Study plan ────────────────────────────────────────────────────────────────

@app.get("/plan")
def get_plan(week_start: str | None = None):
    today = date.today()
    if week_start:
        monday = date.fromisoformat(week_start)
    else:
        monday = today - __import__("datetime").timedelta(days=today.weekday())

    all_tasks = db.get_tasks(include_hidden=True)
    class_map = {c["id"]: c["name"] for c in db.get_classes()}
    for t in all_tasks:
        t["class_name"] = class_map.get(t["class_id"], "")
    active_tasks = [t for t in all_tasks if not t["hidden"]]
    blocks = scheduler.generate_study_blocks(active_tasks, today=today)

    return {
        "week_start": monday.isoformat(),
        "tasks":      all_tasks,
        "blocks":     blocks,
    }


@app.get("/plan/limits")
def get_limits():
    premium = _is_premium()
    return {
        "premium":         premium,
        "max_classes":     _max_classes(),
        "current_classes": db.get_class_count(),
    }


# ── Upgrade / Stripe ──────────────────────────────────────────────────────────

@app.post("/upgrade/checkout")
def create_checkout():
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured.")
    if not STRIPE_PRICE_ID:
        raise HTTPException(status_code=500, detail="Stripe price ID is not configured.")
    session = stripe.checkout.Session.create(
        mode="subscription",
        payment_method_types=["card"],
        line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
        success_url=f"{FRONTEND_URL}?upgraded=1",
        cancel_url=f"{FRONTEND_URL}?upgraded=0",
    )
    return {"url": session.url}


@app.post("/upgrade/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    event_type = event["type"]
    if event_type in ("customer.subscription.created", "customer.subscription.updated"):
        if event["data"]["object"]["status"] == "active":
            db.set_setting("premium", "true")
            db.set_setting("stripe_customer_id", event["data"]["object"]["customer"])
    elif event_type == "customer.subscription.deleted":
        db.set_setting("premium", "false")

    return {"ok": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

_CLASS_COLORS = [
    "#6366f1", "#ec4899", "#f59e0b", "#10b981",
    "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6",
]


def _next_color() -> str:
    count = db.get_class_count()
    return _CLASS_COLORS[count % len(_CLASS_COLORS)]
