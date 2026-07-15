"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUILTIN_PALETTES, Palette, PaletteColor, parseCustomPalette } from "@/app/palettes";
import {
  buildDemoPixels,
  exportPatternPng,
  imageToBeads,
  renderBeadCanvas,
  summarizeColors,
} from "@/app/pixel-engine";

type KeyStatus = {
  active: boolean;
  codePrefix?: string;
  plan?: string;
  remaining?: number;
  expiresAt?: string | null;
};

const SIZES = [24, 32, 40, 48, 64, 80];

export default function Home() {
  const fileRef = useRef<HTMLInputElement>(null);
  const customPaletteRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const [palette, setPalette] = useState<Palette>(BUILTIN_PALETTES[0]);
  const [customPalette, setCustomPalette] = useState<Palette | null>(null);
  const [size, setSize] = useState(40);
  const [pixels, setPixels] = useState<number[]>(() => buildDemoPixels(40, BUILTIN_PALETTES[0]));
  const [sourceName, setSourceName] = useState("示例 · 春日小熊");
  const [showGrid, setShowGrid] = useState(true);
  const [showCodes, setShowCodes] = useState(true);
  const [dither, setDither] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedColor, setSelectedColor] = useState(0);
  const [notice, setNotice] = useState("");
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({ active: false });
  const [redeeming, setRedeeming] = useState(false);

  const activePalettes = useMemo(
    () => (customPalette ? [...BUILTIN_PALETTES, customPalette] : BUILTIN_PALETTES),
    [customPalette],
  );

  const summary = useMemo(() => summarizeColors(pixels, palette), [pixels, palette]);
  const beadCount = useMemo(() => pixels.filter((index) => index >= 0).length, [pixels]);

  const redraw = useCallback(() => {
    if (!canvasRef.current) return;
    renderBeadCanvas(canvasRef.current, pixels, size, palette, {
      showGrid,
      showCodes,
      background: "#fffdf9",
    });
  }, [palette, pixels, showCodes, showGrid, size]);

  useEffect(() => redraw(), [redraw]);

  useEffect(() => {
    fetch("/api/keys/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { active: false }))
      .then((data) => setKeyStatus(data))
      .catch(() => undefined);
  }, []);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const runConversion = useCallback(
    async (image: HTMLImageElement, nextSize = size, nextPalette = palette, nextDither = dither) => {
      setIsProcessing(true);
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      const converted = imageToBeads(image, nextSize, nextPalette, { dither: nextDither });
      setPixels(converted);
      setIsProcessing(false);
    },
    [dither, palette, size],
  );

  const loadFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      flash("请选择 JPG、PNG 或 WEBP 图片");
      return;
    }
    if (file.size > 18 * 1024 * 1024) {
      flash("图片请控制在 18MB 以内");
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = async () => {
      sourceImageRef.current = image;
      setSourceName(file.name.replace(/\.[^.]+$/, ""));
      await runConversion(image);
      URL.revokeObjectURL(url);
      document.getElementById("studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      flash("图片读取失败，请换一张试试");
    };
    image.src = url;
  };

  const choosePalette = async (next: Palette) => {
    setPalette(next);
    setSelectedColor(0);
    if (sourceImageRef.current) await runConversion(sourceImageRef.current, size, next, dither);
    else setPixels(buildDemoPixels(size, next));
  };

  const chooseSize = async (next: number) => {
    setSize(next);
    if (sourceImageRef.current) await runConversion(sourceImageRef.current, next, palette, dither);
    else setPixels(buildDemoPixels(next, palette));
  };

  const toggleDither = async () => {
    const next = !dither;
    setDither(next);
    if (sourceImageRef.current) await runConversion(sourceImageRef.current, size, palette, next);
  };

  const importPalette = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseCustomPalette(await file.text(), file.name.replace(/\.[^.]+$/, ""));
      setCustomPalette(parsed);
      await choosePalette(parsed);
      flash(`已导入 ${parsed.colors.length} 个自定义色号`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "色板读取失败");
    }
    event.target.value = "";
  };

  const paintBead = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * size);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * size);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    setPixels((current) => {
      const next = [...current];
      next[y * size + x] = selectedColor;
      return next;
    });
  };

  const consumeExport = async () => {
    if (!keyStatus.active) {
      setRedeemOpen(true);
      return false;
    }
    try {
      const response = await fetch("/api/keys/consume", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setKeyStatus({ active: false });
        setRedeemOpen(true);
        flash(data.error || "卡密额度不足");
        return false;
      }
      setKeyStatus(data.status);
      return true;
    } catch {
      flash("暂时无法验证卡密，请稍后再试");
      return false;
    }
  };

  const downloadPng = async () => {
    if (!(await consumeExport())) return;
    exportPatternPng(pixels, size, palette, sourceName, { showCodes: true });
    flash("高清图纸已生成");
  };

  const downloadList = async () => {
    if (!(await consumeExport())) return;
    const rows = ["色号,颜色名称,数量", ...summary.map((row) => `${row.color.code},${row.color.name},${row.count}`)];
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${sourceName}-${palette.name}-材料清单.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    flash("材料清单已导出");
  };

  const redeem = async () => {
    if (!keyInput.trim()) return;
    setRedeeming(true);
    try {
      const response = await fetch("/api/keys/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: keyInput }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "卡密兑换失败");
      setKeyStatus(data.status);
      setKeyInput("");
      setRedeemOpen(false);
      flash("卡密激活成功，可以导出高清图纸了");
    } catch (error) {
      flash(error instanceof Error ? error.message : "卡密兑换失败");
    } finally {
      setRedeeming(false);
    }
  };

  const dragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="拼豆像素工坊首页">
          <span className="brand-mark" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, index) => <i key={index} />)}
          </span>
          <span>拼豆像素工坊<small>PIXEL BEAD STUDIO</small></span>
        </a>
        <nav aria-label="主导航">
          <a className="active" href="#studio">开始制作</a>
          <a href="#guide">使用教程</a>
          <button onClick={() => setRedeemOpen(true)}>卡密兑换</button>
        </nav>
        <button className={`key-pill ${keyStatus.active ? "is-active" : ""}`} onClick={() => setRedeemOpen(true)}>
          <span className="key-dot" />
          <span><small>卡密状态</small>{keyStatus.active ? `剩余 ${keyStatus.remaining ?? 0} 次` : "未激活"}</span>
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow"><i /> 高清拼豆图纸生成器</span>
          <h1>上传一张照片，<br />生成<span>带色号</span>的拼豆图纸</h1>
          <p>智能匹配拼豆颜色，清晰生成网格、色号与材料清单。照片只在当前浏览器处理，更快也更安心。</p>
          <div
            className={`upload-zone ${isDragging ? "is-dragging" : ""}`}
            onDragOver={dragOver}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              loadFile(event.dataTransfer.files?.[0]);
            }}
          >
            <button className="primary-button" onClick={() => fileRef.current?.click()}>
              <span className="upload-icon">↑</span> 上传高清图片
            </button>
            <span>或拖入 JPG / PNG / WEBP，最大 18MB</span>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => loadFile(event.target.files?.[0])} />
          </div>
          <div className="palette-label">选择拼豆色板 <span>可在生成后切换</span></div>
          <div className="palette-tabs">
            {activePalettes.map((item) => (
              <button key={item.id} className={palette.id === item.id ? "selected" : ""} onClick={() => choosePalette(item)}>
                <span className="palette-dots" style={{ "--c1": item.colors[2]?.hex, "--c2": item.colors[5]?.hex, "--c3": item.colors[9]?.hex } as React.CSSProperties} />
                {item.name}
              </button>
            ))}
            <button onClick={() => customPaletteRef.current?.click()}><span className="palette-add">＋</span>自定义</button>
            <input ref={customPaletteRef} type="file" accept=".csv,.txt" hidden onChange={importPalette} />
          </div>
        </div>

        <div className="studio-card" id="studio">
          <div className="studio-head">
            <div><span className="grid-icon">⠿</span><strong>图纸工作台</strong><small>{sourceName}</small></div>
            <div className="window-dots"><i /><i /><i /></div>
          </div>
          <div className="toolbar">
            <label>尺寸<select value={size} onChange={(event) => chooseSize(Number(event.target.value))}>{SIZES.map((value) => <option key={value} value={value}>{value} × {value}</option>)}</select></label>
            <button className={showGrid ? "on" : ""} onClick={() => setShowGrid(!showGrid)}>网格</button>
            <button className={showCodes ? "on" : ""} onClick={() => setShowCodes(!showCodes)}>色号</button>
            <button className={dither ? "on" : ""} onClick={toggleDither}>柔化渐变</button>
            <span className="quality-badge">高质量匹配</span>
          </div>
          <div className="studio-body">
            <div className="canvas-panel">
              <div className={`canvas-wrap ${isProcessing ? "processing" : ""}`}>
                <canvas ref={canvasRef} onClick={paintBead} aria-label="可点击修改颜色的拼豆图纸" />
                {isProcessing && <div className="processing-label"><i />正在精细匹配色号…</div>}
              </div>
              <div className="canvas-meta"><span>{size} × {size} 画板</span><span>{beadCount.toLocaleString()} 颗拼豆</span><span>{summary.length} 种颜色</span></div>
              <div className="paint-strip" aria-label="手动改色">
                <strong>手动改色</strong>
                <div>{palette.colors.slice(0, 18).map((color, index) => (
                  <button key={color.code} title={`${color.code} ${color.name}`} className={selectedColor === index ? "selected" : ""} style={{ background: color.hex }} onClick={() => setSelectedColor(index)} />
                ))}</div>
              </div>
            </div>
            <aside className="materials">
              <div className="materials-title"><span>材料统计</span><small>{palette.name}</small></div>
              <div className="material-list">
                {summary.slice(0, 7).map(({ color, count }) => <MaterialRow key={color.code} color={color} count={count} />)}
              </div>
              {summary.length > 7 && <div className="more-colors">还有 {summary.length - 7} 种颜色</div>}
              <div className="export-actions">
                <button className="export-primary" onClick={downloadPng}>导出高清图纸 <span>PNG</span></button>
                <button onClick={downloadList}>材料清单 <span>CSV</span></button>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="产品优势">
        <div><strong>Lab</strong><span>专业色差匹配<small>更接近真实拼豆颜色</small></span></div>
        <div><strong>4K</strong><span>高清图纸导出<small>放大打印依然清晰</small></span></div>
        <div><strong>100%</strong><span>本地图片处理<small>原图不会上传保存</small></span></div>
        <div><strong>4+</strong><span>多品牌色板<small>也支持自定义导入</small></span></div>
      </section>

      <section className="feature-section" id="guide">
        <div className="section-heading"><span>三步完成</span><h2>从照片到可制作图纸，简单又专业</h2><p>每一个设置都围绕真实拼豆制作流程设计。</p></div>
        <div className="feature-grid">
          <article><b>01</b><div className="feature-visual upload-mini">↑<i /><i /><i /></div><h3>上传与调整尺寸</h3><p>支持常见图片格式，选择 24 到 80 颗的画板尺寸。</p></article>
          <article><b>02</b><div className="feature-visual palette-mini">{BUILTIN_PALETTES[0].colors.slice(0, 12).map((color) => <i key={color.code} style={{ background: color.hex }} />)}</div><h3>选择品牌与改色</h3><p>自由切换品牌色号，还能点击格子手动修正细节。</p></article>
          <article><b>03</b><div className="feature-visual export-mini"><span>PNG</span><span>CSV</span><strong>✓</strong></div><h3>导出图纸与清单</h3><p>下载带网格和色号的高清图纸，并统计每色数量。</p></article>
        </div>
      </section>

      <section className="card-section">
        <div><span className="eyebrow"><i /> 灵活卡密方案</span><h2>按需购买，用多少算多少</h2><p>无需注册账号。购买卡密后直接兑换，额度仅在导出高清图纸或材料清单时扣除。</p></div>
        <div className="plan-card"><span>体验卡</span><strong>10<small>次导出</small></strong><p>适合偶尔制作和体验全部功能</p><button onClick={() => setRedeemOpen(true)}>已有卡密，立即兑换</button></div>
        <div className="plan-card featured"><span>创作卡</span><em>最受欢迎</em><strong>50<small>次导出</small></strong><p>适合手作爱好者与接单创作者</p><button onClick={() => setRedeemOpen(true)}>兑换创作卡</button></div>
      </section>

      <footer><div className="brand compact"><span className="brand-mark">{Array.from({ length: 9 }).map((_, index) => <i key={index} />)}</span><span>拼豆像素工坊</span></div><p>把喜欢的照片，变成一颗一颗可以完成的快乐。</p><span className="footer-links"><a href="/admin">卡密管理</a><a href="#top">回到顶部 ↑</a></span></footer>

      {redeemOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setRedeemOpen(false)}>
          <section className="redeem-modal" role="dialog" aria-modal="true" aria-labelledby="redeem-title">
            <button className="modal-close" onClick={() => setRedeemOpen(false)} aria-label="关闭">×</button>
            <div className="ticket-art"><span>•••</span><strong>PIXEL PASS</strong><i /></div>
            <span className="eyebrow"><i /> 拼豆工坊通行证</span>
            <h2 id="redeem-title">兑换你的卡密</h2>
            {keyStatus.active ? (
              <div className="active-key-card"><span className="key-dot" /><div><strong>卡密已激活</strong><small>{keyStatus.plan} · 剩余 {keyStatus.remaining} 次{keyStatus.expiresAt ? ` · ${new Date(keyStatus.expiresAt).toLocaleDateString()} 到期` : ""}</small></div></div>
            ) : (
              <>
                <p>输入购买后收到的卡密，即可解锁高清导出。</p>
                <label className="key-input"><span>卡密</span><input value={keyInput} onChange={(event) => setKeyInput(event.target.value.toUpperCase())} placeholder="PD-XXXX-XXXX-XXXX" onKeyDown={(event) => event.key === "Enter" && redeem()} /></label>
                <button className="primary-button full" disabled={redeeming || !keyInput.trim()} onClick={redeem}>{redeeming ? "正在验证…" : "立即激活"}</button>
              </>
            )}
            <small className="privacy-note">一个浏览器可保存一个激活状态，请妥善保管卡密。</small>
          </section>
        </div>
      )}
      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}

function MaterialRow({ color, count }: { color: PaletteColor; count: number }) {
  return <div className="material-row"><i style={{ background: color.hex }}><span /></i><div><strong>{color.code}</strong><small>{color.name}</small></div><b>{count}<small>颗</small></b></div>;
}
