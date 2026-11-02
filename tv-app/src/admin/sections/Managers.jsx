import React, { useEffect, useState } from "react";
import { UserPlus, Trash2 } from "lucide-react";
import { Card, Button, Field, Segmented } from "../ui.jsx";
import { listManagers, addManager, removeManager, setManagerRole, setManagerAccess, resetPassword } from "../services.js";
import { AREAS, PRESETS, FULL_ACCESS, accessOf, accessSummary } from "../access.js";
import { isDemo } from "../../shared/store.js";

// Tap an area to turn it on or off, or pick a preset.
function AccessPicker({ value, onChange }) {
  const same = (a) => AREAS.every((x) => !!a[x.id] === !!value[x.id]);
  return (
    <div className="access-pick">
      <div className="chip-pick chip-pick-solid">
        {AREAS.map((a) => (
          <button type="button" key={a.id} title={a.hint} className={value[a.id] ? "on" : ""} aria-pressed={!!value[a.id]}
            onClick={() => onChange({ ...value, [a.id]: !value[a.id] })}>{a.label}</button>
        ))}
      </div>
      <div className="access-presets">
        {PRESETS.map((p) => (
          <button type="button" key={p.label} className={same(p.access) ? "on" : ""} onClick={() => onChange(p.access)}>{p.label}</button>
        ))}
      </div>
    </div>
  );
}

export default function Managers({ user }) {
  const [list, setList] = useState({});
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "manager", access: FULL_ACCESS });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => (isDemo() ? undefined : listManagers(setList)), []);

  if (isDemo()) {
    return <Card title="Managers"><p className="hint">Managers can't be changed in preview mode.</p></Card>;
  }

  async function add(e) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      await addManager(form.email, form.password, form.name, form.role, form.access);
      setMsg(`Added ${form.email}. Send them the dashboard link and their password.`);
      setForm({ name: "", email: "", password: "", role: "manager", access: FULL_ACCESS });
    } catch (err) {
      setMsg(err.code === "auth/email-already-in-use" ? "That email already has an account." : err.code === "auth/weak-password" ? "Password needs at least 6 characters." : err.message);
    }
    setBusy(false);
  }

  return (
    <div className="stack">
      <Card title="People who can edit the TV" subtitle="Owners can change everything and choose what each manager is in charge of. Managers only see the pages they're given.">
        <ul className="people">
          {Object.entries(list).map(([uid, p]) => (
            <li key={uid}>
              <div className="avatar">{(p.name || p.email || "?")[0].toUpperCase()}</div>
              <div className="person">
                <b>{p.name || p.email}</b>
                <span>{p.email}{uid === user.uid ? " · you" : ""}</span>
                <small className="person-access">{accessSummary(p)}</small>
              </div>
              {uid !== user.uid ? (
                <>
                  <Segmented small value={p.role} onChange={(r) => setManagerRole(uid, r)} options={[{ value: "manager", label: "Manager" }, { value: "owner", label: "Owner" }]} />
                  <button className="icon-btn danger" aria-label="Remove" onClick={() => confirm(`Remove ${p.email}? They won't be able to edit anymore.`) && removeManager(uid)}><Trash2 size={18} /></button>
                  {p.role !== "owner" && <AccessPicker value={accessOf(p)} onChange={(a) => setManagerAccess(uid, a)} />}
                </>
              ) : <span className="badge">{p.role}</span>}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Add a person">
        <form onSubmit={add} className="stack-sm">
          <div className="grid-2">
            <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email"><input type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Starting password" hint="They can change it with 'Forgot password' on the sign-in page."><input required minLength={6} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <Field label="Role"><Segmented value={form.role} onChange={(role) => setForm({ ...form, role })} options={[{ value: "manager", label: "Manager" }, { value: "owner", label: "Owner" }]} /></Field>
          </div>
          {form.role === "manager"
            ? <Field label="In charge of" hint="They'll only see these pages. You can change this any time."><AccessPicker value={form.access} onChange={(access) => setForm({ ...form, access })} /></Field>
            : <p className="hint">Owners can change everything, including this list.</p>}
          <Button variant="primary" icon={UserPlus} disabled={busy}>{busy ? "Adding…" : "Add person"}</Button>
          {msg && <p className="hint">{msg}</p>}
        </form>
      </Card>

      <Card title="Your account">
        <p className="hint">Signed in as <b>{user.email}</b>.</p>
        <Button onClick={() => resetPassword(user.email).then(() => alert("Check your email for a link to set a new password."))}>Email me a password reset link</Button>
      </Card>
    </div>
  );
}
