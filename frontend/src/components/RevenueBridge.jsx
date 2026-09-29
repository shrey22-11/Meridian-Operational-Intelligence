import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { sum, money, compact } from "../lib/format";

export default function RevenueBridge({ data }) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const previous = sum(data.regions, "previous_revenue");
  const volume = sum(data.regions, "volume_effect");
  const basket = sum(data.regions, "basket_effect");
  const current = sum(data.regions, "revenue");
  const steps = [
    { label: "Previous revenue", value: previous, from: 0, to: previous, note: "Booked revenue in the previous complete calendar month." },
    { label: "Volume effect", value: volume, from: previous, to: previous + volume, note: "The recorded contribution from the change in order volume." },
    { label: "Basket effect", value: basket, from: previous + volume, to: current, note: "The recorded contribution from the change in average basket value." },
    { label: "Current revenue", value: current, from: 0, to: current, note: `Booked revenue in ${data.month}. Volume and basket effects reconcile the change; they do not establish its cause.` },
  ];
  const top = Math.max(1, ...steps.flatMap((step) => [step.from, step.to]));
  const bottom = Math.min(0, ...steps.flatMap((step) => [step.from, step.to]));
  const y = (value) => 190 - ((value - bottom) / (top - bottom)) * 155;
  return <div className="revenue-story">
    <div className="story-scope"><span className="eyebrow">REVENUE ANATOMY</span><span>{data.month} · complete calendar months · all regions, independent of reporting filters</span></div>
    <svg className="bridge-plot" viewBox="0 0 700 230" role="img" aria-label="Monthly revenue waterfall. Exact values are available in the four stage buttons below.">
      {[bottom, (top + bottom) / 2, top].map((value, i) => <g key={i}><path d={`M60 ${y(value)}H690`} className="bridge-grid" /><text x="52" y={y(value) + 4} textAnchor="end">{compact(value)}</text></g>)}
      {steps.map((step, i) => <g key={step.label} opacity={active === i ? 1 : .5}>
        <motion.rect initial={false} animate={{ y: y(Math.max(step.from, step.to)), height: Math.max(2, Math.abs(y(step.from) - y(step.to))) }} transition={{ duration: reduce ? 0 : .5 }} x={85 + i * 155} width="100" rx="3" fill={i === 0 || i === 3 ? "var(--accent)" : step.value < 0 ? "var(--negative)" : "var(--positive)"} />
        {i < 3 && <path className="bridge-connector" d={`M${185 + i * 155} ${y(step.to)}H${240 + i * 155}`} />}
        <text x={135 + i * 155} y="218" textAnchor="middle">0{i + 1}</text>
      </g>)}
    </svg>
    <div className="bridge-stages" role="group" aria-label="Revenue decomposition stages">{steps.map((step, i) => <button key={step.label} aria-pressed={active === i} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)}><span>0{i + 1} / {step.label}</span><strong>{money(step.value)}</strong></button>)}</div>
    <p className="bridge-explanation">{steps[active].note}</p>
  </div>;
}
