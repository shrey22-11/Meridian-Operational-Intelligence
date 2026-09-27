import { useRef, useState } from "react";
import { post } from "../lib/api";

export default function useAnalyst() {
  const [runs, setRuns] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [question, setQuestion] = useState("");
  const pending = useRef(false);
  const busy = runs.some((run) => run.status === "running");
  async function ask(text, retryId) {
    const clean = text.trim();
    if (clean.length < 3 || pending.current) return;
    pending.current = true;
    const id = retryId || crypto.randomUUID();
    const history = runs
      .filter((run) => run.status === "complete" && run.id !== retryId)
      .flatMap((run) => [
        { role: "user", content: run.question },
        { role: "assistant", content: run.result.answer.slice(0, 6000) },
      ])
      .slice(-8);
    const entry = {
      id,
      question: clean,
      status: "running",
      result: null,
      error: null,
    };
    setRuns((current) =>
      retryId
        ? current.map((run) => (run.id === id ? entry : run))
        : [...current, entry],
    );
    setActiveId(id);
    setQuestion("");
    try {
      const result = await post("ai/chat", { message: clean, history });
      setRuns((current) =>
        current.map((run) =>
          run.id === id ? { ...run, status: "complete", result } : run,
        ),
      );
    } catch (error) {
      setRuns((current) =>
        current.map((run) =>
          run.id === id ? { ...run, status: "error", error } : run,
        ),
      );
    } finally {
      pending.current = false;
    }
  }
  function clear() {
    if (!pending.current) {
      setRuns([]);
      setActiveId(null);
      setQuestion("");
    }
  }
  return {
    runs,
    activeId,
    setActiveId,
    question,
    setQuestion,
    ask,
    clear,
    busy,
    active: runs.find((run) => run.id === activeId),
  };
}
