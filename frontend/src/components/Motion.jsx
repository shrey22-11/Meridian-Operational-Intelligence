import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useInView, animate } from "motion/react";

export const motionTiming = { micro: 0.22, reveal: 0.5, ease: [0.22, 1, 0.36, 1] };

// Values become accessible immediately; only the visual representation interpolates.
export function AnimatedNumber({ value, format = String, ...props }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const visible = useInView(ref, { once: true });
  const previous = useRef(0);
  const [display, setDisplay] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce || value == null || !Number.isFinite(Number(value))) {
      setDisplay(value);
      previous.current = value;
      return;
    }
    if (!visible) return;
    const control = animate(Number(previous.current ?? value), Number(value), {
      duration: motionTiming.reveal, ease: motionTiming.ease, onUpdate: setDisplay,
    });
    previous.current = value;
    return () => control.stop();
  }, [value, visible, reduce]);
  return <span ref={ref} role="img" aria-label={format(value)} {...props}><span aria-hidden="true">{format(display)}</span></span>;
}

export function Reveal({ children, className = "", delay = 0, as = "div", ...props }) {
  const reduce = useReducedMotion();
  const Element = as === "section" ? motion.section : motion.div;
  return <Element className={className} initial={reduce ? false : { opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.06 }}
    transition={{ duration: motionTiming.reveal, delay: Math.min(delay, 0.18), ease: motionTiming.ease }} {...props}>{children}</Element>;
}

export function ProbabilityDial({ probability, baseline, label }) {
  const reduce = useReducedMotion();
  const p = Math.max(0, Math.min(1, probability));
  return <div className="probability-dial" aria-hidden="true">
    <svg viewBox="0 0 220 220">
      <circle className="dial-track" cx="110" cy="110" r="92" />
      <motion.circle className="dial-value" cx="110" cy="110" r="92" pathLength="1"
        initial={false} animate={{ strokeDasharray: `${p} 1` }}
        transition={{ duration: reduce ? 0 : motionTiming.reveal }} transform="rotate(-90 110 110)" />
      {baseline != null && <g transform={`rotate(${baseline * 360} 110 110)`}><path className="dial-baseline" d="M110 10v18" /></g>}
      <text x="110" y="106" textAnchor="middle">{(p * 100).toFixed(1)}%</text>
      <text className="dial-caption" x="110" y="130" textAnchor="middle">{label}</text>
    </svg>
    <span>Delay probability &middot; tick marks baseline</span>
  </div>;
}

export function JourneyLink({ href, eyebrow, children }) {
  return <a className="journey-link" href={href}><span>{eyebrow}</span><strong>{children} <span aria-hidden="true">↗</span></strong></a>;
}
