import { useCallback, useEffect, useRef, useState } from "react";
import { post } from "../lib/api";

export function useScenario(initial, fields) {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [revision, setRevision] = useState(0);
  const live = useRef(initial);
  const active = useRef(null);
  const generation = useRef(0);
  const cache = useRef(new Map());
  const attempted = useRef(null);
  const mounted = useRef(true);
  const valid = fields.every(({ name, min, max, step }) => {
    const value = form[name];
    return value !== "" && Number.isFinite(value) && value >= min && value <= max &&
      Math.abs((value - min) / step - Math.round((value - min) / step)) < 0.00001;
  });
  const key = JSON.stringify(form);
  const dirty = result && key !== JSON.stringify(result.inputs);
  const update = useCallback((next) => {
    live.current = next;
    generation.current += 1;
    setForm(next);
    setError(null);
    setRevision((v) => v + 1);
  }, []);
  const run = useCallback(async (event) => {
    event?.preventDefault();
    if (!valid || active.current) return;
    const inputs = { ...live.current };
    const requestKey = JSON.stringify(inputs);
    const version = generation.current;
    attempted.current = { key: requestKey, version };
    setError(null);
    const accept = (prediction) => {
      if (!mounted.current || version !== generation.current) return;
      const next = { ...prediction, inputs };
      setResult(next);
      setBaseline((previous) => previous || next);
    };
    if (cache.current.has(requestKey)) {
      accept(cache.current.get(requestKey));
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    try {
      const prediction = await post("predictions/scenario", inputs, controller.signal);
      if (controller.signal.aborted) return;
      cache.current.set(requestKey, prediction);
      if (cache.current.size > 30) cache.current.delete(cache.current.keys().next().value);
      accept(prediction);
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted && version === generation.current) setError(failure);
    } finally {
      if (active.current === controller) {
        active.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }, [valid]);
  useEffect(() => {
    if (!revision || dragging || busy || !valid || (attempted.current?.key === key && attempted.current?.version === generation.current)) return;
    const timer = setTimeout(() => run(), 650);
    return () => clearTimeout(timer);
  }, [key, revision, dragging, busy, valid, run]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; active.current?.abort(); };
  }, []);
  function reset() {
    generation.current += 1;
    active.current?.abort();
    active.current = null;
    attempted.current = null;
    live.current = initial;
    setForm(initial); setResult(null); setBaseline(null); setError(null);
    setBusy(false); setDragging(false); setRevision(0);
  }
  return { form, update, result, baseline, busy, error, dirty, valid, run, reset, setDragging };
}
