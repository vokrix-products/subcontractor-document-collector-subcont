import os
import io
import csv
import json
import re
from datetime import datetime, date
from typing import Any, Optional, Dict, List

import pdfplumber
import openpyxl
from openai import OpenAI

_client = None
if os.environ.get("DEEPSEEK_API_KEY"):
    _client = OpenAI(api_key=os.environ["DEEPSEEK_API_KEY"], base_url="https://api.deepseek.com")

STATUS_VALID = "valid:good"
STATUS_MISSING = "missing:critical"
STATUS_EXPIRING_SOON = "expiring_soon:warning"
STATUS_EXPIRED = "expired:critical"
STATUS_FLAGGED = "flagged:warning"

DOCUMENT_TYPES = [
    "COI/general liability",
    "auto liability",
    "workers compensation",
    "umbrella",
    "additional insured endorsement",
    "contractor license",
    "W-9",
    "lien waiver",
    "business license",
]


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        return "\n".join((page.extract_text() or "") for page in pdf.pages)


def _extract_from_excel(file_bytes: bytes) -> str:
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    lines = []
    for ws in wb.worksheets:
        for row in ws.iter_rows(values_only=True):
            lines.append("\t".join("" if cell is None else str(cell) for cell in row))
    return "\n".join(lines)


def _fallback_decode(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="ignore")


def _looks_like_csv(text: str) -> bool:
    try:
        sample = text[:4096]
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        rows = list(csv.reader(io.StringIO(sample), dialect))
        if len(rows) >= 2:
            first_len = len(rows[0])
            if first_len > 1:
                for row in rows[1:10]:
                    if len(row) != first_len:
                        return False
                return True
    except Exception:
        pass
    return False


def _parse_csv_text(text: str) -> List[Dict[str, str]]:
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except Exception:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    return [row for row in reader if any(str(v).strip() for v in row.values())]


def _normalize_key(key):
    key = str(key).strip().lower()
    key = key.replace("/", " ")
    key = re.sub(r"[^a-z0-9]+", "_", key)
    return key.strip("_")


def _parse_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    s = str(value).strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y", "%d/%m/%Y", "%Y/%m/%d", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def _status_from_due_date(due_date: Optional[date]) -> str:
    if not due_date:
        return STATUS_FLAGGED
    today = date.today()
    if due_date < today:
        return STATUS_EXPIRED
    if (due_date - today).days <= 90:
        return STATUS_EXPIRING_SOON
    return STATUS_VALID


def _regex_extract(text: str) -> Dict[str, Any]:
    details: Dict[str, Any] = {}
    m = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text)
    if m:
        details["contact_email"] = m.group(0).strip()
    m = re.search(r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", text)
    if m:
        details["contact_phone"] = m.group(0).strip()
    for pattern in [
        r"(?:policy\s*#?|policy\s*number)[:\s]*([A-Za-z0-9\-]+)",
        r"(?:certificate\s*#?|certificate\s*number)[:\s]*([A-Za-z0-9\-]+)",
    ]:
        m = re.search(pattern, text, re.I)
        if m:
            details["document_number"] = m.group(1).strip()
            break
    for pattern in [
        r"(?:carrier|insurance\s*company|issuing\s*authority)[:\s]*([^\n,]+)",
        r"(?:company|carrier)[:\s]*([^\n,]+)",
    ]:
        m = re.search(pattern, text, re.I)
        if m:
            details["carrier"] = m.group(1).strip()
            break
    m = re.search(r"(?:effective\s*date|issue\s*date)[:\s]*([0-9/.\-]+)", text, re.I)
    if m:
        details["effective_date"] = m.group(1).strip()
    m = re.search(r"(?:expiration\s*date|renewal\s*date|expiry\s*date)[:\s]*([0-9/.\-]+)", text, re.I)
    if m:
        details["expiration_date"] = m.group(1).strip()
    m = re.search(r"named\s*insured[:\s]*([^\n]+)", text, re.I)
    if m:
        details["named_insured"] = m.group(1).strip()
    m = re.search(r"certificate\s*holder[:\s]*([^\n]+)", text, re.I)
    if m:
        details["certificate_holder"] = m.group(1).strip()
    if re.search(r"additional\s*insured[:\s]*(yes|true|y)", text, re.I):
        details["additional_insured"] = "yes"
    elif re.search(r"additional\s*insured[:\s]*(no|false|n)", text, re.I):
        details["additional_insured"] = "no"
    for dtype in DOCUMENT_TYPES:
        if dtype.lower() in text.lower():
            details["document_type"] = dtype
            break
    m = re.search(r"(?:limit|coverage\s*limit|limits?)\s*[:\$]?\s*([\d,]+(?:\.\d+)?)", text, re.I)
    if m:
        details["coverage_limit"] = m.group(1).strip()
    sub_name = None
    for label in [
        r"insured\s*[:\-]?\s*([^\n]+)",
        r"applicant\s*[:\-]?\s*([^\n]+)",
        r"company\s*name\s*[:\-]?\s*([^\n]+)",
        r"subcontractor\s*[:\-]?\s*([^\n]+)",
    ]:
        m = re.search(label, text, re.I)
        if m:
            sub_name = m.group(1).strip()
            break
    if not sub_name:
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        if lines:
            sub_name = lines[0][:120]
    details["subcontractor_company_name"] = sub_name or "Unknown"
    return details


def _records_from_llm(text):
    if not _client:
        return None
    prompt = (
        "Extract subcontractor compliance document fields from the text. "
        "Return JSON list with one object. Each object must have title, status, details, due_date. "
        "title MUST be the subcontractor company name, never the document type. "
        "status must be one of: valid:good, missing:critical, expiring_soon:warning, expired:critical, flagged:warning. "
        "due_date is an ISO-8601 string or null."
    )
    try:
        resp = _client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "system", "content": "You are a document extraction API."},
                      {"role": "user", "content": prompt + "\n\nTEXT:\n" + text[:5000]}],
        )
        content = resp.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.strip("`").replace("json\n", "", 1)
        data = json.loads(content)
        if isinstance(data, dict):
            data = [data]
        return data
    except Exception:
        return None


