import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Trello, MessageCircle, Megaphone,
  Plus, Flame, Snowflake, ThermometerSun, Send, Check, CheckCheck,
  TrendingUp, Users, DollarSign, Target, ChevronRight,
  Instagram, Globe, UserPlus, Sparkles, Copy, ArrowUpRight,
  Menu, Bot, WifiOff, RefreshCw, Clock
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";
import { api, API_URL } from "./api.js";

/* ---------------------------------------------------------------
   FONTS + DESIGN TOKENS  (mesma identidade visual do protótipo)
------------------------------------------------------------------*/

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
`;

const STAGES = [
  { id: "novo", label: "Novo lead" },
  { id: "qualificando", label: "Qualificando" },
  { id: "qualificado", label: "Qualificado" },
  { id: "negociacao", label: "Em negociação" },
  { id: "vendido", label: "Vendido" },
  { id: "perdido", label: "Perdido" },
];

const SOURCE_ICON = {
  "Instagram Ads": Instagram,
  "Google Ads": Globe,
  "Indicação": UserPlus,
  "Site": Globe,
  "WhatsApp orgânico": MessageCircle,
};

const TEMP_STYLE = {
  quente: { bg: "#FFF1EC", fg: "#C6491F", ring: "#FF6B4A", Icon: Flame, label: "Quente" },
  morno: { bg: "#FFF8E6", fg: "#8A6400", ring: "#F2B705", Icon: ThermometerSun, label: "Morno" },
  frio: { bg: "#EEF3F6", fg: "#4B6472", ring: "#7C93A8", Icon: Snowflake, label: "Frio" },
};

function iniciais(nome = "?") {
  return nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

// Fallback de score no cliente para leads que a IA ainda não classificou
// (o valor definitivo sempre vem do backend, calculado depois da conversa real).
function scoreLead(lead) {
  const orcamentoPts = { alto: 40, medio: 22, baixo: 6 }[lead.orcamento] ?? 10;
  const urgenciaPts = { imediata: 35, "30dias": 20, sem_previsao: 5 }[lead.urgencia] ?? 10;
  const interessePts = (lead.interesse ?? 5) * 2.5;
  const total = Math.min(100, Math.round(orcamentoPts + urgenciaPts + interessePts));
  const temperatura = total >= 65 ? "quente" : total >= 38 ? "morno" : "frio";
  return { score: total, temperatura };
}

function formatHora(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatRelativo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/* ---------------------------------------------------------------
   MAIN APP
------------------------------------------------------------------*/

export default function FluxoCRM() {
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState(null);

  const [page, setPage] = useState("dashboard");
  const [activeLeadId, setActiveLeadId] = useState(null);
  const [activeLeadDetail, setActiveLeadDetail] = useState(null);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      const data = await api.listLeads();
      setLeads(data);
      setLeadsError(null);
    } catch (erro) {
      setLeadsError(erro.message);
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  const fetchActiveDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await api.getLead(id);
      setActiveLeadDetail(data);
    } catch (erro) {
      showToast(`Erro ao carregar conversa: ${erro.message}`);
    }
  }, [showToast]);

  // Carrega leads ao abrir e mantém sincronizado (o webhook do WhatsApp
  // atualiza o banco em segundo plano, então o front-end faz polling).
  useEffect(() => {
    fetchLeads();
    const t = setInterval(fetchLeads, 6000);
    return () => clearInterval(t);
  }, [fetchLeads]);

  // Enquanto a tela de WhatsApp está aberta num lead, atualiza a conversa
  // com mais frequência pra mostrar as respostas reais assim que chegam.
  useEffect(() => {
    if (page !== "whatsapp" || !activeLeadId) return;
    fetchActiveDetail(activeLeadId);
    const t = setInterval(() => fetchActiveDetail(activeLeadId), 3500);
    return () => clearInterval(t);
  }, [page, activeLeadId, fetchActiveDetail]);

  const updateLeadStage = useCallback(async (id, estagio) => {
    const anterior = leads;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, estagio } : l)));
    try {
      await api.updateLead(id, { estagio });
    } catch (erro) {
      setLeads(anterior);
      showToast(`Não foi possível mover o lead: ${erro.message}`);
    }
  }, [leads, showToast]);

  const captureLead = useCallback(async (form) => {
    try {
      await api.createLead(form);
      showToast(`Lead "${form.nome}" capturado e enviado ao funil`);
      fetchLeads();
    } catch (erro) {
      showToast(`Erro ao capturar lead: ${erro.message}`);
    }
  }, [fetchLeads, showToast]);

  const startQualification = useCallback(async (lead) => {
    try {
      await api.qualifyLead(lead.id);
      showToast(`Mensagem enviada para ${lead.nome} no WhatsApp`);
      fetchLeads();
      fetchActiveDetail(lead.id);
    } catch (erro) {
      showToast(`Erro ao iniciar qualificação: ${erro.message}`);
    }
  }, [fetchLeads, fetchActiveDetail, showToast]);

  const NAV = [
    { id: "dashboard", label: "Painel", Icon: LayoutDashboard },
    { id: "kanban", label: "Funil", Icon: Trello },
    { id: "whatsapp", label: "WhatsApp IA", Icon: MessageCircle },
    { id: "marketing", label: "Marketing", Icon: Megaphone },
  ];

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }} className="h-screen w-full flex flex-col md:flex-row bg-[#F3F5F1] text-[#152621] overflow-hidden">
      <style>{FONT_IMPORT}{`
        * { box-sizing: border-box; }
        .font-display { font-family: 'Sora', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #C9D2C7; border-radius: 4px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        @keyframes floatIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .anim-in { animation: floatIn .25s ease both; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .anim-spin { animation: spin 1s linear infinite; }
      `}</style>

      {/* ---------- DESKTOP SIDEBAR ---------- */}
      <aside className="hidden md:flex md:w-60 shrink-0 flex-col bg-[#132420] text-[#EAF2EC] p-5">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-[#28C08A] flex items-center justify-center font-display font-bold text-[#0B1A16]">F</div>
          <span className="font-display font-bold text-lg tracking-tight">Fluxo CRM</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                page === id ? "bg-[#1E3A32] text-white" : "text-[#9FB3AB] hover:bg-[#1A2E28] hover:text-white"
              }`}
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-[#233F37] flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-[#7E958C]">
            <Sparkles size={14} />
            <span>IA qualificando 24/7</span>
          </div>
          <ConnectionStatus loading={leadsLoading} error={leadsError} onRetry={fetchLeads} />
        </div>
      </aside>

      {/* ---------- MOBILE TOPBAR ---------- */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#132420] text-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#28C08A] flex items-center justify-center font-display font-bold text-[#0B1A16] text-sm">F</div>
          <span className="font-display font-bold">Fluxo CRM</span>
        </div>
        <button onClick={() => setMobileNavOpen((v) => !v)} className="p-1.5"><Menu size={20} /></button>
      </header>
      {mobileNavOpen && (
        <div className="md:hidden bg-[#132420] text-white px-4 pb-3 flex flex-col gap-1 anim-in">
          {NAV.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => { setPage(id); setMobileNavOpen(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${page === id ? "bg-[#1E3A32]" : "text-[#9FB3AB]"}`}>
              <Icon size={17} /> {label}
            </button>
          ))}
          <div className="pt-2 border-t border-[#233F37] mt-1">
            <ConnectionStatus loading={leadsLoading} error={leadsError} onRetry={fetchLeads} />
          </div>
        </div>
      )}

      {/* ---------- MAIN CONTENT ---------- */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {leadsError && (
          <div className="m-4 md:m-6 flex items-start gap-2 bg-[#FFF1EC] border border-[#F6C3AE] text-[#8A3216] text-sm px-4 py-3 rounded-xl">
            <WifiOff size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Não foi possível conectar ao backend.</p>
              <p className="text-xs mt-0.5 opacity-90">
                Verifique se a API está no ar em <span className="font-mono">{API_URL}</span> e se
                <span className="font-mono"> VITE_API_URL</span>/<span className="font-mono">VITE_API_KEY</span> estão corretos. ({leadsError})
              </p>
            </div>
          </div>
        )}

        {page === "dashboard" && <Dashboard leads={leads} loading={leadsLoading} />}
        {page === "kanban" && (
          <Kanban leads={leads} onUpdateStage={updateLeadStage} setPage={setPage} setActiveLeadId={setActiveLeadId} />
        )}
        {page === "whatsapp" && (
          <WhatsAppPanel
            leads={leads}
            activeLeadId={activeLeadId}
            setActiveLeadId={setActiveLeadId}
            activeLeadDetail={activeLeadDetail}
            onStartQualification={startQualification}
          />
        )}
        {page === "marketing" && <Marketing onCaptureLead={captureLead} showToast={showToast} />}
      </main>

      {/* ---------- MOBILE BOTTOM NAV ---------- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E5DF] flex justify-around py-2 z-20">
        {NAV.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setPage(id)} className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium ${page === id ? "text-[#149267]" : "text-[#8A968E]"}`}>
            <Icon size={19} />
            {label}
          </button>
        ))}
      </nav>

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 bg-[#132420] text-white text-sm px-4 py-2.5 rounded-full shadow-lg z-30 anim-in flex items-center gap-2 max-w-[90vw]">
          <Check size={15} className="text-[#28C08A] shrink-0" /> <span className="truncate">{toast}</span>
        </div>
      )}
    </div>
  );
}

