import { useCallback, useEffect, useState } from "react";
import { MarkdownPreview } from "./MarkdownPreview";
import { InkCraftMark } from "./InkCraftMark";
import {
  CheckIcon,
  CropIcon,
  FileTextIcon,
  LoaderIcon,
  SaveIcon,
  ScissorsIcon,
  SettingsIcon,
} from "./icons";
import {
  captureActiveTab,
  listKnowledgeBases,
  loadConfig,
  pingServer,
  saveClip,
  saveConfig,
  startRegionPick,
  type ClipConfig,
  type ClipResult,
  type KnowledgeBase,
  type SavedNote,
} from "../lib/api";

type Stage = "idle" | "saving" | "saved";

const MODE_LABELS: Record<string, string> = {
  page: "正文剪藏",
  selection: "选中摘录",
  region: "区域剪藏",
};

/** 知识库选择器：默认库置顶，其余按序展示 */
function KbSelect({
  value,
  kbs,
  loading,
  onChange,
}: {
  value: string;
  kbs: KnowledgeBase[];
  loading: boolean;
  onChange: (id: string) => void;
}) {
  const nonDefault = kbs.filter((k) => !k.isDefault);
  return (
    <div className="kb-select">
      <label className="kb-label">保存到</label>
      <select
        className="kb-select-input"
        value={value || ""}
        disabled={loading}
        onChange={(e) => onChange(e.target.value)}
        title="选择剪藏保存到的知识库"
      >
        <option value="">默认知识库</option>
        {nonDefault.map((kb) => (
          <option key={kb.id} value={kb.id}>
            {kb.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function App() {
  const [config, setConfig] = useState<ClipConfig>({
    serverUrl: "http://localhost:3001",
    apiKey: "",
    kbId: "",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [kbsLoading, setKbsLoading] = useState(false);

  const [result, setResult] = useState<ClipResult | null>(null);
  const [capturing, setCapturing] = useState<"page" | "selection" | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [savedNote, setSavedNote] = useState<SavedNote | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // 预览视图：read（渲染排版，默认）/ source（Markdown 源码）
  const [view, setView] = useState<"read" | "source">("read");

  useEffect(() => {
    loadConfig().then((cfg) => {
      setConfig(cfg);
      // 未配置 Key 时自动展开设置面板，引导首次配置
      if (!cfg.apiKey) setSettingsOpen(true);
    });
  }, []);

  // 配置就绪后拉取知识库列表；记住的目标库已不存在时回退到默认
  useEffect(() => {
    if (!config.serverUrl || !config.apiKey) return;
    let active = true;
    setKbsLoading(true);
    listKnowledgeBases(config)
      .then((r) => {
        if (!active) return;
        const list = r.ok ? r.kbs || [] : [];
        setKbs(list);
        if (config.kbId && !list.some((k) => k.id === config.kbId)) {
          updateConfig({ kbId: "" });
        }
      })
      .finally(() => {
        if (active) setKbsLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.serverUrl, config.apiKey]);

  const updateConfig = useCallback((patch: Partial<ClipConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  async function persist() {
    await saveConfig(config);
    setTestMsg({ ok: true, text: "配置已保存" });
  }

  async function handleTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      const r = await pingServer(config);
      setTestMsg({ ok: r.ok, text: r.ok ? "连接成功，Key 有效" : r.error || "连接失败" });
      if (r.ok) {
        await saveConfig(config);
        // 连接成功后立即刷新知识库列表，供剪藏选择目标
        const kbRes = await listKnowledgeBases(config);
        if (kbRes.ok) {
          setKbs(kbRes.kbs || []);
          if (config.kbId && !(kbRes.kbs || []).some((k) => k.id === config.kbId)) {
            updateConfig({ kbId: "" });
          }
        }
      }
    } finally {
      setTesting(false);
    }
  }

  async function handleCapture(mode: "page" | "selection") {
    setCapturing(mode);
    setCaptureError(null);
    setStage("idle");
    setSavedNote(null);
    setSaveError(null);
    setView("read");
    try {
      const r = await captureActiveTab(mode);
      if (!r.ok) {
        setCaptureError(r.error || "采集失败");
        setResult(null);
      } else {
        setResult(r);
      }
    } catch (err) {
      setCaptureError(
        err instanceof Error
          ? `${err.message}（浏览器内置页、扩展商店页无法采集）`
          : "采集失败"
      );
      setResult(null);
    } finally {
      setCapturing(null);
    }
  }

  // 区域剪藏：触发页内拾取后 popup 自行关闭（点击页面必失焦，后续在页内面板完成）
  async function handleRegionPick() {
    setCaptureError(null);
    try {
      await startRegionPick();
      window.close();
    } catch (err) {
      setCaptureError(
        err instanceof Error ? `${err.message}（此页面无法启用区域剪藏）` : "无法启用区域剪藏"
      );
    }
  }

  async function handleSave() {
    if (!result) return;
    setStage("saving");
    setSaveError(null);
    try {
      const note = await saveClip(config, result);
      setSavedNote(note);
      setStage("saved");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存失败");
      setStage("idle");
    }
  }

  const configured = !!config.apiKey && !!config.serverUrl;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark">
            <InkCraftMark size={20} />
          </span>
          <span className="brand-text">
            <span className="brand-name">墨匠剪藏</span>
            <span className="brand-sub">INKCRAFT CLIPPER</span>
          </span>
        </div>
        <div className="header-actions">
          <button
            className={`icon-btn ${settingsOpen ? "active" : ""}`}
            title="连接配置"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <SettingsIcon size={14} />
          </button>
        </div>
      </header>

      <div className="main">
        {configured && (
          <KbSelect
            value={config.kbId || ""}
            kbs={kbs}
            loading={kbsLoading}
            onChange={(kbId) => {
              const next = { ...config, kbId };
              setConfig(next);
              saveConfig(next);
            }}
          />
        )}

        {settingsOpen && (
          <div className="settings">
            <div className="field">
              <label>服务地址</label>
              <input
                value={config.serverUrl}
                onChange={(e) => updateConfig({ serverUrl: e.target.value })}
                placeholder="http://localhost:3001"
              />
            </div>
            <div className="field">
              <label>API Key（设置 → 采集接口 中生成）</label>
              <input
                value={config.apiKey}
                onChange={(e) => updateConfig({ apiKey: e.target.value })}
                placeholder="ick_..."
              />
            </div>
            <div className="settings-row">
              <button className="primary" style={{ flex: 1 }} onClick={handleTest} disabled={testing}>
                {testing ? "测试中..." : "测试连接"}
              </button>
              <button className="primary" style={{ flex: 1 }} onClick={persist}>
                保存配置
              </button>
            </div>
            {testMsg && (
              <div className={`test-result ${testMsg.ok ? "ok" : "err"}`}>{testMsg.text}</div>
            )}
          </div>
        )}

        {!configured && !settingsOpen && (
          <div className="empty">
            尚未配置 API Key
            <br />
            点击右上角设置按钮，填写服务地址与 Key
          </div>
        )}

        {configured && !result && (
          <>
            <div className="capture">
              <button
                className="capture-btn"
                title="智能提取全页主体内容（Markdown）"
                onClick={() => handleCapture("page")}
                disabled={capturing !== null}
              >
                <span className={`capture-icon tone-blue ${capturing === "page" ? "busy" : ""}`}>
                  {capturing === "page" ? <LoaderIcon size={16} /> : <FileTextIcon size={16} />}
                </span>
                <span className="label">{capturing === "page" ? "正在提取" : "采集正文"}</span>
                <span className="hint">整页文章转 Markdown</span>
              </button>
              <button
                className="capture-btn"
                title="只保存页面中选中的文字"
                onClick={() => handleCapture("selection")}
                disabled={capturing !== null}
              >
                <span className={`capture-icon tone-amber ${capturing === "selection" ? "busy" : ""}`}>
                  {capturing === "selection" ? <LoaderIcon size={16} /> : <ScissorsIcon size={16} />}
                </span>
                <span className="label">{capturing === "selection" ? "正在提取" : "采集选中"}</span>
                <span className="hint">仅保存选中文字</span>
              </button>
              <button
                className="capture-btn"
                title="在页面上悬停点选一块区域剪藏"
                onClick={handleRegionPick}
                disabled={capturing !== null}
              >
                <span className="capture-icon tone-violet">
                  <CropIcon size={16} />
                </span>
                <span className="label">区域剪藏</span>
                <span className="hint">框选页面区域</span>
              </button>
            </div>
            {captureError && <div className="notice err">{captureError}</div>}
          </>
        )}

        {result && (
          <div className="preview">
            <input
              className="preview-title"
              value={result.title}
              onChange={(e) => setResult({ ...result, title: e.target.value })}
              placeholder="标题"
            />
            <div className="preview-meta">
              <span className="preview-src" title={result.sourceUrl}>
                <span className="mode-badge">{MODE_LABELS[result.mode] || result.mode}</span>
                <a href={result.sourceUrl} target="_blank" rel="noreferrer">{result.sourceUrl}</a>
                {result.byline ? ` · ${result.byline}` : ""}
              </span>
              <span>{result.wordCount} 字</span>
            </div>
            <div className="preview-tabs">
              <button
                className={`tab ${view === "read" ? "active" : ""}`}
                onClick={() => setView("read")}
              >
                预览
              </button>
              <button
                className={`tab ${view === "source" ? "active" : ""}`}
                onClick={() => setView("source")}
              >
                Markdown
              </button>
              <span className="tab-hint">{view === "read" ? "排版预览" : "源码编辑"}</span>
            </div>
            {view === "read" ? (
              <MarkdownPreview content={result.content} />
            ) : (
              <textarea
                className="preview-content"
                value={result.content}
                onChange={(e) =>
                  setResult({ ...result, content: e.target.value, wordCount: e.target.value.length })
                }
                placeholder="采集内容（Markdown）"
              />
            )}

            {stage === "idle" && saveError && <div className="notice err">{saveError}</div>}
            {stage === "saved" && savedNote && (
              <div className="notice ok">
                <CheckIcon size={13} className="notice-icon" />
                已保存「{savedNote.title || "未命名笔记"}」·{" "}
                <a
                  href={`${config.serverUrl}/knowledge/${savedNote.kbId || "default"}?note=${savedNote.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  在墨匠中查看
                </a>
              </div>
            )}

            {stage !== "saved" ? (
              <button className="primary" onClick={handleSave} disabled={stage === "saving"}>
                {stage === "saving" ? (
                  <>
                    <LoaderIcon size={14} />
                    保存中...
                  </>
                ) : (
                  <>
                    <SaveIcon size={14} />
                    保存到墨匠
                  </>
                )}
              </button>
            ) : (
              <button
                className="primary"
                style={{ background: "#f0f0f0", color: "#171717" }}
                onClick={() => {
                  setResult(null);
                  setStage("idle");
                  setSavedNote(null);
                }}
              >
                继续采集下一篇
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
