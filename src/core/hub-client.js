/**
 * Cliente para o Learning Hub - envia learnings de forma assíncrona.
 * Se LEARNING_HUB_URL estiver configurado, saveProjectMemory envia para o Hub.
 */

let hubUrl = null;

export function setHubUrl(url) {
  hubUrl = (url || "").replace(/\/$/, "");
}

export function getHubUrl() {
  if (hubUrl) return hubUrl;
  const env = process.env.LEARNING_HUB_URL || process.env.QA_LAB_LEARNING_HUB_URL;
  if (env) {
    hubUrl = env.replace(/\/$/, "");
    return hubUrl;
  }
  return null;
}

export function isHubEnabled() {
  return !!getHubUrl();
}

/**
 * Envia learnings para o Hub. Assíncrono, não bloqueia.
 * Adiciona projectId (cwd ou env) para rastreamento.
 */
export async function syncLearningsToHub(learnings) {
  const baseUrl = getHubUrl();
  if (!baseUrl) return;

  const entries = Array.isArray(learnings) ? learnings : [learnings];
  if (entries.length === 0) return;

  const projectId = process.env.LEARNING_HUB_PROJECT_ID || process.cwd().split("/").pop() || "default";

  const payload = entries.map((e) => ({
    ...e,
    projectId,
  }));

  try {
    const res = await fetch(`${baseUrl}/learning`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnings: payload }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`[learning-hub] POST /learning failed ${res.status}: ${txt}`);
    }
  } catch (err) {
    console.warn("[learning-hub] sync failed:", err.message);
  }
}