function ConnectionStatus({ loading, error, onRetry }) {
  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-[#7E958C]"><RefreshCw size={12} className="anim-spin" /> Conectando à API…</div>;
  }
  if (error) {
    return (
      <button onClick={onRetry} className="flex items-center gap-2 text-xs text-[#FF9478] hover:text-[#FFB199]">
        <WifiOff size={12} /> Backend offline — tentar de novo
      </button>
    );
  }
  return <div className="flex items-center gap-2 text-xs text-[#7E958C]"><span className="w-1.5 h-1.5 rounded-full bg-[#28C08A]" /> Conectado</div>;
}

/* ---------------------------------------------------------------
   DASHBOARD
------------------------------------------------------------------*/

function Dashboard({ leads, loading }) {
  const total = leads.length;
  const qualificados = leads.filter((l) => !["novo", "perdido"].includes(l.estagio)).length;
  const quentes = leads.filter((l) => (l.temperatura || scoreLead(l).temperatura) === "quente").length;
  const receita = leads.filter((l) => ["negociacao", "vendido"].includes(l.estagio)).reduce((s, l) => s + l.valor, 0);

  const chartData = buildLast7DaysChart(leads);
  const funil = STAGES.map((s) => ({ ...s, count: leads.filter((l) => l.estagio === s.id).length }));

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto anim-in">
      <div className="mb-6">
        <p className="text-xs font-mono uppercase tracking-wider text-[#7E958C] mb-1">Terça-feira, 18 de agosto</p>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Visão geral</h1>
      </div>

      {loading && leads.length === 0 ? (
        <div className="text-sm text-[#7E958C] py-12 text-center">Carregando dados do funil…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KpiCard Icon={Users} label="Leads totais" value={total} accent="#28C08A" />
            <KpiCard Icon={Target} label="Qualificados pela IA" value={qualificados} accent="#F2B705" />
            <KpiCard Icon={Flame} label="Leads quentes" value={quentes} accent="#FF6B4A" />
            <KpiCard Icon={DollarSign} label="Em negociação/vendido" value={`R$ ${receita.toLocaleString("pt-BR")}`} accent="#28C08A" small />
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-[#E2E5DF]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-sm">Novos leads nos últimos 7 dias</h2>
                <span className="flex items-center gap-1 text-[#149267] text-xs font-medium"><TrendingUp size={14}/></span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gradLead" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#28C08A" stopOpacity={0.35}/>
                      <stop offset="100%" stopColor="#28C08A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E9EDE7" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#7E958C" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#7E958C" }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E5DF" }} />
                  <Area type="monotone" dataKey="leads" stroke="#149267" strokeWidth={2} fill="url(#gradLead)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-[#E2E5DF]">
              <h2 className="font-display font-semibold text-sm mb-4">Funil por etapa</h2>
              <div className="flex flex-col gap-2.5">
                {funil.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="text-xs w-24 shrink-0 text-[#516059]">{s.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-[#EEF1EC] overflow-hidden">
                      <div className="h-full rounded-full bg-[#28C08A]" style={{ width: `${total ? Math.max(6, (s.count / total) * 100) : 0}%` }} />
                    </div>
                    <span className="font-mono text-xs w-4 text-right">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function buildLast7DaysChart(leads) {
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dias.push({ key: d.toDateString(), label: i === 0 ? "Hoje" : d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "") });
  }
  const contagem = Object.fromEntries(dias.map((d) => [d.key, 0]));
  leads.forEach((l) => {
    if (!l.criadoEm) return;
    const key = new Date(l.criadoEm).toDateString();
    if (key in contagem) contagem[key] += 1;
  });
  return dias.map((d) => ({ dia: d.label, leads: contagem[d.key] }));
}

function KpiCard({ Icon, label, value, accent, small }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E2E5DF]">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: accent + "1A" }}>
        <Icon size={16} color={accent} strokeWidth={2.2} />
      </div>
      <p className={`font-display font-bold ${small ? "text-lg" : "text-2xl"}`}>{value}</p>
      <p className="text-xs text-[#7E958C] mt-0.5">{label}</p>
    </div>
  );
}

/* ---------------------------------------------------------------
   KANBAN
------------------------------------------------------------------*/

function Kanban({ leads, onUpdateStage, setPage, setActiveLeadId }) {
  const [dragId, setDragId] = useState(null);

  const onDrop = (stageId) => {
    if (!dragId) return;
    const lead = leads.find((l) => l.id === dragId);
    if (lead && lead.estagio !== stageId) {
      onUpdateStage(dragId, stageId);
    }
    setDragId(null);
  };

  return (
    <div className="p-5 md:p-8 anim-in h-full flex flex-col">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-[#7E958C] mb-1">Gestão de vendas</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Funil Kanban</h1>
        </div>
        <span className="hidden md:block text-xs text-[#7E958C]">Arraste os cartões entre as colunas</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 scrollbar-hide">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.estagio === stage.id);
          return (
            <div
              key={stage.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(stage.id)}
              className="w-72 shrink-0 flex flex-col bg-[#EAEEE7]/60 rounded-2xl p-3"
            >
              <div className="flex items-center justify-between px-1 mb-3">
                <h3 className="font-display font-semibold text-sm">{stage.label}</h3>
                <span className="font-mono text-xs bg-white rounded-full px-2 py-0.5 border border-[#E2E5DF]">{stageLeads.length}</span>
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto pr-0.5">
                {stageLeads.map((lead) => {
                  const info = lead.score != null ? lead : scoreLead(lead);
                  const t = TEMP_STYLE[info.temperatura] || TEMP_STYLE.frio;
                  const SourceIcon = SOURCE_ICON[lead.fonte] || Globe;
                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDragId(lead.id)}
                      onClick={() => { setActiveLeadId(lead.id); setPage("whatsapp"); }}
                      className="bg-white rounded-xl p-3 border border-[#E2E5DF] cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#DFF3E8] flex items-center justify-center font-display font-bold text-[11px] text-[#0F7A54]">
                            {iniciais(lead.nome)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold leading-tight">{lead.nome}</p>
                            <p className="text-[11px] text-[#7E958C]">{lead.empresa || "—"}</p>
                          </div>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: t.bg, color: t.fg }}>
                          <t.Icon size={10} /> {t.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#7E958C]">
                        <span className="flex items-center gap-1"><SourceIcon size={11} /> {lead.fonte}</span>
                        <span className="font-mono">{formatRelativo(lead.criadoEm)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-[#152621]">R$ {(lead.valor || 0).toLocaleString("pt-BR")}</span>
                        <span className="font-mono text-[10px] text-[#7E958C]">score {info.score}</span>
                      </div>
                    </div>
                  );
                })}
                {stageLeads.length === 0 && (
                  <div className="text-center text-[11px] text-[#A5B0A9] py-6 border border-dashed border-[#D6DDD3] rounded-xl">Sem leads aqui</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   WHATSAPP AI PANEL
------------------------------------------------------------------*/

function WhatsAppPanel({ leads, activeLeadId, setActiveLeadId, activeLeadDetail, onStartQualification }) {
  const [showList, setShowList] = useState(true);
  const [starting, setStarting] = useState(false);
  const scrollRef = useRef(null);

  const listaLead = leads.find((l) => l.id === activeLeadId);
  const lead = activeLeadDetail && activeLeadDetail.id === activeLeadId ? activeLeadDetail : listaLead;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lead?.mensagens?.length]);

  useEffect(() => {
    if (!activeLeadId && leads.length > 0) setActiveLeadId(leads[0].id);
  }, [activeLeadId, leads, setActiveLeadId]);

  const handleStart = async () => {
    setStarting(true);
    await onStartQualification(lead);
    setStarting(false);
  };

  if (leads.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-center text-[#8A968E] text-sm p-8 anim-in">
        <div>
          <Bot size={28} className="mx-auto mb-2 text-[#A9C4B7]" />
          Nenhum lead ainda. Capture um lead na aba Marketing ou aguarde a primeira mensagem chegar pelo WhatsApp.
        </div>
      </div>
    );
  }
  if (!lead) return null;

  const info = lead.score != null ? lead : scoreLead(lead);
  const t = TEMP_STYLE[info.temperatura] || TEMP_STYLE.frio;
  const mensagens = lead.mensagens || [];
  const aguardandoResposta = lead.estagio === "qualificando" && mensagens[mensagens.length - 1]?.de === "ia";

  return (
    <div className="h-full flex anim-in">
      {/* conversation list */}
      <div className={`${showList ? "flex" : "hidden"} md:flex w-full md:w-80 shrink-0 flex-col border-r border-[#E2E5DF] bg-white`}>
        <div className="p-4 border-b border-[#E2E5DF]">
          <p className="text-xs font-mono uppercase tracking-wider text-[#7E958C] mb-1">Atendimento</p>
          <h1 className="font-display text-lg font-bold">WhatsApp IA</h1>
        </div>
        <div className="overflow-y-auto flex-1">
          {leads.map((l) => {
            const i = l.score != null ? l : scoreLead(l);
            const ts = TEMP_STYLE[i.temperatura] || TEMP_STYLE.frio;
            return (
              <button
                key={l.id}
                onClick={() => { setActiveLeadId(l.id); setShowList(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-[#F0F2EE] text-left hover:bg-[#F7F8F5] ${activeLeadId === l.id ? "bg-[#F1F7F3]" : ""}`}
              >
                <div className="w-10 h-10 rounded-full bg-[#DFF3E8] flex items-center justify-center font-display font-bold text-xs text-[#0F7A54] shrink-0">
                  {iniciais(l.nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold truncate">{l.nome}</p>
                    <ts.Icon size={12} color={ts.fg} />
                  </div>
                  <p className="text-xs text-[#7E958C] truncate">{STAGES.find((s) => s.id === l.estagio)?.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* chat thread */}
      <div className={`${showList ? "hidden" : "flex"} md:flex flex-1 flex-col bg-[#EFF3EC]`}>
        <div className="bg-white px-4 py-3 border-b border-[#E2E5DF] flex items-center gap-3">
          <button onClick={() => setShowList(true)} className="md:hidden p-1 -ml-1 text-[#516059]"><ChevronRight size={18} className="rotate-180" /></button>
          <div className="w-9 h-9 rounded-full bg-[#DFF3E8] flex items-center justify-center font-display font-bold text-xs text-[#0F7A54]">{iniciais(lead.nome)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{lead.nome}</p>
            <p className="text-[11px] font-mono text-[#7E958C]">{lead.telefone}</p>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full" style={{ background: t.bg, color: t.fg }}>
            <t.Icon size={11} /> {t.label} {lead.score != null ? `· ${lead.score}` : ""}
          </span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
          {mensagens.length === 0 && (
            <div className="m-auto text-center text-[#8A968E] text-sm max-w-xs">
              <Bot size={28} className="mx-auto mb-2 text-[#A9C4B7]" />
              Nenhuma conversa ainda. Inicie a qualificação automática para este lead.
            </div>
          )}
          {mensagens.map((m) => (
            <div key={m.id} className={`max-w-[78%] md:max-w-sm px-3.5 py-2 rounded-2xl text-sm anim-in ${
              m.de === "ia" ? "bg-white self-start rounded-bl-sm border border-[#E2E5DF]" : "bg-[#DDF6E4] self-end rounded-br-sm"
            }`}>
              {m.de === "ia" && (
                <p className="text-[10px] font-medium text-[#149267] mb-0.5 flex items-center gap-1">
                  <Bot size={11}/> Assistente IA {m.provedorIA ? `· ${m.provedorIA}` : ""}
                </p>
              )}
              <p className="leading-snug">{m.texto}</p>
              <p className="text-[9px] text-[#9AA79E] text-right mt-1 flex items-center justify-end gap-1 font-mono">
                {formatHora(m.criadoEm)} {m.de === "lead" && <CheckCheck size={11} className="text-[#4FA8DE]" />}
              </p>
            </div>
          ))}
          {aguardandoResposta && (
            <div className="self-start flex items-center gap-1.5 text-[11px] text-[#8A968E] px-1">
              <Clock size={11} /> Aguardando resposta do lead no WhatsApp…
            </div>
          )}
        </div>

        <div className="bg-white border-t border-[#E2E5DF] p-3 flex items-center gap-2">
          {lead.estagio === "novo" ? (
            <button onClick={handleStart} disabled={starting}
              className="w-full flex items-center justify-center gap-2 bg-[#149267] hover:bg-[#0F7A54] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60">
              <Sparkles size={16} /> {starting ? "Enviando…" : "Iniciar qualificação automática pela IA"}
            </button>
          ) : (
            <>
              <input disabled placeholder="Conversa gerenciada pela IA — as respostas do lead chegam pelo WhatsApp real" className="flex-1 text-sm bg-[#F3F5F1] rounded-xl px-3.5 py-2.5 outline-none placeholder:text-[#A5B0A9]" />
              <button disabled className="w-10 h-10 rounded-xl bg-[#B7C2BB] flex items-center justify-center text-white shrink-0 cursor-not-allowed"><Send size={16} /></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   MARKETING
------------------------------------------------------------------*/

const TEMPLATES = [
  { id: "t1", nome: "Boas-vindas", texto: "Oi {{nome}}! Que bom ter você por aqui 👋 Em que posso te ajudar hoje?" },
  { id: "t2", nome: "Recuperação de carrinho", texto: "Ei {{nome}}, notei que você não finalizou sua contratação. Posso te ajudar a concluir?" },
  { id: "t3", nome: "Promoção relâmpago", texto: "{{nome}}, 20% OFF só até hoje às 23h59! Garanta o seu 🔥" },
  { id: "t4", nome: "Reengajamento", texto: "Faz um tempo que não conversamos, {{nome}}! Ainda tem interesse em resolver [problema]?" },
];

function Marketing({ onCaptureLead, showToast }) {
  const [form, setForm] = useState({ nome: "", empresa: "", telefone: "", fonte: "Site" });
  const [copiedId, setCopiedId] = useState(null);
  const [campanhas, setCampanhas] = useState([]);
  const [campLoading, setCampLoading] = useState(true);
  const [novaCampanha, setNovaCampanha] = useState(null);

  const fetchCampanhas = useCallback(async () => {
    try {
      const data = await api.listCampaigns();
      setCampanhas(data);
    } catch {
      /* erro já sinalizado pelo banner global de conexão */
    } finally {
      setCampLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampanhas(); }, [fetchCampanhas]);

  const submitCapture = async (e) => {
    e.preventDefault();
    if (!form.nome || !form.telefone) return;
    await onCaptureLead(form);
    setForm({ nome: "", empresa: "", telefone: "", fonte: "Site" });
  };

  const copyTemplate = (t) => {
    navigator.clipboard?.writeText(t.texto).catch(() => {});
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const submitCampanha = async (e) => {
    e.preventDefault();
    if (!novaCampanha?.nome || !novaCampanha?.mensagem) return;
    try {
      await api.createCampaign(novaCampanha);
      setNovaCampanha(null);
      fetchCampanhas();
      showToast(`Campanha "${novaCampanha.nome}" criada`);
    } catch (erro) {
      showToast(`Erro ao criar campanha: ${erro.message}`);
    }
  };

  return (
    <div className="p-5 md:p-8 anim-in max-w-6xl mx-auto">
      <div className="mb-6">
        <p className="text-xs font-mono uppercase tracking-wider text-[#7E958C] mb-1">Aquisição</p>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Marketing &amp; captura</h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 border border-[#E2E5DF]">
          <h2 className="font-display font-semibold text-sm mb-1">Formulário de captura</h2>
          <p className="text-xs text-[#7E958C] mb-4">O lead vai direto pro banco de dados e cai na coluna "Novo lead" do funil.</p>
          <form onSubmit={submitCapture} className="flex flex-col gap-3">
            <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" className="text-sm border border-[#E2E5DF] rounded-lg px-3 py-2.5 outline-none focus:border-[#28C08A]" />
            <input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} placeholder="Empresa (opcional)" className="text-sm border border-[#E2E5DF] rounded-lg px-3 py-2.5 outline-none focus:border-[#28C08A]" />
            <input required value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="WhatsApp com DDD" className="text-sm border border-[#E2E5DF] rounded-lg px-3 py-2.5 outline-none focus:border-[#28C08A] font-mono" />
            <select value={form.fonte} onChange={(e) => setForm({ ...form, fonte: e.target.value })} className="text-sm border border-[#E2E5DF] rounded-lg px-3 py-2.5 outline-none focus:border-[#28C08A]">
              {Object.keys(SOURCE_ICON).map((s) => <option key={s}>{s}</option>)}
            </select>
            <button type="submit" className="flex items-center justify-center gap-2 bg-[#152621] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[#0E1B17] transition-colors">
              <Plus size={15} /> Capturar lead
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E2E5DF]">
          <h2 className="font-display font-semibold text-sm mb-1">Modelos de mensagem</h2>
          <p className="text-xs text-[#7E958C] mb-4">Use variáveis como <span className="font-mono">{"{{nome}}"}</span> em disparos automáticos.</p>
          <div className="flex flex-col gap-2">
            {TEMPLATES.map((t) => (
              <div key={t.id} className="border border-[#E2E5DF] rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{t.nome}</p>
                  <button onClick={() => copyTemplate(t)} className="text-[#7E958C] hover:text-[#149267]">
                    {copiedId === t.id ? <Check size={14} className="text-[#149267]" /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-xs text-[#516059] leading-snug">{t.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-[#E2E5DF]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-sm">Campanhas de disparo</h2>
          <button onClick={() => setNovaCampanha({ nome: "", template: "Personalizado", mensagem: "" })} className="flex items-center gap-1.5 text-xs font-semibold text-[#149267] hover:text-[#0F7A54]">
            <Plus size={14} /> Nova campanha
          </button>
        </div>

        {novaCampanha && (
          <form onSubmit={submitCampanha} className="mb-4 p-3 border border-[#E2E5DF] rounded-xl flex flex-col gap-2 anim-in">
            <input autoFocus required placeholder="Nome da campanha" value={novaCampanha.nome} onChange={(e) => setNovaCampanha({ ...novaCampanha, nome: e.target.value })} className="text-sm border border-[#E2E5DF] rounded-lg px-3 py-2 outline-none focus:border-[#28C08A]" />
            <textarea required placeholder="Mensagem a disparar" value={novaCampanha.mensagem} onChange={(e) => setNovaCampanha({ ...novaCampanha, mensagem: e.target.value })} rows={2} className="text-sm border border-[#E2E5DF] rounded-lg px-3 py-2 outline-none focus:border-[#28C08A] resize-none" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setNovaCampanha(null)} className="text-xs font-medium text-[#7E958C] px-3 py-1.5">Cancelar</button>
              <button type="submit" className="text-xs font-semibold bg-[#149267] text-white px-3 py-1.5 rounded-lg">Salvar campanha</button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          {campLoading ? (
            <p className="text-xs text-[#7E958C] py-4">Carregando campanhas…</p>
          ) : campanhas.length === 0 ? (
            <p className="text-xs text-[#7E958C] py-4">Nenhuma campanha ainda. Crie a primeira acima.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-[#7E958C] border-b border-[#E2E5DF]">
                  <th className="pb-2 font-medium">Campanha</th>
                  <th className="pb-2 font-medium">Modelo</th>
                  <th className="pb-2 font-medium">Enviados</th>
                  <th className="pb-2 font-medium">Respostas</th>
                  <th className="pb-2 font-medium">Conversões</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {campanhas.map((c) => (
                  <tr key={c.id} className="border-b border-[#F0F2EE] last:border-0">
                    <td className="py-2.5 font-medium">{c.nome}</td>
                    <td className="py-2.5 text-[#516059]">{c.template}</td>
                    <td className="py-2.5 font-mono">{c.enviados}</td>
                    <td className="py-2.5 font-mono">{c.respostas}</td>
                    <td className="py-2.5 font-mono flex items-center gap-1">{c.conversoes} <ArrowUpRight size={12} className="text-[#149267]" /></td>
                    <td className="py-2.5">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${c.status === "Ativa" ? "bg-[#DFF3E8] text-[#0F7A54]" : "bg-[#EEF1EC] text-[#7E958C]"}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
