import os
import time
import json
import datetime
import traceback
import requests
import processor

SUPABASE_URL = os.environ['SUPABASE_URL'].rstrip('/')
SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
PRODUCT_ID = os.environ['PRODUCT_ID']
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')

REST_URL = f"{SUPABASE_URL}/rest/v1"
SB_HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
}
RESULTS_BUCKET = "results"
NOTIFICATIONS_URL = "https://njyvnmczoydsaewvfhyq.supabase.co/rest/v1/notifications"

def download_file(bucket, file_path):
    if file_path.startswith(bucket + "/"):
        file_path = file_path[len(bucket) + 1:]
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{file_path}"
    resp = requests.get(url, headers={"Authorization": f"Bearer {SUPABASE_SERVICE_KEY}", "apikey": SUPABASE_SERVICE_KEY})
    resp.raise_for_status()
    return resp.content

def upload_result(bucket, path, data_bytes):
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    resp = requests.post(url, headers={"Authorization": f"Bearer {SUPABASE_SERVICE_KEY}", "apikey": SUPABASE_SERVICE_KEY, "Content-Type": "application/octet-stream"}, data=data_bytes)
    resp.raise_for_status()
    return f"{bucket}/{path}"

def notify(customer_id, title, body, notif_type):
    try:
        resp = requests.post(
            NOTIFICATIONS_URL,
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "product_id": PRODUCT_ID,
                "customer_id": customer_id,
                "title": title,
                "body": body,
                "type": notif_type,
                "read": False,
            },
        )
        resp.raise_for_status()
    except Exception:
        pass

def update_job(job_id, status, output_file_path, result_summary):
    url = f"{REST_URL}/jobs?id=eq.{job_id}"
    payload = {
        "status": status,
        "output_file_path": output_file_path,
        "result_summary": result_summary,
        "completed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    resp = requests.patch(url, headers=SB_HEADERS, json=payload)
    resp.raise_for_status()

def process_job(job):
    customer_id = job["customer_id"]
    input_path = job["input_file_path"]
    file_bytes = download_file("uploads", input_path)
    records = processor.process_file(file_bytes)
    for r in records:
        requests.post(
            f"{REST_URL}/records",
            headers={**SB_HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"},
            json={
                "product_id": PRODUCT_ID,
                "customer_id": customer_id,
                "title": r["title"],
                "status": r["status"],
                "details": r["details"],
                "source_file_path": input_path,
                "due_date": r.get("due_date"),
            },
        ).raise_for_status()
    result_data = json.dumps({"records": records}, default=str).encode()
    result_path = upload_result(RESULTS_BUCKET, f"job_{job['id']}.json", result_data)
    update_job(job["id"], "completed", result_path, f"Processed {len(records)} records")
    notify(customer_id, "Processing complete", "Your upload has been processed successfully.", "success")

def poll():
    while True:
        try:
            params = {
                "select": "*",
                "status": "eq.pending",
                "job_type": "eq.process_upload",
                "product_id": f"eq.{PRODUCT_ID}",
            }
            resp = requests.get(f"{REST_URL}/jobs", headers=SB_HEADERS, params=params)
            resp.raise_for_status()
            jobs = resp.json()
            for job in jobs:
                try:
                    process_job(job)
                except Exception as e:
                    error_summary = f"{type(e).__name__}: {e}"
                    try:
                        update_job(job.get("id"), "failed", "", error_summary)
                        notify(job.get("customer_id"), "Processing failed", "There was an error processing your upload.", "error")
                    except Exception:
                        pass
        except Exception:
            traceback.print_exc()
        time.sleep(60)

if __name__ == "__main__":
    print("Poller started")
    poll()
