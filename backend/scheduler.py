"""
Generates study time blocks by spreading estimated hours across
the days leading up to each task's due date.

Rules:
- Weighted distribution (more time closer to due date)
- Daily cap: 2h per day
- Priority: exam > project > quiz > assignment
- Overflow: low-priority blocks pushed earlier, never past today or due date
"""
from datetime import date, timedelta
from collections import defaultdict

DAILY_CAP_HOURS = 2.0

SPREAD_DAYS = {
    "exam":       7,
    "project":    14,
    "assignment": 3,
    "quiz":       2,
    "reading":    2,
    "other":      2,
}

PRIORITY = {
    "exam":       4,
    "project":    3,
    "quiz":       2,
    "assignment": 1,
    "reading":    1,
    "other":      1,
}

# Weight per spread length: index 0 = earliest day, last = day before due
_WEIGHTS: dict[int, list[float]] = {
    2:  [0.40, 0.60],
    3:  [0.25, 0.35, 0.40],
    7:  [0.08, 0.10, 0.12, 0.14, 0.16, 0.18, 0.22],
    14: [0.04, 0.05, 0.05, 0.06, 0.06, 0.07, 0.07,
         0.07, 0.08, 0.08, 0.09, 0.09, 0.10, 0.09],
}


def _weights_for(n: int) -> list[float]:
    if n in _WEIGHTS:
        return _WEIGHTS[n]
    # Linear ramp fallback
    total = sum(range(1, n + 1))
    return [i / total for i in range(1, n + 1)]


def _ideal_blocks(task: dict, today: date) -> list[dict]:
    due = date.fromisoformat(task["due_date"])
    if due < today:
        return []

    spread = SPREAD_DAYS.get(task["type"], 3)
    days_left = (due - today).days
    actual_spread = min(spread, max(days_left, 1))
    weights = _weights_for(actual_spread)[-actual_spread:]
    total_w = sum(weights)

    blocks = []
    for i, w in enumerate(weights):
        day = due - timedelta(days=actual_spread - i)
        if day < today:
            continue
        hours = round(task["estimated_hours"] * w / total_w, 2)
        if hours < 0.1:
            continue
        blocks.append({
            "date":       day,
            "task_id":    task["id"],
            "task_title": task["title"],
            "class_id":   task.get("class_id"),
            "class_name": task.get("class_name", ""),
            "color":      task.get("color", "#6366f1"),
            "hours":      hours,
            "priority":   PRIORITY.get(task["type"], 1),
            "due_date":   due,
            "type":       task["type"],
        })
    return blocks


def _apply_daily_cap(blocks: list[dict], today: date) -> list[dict]:
    """Push overflow from low-priority blocks to earlier days."""
    by_date: dict[date, list] = defaultdict(list)
    for b in blocks:
        by_date[b["date"]].append(b)

    # Process latest → earliest so overflow propagates backward
    result_by_date: dict[date, list] = defaultdict(list)

    for day in sorted(by_date.keys(), reverse=True):
        day_blocks = by_date[day][:]
        total = sum(b["hours"] for b in day_blocks)

        if total <= DAILY_CAP_HOURS + 0.05:
            result_by_date[day].extend(day_blocks)
            continue

        # High priority stays, low priority gets pushed earlier
        day_blocks.sort(key=lambda b: -b["priority"])

        kept: list[dict] = []
        to_move: list[dict] = []
        cap_remaining = DAILY_CAP_HOURS

        for b in day_blocks:
            if cap_remaining <= 0.05:
                to_move.append(b)
                continue
            if b["hours"] <= cap_remaining:
                kept.append(b)
                cap_remaining -= b["hours"]
            else:
                kept.append({**b, "hours": round(cap_remaining, 2)})
                to_move.append({**b, "hours": round(b["hours"] - cap_remaining, 2)})
                cap_remaining = 0

        result_by_date[day].extend(kept)

        prev = day - timedelta(days=1)
        if prev >= today:
            by_date[prev].extend(to_move)
        # If nowhere to push, drop (can't schedule before today)

    result = []
    for day_blocks in result_by_date.values():
        result.extend(day_blocks)
    return result


def generate_study_blocks(tasks: list[dict], today: date | None = None) -> list[dict]:
    today = today or date.today()

    raw: list[dict] = []
    for task in tasks:
        raw.extend(_ideal_blocks(task, today))

    capped = _apply_daily_cap(raw, today)
    capped.sort(key=lambda b: b["date"])

    return [
        {
            "date":       b["date"].isoformat(),
            "task_id":    b["task_id"],
            "task_title": b["task_title"],
            "class_id":   b["class_id"],
            "class_name": b["class_name"],
            "color":      b["color"],
            "hours":      b["hours"],
            "type":       b["type"],
        }
        for b in capped
        if b["hours"] >= 0.1
    ]
