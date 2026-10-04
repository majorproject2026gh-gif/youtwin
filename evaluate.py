"""
YouTwin — Evaluation Metrics Script

Runs a labeled test set of questions against your LIVE running system
(api-service must be up) and computes real, reportable metrics:
Accuracy, Precision, Recall, F1 for the guardrail's grounded/refused
decision, plus average confidence and response latency.

This produces genuine numbers from your actual trained twin — not
estimates — suitable for the "evaluation metrics" section of your
report/presentation.

Usage:
    1. Make sure api-service is running (npm run dev, port 4000) and
       your twin is already trained.
    2. Edit TWIN_ID below to your actual trained twin's ID (find it via
       localStorage.getItem("youtwin_twinId") in your browser console
       while on the app).
    3. Edit the TEST_SET below to match content YOUR trained video
       actually covers (the examples assume the "who built this /
       five modules / guardrail" style demo video from tonight).
    4. Run: python evaluate.py
"""
import time
import requests

API_BASE = "http://localhost:4000"
TWIN_ID = "PASTE_YOUR_TWIN_ID_HERE"

# label: "should_answer" = a question your video genuinely covers,
#        "should_refuse" = a question it does NOT cover (out of scope)
# Edit these to match YOUR actual trained content before running.
TEST_SET = [
    {"question": "Who built this project?", "label": "should_answer"},
    {"question": "What are YouTwin's five modules?", "label": "should_answer"},
    {"question": "What is the zero-hallucination guardrail?", "label": "should_answer"},
    {"question": "What college is this project from?", "label": "should_answer"},
    {"question": "What does the ingestion module do?", "label": "should_answer"},
    {"question": "What is stylometric extraction?", "label": "should_answer"},
    {"question": "What programming language did you use?", "label": "should_refuse"},
    {"question": "How much does this cost?", "label": "should_refuse"},
    {"question": "What's your favorite pizza topping?", "label": "should_refuse"},
    {"question": "When will this be available to the public?", "label": "should_refuse"},
    {"question": "What's the weather like today?", "label": "should_refuse"},
    {"question": "Who is the president of the United States?", "label": "should_refuse"},
]


def run_evaluation():
    results = []
    print(f"Running {len(TEST_SET)} test questions against twin {TWIN_ID}...\n")

    for case in TEST_SET:
        start = time.time()
        try:
            resp = requests.post(
                f"{API_BASE}/chat",
                json={"twinId": TWIN_ID, "message": case["question"]},
                timeout=30,
            )
            latency_ms = (time.time() - start) * 1000
            data = resp.json()
            actual = "should_refuse" if data.get("refused") else "should_answer"
            confidence = data.get("confidence", 0.0)
        except Exception as exc:
            print(f"  ERROR on '{case['question']}': {exc}")
            continue

        correct = actual == case["label"]
        results.append({
            "question": case["question"],
            "expected": case["label"],
            "actual": actual,
            "correct": correct,
            "confidence": confidence,
            "latency_ms": latency_ms,
        })
        status = "✓" if correct else "✗"
        print(f"  {status} [{case['label']:>14}] {case['question'][:50]:<50} "
              f"conf={confidence:.2f} latency={latency_ms:.0f}ms")

    return results


def compute_metrics(results):
    n = len(results)
    if n == 0:
        print("\nNo results to evaluate.")
        return

    tp = sum(1 for r in results if r["expected"] == "should_answer" and r["actual"] == "should_answer")
    fn = sum(1 for r in results if r["expected"] == "should_answer" and r["actual"] == "should_refuse")
    fp = sum(1 for r in results if r["expected"] == "should_refuse" and r["actual"] == "should_answer")
    tn = sum(1 for r in results if r["expected"] == "should_refuse" and r["actual"] == "should_refuse")

    accuracy = (tp + tn) / n
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0  # guardrail false-positive rate
    avg_confidence = sum(r["confidence"] for r in results) / n
    avg_latency = sum(r["latency_ms"] for r in results) / n

    print("\n" + "=" * 60)
    print("EVALUATION METRICS")
    print("=" * 60)
    print(f"Test set size:                {n}")
    print(f"Correct decisions:            {tp + tn}/{n}")
    print(f"Accuracy:                     {accuracy:.1%}")
    print(f"Precision (should_answer):    {precision:.1%}")
    print(f"Recall (should_answer):       {recall:.1%}")
    print(f"F1 score:                     {f1:.1%}")
    print(f"Guardrail false-positive rate:{fpr:.1%}  (answered when it should have refused)")
    print(f"Average confidence score:     {avg_confidence:.2f}")
    print(f"Average response latency:     {avg_latency:.0f} ms")
    print("=" * 60)
    print("\nCopy the block above directly into your report's Evaluation section.")

    wrong = [r for r in results if not r["correct"]]
    if wrong:
        print(f"\n{len(wrong)} misclassified question(s) — worth reviewing:")
        for r in wrong:
            print(f"  - \"{r['question']}\" — expected {r['expected']}, got {r['actual']} (conf={r['confidence']:.2f})")


if __name__ == "__main__":
    results = run_evaluation()
    compute_metrics(results)
