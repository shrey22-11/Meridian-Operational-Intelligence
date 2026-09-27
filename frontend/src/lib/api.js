export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api/${path}`, options);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(
      "The analytics service could not be reached. Check that the local backend is running.",
      0,
    );
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      typeof body.detail === "string"
        ? body.detail
        : "Please check the request values and try again.";
    throw new ApiError(detail, response.status);
  }
  return body;
}

export const post = (path, body, signal) =>
  api(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
export const query = (values) =>
  new URLSearchParams(
    Object.entries(values).filter(([, value]) => value != null && value !== ""),
  ).toString();
