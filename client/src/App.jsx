import React, { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Activity,
  ArrowDownToLine,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Home,
  Image,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { api, download, formatDate } from "./lib/api.js";
import Steps from "./components/Steps.jsx";
import Status from "./components/Status.jsx";

function DynamicCopy({ children, dictionary = {} }) {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      const key = child.trim();
      if (!key || typeof dictionary[key] !== "string") return child;
      const leading = child.match(/^\s*/)?.[0] || "";
      const trailing = child.match(/\s*$/)?.[0] || "";
      return `${leading}${dictionary[key]}${trailing}`;
    }

    if (!React.isValidElement(child)) return child;

    // React Router requires Routes to contain only Route or Fragment children.
    // Do not recursively wrap route declarations in DynamicCopy.
    if (child.type === Routes || child.type === Route) return child;

    if (child.props?.children !== undefined) {
      return React.cloneElement(
        child,
        {},
        <DynamicCopy dictionary={dictionary}>
          {child.props.children}
        </DynamicCopy>,
      );
    }

    return child;
  });
}

function Alert({ error, success, onClose }) {
  if (!error && !success) return null;
  return (
    <div
      className={`alert ${error ? "alert-error" : "alert-success"}`}
      role="status"
    >
      {error || success}
      <button className="icon-button" onClick={onClose} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
function Field({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
function Button({
  children,
  variant = "primary",
  loading = false,
  block = false,
  className = "",
  ...props
}) {
  return (
    <button
      {...props}
      type={props.type || "button"}
      className={`button button-${variant} ${block ? "button-block" : ""} ${className}`}
      disabled={loading || props.disabled}
    >
      {loading ? <RefreshCw size={16} className="spin" /> : null}
      {children}
    </button>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState({});
  const [site, setSite] = useState({});
  const location = useLocation();
  useEffect(() => {
    api("/site/content")
      .then((d) => {
        setSite(d.content || {});
        setContent(d.content?.home || {});
      })
      .catch(() => {});
    const query = new URLSearchParams(location.search);
    if (query.get("error"))
      setError(
        "Administrator sign-in failed. Check the administrator email and password.",
      );
  }, [location.search]);
  async function adminLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await api("/admin/login", {
        method: "POST",
        body: { email, password },
      });
      onLogin(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-brand">
        {site.header?.logoUrl || content.logoUrl ? (
          <img
            className="brand-logo"
            src={site.header?.logoUrl || content.logoUrl}
            alt="College logo"
          />
        ) : (
          <div className="brand-mark">S</div>
        )}
        <div>
          <div className="brand-name">
            {site.header?.title || content.title || "SGGS Salary Notifications"}
          </div>
          <div className="brand-subtitle">College operations portal</div>
        </div>
      </div>
      <div className="login-grid">
        <section className="login-intro">
          <span className="eyebrow">COLLEGE-ONLY SYSTEM</span>
          <h1>
            {content.heading || "Salary notifications, managed securely."}
          </h1>
          <p>
            {content.subtitle ||
              "Upload salary documents, review employee records, approve notifications and track delivery from one simple workspace."}
          </p>
          <div className="login-points">
            <div>
              <ShieldCheck size={18} />
              <span>Access for authorized college users</span>
            </div>
            <div>
              <FileText size={18} />
              <span>Document review and delivery reports</span>
            </div>
            <div>
              <Activity size={18} />
              <span>Traceable approvals and audit history</span>
            </div>
          </div>
        </section>
        <div className="login-cards">
          <section className="panel login-card">
            <div className="card-icon admin-icon">
              <ShieldCheck size={20} />
            </div>
            <h2>Admin login</h2>
            <p>
              Upload salary files, manage directories, create campaigns, send
              notifications and review reports.
            </p>
            <form onSubmit={adminLogin} className="stack">
              <Field
                label="Admin email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Field
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="submit" loading={busy} block>
                Sign in as admin <ChevronRight size={16} />
              </Button>
            </form>
          </section>
          <Alert error={error} onClose={() => setError("")} />
        </div>
      </div>
      <footer className="login-footer">
        {site.footer?.text ||
          content.footer ||
          "SGGS · Authorized use only · Do not share salary records outside approved college workflows."}
      </footer>
    </main>
  );
}

const navAdmin = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/campaigns", label: "Campaigns", icon: Bell },
  { to: "/admin/uploads", label: "Document review", icon: UploadCloud },
  {
    to: "/admin/miscellaneous",
    label: "Miscellaneous directory",
    icon: ClipboardList,
  },
  { to: "/admin/templates", label: "Message templates", icon: MessageSquare },
  { to: "/admin/content", label: "Website content", icon: Image },
  { to: "/admin/reports", label: "Reports", icon: ClipboardList },
  { to: "/admin/audit", label: "Audit logs", icon: Activity },
  { to: "/admin/usage", label: "Usage & costs", icon: FileSpreadsheet },
  { to: "/admin/settings", label: "System settings", icon: Settings },
  { to: "/admin/backups", label: "Backup & restore", icon: RefreshCw },
];
function Shell({ user, onLogout, children }) {
  const location = useLocation();
  const nav = navAdmin;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [site, setSite] = useState({});
  useEffect(() => {
    api("/site/content")
      .then((d) => setSite(d.content || {}))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);
  const current =
    nav.find((item) => item.to === location.pathname) ||
    nav.find(
      (item) => location.pathname.startsWith(item.to) && item.to !== "/admin",
    ) ||
    nav[0];
  const uiCopy = site.uiCopy?.labels || site.uiCopy || {};
  return (
    <DynamicCopy dictionary={uiCopy}>
      <div className="app-shell">
        <aside
          id="admin-sidebar"
          className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}
          aria-label="Administration navigation"
        >
          <div className="sidebar-brand">
            {site.header?.logoUrl || site.home?.logoUrl ? (
              <img
                className="brand-logo sidebar-logo"
                src={site.header?.logoUrl || site.home?.logoUrl}
                alt="College logo"
              />
            ) : (
              <div className="brand-mark small">S</div>
            )}
            <div>
              <strong>
                {site.header?.title || site.home?.title || "SGGS"}
              </strong>
              <span>{site.header?.tagline || "Salary notifications"}</span>
            </div>
            <button
              className="icon-button sidebar-close"
              onClick={() => setMobileOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="role-label">{"ADMINISTRATION"}</div>
          <nav className="side-nav">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={location.pathname === item.to ? "active" : ""}
              >
                <item.icon size={18} />
                <span>{site.navigation?.[item.to] || item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="user-mini">
              <div className="avatar">
                {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
              </div>
              <div className="user-mini-text">
                <strong>{user.name || user.email}</strong>
                <span>{user.email}</span>
              </div>
            </div>
            <button className="logout-button" onClick={onLogout}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </aside>
        <div className="main-column">
          <header className="topbar">
            <button
              className="icon-button menu-toggle"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls="admin-sidebar"
            >
              <span className="hamburger">☰</span>
            </button>
            <div className="breadcrumbs">
              <span>{site.header?.title || site.home?.title || "SGGS"}</span>
              <ChevronRight size={14} />
              <strong>{site.navigation?.[current.to] || current.label}</strong>
            </div>
            <div className="topbar-right">
              <span className="secure-tag">
                <span className="secure-dot" /> Secure session
              </span>
              <div className="avatar avatar-top">
                {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
              </div>
            </div>
          </header>
          <main className="page-content">{children}</main>
          <footer className="app-footer">
            <span>
              {site.header?.title ||
                site.home?.title ||
                "SGGS Salary Notification System"}
            </span>
            <span>
              {site.footer?.text ||
                site.home?.footer ||
                "Authorized college use · Keep payroll information confidential"}
            </span>
          </footer>
        </div>
        {mobileOpen && (
          <button
            className="scrim"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
        )}
      </div>
    </DynamicCopy>
  );
}
function PageHeading({ eyebrow, title, description, action }) {
  const location = useLocation();
  const [dynamic, setDynamic] = useState(null);
  useEffect(() => {
    const pageKey = {
      "/admin": "admin",
      "/admin/campaigns": "campaigns",
      "/admin/uploads": "uploads",
      "/admin/miscellaneous": "miscellaneous",
      "/admin/templates": "templates",
      "/admin/reports": "reports",
      "/admin/audit": "audit",
      "/admin/usage": "usage",
      "/admin/settings": "settings",
      "/admin/backups": "backups",
    }[location.pathname];
    if (!pageKey) return;
    api("/site/content")
      .then((response) =>
        setDynamic(response.content?.[pageKey]?.content || null),
      )
      .catch(() => {});
  }, [location.pathname]);
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{dynamic?.title || title}</h1>
        {(dynamic?.description || dynamic?.subtitle || description) && (
          <p>{dynamic?.description || dynamic?.subtitle || description}</p>
        )}
      </div>
      {dynamic?.imageUrl && (
        <img src={dynamic.imageUrl} alt="" className="page-heading-image" />
      )}
      {action}
    </div>
  );
}
function Empty({ title, text }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <FileText size={22} />
      </div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
function Stat({ label, value, note, icon: Icon }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon size={17} />
        </span>
      </div>
      <div className="stat-value">{value ?? "—"}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}

function UploadsPage() {
  const admin = true;
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [records, setRecords] = useState([]);
  const [title, setTitle] = useState("");
  const [channels, setChannels] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function load() {
    const d = await api("/uploads");
    setUploads(d.items || []);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const id = setInterval(() => load().catch(() => {}), 8000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!selected || !["uploaded", "processing"].includes(selected.status))
      return;
    const timer = setInterval(
      () =>
        api(`/uploads/${selected._id}/preview`)
          .then((d) => {
            setSelected(d.upload);
            setRecords(d.records || []);
          })
          .catch(() => {}),
      4000,
    );
    return () => clearInterval(timer);
  }, [selected?._id, selected?.status]);
  async function uploadFile(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const form = new FormData();
      form.append("file", file);
      const d = await api("/uploads", { method: "POST", body: form });
      setSuccess(
        `Upload received: ${d.upload.reference}. Processing has started.`,
      );
      setFile(null);
      e.target.reset();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function viewUpload(u) {
    setError("");
    try {
      const d = await api(`/uploads/${u._id}/preview`);
      setSelected(d.upload);
      setRecords(d.records || []);
      setChannels([]);
      setTitle(d.upload.originalName.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(e.message);
    }
  }
  async function deleteUpload(upload) {
    if (!window.confirm(`Delete uploaded document "${upload.originalName}"?`))
      return;
    try {
      await api(`/uploads/${upload._id}`, { method: "DELETE" });
      if (selected?._id === upload._id) setSelected(null);
      setSuccess("Uploaded document deleted.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function saveRecord(record, extra = {}) {
    try {
      const d = await api(`/uploads/${selected._id}/records/${record._id}`, {
        method: "PATCH",
        body: {
          name: record.name,
          email: record.email,
          phone: record.phone,
          salaryAmount:
            record.salaryAmount?.toString?.() || record.salaryAmount,
          salaryPeriod: record.salaryPeriod,
          language: record.language,
          ...extra,
        },
      });
      setRecords((old) =>
        old.map((r) => (r._id === record._id ? d.record : r)),
      );
      setSuccess("Salary record updated.");
    } catch (e) {
      setError(e.message);
    }
  }
  async function submitCampaign() {
    setBusy(true);
    setError("");
    try {
      const d = await api(`/uploads/${selected._id}/submit`, {
        method: "POST",
        body: { title, channels },
      });
      setSuccess(
        `Campaign ${d.campaign.reference} created. Review its personalized messages in Campaigns before approving it.`,
      );
      setSelected(null);
      navigate(`/admin/campaigns/${d.campaign._id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const toggleChannel = (ch) =>
    setChannels((old) =>
      old.includes(ch) ? old.filter((x) => x !== ch) : [...old, ch],
    );

  const hasSalary = records.some(
    (record) =>
      record.salaryAmount !== undefined &&
      record.salaryAmount !== null &&
      String(record.salaryAmount).trim() !== "",
  );

  return (
    <>
      <PageHeading
        eyebrow="DOCUMENT PROCESSING"
        title="Documents"
        description="Upload a salary document, review the extracted records, select channels and create a campaign."
      />
      <Alert
        error={error}
        success={success}
        onClose={() => {
          setError("");
          setSuccess("");
        }}
      />
      <div className="content-grid upload-grid">
        <div className="stack">
          <Steps
            title="Upload workflow"
            steps={[
              {
                title: "Choose file",
                description:
                  "CSV, XLSX, XLS or PDF up to the configured upload limit.",
              },
              {
                title: "Wait for processing",
                description:
                  "The system extracts salary rows and validates the contact details supplied in the uploaded document.",
              },
              {
                title: "Review records",
                description:
                  "Check the preview and correct any invalid values.",
              },
              {
                title: "Submit campaign",
                description:
                  "Choose notification channels, create the campaign, review the personalized messages and start sending.",
              },
            ]}
          />
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Upload document</h2>
                <p className="muted">Accepted formats: CSV, Excel and PDF</p>
              </div>
              <UploadCloud size={20} className="muted-icon" />
            </div>
            <form onSubmit={uploadFile} className="stack">
              <label className="dropzone">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                />
                <UploadCloud size={24} />
                <strong>{file?.name || "Choose a file to upload"}</strong>
                <span>
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                    : "CSV, XLSX, XLS or PDF"}
                </span>
              </label>
              <Button type="submit" loading={busy} block>
                Upload and process
              </Button>
              <p className="helper-text">
                Salary documents are stored privately. Do not upload files you
                are not authorized to process.
              </p>
            </form>
          </section>
        </div>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Upload history</h2>
              <p className="muted">Select a processed document to review</p>
            </div>
            <button
              className="icon-button"
              onClick={() => load()}
              aria-label="Refresh uploads"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {uploads.length === 0 ? (
            <Empty
              title="No uploads"
              text="Uploaded documents will appear here."
            />
          ) : (
            <div className="upload-list">
              {uploads.map((u) => (
                <div
                  className={`upload-item ${selected?._id === u._id ? "selected" : ""}`}
                  key={u._id}
                >
                  <button
                    className="upload-item-main"
                    onClick={() => viewUpload(u)}
                  >
                    <span className="file-icon">
                      <FileText size={18} />
                    </span>
                    <span className="upload-item-text">
                      <strong>{u.originalName}</strong>
                      <small>
                        {u.reference} · {formatDate(u.createdAt)}
                      </small>
                      <span className="muted small">
                        {u.rowCount ?? "—"} rows · {u.validCount ?? "—"} valid ·{" "}
                        {u.invalidCount ?? "—"} issues
                      </span>
                    </span>
                    <Status value={u.status} />
                  </button>
                  <Button
                    variant="ghost"
                    className="button-small"
                    onClick={() => deleteUpload(u)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {selected && (
        <section className="panel record-panel">
          <div className="panel-title">
            <div>
              <h2>Review extracted records</h2>
              <p className="muted">
                {selected.reference} · {records.length} records · Save
                corrections before submitting.
              </p>
            </div>
            <button
              className="icon-button"
              onClick={() => setSelected(null)}
              aria-label="Close preview"
            >
              <X size={18} />
            </button>
          </div>
          {selected.status === "submitted" && (
            <Alert
              error="This document is linked to a campaign and is locked. Use the campaign version workflow instead of reprocessing the source file."
              onClose={() => {}}
            />
          )}
          {selected.status === "processing" ||
          selected.status === "uploaded" ? (
            <p className="helper-text">
              The document is still processing. This panel will refresh when
              processing completes.
            </p>
          ) : null}
          {selected.status === "failed" && (
            <Alert
              error={
                selected.errors?.join("; ") ||
                "Processing failed. Re-upload the file after correcting its format."
              }
              onClose={() => {}}
            />
          )}
          {selected.status === "review" && (
            <div className="helper-text">
              {selected.validCount || 0} valid · {selected.invalidCount || 0}{" "}
              require correction · {selected.duplicateCount || 0} duplicate
              contacts. Campaign creation remains blocked until every included
              record is valid.
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  {hasSalary && <th>Salary</th>}
                  <th>Validation</th>
                  <th>Save</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <EditableRecord
                    key={r._id}
                    record={r}
                    onSave={saveRecord}
                    showSalary={hasSalary}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {selected.status === "review" && admin && (
            <div className="campaign-submit">
              <div className="campaign-fields">
                <Field
                  label="Campaign title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
                <div className="channel-select">
                  <span>Notification channels (select one or more)</span>
                  {["email", "sms", "whatsapp"].map((ch) => (
                    <label key={ch}>
                      <input
                        type="checkbox"
                        checked={channels.includes(ch)}
                        onChange={() => toggleChannel(ch)}
                      />
                      {ch.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
              <Button
                onClick={submitCampaign}
                loading={busy}
                disabled={!channels.length || !title.trim()}
              >
                Create campaign and review
              </Button>
              <p className="helper-text">
                Select every channel you want included. Provider configuration
                is checked again during approval; phone numbers must be valid
                international numbers for SMS or WhatsApp. After creation,
                review every personalized message before approving delivery.
              </p>
            </div>
          )}
        </section>
      )}
    </>
  );
}
function EditableRecord({ record, onSave, showSalary = false }) {
  const [r, setR] = useState(record);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setR(record);
  }, [record]);

  async function handleSave(extra = {}) {
    setSaving(true);

    try {
      await onSave(r, extra);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>
        <input
          className="table-input"
          value={r.name || ""}
          onChange={(e) => setR({ ...r, name: e.target.value })}
          aria-label="Employee name"
        />
      </td>

      <td>
        <input
          className="table-input wide"
          type="email"
          value={r.email || ""}
          onChange={(e) => setR({ ...r, email: e.target.value })}
          aria-label="Employee email"
          placeholder="employee@example.com"
        />
      </td>

      <td>
        <input
          className="table-input"
          type="tel"
          value={r.phone || ""}
          onChange={(e) => setR({ ...r, phone: e.target.value })}
          aria-label="Employee mobile number"
          placeholder="Mobile number"
        />
      </td>

      {showSalary && (
        <td>
          <input
            className="table-input"
            type="number"
            min="0"
            step="0.01"
            value={r.salaryAmount?.toString?.() || r.salaryAmount || ""}
            onChange={(e) => setR({ ...r, salaryAmount: e.target.value })}
            aria-label="Salary amount"
          />
        </td>
      )}

      <td>
        <Status value={r.valid ? "valid" : "needs_review"} />

        {r.errors?.length > 0 && (
          <small className="error-small">{r.errors.join("; ")}</small>
        )}
      </td>

      <td>
        <div className="table-actions">
          <button
            type="button"
            className="button button-secondary button-small"
            disabled={saving}
            onClick={() => handleSave()}
          >
            <Check size={14} />
            {saving ? "Saving…" : "Save"}
          </button>

          {!r.excluded && (
            <button
              type="button"
              className="button button-ghost button-small"
              disabled={saving}
              onClick={() => handleSave({ excluded: true })}
            >
              Exclude
            </button>
          )}

          {r.excluded && (
            <button
              type="button"
              className="button button-ghost button-small"
              disabled={saving}
              onClick={() => handleSave({ excluded: false })}
            >
              Include
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function CampaignsPage() {
  const admin = true;
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState("");
  async function load() {
    try {
      const d = await api("/admin/campaigns");
      setItems(d.items || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function action(id, action, body = {}) {
    setBusyId(id + action);
    setError("");
    setSuccess("");
    try {
      await api(`/admin/campaigns/${id}/${action}`, { method: "POST", body });
      setSuccess(
        action === "cancellation-request"
          ? "Cancellation request recorded. An administrator must review it."
          : `Campaign action completed: ${action.replaceAll("-", " ")}.`,
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  }
  async function deleteCampaign(campaign) {
    if (
      !window.confirm(
        `Delete campaign "${campaign.title}"? Only inactive campaigns can be deleted.`,
      )
    )
      return;
    setBusyId(`${campaign._id}delete`);
    try {
      await api(`/admin/campaigns/${campaign._id}`, {
        method: "DELETE",
      });
      setSuccess("Campaign deleted.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Campaign management"
        description={
          "Create campaigns, review personalized messages, approve or schedule delivery, and monitor results."
        }
      />
      <Alert
        error={error}
        success={success}
        onClose={() => {
          setError("");
          setSuccess("");
        }}
      />
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Campaign queue</h2>
            <p className="muted">{items.length} campaigns</p>
          </div>
          <button className="icon-button" onClick={load} aria-label="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
        {items.length === 0 ? (
          <Empty
            title="No campaigns"
            text="Campaigns created by the administrator will appear here."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Recipients</th>
                  <th>Channels</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <strong>{c.title}</strong>
                      <small>
                        {c.reference} · v{c.version}
                      </small>
                    </td>
                    <td>{c.recipientCount ?? 0}</td>
                    <td>{c.channels?.join(", ")}</td>
                    <td>{formatDate(c.createdAt)}</td>
                    <td>
                      <Status value={c.status} />
                    </td>
                    <td>
                      <div className="table-actions">
                        {admin && c.status === "awaiting_approval" && (
                          <span className="helper-text">Review required</span>
                        )}
                        {admin &&
                          ["sending", "scheduled", "approved"].includes(
                            c.status,
                          ) && (
                            <Button
                              variant="secondary"
                              className="button-small"
                              onClick={() => action(c._id, "pause")}
                            >
                              Pause
                            </Button>
                          )}
                        {admin && c.status === "paused" && (
                          <Button
                            variant="secondary"
                            className="button-small"
                            onClick={() => action(c._id, "resume")}
                          >
                            Resume
                          </Button>
                        )}
                        {admin &&
                          ["partial_failure", "failed", "completed"].includes(
                            c.status,
                          ) &&
                          (c.counters?.failed || 0) > 0 && (
                            <Button
                              variant="secondary"
                              className="button-small"
                              onClick={() => action(c._id, "retry-failed")}
                            >
                              Retry failed
                            </Button>
                          )}
                        {admin &&
                          !["completed", "cancelled", "failed"].includes(
                            c.status,
                          ) && (
                            <Button
                              variant="ghost"
                              className="button-small"
                              onClick={() => action(c._id, "cancel")}
                            >
                              Cancel
                            </Button>
                          )}
                        {admin &&
                          [
                            "draft",
                            "awaiting_approval",
                            "rejected",
                            "cancelled",
                            "failed",
                            "completed",
                            "partial_failure",
                          ].includes(c.status) && (
                            <Button
                              variant="ghost"
                              className="button-small"
                              loading={busyId === `${c._id}delete`}
                              onClick={() => deleteCampaign(c)}
                            >
                              Delete
                            </Button>
                          )}
                        {!admin &&
                          !["completed", "cancelled", "failed"].includes(
                            c.status,
                          ) && (
                            <Button
                              variant="ghost"
                              className="button-small"
                              onClick={() =>
                                action(c._id, "cancellation-request")
                              }
                            >
                              Request cancellation
                            </Button>
                          )}
                        <Link
                          className="text-link"
                          to={`/admin/campaigns/${c._id}`}
                        >
                          Details
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function CampaignDetails({ user }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const id = pathname.split("/").pop();
  const admin = user.role === "admin";
  const [campaign, setCampaign] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newChannels, setNewChannels] = useState([]);
  const [visitedPages, setVisitedPages] = useState(new Set());
  const [reviewChecked, setReviewChecked] = useState(false);
  const [reviewAck, setReviewAck] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  async function loadPreview(page = 1) {
    let d;
    try {
      d = await api(`/admin/campaigns/${id}/preview?page=${page}&limit=25`);
      setPreviewError("");
    } catch (e) {
      setPreviewError(e.message);
      throw e;
    }
    if (preview?.campaignId === id && preview.snapshotHash !== d.snapshotHash) {
      setVisitedPages(new Set([page]));
      setError(
        "The campaign or template changed while reviewing. Please review every page again.",
      );
    } else setVisitedPages((old) => new Set([...old, page]));
    setPreview({ ...d, campaignId: id });
    setPreviewPage(page);
    setReviewChecked(false);
    setReviewAck(false);
  }
  async function load() {
    try {
      const [c, d] = await Promise.all([
        api(`/campaigns/${id}`),
        api(`/campaigns/${id}/deliveries`),
      ]);
      setCampaign(c.campaign);
      setDeliveries(d.items || []);
      if (admin && c.campaign.status === "awaiting_approval")
        await loadPreview(1);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    setCampaign(null);
    setDeliveries([]);
    setPreview(null);
    setPreviewError("");
    setVisitedPages(new Set());
    setReviewChecked(false);
    setReviewAck(false);
    load();
  }, [id]);
  async function createVersion() {
    try {
      const d = await api(
        `${admin ? "/admin" : "/campaigns"}/${id}/new-version`,
        {
          method: "POST",
          body: { title: newTitle || campaign.title, channels: newChannels },
        },
      );
      navigate(`/admin/campaigns/${d.campaign._id}`);
    } catch (e) {
      setError(e.message);
    }
  }
  async function acknowledge() {
    setReviewBusy(true);
    setError("");
    try {
      await api(`/admin/campaigns/${id}/preview-ack`, {
        method: "POST",
        body: { snapshotHash: preview.snapshotHash },
      });
      setReviewAck(true);
      setSuccess(
        "The personalized preview has been acknowledged. You can now approve this exact version.",
      );
    } catch (e) {
      setError(e.message);
      setReviewAck(false);
    } finally {
      setReviewBusy(false);
    }
  }
  async function action(name, body = {}) {
    setReviewBusy(true);
    setError("");
    setSuccess("");
    try {
      const d = await api(`/admin/campaigns/${id}/${name}`, {
        method: "POST",
        body,
      });
      setCampaign(d.campaign || campaign);
      setSuccess(
        name === "approve"
          ? "Campaign approved and queued for dispatch."
          : name === "reject"
            ? "Campaign rejected."
            : `Campaign ${name.replaceAll("-", " ")} completed.`,
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setReviewBusy(false);
    }
  }
  if (error && !campaign) return <Alert error={error} />;
  if (!campaign)
    return (
      <div className="loading-block">
        <RefreshCw className="spin" /> Loading campaign…
      </div>
    );
  return (
    <>
      <PageHeading
        eyebrow="CAMPAIGN DETAIL"
        title={campaign.title}
        description={`${campaign.reference} · Version ${campaign.version}`}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setNewTitle(`${campaign.title} (new version)`);
              setNewChannels(campaign.channels || ["email"]);
              setNewVersionOpen((v) => !v);
            }}
          >
            Create new version
          </Button>
        }
      />
      {newVersionOpen && (
        <section className="panel version-create">
          <div className="form-grid">
            <Field
              label="New version title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
            <div className="channel-select">
              <span>Channels for the new version (select one or more)</span>
              {["email", "sms", "whatsapp"].map((ch) => (
                <label key={ch}>
                  <input
                    type="checkbox"
                    checked={newChannels.includes(ch)}
                    onChange={() =>
                      setNewChannels((old) =>
                        old.includes(ch)
                          ? old.filter((x) => x !== ch)
                          : [...old, ch],
                      )
                    }
                  />
                  {ch.toUpperCase()}
                </label>
              ))}
            </div>
          </div>
          <div className="button-row">
            <Button
              disabled={!newTitle.trim() || !newChannels.length}
              onClick={createVersion}
            >
              Create draft version
            </Button>
            <Button variant="ghost" onClick={() => setNewVersionOpen(false)}>
              Close
            </Button>
          </div>
          <p className="helper-text">
            The new version requires a fresh administrator preview and approval.
            Corrected salary values require a corrected source document.
          </p>
        </section>
      )}
      <Alert
        error={error}
        success={success}
        onClose={() => {
          setError("");
          setSuccess("");
        }}
      />
      <div className="stats-grid">
        <Stat
          label="Recipients"
          value={campaign.recipients?.length || 0}
          note="Unique employees"
          icon={UserRound}
        />
        <Stat
          label="Delivered"
          value={campaign.counters?.delivered || 0}
          note="Provider-confirmed deliveries"
          icon={Check}
        />
        <Stat
          label="Failed"
          value={campaign.counters?.failed || 0}
          note="Failed attempts"
          icon={X}
        />
        <Stat
          label="Channels"
          value={campaign.channels?.length || 0}
          note={campaign.channels?.join(", ")}
          icon={Bell}
        />
      </div>
      {admin && campaign.status === "awaiting_approval" && (
        <section className="panel review-panel">
          <div className="panel-title">
            <div>
              <h2>Personalized message review</h2>
              <p className="muted">
                Review the exact employee-specific message content for every
                selected channel before approving.
              </p>
            </div>
            <ShieldCheck size={20} className="muted-icon" />
          </div>
          <div className="review-warning">
            <ShieldCheck size={17} />
            <p>
              Salary amounts are confidential. Verify the employee, language,
              contact mapping and message content. The preview is versioned; any
              content change requires a fresh review.
            </p>
          </div>
          {!preview ? (
            <div className="loading-block">
              {previewError ? (
                <div className="stack">
                  <p>{previewError}</p>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      loadPreview(1).catch((e) => setError(e.message))
                    }
                  >
                    Retry preview
                  </Button>
                </div>
              ) : (
                <>
                  <RefreshCw className="spin" /> Preparing preview…
                </>
              )}
            </div>
          ) : (
            <>
              <div className="preview-summary">
                <div>
                  <span>Recipients</span>
                  <strong>{preview.total}</strong>
                </div>
                <div>
                  <span>Preview pages visited</span>
                  <strong>
                    {visitedPages.size} / {preview.totalPages}
                  </strong>
                </div>
                <div>
                  <span>Channels</span>
                  <strong>{campaign.channels.join(", ")}</strong>
                </div>
              </div>
              <div className="preview-list">
                {preview.items.map((recipient, recipientIndex) => (
                  <article
                    className="preview-recipient"
                    key={
                      recipient.sourceRecord ||
                      recipient.email ||
                      `${recipient.sourceSheet || "sheet"}-${recipient.sourceRow || recipientIndex}`
                    }
                  >
                    <div className="preview-recipient-head">
                      <strong>{recipient.name}</strong>

                      <span>
                        Source:{" "}
                        {recipient.sourceSheet
                          ? `${recipient.sourceSheet} · `
                          : ""}
                        row {recipient.sourceRow ?? "—"}
                      </span>
                      <span>
                        Salary: ₹{recipient.salaryAmount}{" "}
                        {recipient.salaryPeriod || ""}
                      </span>
                      <span>
                        {{ en: "English", mr: "Marathi", hi: "Hindi" }[
                          recipient.language
                        ] || recipient.language}
                      </span>
                    </div>
                    {recipient.messages.map((m, i) => (
                      <div
                        className="message-preview"
                        key={`${m.channel}-${m.email || m.phone || "recipient"}-${i}`}
                      >
                        <div className="message-preview-head">
                          <strong>{m.channel.toUpperCase()}</strong>
                          <span>
                            {m.channel === "email" ? m.email : m.phone}
                          </span>
                        </div>
                        {m.subject && (
                          <div className="message-subject">
                            <span>Subject</span>
                            <strong>{m.subject}</strong>
                          </div>
                        )}
                        <p>{m.body}</p>
                        {m.whatsappTemplateName && (
                          <small>
                            Approved WhatsApp template: {m.whatsappTemplateName}{" "}
                            ·{" "}
                            {m.whatsappLanguageCode || "language code not set"}
                          </small>
                        )}
                      </div>
                    ))}
                  </article>
                ))}
              </div>
              <div className="preview-pagination">
                <Button
                  variant="secondary"
                  disabled={previewPage <= 1}
                  onClick={() =>
                    loadPreview(previewPage - 1).catch((e) =>
                      setError(e.message),
                    )
                  }
                >
                  Previous page
                </Button>
                <span>
                  Page {previewPage} of {preview.totalPages}
                </span>
                <Button
                  variant="secondary"
                  disabled={previewPage >= preview.totalPages}
                  onClick={() =>
                    loadPreview(previewPage + 1).catch((e) =>
                      setError(e.message),
                    )
                  }
                >
                  Next page
                </Button>
              </div>
              <div className="review-ack">
                <label>
                  <input
                    type="checkbox"
                    checked={reviewChecked}
                    onChange={(e) => {
                      setReviewChecked(e.target.checked);
                      if (!e.target.checked) setReviewAck(false);
                    }}
                    disabled={visitedPages.size < preview.totalPages}
                  />
                  <span>
                    I have reviewed all pages and verified the personalized
                    salary messages, recipient identities and channels.
                  </span>
                </label>
                <Button
                  variant="secondary"
                  loading={reviewBusy}
                  disabled={
                    !reviewChecked || visitedPages.size < preview.totalPages
                  }
                  onClick={acknowledge}
                >
                  Record review acknowledgement
                </Button>
              </div>
              <div className="approval-actions">
                <label className="field">
                  <span>Optional schedule time</span>
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Rejection reason</span>
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Required if rejecting"
                  />
                </label>
                <div className="button-row">
                  <Button
                    loading={reviewBusy}
                    disabled={!reviewAck || !reviewChecked}
                    onClick={() =>
                      action(
                        "approve",
                        scheduleAt
                          ? { scheduleAt: new Date(scheduleAt).toISOString() }
                          : {},
                      )
                    }
                  >
                    Approve {scheduleAt ? "and schedule" : "and send"}
                  </Button>
                  <Button
                    variant="ghost"
                    loading={reviewBusy}
                    disabled={!rejectReason.trim()}
                    onClick={() => action("reject", { reason: rejectReason })}
                  >
                    Reject campaign
                  </Button>
                </div>
              </div>
            </>
          )}
          {previewError && (
            <div className="approval-actions">
              <label className="field field-span">
                <span>Rejection reason</span>
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why the campaign cannot be approved"
                />
              </label>
              <Button
                variant="ghost"
                loading={reviewBusy}
                disabled={!rejectReason.trim()}
                onClick={() => action("reject", { reason: rejectReason })}
              >
                Reject campaign
              </Button>
            </div>
          )}
        </section>
      )}
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Delivery log</h2>
            <p className="muted">Contacts are masked in this table.</p>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await api("/reports", {
                  method: "POST",
                  body: { type: "deliveries-csv", filters: { campaignId: id } },
                });
                setSuccess(
                  "Report queued. Open Reports to download it when ready.",
                );
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <FileSpreadsheet size={16} /> Export CSV
          </Button>
        </div>
        {deliveries.length === 0 ? (
          <Empty
            title="No delivery jobs yet"
            text="Delivery rows appear after an approved campaign begins sending."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td>{d.contact}</td>
                    <td>{d.channel}</td>
                    <td>
                      <Status value={d.status} />
                    </td>
                    <td>{d.attempts}</td>
                    <td>
                      {formatDate(d.deliveredAt || d.createdAt)}
                      {admin && ["unknown", "sent"].includes(d.status) && (
                        <div className="table-actions">
                          <Button
                            className="button-small"
                            variant="secondary"
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  "Confirm that the provider dashboard reports this message as delivered.",
                                )
                              )
                                return;
                              const providerMessageId = window.prompt(
                                "Optional provider message ID from the provider dashboard",
                              );
                              try {
                                await api(
                                  `/admin/deliveries/${d.id}/reconcile`,
                                  {
                                    method: "PATCH",
                                    body: {
                                      status: "delivered",
                                      providerMessageId:
                                        providerMessageId || undefined,
                                    },
                                  },
                                );
                                setSuccess(
                                  "Delivery marked delivered based on provider verification.",
                                );
                                const latest = await api(
                                  `/campaigns/${id}/deliveries`,
                                );
                                setDeliveries(latest.items || []);
                              } catch (e) {
                                setError(e.message);
                              }
                            }}
                          >
                            Mark delivered
                          </Button>
                          <Button
                            className="button-small"
                            variant="ghost"
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  "Confirm from provider logs that this message was NOT accepted. Only then retry.",
                                )
                              )
                                return;
                              try {
                                await api(
                                  `/admin/deliveries/${d.id}/reconcile`,
                                  {
                                    method: "PATCH",
                                    body: {
                                      status: "queued",
                                      confirmNotSent: true,
                                    },
                                  },
                                );
                                setSuccess(
                                  "Delivery re-queued after explicit confirmation it was not sent.",
                                );
                                const latest = await api(
                                  `/campaigns/${id}/deliveries`,
                                );
                                setDeliveries(latest.items || []);
                              } catch (e) {
                                setError(e.message);
                              }
                            }}
                          >
                            Confirm not sent & retry
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function ReportsPage({ admin = false }) {
  const [items, setItems] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [type, setType] = useState("campaign-pdf");
  const [campaignId, setCampaignId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  async function load() {
    try {
      const [r, c, h] = await Promise.all([
        api(admin ? "/admin/reports" : "/reports/my"),
        api(admin ? "/admin/campaigns" : "/campaigns"),
        api("/reports/download-history"),
      ]);
      setItems(r.items || []);
      setCampaigns(c.items || []);
      setHistory(h.items || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    const timer = setInterval(() => load().catch(() => {}), 6000);
    return () => clearInterval(timer);
  }, [admin]);
  async function requestReport(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const filters = {};
      if (campaignId) filters.campaignId = campaignId;
      if (type !== "campaign-pdf" && fromDate)
        filters.from = new Date(`${fromDate}T00:00:00.000Z`).toISOString();
      if (type !== "campaign-pdf" && toDate)
        filters.to = new Date(`${toDate}T23:59:59.999Z`).toISOString();
      await api("/reports", { method: "POST", body: { type, filters } });
      setSuccess("Report queued. It will appear below when ready.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteReport(report) {
    if (
      !window.confirm(
        `Delete report "${report.reference}" and its generated file?`,
      )
    )
      return;
    try {
      await api(`/reports/${report._id}`, { method: "DELETE" });
      setSuccess("Report deleted.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="REPORTING"
        title={admin ? "Reports & audit logs" : "Your reports"}
        description="Generate PDF, Excel or CSV exports. Reports expire after 30 days."
      />
      <Alert
        error={error}
        success={success}
        onClose={() => {
          setError("");
          setSuccess("");
        }}
      />
      <div className="content-grid">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Generate report</h2>
              <p className="muted">Choose a report type and scope.</p>
            </div>
            <FileText size={20} className="muted-icon" />
          </div>
          <form className="stack" onSubmit={requestReport}>
            <label className="field">
              <span>Report type</span>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="campaign-pdf">
                  Single campaign summary · PDF
                </option>
                <option value="campaigns-csv">Salary campaigns · CSV</option>
                <option value="campaigns-xlsx">Salary campaigns · Excel</option>
                {admin && (
                  <>
                    <option value="bills-csv">Miscellaneous bills · CSV</option>
                    <option value="bills-xlsx">
                      Miscellaneous bills · Excel
                    </option>
                    <option value="bills-pdf">Miscellaneous bills · PDF</option>
                  </>
                )}
                <option value="deliveries-xlsx">
                  Delivery details · Excel
                </option>
                <option value="deliveries-csv">Delivery details · CSV</option>
                <option value="uploads-pdf">Document processing · PDF</option>
                <option value="uploads-csv">Document processing · CSV</option>
                {admin && (
                  <>
                    <option value="audit-csv">Audit logs · CSV</option>
                    <option value="operations-pdf">
                      Operations summary · PDF
                    </option>
                  </>
                )}
              </select>
            </label>
            {type !== "campaign-pdf" && (
              <div className="form-grid">
                <Field
                  label="From date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
                <Field
                  label="To date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            )}
            {type === "campaign-pdf" && (
              <label className="field">
                <span>Campaign</span>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  required
                >
                  <option value="">Choose a campaign</option>
                  {campaigns.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.reference} — {c.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button type="submit" loading={busy}>
              <FileText size={16} /> Generate report
            </Button>
          </form>
          <div className="helper-box">
            <CircleHelp size={17} />
            <p>
              Reports include only the records your role is allowed to access.
              Salary amounts are excluded from standard delivery exports.
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Report jobs</h2>
              <p className="muted">
                Generated files are private and expire after 30 days.
              </p>
            </div>
            <button
              className="icon-button"
              onClick={load}
              aria-label="Refresh reports"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {items.length === 0 ? (
            <Empty
              title="No reports yet"
              text="Generate a report to see it here."
            />
          ) : (
            <div className="upload-list">
              {items.map((r) => (
                <div className="upload-item report-item" key={r._id}>
                  <span className="file-icon">
                    <FileText size={18} />
                  </span>
                  <span className="upload-item-text">
                    <strong>{r.type}</strong>
                    <small>
                      {r.reference} · {formatDate(r.createdAt)}
                    </small>
                    <small className="muted">
                      Expires {formatDate(r.expiresAt)}
                    </small>
                  </span>
                  <Status value={r.status} />
                  {r.status === "ready" && (
                    <Button
                      className="button-small"
                      onClick={() => download(`/reports/${r._id}/download`)}
                    >
                      <ArrowDownToLine size={15} /> Download
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="button-small"
                    onClick={() => deleteReport(r)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Download history</h2>
            <p className="muted">Audit trail for report downloads</p>
          </div>
        </div>
        {history.length === 0 ? (
          <Empty
            title="No downloads recorded"
            text="Successful and denied report downloads will appear here."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Role</th>
                  <th>Downloaded</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h._id}>
                    <td>{h.report}</td>
                    <td>{h.actorRole}</td>
                    <td>{formatDate(h.downloadedAt)}</td>
                    <td>
                      <Status value={h.result} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function AdminOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/admin/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  const s = data?.stats || {};
  return (
    <>
      <PageHeading
        eyebrow="SYSTEM ADMINISTRATION"
        title="Admin overview"
        description="Upload and review salary files, manage both directories, create campaigns and monitor notification delivery."
      />
      <Alert error={error} />
      <div className="stats-grid">
        <Stat
          label="Documents"
          value={s.uploads}
          note="Uploaded submissions"
          icon={FileSpreadsheet}
        />
        <Stat
          label="Campaigns"
          value={s.campaigns}
          note="All campaign versions"
          icon={Bell}
        />
        <Stat
          label="Pending approval"
          value={s.pendingApproval}
          note="Awaiting final review"
          icon={Activity}
        />
        <Stat
          label="Failed deliveries"
          value={s.failed}
          note="Review and retry where safe"
          icon={X}
        />
        <Stat
          label="Delivery jobs"
          value={s.deliveries}
          note="All channels"
          icon={Mail}
        />
        <Stat
          label="Estimated cost"
          value={`₹${Number(s.estimatedCost || 0).toFixed(2)}`}
          note="Based on configured unit prices"
          icon={FileSpreadsheet}
        />
        <Stat
          label="Actual cost"
          value={`₹${Number(s.actualCost || 0).toFixed(2)}`}
          note="Provider-reconciled usage"
          icon={Activity}
        />
      </div>
      <div className="content-grid">
        <Steps
          title="Admin operating guide"
          steps={[
            {
              title: "Configure the system",
              description:
                "Check providers, languages, retention and upload policies.",
            },
            {
              title: "Review documents and exceptions",
              description:
                "Review uploaded salary rows and correct missing or invalid contact details.",
            },
            {
              title: "Review campaign messages",
              description:
                "Verify recipients, salary details, languages and channels.",
            },
            {
              title: "Approve or schedule",
              description:
                "Approve the exact version or reject it with a reason.",
            },
            {
              title: "Monitor and export",
              description:
                "Track delivery, retry safe failures and download reports.",
            },
          ]}
        />
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Recent campaigns</h2>
              <p className="muted">Latest college activity</p>
            </div>
            <Link className="text-link" to="/admin/campaigns">
              Review queue <ChevronRight size={15} />
            </Link>
          </div>
          {!data?.recent?.length ? (
            <Empty
              title="No campaigns yet"
              text="Campaigns created by the administrator will appear here."
            />
          ) : (
            <div className="upload-list">
              {data.recent.map((c) => (
                <div className="upload-item" key={c._id}>
                  <span className="file-icon">
                    <Bell size={18} />
                  </span>
                  <span className="upload-item-text">
                    <strong>{c.title}</strong>
                    <small>
                      {c.reference} · {formatDate(c.createdAt)}
                    </small>
                  </span>
                  <Status value={c.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function MiscellaneousPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [amount, setAmount] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function load() {
    const d = await api(`/admin/bills?q=${encodeURIComponent(q)}&limit=100`);
    setItems(d.items || []);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function add(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const d = await api("/admin/bills", {
        method: "POST",
        body: {
          title,
          billNumber,
          recipientName,
          recipientEmail,
          organization,
          amount,
          issueDate: issueDate || undefined,
          dueDate: dueDate || undefined,
          notes,
        },
      });
      setSuccess(`Bill saved: ${d.bill.reference}`);
      setTitle("");
      setBillNumber("");
      setRecipientName("");
      setRecipientEmail("");
      setOrganization("");
      setAmount("");
      setIssueDate("");
      setDueDate("");
      setNotes("");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function send(item) {
    setError("");
    setSuccess("");
    try {
      await api(`/admin/bills/${item._id}/send`, { method: "POST", body: {} });
      setSuccess(`Bill email sent to ${item.recipientEmail}.`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function editDraft(item) {
    if (item.status !== "draft") return;
    const title = window.prompt("Bill title / purpose", item.title);
    if (title === null) return;
    const amount = window.prompt("Amount (INR)", String(item.amount || ""));
    if (amount === null) return;
    const recipientEmail = window.prompt(
      "Recipient email",
      item.recipientEmail,
    );
    if (recipientEmail === null) return;
    try {
      await api(`/admin/bills/${item._id}`, {
        method: "PATCH",
        body: { title, amount, recipientEmail },
      });
      setSuccess("Draft bill updated.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function removeDraft(item) {
    if (item.status === "sent") return;
    if (
      !window.confirm(`Delete bill ${item.reference}? This cannot be undone.`)
    )
      return;
    try {
      await api(`/admin/bills/${item._id}`, { method: "DELETE", body: {} });
      setSuccess("Bill deleted.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="MISCELLANEOUS BILLS"
        title="Miscellaneous bill management"
        description="Create and track non-salary bills, record the recipient and amount, and email bill details to the recipient."
      />
      <Alert
        error={error}
        success={success}
        onClose={() => {
          setError("");
          setSuccess("");
        }}
      />
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Create bill</h2>
            <p className="muted">
              Add a bill record before sending it by email.
            </p>
          </div>
          <ClipboardList size={20} className="muted-icon" />
        </div>
        <form className="form-grid" onSubmit={add}>
          <Field
            label="Bill title / purpose"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Field
            label="Bill number (optional)"
            value={billNumber}
            onChange={(e) => setBillNumber(e.target.value)}
          />
          <Field
            label="Recipient name"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            required
          />
          <Field
            label="Recipient email"
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            required
          />
          <Field
            label="Organization / vendor"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
          />
          <Field
            label="Amount (₹)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Field
            label="Issue date"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
          <Field
            label="Due date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <label className="field field-span">
            <span>Notes</span>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bill description or payment instructions"
            />
          </label>
          <div className="form-action">
            <Button type="submit">Save bill</Button>
          </div>
        </form>
      </section>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Bill records</h2>
            <p className="muted">{items.length} shown</p>
          </div>
          <form
            className="search-form"
            onSubmit={(e) => {
              e.preventDefault();
              load().catch((err) => setError(err.message));
            }}
          >
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search bill, recipient or organization"
            />
            <button type="submit">Search</button>
          </form>
        </div>
        {items.length === 0 ? (
          <Empty
            title="No bills yet"
            text="Create a bill using the form above."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Bill</th>
                  <th>Recipient</th>
                  <th>Amount</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i._id}>
                    <td>
                      <strong>{i.reference}</strong>
                    </td>
                    <td>
                      {i.title}
                      <small>{i.billNumber || ""}</small>
                    </td>
                    <td>
                      {i.recipientName}
                      <small>{i.recipientEmail}</small>
                    </td>
                    <td>
                      ₹
                      {Number(i.amount || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      {i.dueDate
                        ? new Date(i.dueDate).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td>
                      <Status value={i.status} />
                    </td>
                    <td>
                      <div className="table-actions">
                        <Button
                          variant="secondary"
                          className="button-small"
                          disabled={i.status === "sent"}
                          onClick={() => send(i)}
                        >
                          {i.status === "failed" ? "Retry email" : "Send email"}
                        </Button>
                        {i.status === "draft" && (
                          <Button
                            variant="secondary"
                            className="button-small"
                            onClick={() => editDraft(i)}
                          >
                            Edit draft
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="button-small"
                          disabled={i.status === "sent"}
                          onClick={() => removeDraft(i)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function TemplatesPage() {
  const [items, setItems] = useState([]);
  const [channel, setChannel] = useState("email");
  const [language, setLanguage] = useState("en");
  const [subject, setSubject] = useState(
    "Salary notification for {{salary_period}}",
  );
  const [body, setBody] = useState(
    "Dear {{employee_name}}, your salary notification for {{salary_period}} is ready. Salary amount: ₹{{salary_amount}}.",
  );
  const [waName, setWaName] = useState("");
  const [waLanguageCode, setWaLanguageCode] = useState("en_US");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function load() {
    const d = await api("/admin/templates?all=true");
    setItems(d.items || []);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const examples = {
      en: {
        subject: "Salary notification for {{salary_period}}",
        body: "Dear {{employee_name}}, your salary notification for {{salary_period}} is ready. Salary amount: ₹{{salary_amount}}.",
      },
      mr: {
        subject: "{{salary_period}} साठी वेतन सूचना",
        body: "प्रिय {{employee_name}}, {{salary_period}} साठी तुमची वेतन सूचना तयार आहे. वेतन रक्कम: ₹{{salary_amount}}.",
      },
      hi: {
        subject: "{{salary_period}} के लिए वेतन सूचना",
        body: "प्रिय {{employee_name}}, {{salary_period}} के लिए आपकी वेतन सूचना तैयार है। वेतन राशि: ₹{{salary_amount}}।",
      },
    };
    setSubject(examples[language].subject);
    setBody(examples[language].body);
    setWaLanguageCode(language === "en" ? "en_US" : language);
  }, [channel, language]);
  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/admin/templates", {
        method: "POST",
        body: {
          key: "salary_notification",
          channel,
          language,
          subject,
          body,
          whatsappTemplateName: waName,
          whatsappLanguageCode: waLanguageCode,
        },
      });
      setSuccess(
        "Template draft version created. Publish it after checking the provider-approved content.",
      );
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function publish(id) {
    try {
      await api(`/admin/templates/${id}/publish`, { method: "POST", body: {} });
      setSuccess("Template published.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function restore(id) {
    try {
      await api(`/admin/templates/${id}/restore`, { method: "POST", body: {} });
      setSuccess("A new draft version was created from the selected template.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function removeTemplate(template) {
    if (
      !window.confirm(
        `Delete ${template.channel.toUpperCase()} template version ${template.version}?`,
      )
    )
      return;
    try {
      await api(`/admin/templates/${template._id}`, { method: "DELETE" });
      setSuccess("Template version deleted.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="MESSAGE MANAGEMENT"
        title="Notification templates"
        description="Manage versioned templates in English, Marathi and Hindi. Campaign approval freezes the exact template version."
      />
      <Alert
        error={error}
        success={success}
        onClose={() => {
          setError("");
          setSuccess("");
        }}
      />
      <div className="content-grid">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Create template version</h2>
              <p className="muted">Use only the supported placeholders.</p>
            </div>
            <MessageSquare size={20} className="muted-icon" />
          </div>
          <form className="stack" onSubmit={create}>
            <label className="field">
              <span>Channel</span>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </label>
            <label className="field">
              <span>Language</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="mr">Marathi</option>
                <option value="hi">Hindi</option>
              </select>
            </label>
            {channel === "email" && (
              <Field
                label="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            )}
            {channel === "whatsapp" && (
              <>
                <Field
                  label="Approved WhatsApp template name"
                  value={waName}
                  onChange={(e) => setWaName(e.target.value)}
                  placeholder="Approved provider template name"
                  required
                />
                <Field
                  label="Provider language code"
                  value={waLanguageCode}
                  onChange={(e) => setWaLanguageCode(e.target.value)}
                  required
                />
                <p className="helper-text">
                  Use the exact language code shown in the approved WhatsApp
                  template (for example, en_US).
                </p>
              </>
            )}
            <label className="field">
              <span>Message body</span>
              <textarea
                rows="7"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </label>
            <div className="helper-box">
              <CircleHelp size={17} />
              <p>
                Placeholders: {"{{employee_name}}"}, {"{{salary_amount}}"},{" "}
                {"{{salary_period}}"}, {"{{campaign_title}}"},{" "}
                {"{{college_name}}"}, {"{{notification_date}}"}.
              </p>
            </div>
            <Button type="submit">Save new draft version</Button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Template versions</h2>
              <p className="muted">Drafts and published versions</p>
            </div>
          </div>
          {items.length === 0 ? (
            <Empty
              title="No templates yet"
              text="Create templates for each channel and language before approving a campaign."
            />
          ) : (
            <div className="upload-list">
              {items.map((t) => (
                <div className="upload-item" key={t._id}>
                  <span className="file-icon">
                    <MessageSquare size={18} />
                  </span>
                  <span className="upload-item-text">
                    <strong>
                      {t.channel.toUpperCase()} ·{" "}
                      {
                        { en: "English", mr: "Marathi", hi: "Hindi" }[
                          t.language
                        ]
                      }{" "}
                      · v{t.version}
                    </strong>
                    <small>
                      {t.subject ||
                        t.whatsappTemplateName ||
                        "Message template"}
                    </small>
                    <small className="muted">
                      {t.body.slice(0, 110)}
                      {t.body.length > 110 ? "…" : ""}
                    </small>
                  </span>
                  <Status value={t.status} />
                  {t.status === "draft" && (
                    <Button
                      className="button-small"
                      onClick={() => publish(t._id)}
                    >
                      Publish
                    </Button>
                  )}
                  {t.status !== "draft" && (
                    <Button
                      variant="ghost"
                      className="button-small"
                      onClick={() => restore(t._id)}
                    >
                      Restore as draft
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="button-small"
                    onClick={() => removeTemplate(t)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ContentPage() {
  const [key, setKey] = useState("home");
  const [title, setTitle] = useState("SGGS Salary Notifications");
  const [collegeName, setCollegeName] = useState("SGGS");
  const [heading, setHeading] = useState(
    "Salary notifications, managed securely.",
  );
  const [subtitle, setSubtitle] = useState(
    "Upload salary documents, review employee records, approve notifications and track delivery from one simple workspace.",
  );
  const [footer, setFooter] = useState("SGGS · Authorized college use");
  const [logoUrl, setLogoUrl] = useState("");
  const [navigationJson, setNavigationJson] = useState("{}");
  const [labelRows, setLabelRows] = useState([]);
  const [pages, setPages] = useState([]);
  const [image, setImage] = useState(null);
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function load() {
    const [d, h] = await Promise.all([
      api("/admin/site-content"),
      api(`/admin/site-content/versions?key=${encodeURIComponent(key)}`),
    ]);
    setPages(d.pages || []);
    const item = d.content?.[key];
    const c = item?.content || {};
    setTitle(c.title || "");
    setCollegeName(c.collegeName || "SGGS");
    setHeading(c.heading || "");
    setSubtitle(c.subtitle || c.tagline || "");
    setFooter(c.footer || c.text || "");
    setLogoUrl(c.logoUrl || c.imageUrl || "");
    setNavigationJson(JSON.stringify(c || {}, null, 2));
    setLabelRows(
      Object.entries(c || {})
        .filter(([, value]) => typeof value === "string")
        .map(([label, value]) => ({ label, value })),
    );
    setVersions(h.items || []);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [key]);
  async function uploadImage() {
    if (!image) return;
    const form = new FormData();
    form.append("file", image);
    const res = await fetch("/api/admin/site-assets", {
      method: "POST",
      body: form,
      credentials: "include",
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Image upload failed");
    setLogoUrl(d.url);
    setImage(null);
    setSuccess("Image uploaded. Publish content to apply it.");
    return d.url;
  }
  async function deleteImage() {
    if (!logoUrl.startsWith("/site-assets/")) return;
    if (!window.confirm("Delete this uploaded image?")) return;
    const name = logoUrl.split("/").pop();
    const response = await fetch(
      `/api/admin/site-assets/${encodeURIComponent(name)}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Image deletion failed");
    setLogoUrl("");
    setSuccess("Image deleted.");
  }
  async function save() {
    setError("");
    setSuccess("");
    try {
      let currentLogo = logoUrl;
      if (image) currentLogo = (await uploadImage()) || logoUrl;
      let content;
      if (key === "footer") content = { text: footer };
      else if (key === "header")
        content = { title, tagline: subtitle, logoUrl: currentLogo };
      else if (key === "navigation" || key === "uiCopy") {
        content = Object.fromEntries(
          labelRows
            .filter(({ label }) => label.trim())
            .map(({ label, value }) => [
              label.trim().slice(0, 200),
              value.slice(0, 500),
            ]),
        );
      } else
        content = {
          title,
          heading,
          subtitle,
          footer,
          logoUrl: currentLogo,
          imageUrl: currentLogo,
          collegeName,
        };
      const d = await api(`/admin/site-content/${key}`, {
        method: "PUT",
        body: { content },
      });
      setSuccess(
        `Draft version ${d.item.version} saved. Publish it to make the changes live.`,
      );
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function publish() {
    try {
      const d = await api("/admin/site-content");
      const item = d.content?.[key];
      if (!item || item.status !== "draft")
        return setError("Save a draft before publishing.");
      await api(`/admin/site-content/${item._id}/publish`, {
        method: "POST",
        body: {},
      });
      setSuccess("Content published.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function restoreVersion(id) {
    try {
      const d = await api(`/admin/site-content/versions/${id}/restore`, {
        method: "POST",
        body: {},
      });
      setSuccess(
        `Version ${d.item.version} created as a draft. Publish it to apply.`,
      );
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="DYNAMIC WEBSITE"
        title="Website content"
        description="Edit text and branding without changing source code. Drafts require publishing before they become visible."
      />
      <Alert
        error={error}
        success={success}
        onClose={() => {
          setError("");
          setSuccess("");
        }}
      />
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Content editor</h2>
            <p className="muted">
              Edit site branding, navigation, and exact internal dashboard text
              strings. Dashboard overrides are applied to matching visible text
              nodes.
            </p>
          </div>
          <Image size={20} className="muted-icon" />
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Content section</span>
            <select value={key} onChange={(e) => setKey(e.target.value)}>
              {(pages.length
                ? pages
                : [
                    { key: "home", label: "Home / sign-in", path: "/" },
                    {
                      key: "header",
                      label: "Header / branding",
                      path: "All pages",
                    },
                    { key: "footer", label: "Footer", path: "All pages" },
                    {
                      key: "navigation",
                      label: "Sidebar navigation",
                      path: "All admin pages",
                    },
                    {
                      key: "uiCopy",
                      label: "Shared text labels",
                      path: "All pages",
                    },
                  ]
              ).map((page) => (
                <option key={page.key} value={page.key}>
                  {page.label} ({page.path})
                </option>
              ))}
            </select>
          </label>
          {key === "navigation" || key === "uiCopy" ? (
            <label className="field field-span">
              <span>
                {key === "uiCopy"
                  ? "Dashboard text overrides JSON"
                  : "Navigation labels JSON"}
              </span>
              <div className="stack">
                {labelRows.map((row, index) => (
                  <div className="form-grid" key={`${row.label}-${index}`}>
                    <Field
                      label="Original text / key"
                      value={row.label}
                      onChange={(e) => {
                        const next = [...labelRows];
                        next[index] = { ...row, label: e.target.value };
                        setLabelRows(next);
                      }}
                    />
                    <Field
                      label="Editable replacement"
                      value={row.value}
                      onChange={(e) => {
                        const next = [...labelRows];
                        next[index] = { ...row, value: e.target.value };
                        setLabelRows(next);
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setLabelRows(labelRows.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setLabelRows([...labelRows, { label: "", value: "" }])
                  }
                >
                  Add text label
                </Button>
              </div>
            </label>
          ) : (
            <>
              {key !== "footer" && (
                <>
                  <Field
                    label="Website title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  {key === "home" && (
                    <>
                      <Field
                        label="College name used in notifications"
                        value={collegeName}
                        onChange={(e) => setCollegeName(e.target.value)}
                      />
                      <Field
                        label="Main heading"
                        value={heading}
                        onChange={(e) => setHeading(e.target.value)}
                      />
                    </>
                  )}
                  <label className="field field-span">
                    <span>
                      {key === "header" ? "Header tagline" : "Subtitle"}
                    </span>
                    <textarea
                      rows="3"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                    />
                  </label>
                  <Field
                    label="Logo / image URL"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="/site-assets/image.webp"
                  />
                  <label className="field">
                    <span>Upload logo/image (JPEG, PNG, WebP)</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setImage(e.target.files?.[0] || null)}
                    />
                  </label>
                </>
              )}
              {(key === "footer" || key === "home") && (
                <label className="field field-span">
                  <span>Footer text</span>
                  <textarea
                    rows="3"
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
                  />
                </label>
              )}
            </>
          )}
        </div>
        <div className="version-history">
          <div className="panel-title">
            <div>
              <h2>Pages and tabs</h2>
              <p className="muted">
                Every listed page can have an editable title, description,
                image, and shared text labels.
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Page / tab</th>
                  <th>Path</th>
                  <th>Editable content</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.key}>
                    <td>
                      <strong>{page.label}</strong>
                    </td>
                    <td>{page.path}</td>
                    <td>Text, title, description, image</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="button-row">
          <Button onClick={save}>Save draft</Button>
          <Button variant="secondary" onClick={publish}>
            Publish current version
          </Button>
        </div>
        <div className="helper-box">
          <CircleHelp size={17} />
          <p>
            Images are converted to WebP and served as public branding assets.
            Never upload salary documents or employee records here.
          </p>
        </div>
        <div className="version-history">
          <div className="panel-title">
            <div>
              <h2>Version history</h2>
              <p className="muted">Restore a prior version as a new draft.</p>
            </div>
          </div>
          {versions.length === 0 ? (
            <p className="muted">No versions saved for this section.</p>
          ) : (
            versions.map((v) => (
              <div className="version-row" key={v._id}>
                <div>
                  <strong>Version {v.version}</strong>
                  <small>
                    {v.status} · {formatDate(v.updatedAt || v.createdAt)}
                  </small>
                </div>
                <div className="table-actions">
                  {v.status === "draft" && (
                    <Button
                      className="button-small"
                      onClick={() =>
                        api(`/admin/site-content/${v._id}/publish`, {
                          method: "POST",
                          body: {},
                        })
                          .then(() => {
                            setSuccess(`Version ${v.version} published.`);
                            load();
                          })
                          .catch((e) => setError(e.message))
                      }
                    >
                      Publish
                    </Button>
                  )}
                  {v.status !== "draft" && (
                    <Button
                      variant="ghost"
                      className="button-small"
                      onClick={() => restoreVersion(v._id)}
                    >
                      Restore as draft
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [key, setKey] = useState("uploadPolicy");
  const [value, setValue] = useState(
    '{\n  "maxUploadMB": 20,\n  "maxRecipientsPerCampaign": 1000\n}',
  );
  const [providers, setProviders] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testing, setTesting] = useState("");
  async function load() {
    const [s, p] = await Promise.all([
      api("/admin/settings"),
      api("/admin/provider-health"),
    ]);
    setSettings(s.settings || {});
    setProviders(p.providers || []);
    setValue(JSON.stringify(s.settings?.[key] || {}, null, 2));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function save() {
    setError("");
    try {
      const parsed = JSON.parse(value);
      await api(`/admin/settings/${key}`, {
        method: "PATCH",
        body: { value: parsed },
      });
      setSuccess("Setting saved and audited.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function testProvider(channel) {
    setTesting(channel);
    setError("");
    setSuccess("");
    try {
      const d = await api(`/admin/providers/${channel}/test`, {
        method: "POST",
        body: {},
      });
      setSuccess(
        `${channel.toUpperCase()} provider connection test succeeded.`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setTesting("");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="SYSTEM CONFIGURATION"
        title="System settings"
        description="Operational policy is stored in the database. Provider credentials remain in server-side environment variables or a secret manager."
      />
      <Alert
        error={error}
        success={success}
        onClose={() => {
          setError("");
          setSuccess("");
        }}
      />
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Provider readiness</h2>
            <p className="muted">
              Configured does not mean a provider has been live-tested.
            </p>
          </div>
          <Activity size={20} className="muted-icon" />
        </div>
        <div className="provider-list">
          {providers.map((p) => (
            <div className="provider-row" key={p.channel}>
              <div>
                <strong>{p.channel.toUpperCase()}</strong>
                <p className="muted">
                  {p.mode} · {p.note}
                </p>
              </div>
              <div className="table-actions">
                <Status
                  value={p.configured ? "configured" : "not_configured"}
                />
                <Button
                  variant="secondary"
                  className="button-small"
                  loading={testing === p.channel}
                  disabled={!p.configured}
                  onClick={() => testProvider(p.channel)}
                >
                  Test connection
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Dynamic operational settings</h2>
            <p className="muted">Edit a supported setting as JSON.</p>
          </div>
          <Settings size={20} className="muted-icon" />
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Setting category</span>
            <select
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setValue(
                  JSON.stringify(settings[e.target.value] || {}, null, 2),
                );
              }}
            >
              {[
                "uploadPolicy",
                "notificationPolicy",
                "providerPricing",
                "costLimits",
                "retentionPolicy",
                "reportPolicy",
                "localePolicy",
              ].map((k) => (
                <option value={k} key={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="field field-span">
            <span>JSON value</span>
            <textarea
              className="code-textarea"
              rows="10"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
        </div>
        <Button onClick={save}>Save setting</Button>
        <p className="helper-text">
          Security-sensitive settings such as provider secrets, OAuth client
          secrets, session keys and database credentials cannot be changed
          through this JSON editor.
        </p>
      </section>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Retention baseline</h2>
            <p className="muted">Current configured project defaults</p>
          </div>
        </div>
        <div className="retention-grid">
          <div>
            <strong>
              {settings.retentionPolicy?.uploadRetentionDays || 90} days
            </strong>
            <span>Original uploaded files</span>
          </div>
          <div>
            <strong>365 days</strong>
            <span>Audit logs</span>
          </div>
          <div>
            <strong>{settings.reportPolicy?.retentionDays || 30} days</strong>
            <span>Generated reports</span>
          </div>
          <div>
            <strong>
              {settings.retentionPolicy?.backupRetentionDays || 35} days
            </strong>
            <span>Backup rolling window</span>
          </div>
        </div>
        <p className="helper-text">
          Extracted salary-record retention and provider billing-record
          retention require formal college policy confirmation. Do not treat the
          displayed defaults as a substitute for institutional approval.
        </p>
      </section>
    </>
  );
}

function UsagePage() {
  const [items, setItems] = useState([]);
  const [usage, setUsage] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function load() {
    const [r, u] = await Promise.all([
      api("/admin/usage/records"),
      api("/admin/usage"),
    ]);
    setItems(r.items || []);
    setUsage(u.usage || []);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function reconcile(item) {
    try {
      const d = await api(`/admin/usage/${item._id}/reconcile`, {
        method: "PATCH",
        body: { actualCost: amounts[item._id] },
      });
      setSuccess(`Actual cost reconciled for ${item.channel}.`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="PROVIDER ACCOUNTING"
        title="Usage & costs"
        description="Review estimated message costs and reconcile actual provider charges from approved invoices or usage exports."
      />
      <Alert
        error={error}
        success={success}
        onClose={() => {
          setError("");
          setSuccess("");
        }}
      />
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Channel totals</h2>
            <p className="muted">Actual costs remain zero until reconciled.</p>
          </div>
          <button className="icon-button" onClick={load}>
            <RefreshCw size={16} />
          </button>
        </div>
        {usage.length === 0 ? (
          <Empty
            title="No usage recorded"
            text="Usage records appear when messages are dispatched."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Provider</th>
                  <th>Units</th>
                  <th>Estimated cost</th>
                  <th>Actual cost</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((u, i) => (
                  <tr key={i}>
                    <td>{u._id.channel}</td>
                    <td>{u._id.provider}</td>
                    <td>{u.units}</td>
                    <td>₹{Number(u.estimatedCost || 0).toFixed(2)}</td>
                    <td>₹{Number(u.actualCost || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Usage records</h2>
            <p className="muted">
              Update actual cost from provider billing records.
            </p>
          </div>
        </div>
        {items.length === 0 ? (
          <Empty
            title="No usage records"
            text="No provider usage records are available yet."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Provider / channel</th>
                  <th>Units</th>
                  <th>Estimated</th>
                  <th>Actual INR</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i._id}>
                    <td>{formatDate(i.occurredAt)}</td>
                    <td>
                      {i.provider}
                      <small>{i.channel}</small>
                    </td>
                    <td>{i.units}</td>
                    <td>₹{Number(i.estimatedCost || 0).toFixed(2)}</td>
                    <td>
                      <input
                        className="table-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={amounts[i._id] ?? i.actualCost ?? 0}
                        onChange={(e) =>
                          setAmounts((old) => ({
                            ...old,
                            [i._id]: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td>
                      <Status value={i.reconciliationStatus} />
                    </td>
                    <td>
                      <Button
                        className="button-small"
                        variant="secondary"
                        onClick={() => reconcile(i)}
                      >
                        Reconcile
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function BackupPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const d = await api("/admin/backups");
    setItems(d.items || []);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const t = setInterval(() => load().catch(() => {}), 7000);
    return () => clearInterval(t);
  }, []);
  async function create() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const d = await api("/admin/backups", { method: "POST", body: {} });
      setSuccess(d.message || "Backup queued.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(id) {
    try {
      await api(`/admin/backups/${id}/verify`, { method: "POST", body: {} });
      setSuccess("Backup checksum verified.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="DISASTER RECOVERY"
        title="Backup & restore"
        description="Create encrypted backups of MongoDB and private files, verify checksums, and follow a controlled restoration procedure."
        action={
          <Button onClick={create} loading={busy}>
            <RefreshCw size={16} /> Create backup
          </Button>
        }
      />
      <Alert
        error={error}
        success={success}
        onClose={() => {
          setError("");
          setSuccess("");
        }}
      />
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Backup history</h2>
            <p className="muted">
              Encrypted backup files expire after 35 days by default.
            </p>
          </div>
          <button className="icon-button" onClick={load}>
            <RefreshCw size={16} />
          </button>
        </div>
        {items.length === 0 ? (
          <Empty
            title="No backups recorded"
            text="Create a backup after configuring the encryption passphrase and MongoDB database tools."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Created</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b._id}>
                    <td>
                      <strong>{b.reference}</strong>
                      <small>{b.provider}</small>
                    </td>
                    <td>{formatDate(b.createdAt)}</td>
                    <td>
                      {b.sizeBytes
                        ? `${(b.sizeBytes / 1024 / 1024).toFixed(1)} MB`
                        : "—"}
                    </td>
                    <td>
                      <Status value={b.status} />
                      {b.error && (
                        <small className="error-small">{b.error}</small>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        {["completed", "verified"].includes(b.status) && (
                          <>
                            <Button
                              variant="secondary"
                              className="button-small"
                              onClick={() => verify(b._id)}
                            >
                              Verify
                            </Button>
                            <Button
                              variant="secondary"
                              className="button-small"
                              onClick={() =>
                                download(`/admin/backups/${b._id}/download`)
                              }
                            >
                              <ArrowDownToLine size={14} /> Download encrypted
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Safe restoration procedure</h2>
            <p className="muted">
              Live database restoration is intentionally not a one-click action.
            </p>
          </div>
          <ShieldCheck size={20} className="muted-icon" />
        </div>
        <Steps
          title="Restore in maintenance mode"
          steps={[
            {
              title: "Announce maintenance",
              description:
                "Stop user traffic and disable campaign dispatch before restoring.",
            },
            {
              title: "Select a verified backup",
              description:
                "Download the encrypted archive and verify its checksum.",
            },
            {
              title: "Stop the application",
              description:
                "Stop the API and worker containers so they cannot write during restoration.",
            },
            {
              title: "Run the restore script",
              description:
                "On the server, set BACKUP_FILE and BACKUP_ENCRYPTION_PASSPHRASE, then run scripts/restore.sh with CONFIRM_RESTORE=YES.",
            },
            {
              title: "Verify integrity",
              description:
                "Check database records, private files, employee matching, audit logs and queue state.",
            },
            {
              title: "Resume service carefully",
              description:
                "Reconcile in-flight campaigns and confirm no duplicate notifications will be sent before reopening traffic.",
            },
          ]}
        />
        <p className="helper-text">
          The restore script uses mongorestore --drop and overwrites matching
          collections in the target database. Test it in staging first. Never
          restore a production backup into an unapproved environment.
        </p>
      </section>
    </>
  );
}

function AuditPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  async function load() {
    const d = await api("/admin/audit-logs?limit=100");
    setItems(d.items || []);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <PageHeading
        title="Audit logs"
        description="Restricted administrative history of security and system actions."
      />
      <Alert error={error} />
      <section className="panel">
        <div className="panel-title">
          <h2>Recent events</h2>
          <Button variant="secondary" onClick={load}>
            <RefreshCw size={15} /> Refresh
          </Button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i._id}>
                  <td>{formatDate(i.createdAt)}</td>
                  <td>{i.actorEmail || i.actorRole}</td>
                  <td>{i.action}</td>
                  <td>
                    {i.targetType} {i.targetId}
                  </td>
                  <td>
                    <Status value={i.result} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function RouteContent({ user }) {
  const path = useLocation().pathname;
  if (path === "/admin" || path === "/admin/") return <AdminOverview />;
  if (path === "/admin/campaigns") return <CampaignsPage admin />;
  if (path === "/admin/uploads") return <UploadsPage admin />;
  if (path.startsWith("/admin/campaigns/"))
    return <CampaignDetails user={user} />;
  if (path === "/admin/miscellaneous") return <MiscellaneousPage />;
  if (path === "/admin/templates") return <TemplatesPage />;
  if (path === "/admin/content") return <ContentPage />;
  if (path === "/admin/reports") return <ReportsPage admin />;
  if (path === "/admin/settings") return <SettingsPage />;
  if (path === "/admin/audit") return <AuditPage />;
  if (path === "/admin/usage") return <UsagePage />;
  if (path === "/admin/backups") return <BackupPage />;
  return <Navigate to="/admin" replace />;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    let alive = true;
    api("/auth/me")
      .then((d) => {
        if (alive && d.authenticated) {
          setUser(d.user);
        }
      })
      .catch(() => {})
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (user && !location.pathname.startsWith("/admin")) {
      navigate("/admin", { replace: true });
    }
  }, [user, location.pathname, navigate]);
  async function logout() {
    try {
      await api("/admin/logout", {
        method: "POST",
        body: {},
      });
    } catch {}
    setUser(null);
    navigate("/login");
  }
  if (checking)
    return (
      <div className="loading-screen">
        <div className="brand-mark">S</div>
        <span>Loading secure workspace…</span>
      </div>
    );
  if (!user)
    return (
      <Routes>
        <Route
          path="*"
          element={
            <Login
              onLogin={(u) => {
                setUser(u.user);
                navigate("/admin");
              }}
            />
          }
        />
      </Routes>
    );
  return (
    <Shell user={user} onLogout={logout}>
      <Routes>
        <Route path="*" element={<RouteContent user={user} />} />
      </Routes>
    </Shell>
  );
}
