const BASE_URL = "/api"; // SWA proxied API

export async function predictRegistro(payload) {
  const res = await fetch(`${BASE_URL}/predict`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Error /predict: ${res.status}`);
  return res.json();
}

export async function predictBatch(registros) {
  const res = await fetch(`${BASE_URL}/predict_batch`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ registros }),
  });
  if (!res.ok) throw new Error(`Error /predict_batch: ${res.status}`);
  return res.json();
}
