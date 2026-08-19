import { config } from "../config.js";

// Protege rotas administrativas (tudo que não é o webhook do WhatsApp, que
// tem sua própria verificação de assinatura). O front-end deve enviar o
// header `x-api-key` com o valor de ADMIN_API_KEY.
export function requireApiKey(req, res, next) {
  const key = req.header("x-api-key");
  if (!key || key !== config.adminApiKey) {
    return res.status(401).json({ erro: "Chave de API ausente ou inválida" });
  }
  next();
}