def process_file(file_bytes: bytes) -> List[Dict[str, Any]]:
    text = ""
    for extractor in (_extract_text_from_pdf, _extract_from_excel, _fallback_decode):
        try:
            text = extractor(file_bytes)
            if text and text.strip():
                break
        except Exception:
            continue
    if not text or not text.strip():
        return []
    if _looks_like_csv(text):
        rows = _parse_csv_text(text)
        records = []
        for row in rows:
            details = {_normalize_key(k): (str(v).strip() if v is not None else "") for k, v in row.items()}
            title = None
            for key in ("subcontractor company name", "subcontractor_company_name", "company", "supplier", "vendor", "name"):
                if details.get(key):
                    title = details[key]
                    break
            if not title:
                for key, val in details.items():
                    if val and key.lower() not in {"product", "price", "qty", "quantity"}:
                        title = val
                        break
            title = title or "Unknown"
            due_date_str = None
            for key in ("expiration_renewal_date", "expiration_date", "expiration", "due_date", "renewal_date"):
                if details.get(key):
                    due_date_str = details[key]
                    break
            due_date = _parse_date(due_date_str)
            status = _status_from_due_date(due_date)
            records.append({
                "title": title,
                "status": status,
                "details": details,
                "due_date": due_date.isoformat() if due_date else None,
            })
        if records:
            return records
    details = _regex_extract(text)
    due_date = _parse_date(details.get("expiration_date"))
    status = _status_from_due_date(due_date)
    title = details.get("subcontractor_company_name", "Unknown")
    record = {
        "title": title,
        "status": status,
        "details": details,
        "due_date": due_date.isoformat() if due_date else None,
    }
    llm_records = _records_from_llm(text)
    if llm_records:
        validated = []
        for rec in llm_records:
            if not isinstance(rec, dict):
                continue
            title = rec.get("title")
            if not isinstance(title, str) or not title.strip():
                title = record["title"]
            status = rec.get("status")
            if not isinstance(status, str) or not status.strip():
                status = record["status"]
            details = rec.get("details")
            if not isinstance(details, dict) or not details:
                details = record["details"]
            due_date_val = rec.get("due_date")
            if isinstance(due_date_val, str) and due_date_val.strip():
                parsed = _parse_date(due_date_val)
                due_date_val = parsed.isoformat() if parsed else record["due_date"]
            else:
                due_date_val = record["due_date"]
            validated.append({
                "title": title,
                "status": status,
                "details": details,
                "due_date": due_date_val,
            })
        if validated:
            return validated
    return [record]
