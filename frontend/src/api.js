// Cliente HTTP simples para a API do Fluxo CRM backend.
// Configurado via variáveis de ambiente do Vite (precisam do prefixo VITE_
// e são embutidas no build — veja o .env.example na raiz do projeto).

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const API_KEY = import.meta.env.VITE_API_KEY || "";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let detalhe = "";
    try {
      detalhe = (await res.json()).erro;
    } catch {
      /* corpo não era JSON */
    }
    throw new Error(detalhe || `Erro ${res.status} ao chamar ${path}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listLeads: (estagio) => request(`/api/leads${estagio ? `?estagio=${estagio}` : ""}`),
  getLead: (id) => request(`/api/leads/${id}`),
  createLead: (data) => request("/api/leads", { method: "POST", body: JSON.stringify(data) }),
  updateLead: (id, patch) => request(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  qualifyLead: (id) => request(`/api/leads/${id}/qualify`, { method: "POST" }),

  listCampaigns: () => request("/api/campaigns"),
  createCampaign: (data) => request("/api/campaigns", { method: "POST", body: JSON.stringify(data) }),
};

export { API_URL };
