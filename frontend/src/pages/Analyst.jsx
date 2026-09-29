import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, RotateCcw } from "lucide-react";
import { PageHeading, ErrorState } from "../components/UI";
import EvidencePanel, { toolLabels } from "../components/EvidencePanel";
import { Reveal } from "../components/Motion";

const questions = [
  {
    title: "Revenue movement",
    text: "Why did revenue change last month? Separate volume and basket effects.",
  },
  {
    title: "Delivery priorities",
    text: "Which three open orders have the highest delivery-delay risk? Cite the data.",
  },
  {
    title: "Operational exceptions",
    text: "What anomalies should management investigate, and what does the policy recommend?",
  },
  {
    title: "Business definitions",
    text: "How is booked revenue defined? Retrieve and cite the policy.",
  },
];
function AnswerText({ text, onCitation }) {
  return (
    <div className="answer-text">
      {text.split(/\n\s*\n/).map((paragraph, index) => (
        <p key={index}>
          {paragraph
            .split(/(\[T\d+\]|\*\*[^*]+\*\*|`[^`]+`)/g)
            .map((piece, i) =>
              /^\[T\d+\]$/.test(piece) ? (
                <button
                  key={i}
                  className="citation-button"
                  onClick={() => onCitation(piece.slice(1, -1))}
                  aria-label={`View evidence ${piece.slice(1, -1)}`}
                >
                  {piece.slice(1, -1)}
                </button>
              ) : piece.startsWith("**") ? (
                <strong key={i}>{piece.slice(2, -2)}</strong>
              ) : piece.startsWith("`") ? (
                <span key={i}>{piece.slice(1, -1).replaceAll("_", " ")}</span>
              ) : (
                piece
              ),
            )}
        </p>
      ))}
    </div>
  );
}
export default function Analyst({ health, analyst }) {
  const { runs, active, setActiveId, question, setQuestion, busy, ask, clear } =
    analyst;
  const [evidenceId, setEvidenceId] = useState(null);
  useEffect(() => setEvidenceId(null), [active?.id, active?.status]);
  function selectEvidence(id) {
    setEvidenceId(id);
    const panel = document.getElementById("analysis-evidence");
    panel?.focus({ preventScroll: true });
    if (window.innerWidth < 1100)
      panel?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  }
  function submit(event) {
    event.preventDefault();
    ask(question);
  }
  const evidenceMode =
    !health?.ai_provider || health.ai_provider === "evidence";
  return (
    <>
      <PageHeading
        eyebrow="ANALYTICAL WORKSPACE"
        title="Ask Meridian"
        description="Frame a business question. Inspect the answer and its sources."
        action={
          <button
            className="button quiet"
            disabled={busy || !runs.length}
            onClick={clear}
          >
            <RotateCcw size={14} />
            Clear session
          </button>
        }
      />
      <div className="analyst-status">
        <span className={`connection-dot ${health ? "connected" : ""}`} />
        <strong>
          {!health
            ? "Provider status unavailable"
            : evidenceMode
              ? "Evidence-only mode"
              : health.ai_provider === "ollama"
                ? "Local analyst"
                : "Connected analyst"}
        </strong>
        <span>
          {!health
            ? "The data service could not be reached."
            : evidenceMode
              ? "Real data tools; no language-model explanation."
              : `${health.ai_provider} / ${health.ai_model}`}
        </span>
        <span className="analyst-status-right">Read-only access</span>
      </div>
      <div className="analyst-workspace">
        <section className="analysis-notebook">
          <form className="question-form" onSubmit={submit}>
            <label htmlFor="analyst-question">BUSINESS QUESTION</label>
            <textarea
              id="analyst-question"
              aria-label="Ask the analyst"
              placeholder={
                runs.length
                  ? "Ask a follow-up about these findings…"
                  : "What changed in the business, and what should we investigate?"
              }
              minLength={3}
              maxLength={2000}
              value={question}
              disabled={busy}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  ask(question);
                }
              }}
            />
            <div>
              <span>
                Dates refer to the dataset snapshot.
                <small>Ctrl / ⌘ + Enter to run</small>
              </span>
              <button
                className="button primary"
                disabled={busy || question.trim().length < 3}
              >
                {busy
                  ? "Analysis running…"
                  : evidenceMode
                    ? "Retrieve evidence"
                    : "Run analysis"}
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
          {!!runs.length && (
            <div className="analysis-history" aria-label="Session analyses">
              <span>SESSION</span>
              {runs.map((run, index) => (
                <button
                  key={run.id}
                  className={active?.id === run.id ? "selected" : ""}
                  aria-pressed={active?.id === run.id}
                  onClick={() => setActiveId(run.id)}
                  title={run.question}
                >
                  {String(index + 1).padStart(2, "0")}
                  <span>{run.question}</span>
                  {run.status === "running" && <i className="activity-dot" />}
                  {run.status === "error" && (
                    <span className="risk-text">Failed</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {!active ? (
            <div className="analysis-starters">
              <div className="section-heading">
                <div>
                  <h2>Start with a business question</h2>
                  <p>Use an investigation below, or frame your own question.</p>
                </div>
              </div>
              {questions.map((item, index) => (
                <button
                  key={item.title}
                  className="starter-row"
                  onClick={() => ask(item.text)}
                  disabled={busy}
                >
                  <span className="starter-number">0{index + 1}</span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.text}</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
              <p className="footnote">
                Answers distinguish calculated metrics, model predictions and
                document guidance. Sources remain available for inspection.
              </p>
            </div>
          ) : (
            <div className="analysis-result" aria-live="polite">
              <div className="analysis-question">
                <span className="eyebrow">
                  QUESTION{" "}
                  {String(
                    runs.findIndex((run) => run.id === active.id) + 1,
                  ).padStart(2, "0")}
                </span>
                <h2>{active.question}</h2>
              </div>
              {active.status === "running" && (
                <div className="analysis-pending" role="status">
                  <span className="activity-dot" />
                  <div>
                    <strong>Analyst request in progress</strong>
                    <p>
                      Waiting for the provider and completed tool results. Provider responses may take a moment.
                    </p>
                  </div>
                </div>
              )}
              {active.status === "error" && (
                <ErrorState
                  title="Analysis could not be completed"
                  error={active.error}
                  retry={() => ask(active.question, active.id)}
                />
              )}
              {active.result && (
                <Reveal key={active.id}>
                  <div className="investigation-trail" aria-label="Returned evidence trail">
                    <span className="eyebrow">RETURNED EVIDENCE · COMPLETED RESPONSE</span>
                    <div>{active.result.evidence.map((entry, index) => <Reveal key={entry.id} delay={index * .045}><button onClick={() => selectEvidence(entry.id)} aria-pressed={evidenceId === entry.id}><span>{entry.id}</span><strong>{toolLabels[entry.tool] || entry.tool}</strong><small>{entry.result?.error ? "Tool returned an error" : entry.tool === "search_policies" ? "Retrieved policy" : "Returned tool result"}</small></button></Reveal>)}</div>
                  </div>
                  <div className={`result-label validation-${active.result.guard.status}`}>
                    <span>
                      {active.result.mode === "evidence"
                        ? "STRUCTURED EVIDENCE"
                        : "ANALYSIS"}
                    </span>
                    <span
                      className={
                        active.result.guard.status === "passed"
                          ? "positive"
                          : active.result.guard.status === "withheld"
                            ? "attention"
                            : "muted"
                      }
                    >
                      {active.result.guard.status === "passed"
                        ? "Numerical & citation checks passed"
                        : active.result.guard.status === "withheld"
                          ? "Explanation withheld"
                          : "No generated interpretation"}
                    </span>
                  </div>
                  <AnswerText
                    text={active.result.answer}
                    onCitation={selectEvidence}
                  />
                  <div className="answer-sources">
                    {active.result.evidence.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => selectEvidence(entry.id)}
                      >
                        <span>{entry.id}</span>
                        {entry.tool === "search_policies"
                          ? "Policy evidence"
                          : "Data evidence"}
                        <ArrowUpRight size={12} />
                      </button>
                    ))}
                  </div>
                  <p className="footnote">
                    Evidence checks reduce invented metrics; they do not
                    establish causation or verify every interpretation. Review
                    the source before acting.
                  </p>
                </Reveal>
              )}
            </div>
          )}
        </section>
        <EvidencePanel
          entries={active?.result?.evidence || []}
          status={active?.status}
          selected={evidenceId}
          onSelect={setEvidenceId}
        />
      </div>
    </>
  );
}
