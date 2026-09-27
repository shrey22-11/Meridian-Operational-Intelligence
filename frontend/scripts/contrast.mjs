// Targeted text-contrast audit for Meridian's opaque, non-gradient surfaces.
// Complements keyboard/browser tests; this is not a full accessibility certification.
export function textContrastAudit() {
  const rgb = (value) => (value.match(/[\d.]+/g) || []).map(Number);
  const luminance = (color) =>
    rgb(color)
      .slice(0, 3)
      .map((value) => {
        const s = value / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      })
      .reduce(
        (total, value, i) => total + value * [0.2126, 0.7152, 0.0722][i],
        0,
      );
  const failures = [];
  for (const el of document.querySelectorAll("body *")) {
    if (
      !Array.from(el.childNodes).some(
        (node) => node.nodeType === 3 && node.textContent.trim(),
      )
    )
      continue;
    if (
      !el.getClientRects().length ||
      el.closest(".sr-only,[disabled],script,style,option")
    )
      continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || Number(style.opacity) < 1) continue;
    let parent = el,
      background;
    while (parent) {
      const candidate = getComputedStyle(parent).backgroundColor;
      const values = rgb(candidate);
      if (values.length === 3 || values[3] === 1) {
        background = candidate;
        break;
      }
      parent = parent.parentElement;
    }
    if (!background) continue;
    const foreground =
      el.tagName.toLowerCase() === "tspan" ? style.fill : style.color;
    const [low, high] = [luminance(background), luminance(foreground)].sort(
      (a, b) => a - b,
    );
    const ratio = (high + 0.05) / (low + 0.05);
    const large =
      parseFloat(style.fontSize) >= 24 ||
      (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
    if (ratio + 0.01 < (large ? 3 : 4.5))
      failures.push({
        tag: el.tagName,
        class: el.getAttribute("class"),
        text: el.textContent.trim().slice(0, 70),
        ratio: +ratio.toFixed(2),
        foreground,
        background,
      });
  }
  return failures;
}
