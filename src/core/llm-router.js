export const TASK_COMPLEXITY = {
  simple: ["generate_tests", "create_test_template", "suggest_fix"],
  complex: ["por_que_falhou", "suggest_selector_fix", "analyze_file_methods"],
};

export function resolveLLMProvider(taskType = "simple") {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.QA_LAB_LLM_API_KEY;
  const OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const CUSTOM_URL = process.env.QA_LAB_LLM_BASE_URL;

  const simpleModel = process.env.QA_LAB_LLM_SIMPLE;
  const complexModel = process.env.QA_LAB_LLM_COMPLEX;

  if (CUSTOM_URL) {
    const model = taskType === "complex" ? (complexModel || "llama3.1:70b") : (simpleModel || "llama3.1:8b");
    return { provider: "custom", apiKey: process.env.QA_LAB_LLM_API_KEY || "not-needed", baseUrl: CUSTOM_URL, model };
  }

  if (!GROQ_KEY && !GEMINI_KEY && !OPENAI_KEY) {
    const model = taskType === "complex" ? (complexModel || "llama3.1:70b") : (simpleModel || "llama3.1:8b");
    return { provider: "ollama", apiKey: "not-needed", baseUrl: `${OLLAMA_URL}/v1`, model };
  }

  let provider = GROQ_KEY ? "groq" : GEMINI_KEY ? "gemini" : "openai";
  const apiKey = GROQ_KEY || GEMINI_KEY || OPENAI_KEY;
  const baseUrl = provider === "groq"
    ? "https://api.groq.com/openai/v1"
    : provider === "gemini"
      ? "https://generativelanguage.googleapis.com/v1beta"
      : "https://api.openai.com/v1";

  let model;
  if (taskType === "complex") {
    model = complexModel || (provider === "groq" ? "llama-3.3-70b-versatile" : provider === "gemini" ? "gemini-1.5-pro" : "gpt-4o");
  } else {
    model = simpleModel || (provider === "groq" ? "llama-3.1-8b-instant" : provider === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini");
  }

  return { provider, apiKey, baseUrl, model };
}
