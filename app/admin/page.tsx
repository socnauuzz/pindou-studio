"use client";

import { useState } from "react";
import Link from "next/link";

type AccessKey = {
  id: string;
  code_prefix: string;
  plan: string;
  usage_limit: number;
  used_count: number;
  expires_at: string | null;
  status: string;
  note: string | null;
  created_at: string;
};

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [keys, setKeys] = useState<AccessKey[]>([]);
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ count: 10, plan: "体验卡", usageLimit: 10, validDays: 365, note: "" });

  const request = async (url: string, init: RequestInit = {}) => {
    const response = await fetch(url, { ...init, headers: { ...(init.headers || {}), "x-admin-secret": secret, "content-type": "application/json" } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "操作失败");
    return data;
  };

  const login = async () => {
    setLoading(true); setMessage("");
    try {
      const data = await request("/api/admin/keys");
      setKeys(data.keys); setAuthenticated(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "无法进入后台"); }
    finally { setLoading(false); }
  };

  const refresh = async () => {
    const data = await request("/api/admin/keys");
    setKeys(data.keys);
  };

  const generate = async () => {
    setLoading(true); setMessage(""); setCodes([]);
    try {
      const data = await request("/api/admin/keys", { method: "POST", body: JSON.stringify(form) });
      setCodes(data.codes); setMessage(`已生成 ${data.codes.length} 张卡密。完整卡密只显示这一次，请立即保存。`); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "生成失败"); }
    finally { setLoading(false); }
  };

  const changeStatus = async (item: AccessKey) => {
    await request("/api/admin/keys", { method: "PATCH", body: JSON.stringify({ id: item.id, status: item.status === "active" ? "disabled" : "active" }) });
    await refresh();
  };

  const copyCodes = async () => {
    await navigator.clipboard.writeText(codes.join("\n"));
    setMessage(`已复制 ${codes.length} 张卡密`);
  };

  const downloadCodes = () => {
    const rows = ["卡密,套餐,总次数,有效天数,备注", ...codes.map((code) => `${code},${form.plan},${form.usageLimit},${form.validDays},${form.note}`)];
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `拼豆卡密-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  if (!authenticated) return (
    <main className="admin-shell login-shell">
      <Link className="admin-brand" href="/"><span className="admin-logo">••<br />••</span><span>拼豆像素工坊<small>卡密管理后台</small></span></Link>
      <section className="admin-login">
        <span className="eyebrow"><i /> OWNER CONSOLE</span>
        <h1>进入卡密后台</h1>
        <p>输入管理密码后，可以批量生成、查看和停用卡密。</p>
        <label><span>管理密码</span><input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} onKeyDown={(event) => event.key === "Enter" && login()} placeholder="输入后台管理密码" autoFocus /></label>
        <button onClick={login} disabled={loading || secret.length < 8}>{loading ? "正在验证…" : "安全进入"}</button>
        {message && <div className="admin-message error">{message}</div>}
        <Link href="/">← 返回网站首页</Link>
      </section>
    </main>
  );

  const activeCount = keys.filter((item) => item.status === "active").length;
  const usedTotal = keys.reduce((total, item) => total + item.used_count, 0);
  return (
    <main className="admin-shell">
      <header className="admin-top"><Link className="admin-brand" href="/"><span className="admin-logo">••<br />••</span><span>拼豆像素工坊<small>卡密管理后台</small></span></Link><div><span>已安全登录</span><button onClick={() => { setAuthenticated(false); setSecret(""); }}>退出</button></div></header>
      <section className="admin-main">
        <div className="admin-heading"><div><span className="eyebrow"><i /> CARD KEY CENTER</span><h1>卡密管理</h1><p>批量创建销售卡密，并追踪使用状态。</p></div><Link href="/">打开用户网站 ↗</Link></div>
        <div className="stat-grid"><article><span>累计生成</span><strong>{keys.length}</strong><small>张卡密</small></article><article><span>当前有效</span><strong>{activeCount}</strong><small>可正常兑换</small></article><article><span>已用额度</span><strong>{usedTotal}</strong><small>次导出</small></article></div>
        <div className="admin-columns">
          <section className="generator-card">
            <div className="admin-card-head"><div><strong>批量生成卡密</strong><small>设置销售套餐和使用额度</small></div><span>NEW</span></div>
            <div className="form-grid">
              <label><span>生成数量</span><input type="number" min="1" max="100" value={form.count} onChange={(event) => setForm({ ...form, count: Number(event.target.value) })} /></label>
              <label><span>套餐名称</span><select value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })}><option>体验卡</option><option>创作卡</option><option>工作室卡</option><option>不限时卡</option></select></label>
              <label><span>每张导出次数</span><input type="number" min="1" max="10000" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: Number(event.target.value) })} /></label>
              <label><span>有效天数</span><input type="number" min="1" max="3650" value={form.validDays} onChange={(event) => setForm({ ...form, validDays: Number(event.target.value) })} /></label>
              <label className="wide"><span>批次备注</span><input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="例如：淘宝 7 月活动" /></label>
            </div>
            <button className="generate-button" disabled={loading} onClick={generate}>{loading ? "正在生成…" : `生成 ${form.count} 张卡密`}</button>
            <p className="security-tip">卡密使用安全随机算法生成，后台只保存摘要，完整卡密不会再次显示。</p>
          </section>
          <section className="codes-card">
            <div className="admin-card-head"><div><strong>本次生成结果</strong><small>请立即复制或下载保存</small></div>{codes.length > 0 && <span>{codes.length} 张</span>}</div>
            {codes.length ? <><div className="codes-list">{codes.map((code, index) => <div key={code}><span>{String(index + 1).padStart(2,"0")}</span><strong>{code}</strong></div>)}</div><div className="codes-actions"><button onClick={copyCodes}>复制全部</button><button onClick={downloadCodes}>下载 CSV</button></div></> : <div className="empty-codes"><div>••<br />••</div><strong>卡密将在这里显示</strong><span>生成后请立即保存完整卡密</span></div>}
          </section>
        </div>
        {message && <div className={`admin-message ${message.includes("失败") || message.includes("不正确") ? "error" : ""}`}>{message}</div>}
        <section className="key-table-card">
          <div className="admin-card-head"><div><strong>最近卡密</strong><small>最多显示 200 条，仅展示卡密前缀</small></div><button onClick={refresh}>刷新</button></div>
          <div className="key-table"><div className="key-table-row head"><span>卡密</span><span>套餐</span><span>使用情况</span><span>有效期</span><span>备注</span><span>操作</span></div>{keys.length ? keys.map((item) => <div className="key-table-row" key={item.id}><strong>{item.code_prefix}</strong><span>{item.plan}</span><span><i style={{ width: `${Math.min(100, item.used_count / item.usage_limit * 100)}%` }} />{item.used_count} / {item.usage_limit}</span><span>{item.expires_at ? new Date(item.expires_at).toLocaleDateString() : "长期"}</span><span>{item.note || "—"}</span><button className={item.status === "active" ? "disable" : "enable"} onClick={() => changeStatus(item)}>{item.status === "active" ? "停用" : "启用"}</button></div>) : <div className="empty-table">还没有卡密，先创建第一个批次吧。</div>}</div>
        </section>
      </section>
    </main>
  );
}
