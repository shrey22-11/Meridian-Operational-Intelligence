"""Live local provider evaluation. Results persist as evidence, never canned answers."""
import argparse
import json
import time
from backend.app.config import ROOT
from ai.analyst import chat


def main():
    parser=argparse.ArgumentParser();parser.add_argument("--question");args=parser.parse_args()
    questions=[args.question] if args.question else [
        "What was total booked revenue in December 2025? Give the exact INR value and cite your tool.",
        "How is booked revenue defined, and what should management check before claiming a revenue decline was caused by marketing? Retrieve policy guidance.",
        "Which three open orders have the highest delivery-delay risk? Cite the data."]
    results=[]
    for question in questions:
        start=time.monotonic();result=chat(question);result["question"]=question
        result["seconds"]=round(time.monotonic()-start,2);results.append(result)
        print(json.dumps({"question":question,"answer":result["answer"],"guard":result["guard"],
                          "tools":[e["tool"] for e in result["evidence"]],"seconds":result["seconds"]},indent=2),flush=True)
    (ROOT/"reports").mkdir(exist_ok=True)
    (ROOT/"reports/ai_live_evaluation.json").write_text(json.dumps(results,indent=2,default=str))
    if any(r["guard"]["status"]!="passed" for r in results):raise SystemExit("One or more explanations were withheld; inspect live evaluation.")


if __name__=="__main__":main()
