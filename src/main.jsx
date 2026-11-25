import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, CalendarDays, ChevronRight, ClipboardList, CreditCard, HeartPulse, LogOut, Menu, Plus, Search, ShieldCheck, Stethoscope, Users, X } from 'lucide-react';
import './style.css';

const API = '/api';
let refreshInFlight = null;
const empty = { email: '', password: '' };
const sections = ['Overview', 'Patients', 'Doctors', 'Appointments', 'Records', 'Billing'];
const icons = { Overview: Activity, Patients: Users, Doctors: Stethoscope, Appointments: CalendarDays, Records: ClipboardList, Billing: CreditCard };
const fields = {
  Patients: [['userId','User ID','number'],['name','Full name'],['dob','Date of birth','date'],['gender','Gender'],['phone','Phone'],['address','Address'],['bloodGroup','Blood group']],
  Doctors: [['userId','User ID','number'],['name','Full name'],['specialization','Specialization'],['phone','Phone'],['consultationFee','Consultation fee','number'],['availableDays','Available days (MON,WED,FRI)']],
  Appointments: [['patientId','Patient ID','number'],['doctorId','Doctor ID','number'],['date','Date','date'],['startTime','Start time','time'],['endTime','End time','time'],['reason','Reason']],
  Records: [['patientId','Patient ID','number'],['doctorId','Doctor ID','number'],['appointmentId','Appointment ID','number'],['diagnosis','Diagnosis'],['prescription','Prescription'],['notes','Notes']],
  Billing: [['appointmentId','Completed appointment ID','number']]
};

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('medix_token') || '');
  const [user, setUser] = useState(null);
  const [section, setSection] = useState('Overview');
  const [items, setItems] = useState({ Patients: [], Doctors: [], Appointments: [], Records: [], Billing: [] });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [auth, setAuth] = useState(empty);
  const [register, setRegister] = useState(false);
  const [lookup, setLookup] = useState('');
  const [menu, setMenu] = useState(false);

  async function request(path, options = {}, bearer = token) {
    const send = accessToken => fetch(API + path, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers } });
    let response = await send(bearer);
    if (response.status === 401 && bearer) {
      const refreshToken = sessionStorage.getItem('medix_refresh_token');
      if (!refreshToken) { signOut(); throw new Error('Session expired. Please sign in again.'); }
      try {
        if (!refreshInFlight) {
          refreshInFlight = fetch(API + '/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) })
            .then(async result => { if (!result.ok) throw new Error('Session expired. Please sign in again.'); return result.json(); })
            .finally(() => { refreshInFlight = null; });
        }
        const renewed = await refreshInFlight;
        sessionStorage.setItem('medix_token', renewed.accessToken);
        sessionStorage.setItem('medix_refresh_token', renewed.refreshToken);
        setToken(renewed.accessToken);
        response = await send(renewed.accessToken);
      } catch (error) { signOut(); throw error; }
    }
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.detail || `${response.status} ${response.statusText}`);
    return data;
  }
  function signOut() { sessionStorage.removeItem('medix_token'); sessionStorage.removeItem('medix_refresh_token'); setToken(''); setUser(null); setItems({ Patients: [], Doctors: [], Appointments: [], Records: [], Billing: [] }); }
  useEffect(() => { if (!token) return; request('/auth/me').then(setUser).catch(() => { signOut(); setNotice('Session expired. Please sign in again.'); }); }, [token]);
  useEffect(() => { if (user) load(section); }, [section, user]);
  async function load(name) {
    if (name === 'Overview') { await Promise.all(['Patients','Doctors'].filter(s => s !== 'Patients' || user?.role !== 'DOCTOR').map(load)); return; }
    if (['Patients','Doctors'].includes(name)) {
      setLoading(true);
      try { const data = await request('/' + name.toLowerCase()); setItems(v => ({ ...v, [name]: data })); }
      catch (e) { setNotice(e.message); } finally { setLoading(false); }
    }
  }
  async function authenticate(event) {
    event.preventDefault(); setLoading(true); setNotice('');
    try {
      if (register) { await request('/auth/register', { method: 'POST', body: JSON.stringify(auth) }, ''); setRegister(false); setNotice('Account created. Sign in to continue.'); }
      else { const data = await request('/auth/login', { method: 'POST', body: JSON.stringify(auth) }, ''); sessionStorage.setItem('medix_token', data.accessToken); sessionStorage.setItem('medix_refresh_token', data.refreshToken); setToken(data.accessToken); setAuth(empty); }
    } catch (e) { setNotice(e.message); } finally { setLoading(false); }
  }
  async function submit(event) {
    event.preventDefault(); setLoading(true); setNotice('');
    try {
      const path = section === 'Billing' ? '/invoices' : '/' + section.toLowerCase();
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '').map(([k,v]) => [k, /^(userId|patientId|doctorId|appointmentId)$/.test(k) ? Number(v) : v]));
      const result = await request(path, { method: 'POST', body: JSON.stringify(body) });
      setModal(false); setForm({}); setNotice(`${section.slice(0,-1)} #${result.id} created successfully.`);
      if (['Patients','Doctors'].includes(section)) load(section);
      else setItems(v => ({ ...v, [section]: [result, ...v[section]] }));
    } catch (e) { setNotice(e.message); } finally { setLoading(false); }
  }
  async function find(event) {
    event.preventDefault(); if (!lookup.trim()) return;
    setLoading(true); setNotice('');
    try {
      const path = section === 'Appointments' || section === 'Records' ? `/${section.toLowerCase()}/patient/${lookup}` : section === 'Billing' ? `/invoices/${lookup}` : `/${section.toLowerCase()}/${lookup}`;
      const data = await request(path);
      setItems(v => ({ ...v, [section]: Array.isArray(data) ? data : [data] }));
    } catch (e) { setNotice(e.message); } finally { setLoading(false); }
  }
  async function action(path, method, message) {
    setLoading(true); setNotice('');
    try { const result = await request(path, { method }); setNotice(message); if (result) { const key = path.startsWith('/appointments') ? 'Appointments' : 'Billing'; setItems(v => ({ ...v, [key]: v[key].map(item => item.id === result.id ? result : item) })); } }
    catch (e) { setNotice(e.message); } finally { setLoading(false); }
  }
  const role = user?.role;
  const canCreate = { Patients: ['ADMIN','STAFF','PATIENT'], Doctors: ['ADMIN'], Appointments: ['PATIENT','STAFF'], Records: ['DOCTOR'], Billing: ['ADMIN','STAFF'] }[section]?.includes(role);
  const welcome = user?.email?.split('@')[0] || 'there';

  if (!token || !user) return <div className="auth-layout"><aside className="auth-brand"><div className="brand"><span className="brand-mark"><HeartPulse size={25}/></span><span>MediX</span></div><div className="auth-pitch"><span className="eyebrow light">A BETTER WAY TO CARE</span><h1>Every patient.<br/>Every moment.<br/><em>In good hands.</em></h1><p>One calm workspace for your care team, from first appointment to final invoice.</p></div><div className="auth-bottom"><span className="pulse-dot"/> Connected care, made simple</div></aside><main className="auth-main"><div className="auth-card"><div className="mobile-brand brand"><span className="brand-mark"><HeartPulse size={23}/></span><span>MediX</span></div><div className="icon-tile"><ShieldCheck size={24}/></div><span className="eyebrow">WELCOME TO MEDIX</span><h2>{register ? 'Create your account' : 'Sign in to your workspace'}</h2><p className="muted">{register ? 'Register as a patient to get started.' : 'Manage care with clarity and confidence.'}</p><form onSubmit={authenticate} className="stack"><label>Email address<input type="email" value={auth.email} onChange={e => setAuth({...auth,email:e.target.value})} placeholder="you@example.com" required/></label><label>Password<input type="password" value={auth.password} onChange={e => setAuth({...auth,password:e.target.value})} placeholder="At least 8 characters" minLength={register ? 8 : undefined} required/></label><button className="primary wide" disabled={loading}>{loading ? 'Please wait…' : register ? 'Create account' : 'Sign in'} <ChevronRight size={17}/></button></form>{notice && <div className="notice">{notice}</div>}<p className="auth-switch">{register ? 'Already have an account?' : 'New to MediX?'} <button onClick={() => { setRegister(!register); setNotice(''); }}>{register ? 'Sign in' : 'Create an account'}</button></p></div></main></div>;

  return <div className="app-shell"><aside className={`sidebar ${menu ? 'open' : ''}`}><div className="brand side-brand"><span className="brand-mark"><HeartPulse size={23}/></span><span>MediX</span><button className="mobile-close" onClick={() => setMenu(false)}><X size={20}/></button></div><div className="nav-caption">WORKSPACE</div><nav>{sections.map(name => { const Icon = icons[name]; return <button key={name} className={section === name ? 'nav-item active' : 'nav-item'} onClick={() => { setSection(name); setLookup(''); setNotice(''); setMenu(false); }}><Icon size={19}/><span>{name}</span>{section === name && <ChevronRight size={15} className="nav-chevron"/>}</button>; })}</nav><div className="side-footer"><div className="avatar">{welcome.slice(0,1).toUpperCase()}</div><div className="user-meta"><strong>{welcome}</strong><small>{role?.toLowerCase()}</small></div><button title="Sign out" className="icon-button" onClick={signOut}><LogOut size={18}/></button></div></aside><main className="main"><header className="topbar"><button className="menu-button" onClick={() => setMenu(true)}><Menu size={22}/></button><div className="crumb">Workspace <ChevronRight size={15}/> <strong>{section}</strong></div><div className="top-right"><span className="status"><span className="pulse-dot"/> System online</span><div className="avatar small">{welcome.slice(0,1).toUpperCase()}</div></div></header><div className="content"><div className="heading"><div><span className="eyebrow">MEDIX WORKSPACE</span><h1>{section === 'Overview' ? `Good to see you, ${welcome}.` : section}</h1><p className="muted">{section === 'Overview' ? 'Here is your care workspace at a glance.' : subtitles[section]}</p></div>{canCreate && <button className="primary" onClick={() => { setForm(section === 'Patients' && role === 'PATIENT' ? {userId: user.id} : {}); setModal(true); }}><Plus size={18}/> Add {section === 'Billing' ? 'invoice' : section.slice(0,-1).toLowerCase()}</button>}</div>{notice && <div className="notice dismiss"><span>{notice}</span><button onClick={() => setNotice('')}><X size={16}/></button></div>}{section === 'Overview' ? <><div className="hero"><div><span className="eyebrow light">YOUR CARE COMMAND CENTER</span><h2>Care moves better<br/>when everything connects.</h2><p>Find patients, coordinate appointments, and keep the details in one place.</p><button onClick={() => setSection('Appointments')}>Explore appointments <ChevronRight size={17}/></button></div><div className="hero-visual"><div className="hero-ring ring-a"/><div className="hero-ring ring-b"/><HeartPulse size={96} strokeWidth={1.2}/></div></div><div className="metrics"><Metric label="Patients" value={items.Patients.length} icon={Users} color="blue"/><Metric label="Doctors" value={items.Doctors.length} icon={Stethoscope} color="green"/><Metric label="Your role" value={role} icon={ShieldCheck} color="purple"/></div><div className="section-title"><h2>Quick access</h2><span>What would you like to manage?</span></div><div className="quick-grid">{sections.slice(1).map(name => { const Icon=icons[name]; return <button className="quick-card" key={name} onClick={() => setSection(name)}><span className="quick-icon"><Icon size={22}/></span><strong>{name}</strong><small>{subtitles[name]}</small><ChevronRight size={17} className="quick-arrow"/></button>; })}</div></> : <><div className="panel"><div className="panel-top"><div><h2>{section} directory</h2><p>{['Patients','Doctors'].includes(section) ? `Browse and manage ${section.toLowerCase()} in your workspace.` : `Look up ${section === 'Billing' ? 'an invoice ID' : section === 'Appointments' || section === 'Records' ? 'a patient ID' : 'an ID'} to view details.`}</p></div>{['Patients','Doctors'].includes(section) && <button className="secondary" onClick={() => load(section)}>Refresh</button>}</div>{!['Patients','Doctors'].includes(section) && <form className="search-row" onSubmit={find}><Search size={18}/><input type="number" min="1" placeholder={section === 'Billing' ? 'Enter invoice ID' : 'Enter patient ID'} value={lookup} onChange={e => setLookup(e.target.value)}/><button className="primary" disabled={loading}>Search</button></form>}{loading && <div className="loading">Loading…</div>}<div className="table-wrap"><table><thead><tr>{columns[section].map(c => <th key={c[0]}>{c[1]}</th>)}{['Appointments','Billing'].includes(section) && <th>Actions</th>}</tr></thead><tbody>{items[section].map(item => <tr key={item.id}>{columns[section].map(([key]) => <td key={key}>{key === 'status' ? <span className={`badge ${item[key]?.toLowerCase()}`}>{item[key]}</span> : String(item[key] ?? '—')}</td>)}{section === 'Appointments' && <td className="row-actions">{item.status === 'BOOKED' && role === 'DOCTOR' && <button onClick={() => action(`/appointments/${item.id}/complete`, 'PUT', 'Appointment completed.')}>Complete</button>}{item.status === 'BOOKED' && ['PATIENT','STAFF'].includes(role) && <button onClick={() => action(`/appointments/${item.id}/cancel`, 'PUT', 'Appointment cancelled.')}>Cancel</button>}</td>}{section === 'Billing' && <td className="row-actions">{item.status === 'UNPAID' && ['ADMIN','STAFF'].includes(role) && <button onClick={() => action(`/invoices/${item.id}/pay`, 'POST', 'Payment recorded.')}>Mark paid</button>}</td>}</tr>)}</tbody></table>{!items[section].length && !loading && <div className="empty"><span className="empty-icon">{React.createElement(icons[section], {size:26})}</span><h3>No {section.toLowerCase()} to show yet</h3><p>{['Patients','Doctors'].includes(section) ? 'New entries will appear here.' : 'Search by ID or create a new entry to get started.'}</p></div>}</div></div></>}</div></main>{modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false); }}><div className="modal"><div className="modal-head"><div><span className="eyebrow">NEW ENTRY</span><h2>Add {section === 'Billing' ? 'invoice' : section.slice(0,-1).toLowerCase()}</h2></div><button className="icon-button" onClick={() => setModal(false)}><X size={20}/></button></div><form onSubmit={submit}><div className="form-grid">{fields[section]?.map(([key,label,type]) => <label key={key}>{label}<input type={type || 'text'} step={key === 'consultationFee' ? '0.01' : undefined} min={type === 'number' ? '0' : undefined} value={form[key] ?? ''} onChange={e => setForm({...form,[key]:e.target.value})} required={['userId','name','specialization','consultationFee','availableDays','patientId','doctorId','date','startTime','endTime','appointmentId','diagnosis'].includes(key)} disabled={key === 'userId' && role === 'PATIENT'}/></label>)}</div><div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(false)}>Cancel</button><button className="primary" disabled={loading}>{loading ? 'Saving…' : 'Create entry'}</button></div></form></div></div>}</div>;
}
const subtitles = { Patients: 'Patient profiles and details', Doctors: 'Care providers and availability', Appointments: 'Bookings and care visits', Records: 'Clinical history and notes', Billing: 'Invoices and payments' };
const columns = { Patients: [['id','ID'],['name','Name'],['userId','User ID'],['dob','Date of birth'],['bloodGroup','Blood group'],['phone','Phone']], Doctors: [['id','ID'],['name','Name'],['specialization','Specialization'],['availableDays','Available days'],['consultationFee','Fee']], Appointments: [['id','ID'],['patientId','Patient'],['doctorId','Doctor'],['date','Date'],['startTime','Time'],['status','Status']], Records: [['id','ID'],['appointmentId','Appointment'],['doctorId','Doctor'],['diagnosis','Diagnosis'],['createdAt','Created']], Billing: [['id','ID'],['appointmentId','Appointment'],['amount','Amount'],['status','Status'],['createdAt','Created']] };
function Metric({label,value,icon:Icon,color}) { return <div className="metric"><span className={`metric-icon ${color}`}><Icon size={22}/></span><div><small>{label}</small><strong>{value}</strong></div></div>; }
createRoot(document.getElementById('root')).render(<App/>);
