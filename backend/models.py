from pydantic import BaseModel
from typing import Literal
from datetime import date


TaskType = Literal["exam", "assignment", "project", "reading", "quiz", "other"]


class Task(BaseModel):
    id: int | None = None
    class_id: int
    title: str
    type: TaskType
    due_date: date
    description: str = ""
    estimated_hours: float
    color: str = "#6366f1"


class ClassCreate(BaseModel):
    name: str
    color: str = "#6366f1"


class Class(BaseModel):
    id: int
    name: str
    color: str
    task_count: int = 0


class StudyBlock(BaseModel):
    date: date
    task_id: int
    task_title: str
    class_name: str
    color: str
    hours: float


class WeekPlan(BaseModel):
    tasks_due: list[Task]
    study_blocks: list[StudyBlock]
