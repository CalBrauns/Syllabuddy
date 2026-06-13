"""
Syllabus PDF parser.
Extracts text with pdfplumber, sends to Claude, returns structured task list.
"""
import json
import re
import pdfplumber
import anthropic

client = anthropic.Anthropic()

SYSTEM_PROMPT = """You are a study planner assistant. Parse the provided college syllabus text and extract every graded item, due date, exam, and major deadline.

Return ONLY a raw JSON object with this exact shape — no prose, no markdown:
{
  "class_name": "Full course name",
  "tasks": [
    {
      "title": "Short descriptive title",
      "type": "exam|assignment|project|reading|quiz|other",
      "due_date": "YYYY-MM-DD",
      "description": "Brief context from the syllabus",
      "estimated_hours": <number>
    }
  ]
}

Estimated hours guidelines:
- exam: 8–15 (scale with exam weight)
- project: 8–20 (scale with scope)
- assignment: 1–5
- quiz: 1–3
- reading: 1–2 per chapter
- other: 1–3

Reading tasks — important:
- If the syllabus specifies a chapter range (e.g. "Read Chapters 1–5", "Ch. 3 and 4"), create ONE task per chapter, not one combined task.
- Title each: "Read Chapter N" or "Read Chapter N: [Title]" if a chapter title is given.
- Space the due dates evenly across the window leading up to the final reading deadline. If chapters are due each week, assign one per week.
- Estimated hours per chapter: 1–2 hours depending on density.
- If the reading is a single article, paper, or non-chapter assignment with no chapter numbers, create one task for it.

Recurring tasks:
- If the syllabus mentions a task that repeats on a schedule (e.g. "weekly homework due every Friday", "quiz every Monday"), generate one task per occurrence for the full semester.
- Title them sequentially: "Homework 1", "Homework 2", etc. or "Week 1 Quiz", "Week 2 Quiz", etc.
- Use the syllabus's last day of class or final exam date to determine the last occurrence. If not stated, generate through the last date mentioned in the syllabus.
- Estimated hours per occurrence: same as a single task of that type.
- Cap at 20 occurrences of any single recurring task to avoid runaway output.

If a date is missing or ambiguous, omit that task. Use the current year if no year is given. Output tasks sorted by due_date ascending."""


def extract_text(pdf_bytes: bytes) -> str:
    import io
    text_parts = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
    return "\n\n".join(text_parts)


def parse_syllabus(pdf_bytes: bytes) -> dict:
    raw_text = extract_text(pdf_bytes)
    if not raw_text.strip():
        raise ValueError("No text could be extracted from the PDF.")

    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Syllabus text:\n\n{raw_text[:12000]}"}],
    )

    raw = resp.content[0].text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw).strip()

    return json.loads(raw)
