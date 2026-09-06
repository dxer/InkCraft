import { useCallback, useEffect, useState } from "react";
import { MarkdownPreview } from "./MarkdownPreview";
import {
  captureActiveTab,
  loadConfig,
  pingServer,
  saveClip,
  saveConfig,
  startRegionPick,
  type ClipConfig,
  type ClipResult,
  type SavedNote,
} from "../lib/api";

type Stage = "idle" | "saving" | "saved";

const MODE_LABELS: Record<string, string> = {
  page: "正文剪藏",
  selection: "选中摘录",
  region: "区域剪藏",
};

export function App() {
  const [config, setConfig] = useState<ClipConfig>({
    serverUrl: "http://localhost:3001",
    apiKey: "",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
      if (r.ok) await saveConfig(config);
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
          <span className="brand-mark">墨</span>
          <span>墨匠剪藏</span>
        </div>
        <div className="header-actions">
          <button
            className={`icon-btn ${settingsOpen ? "active" : ""}`}
            title="连接配置"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            ⚙
          </button>
        </div>
      </header>

      <div className="main">
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
            点击右上角 ⚙ 填写服务地址与 Key
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
                <span className="emoji">{capturing === "page" ? "⏳" : "📄"}</span>
                <span className="label">{capturing === "page" ? "提取中..." : "采集正文"}</span>
              </button>
              <button
                className="capture-btn"
                title="只保存页面中选中的文字"
                onClick={() => handleCapture("selection")}
                disabled={capturing !== null}
              >
                <span className="emoji">{capturing === "selection" ? "⏳" : "✂️"}</span>
                <span className="label">{capturing === "selection" ? "提取中..." : "采集选中"}</span>
              </button>
              <button
                className="capture-btn"
                title="在页面上悬停点选一块区域剪藏"
                onClick={handleRegionPick}
                disabled={capturing !== null}
              >
                <span className="emoji">◱</span>
                <span className="label">区域剪藏</span>
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
                ✓ 已保存「{savedNote.title || "未命名笔记"}」·{" "}
                <a
                  href={`${config.serverUrl}/knowledge/default?note=${savedNote.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  在墨匠中查看
                </a>
              </div>
            )}

            {stage !== "saved" ? (
              <button className="primary" onClick={handleSave} disabled={stage === "saving"}>
                {stage === "saving" ? "保存中..." : "保存到墨匠"}
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
