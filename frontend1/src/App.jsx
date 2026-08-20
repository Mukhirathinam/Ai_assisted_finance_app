import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  LayoutDashboard, FileText, ListTree, TrendingUp, PieChart,
  Plus, Upload, Trash2, Download, ShieldCheck, ChevronRight,
  Bot, Send, Sparkles, Loader2, Eye, X
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RPie, Pie, Cell
} from 'recharts';

const API = 'https://ai-finance-backend-6xh6.onrender.com';

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [parsed, setParsed] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
    const saved = localStorage.getItem('finance_user');
    return saved ? JSON.parse(saved).company_id : 1;
  });
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('finance_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [importFile, setImportFile] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [aiMessages, setAiMessages] = useState([{ role: 'ai', text: "Hello! Ask me anything about your finances." }]);
  const [aiInput, setAiInput] = useState('');

  const loadCompanies = async () => {
    try {
      const res = await axios.get(`${API}/companies/`);
      setCompanies(res.data);
      if (res.data.length > 0 && !selectedCompanyId) setSelectedCompanyId(res.data[0].id);
    } catch (e) { console.error(e); }
  };

  const load = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const [s, a, v] = await Promise.all([
        axios.get(`${API}/companies/${selectedCompanyId}/summary`),
        axios.get(`${API}/accounts/?company_id=${selectedCompanyId}`),
        axios.get(`${API}/jv/?company_id=${selectedCompanyId}`)
      ]);
      setSummary(s.data); setAccounts(a.data); setVouchers(v.data);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadCompanies(); }, []);
  useEffect(() => { if (selectedCompanyId) load(); }, [selectedCompanyId]);

  const handleFileSelect = (e) => {
    const f = e.target.files[0]; if (!f) return;
    setImportFile(f);
    setShowImportModal(true);
    e.target.value = '';
  };

  const executeUpload = async (useAi) => {
    if (!importFile) return;
    setShowImportModal(false);
    const fd = new FormData(); fd.append('file', importFile);
    try {
      const r = await axios.post(`${API}/ai/upload-jv/?company_id=${selectedCompanyId}&use_ai=${useAi}`, fd);
      const data = r.data?.results || r.data;
      if (Array.isArray(data) && data.length) { setParsed(data); setTab('journal'); }
      else alert('No vouchers found in file.');
    } catch(err) { alert('Upload failed: ' + (err.response?.data?.detail || err.message)); }
    setImportFile(null);
  };

  if (loading) return <div style={{display:'grid',placeItems:'center',height:'100vh',background:'#09090b'}}><p style={{color:'#71717a',fontSize:13}}>Loading...</p></div>;

  const navItems = [
    { id:'dashboard', icon: LayoutDashboard, label:'Overview' },
    { id:'journal', icon: FileText, label:'Journal Vouchers' },
    { id:'accounts', icon: ListTree, label:'Chart of Accounts' },
    { id:'ai', icon: Bot, label:'AI Copilot' },
  ];
  const reportItems = [
    { id:'tb', icon: ListTree, label:'Trial Balance' },
    { id:'pl', icon: TrendingUp, label:'Profit & Loss' },
    { id:'bs', icon: PieChart, label:'Balance Sheet' },
  ];

  if (!user) {
    return <LoginView onLogin={(userData) => { 
      localStorage.setItem('finance_user', JSON.stringify(userData));
      setUser(userData); 
      setSelectedCompanyId(userData.company_id); 
    }} />;
  }

  return (
    <div className="shell">
      <nav className="rail">
        <div className="rail-brand">
          <div className="logo">{user.username.charAt(0).toUpperCase()}</div>
          <div>
            <h1 style={{textTransform:'capitalize'}}>{user.username}</h1>
            <small style={{color:'var(--text-2)'}}>{companies.find(c => c.id === user.company_id)?.name}</small>
          </div>
        </div>
        <div className="rail-group-label">Workspace</div>
        {navItems.map(n => <button key={n.id} className={`rail-btn ${tab===n.id?'on':''}`} onClick={()=>setTab(n.id)}><n.icon size={16}/>{n.label}</button>)}
        <div className="rail-group-label">Reports</div>
        {reportItems.map(n => <button key={n.id} className={`rail-btn ${tab===n.id?'on':''}`} onClick={()=>setTab(n.id)}><n.icon size={16}/>{n.label}</button>)}
        <div className="rail-footer">
          <button className="btn btn-ghost" onClick={() => {
            localStorage.removeItem('finance_user');
            setUser(null); 
            setSelectedCompanyId(1); 
            setAiMessages([{ role: 'ai', text: "Hello! Ask me anything about your finances." }]); 
            setAiInput('');
          }} style={{width:'100%',justifyContent:'flex-start',padding:'8px 12px',color:'var(--text-2)'}}>Logout</button>
        </div>
      </nav>

      <main className="workspace">
        {tab === 'dashboard' && <DashboardView s={summary} vouchers={vouchers} companyName={companies.find(c => c.id === user.company_id)?.name || 'Loading...'} />}
        {tab === 'journal' && <JournalView accounts={accounts} vouchers={vouchers} parsed={parsed} setParsed={setParsed} showForm={showForm} setShowForm={setShowForm} onUpload={handleFileSelect} reload={load} selectedCompanyId={selectedCompanyId}/>}
        {tab === 'accounts' && <AccountsView accounts={accounts} reload={load} selectedCompanyId={selectedCompanyId}/>}
        {tab === 'ai' && <AICopilotView selectedCompanyId={selectedCompanyId} messages={aiMessages} setMessages={setAiMessages} input={aiInput} setInput={setAiInput}/>}
        {tab === 'tb' && <TrialBalanceView data={summary?.trial_balance || []}/>}
        {tab === 'pl' && <PLView data={summary.profit_loss}/>}
        {tab === 'bs' && <BSView data={summary}/>}
      </main>

      {showImportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(9, 9, 11, 0.85)', backdropFilter: 'blur(8px)',
          display: 'grid', placeItems: 'center', zIndex: 9999
        }}>
          <div style={{
            background: '#121214', border: '1px solid var(--brand)',
            borderRadius: 12, padding: 32, width: 440, maxWidth: '90%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: '#fafafa', fontWeight: 700 }}>Ingest Transaction Statement</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: 13, color: '#a1a1aa', lineHeight: 1.5 }}>
              Choose how you want to parse and map the transactions from <strong>{importFile?.name}</strong>.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <button 
                onClick={() => executeUpload(false)}
                style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px solid #27272a',
                  borderRadius: 8, padding: '16px 20px', textAlign: 'left', cursor: 'pointer',
                  transition: 'border-color 0.2s', display: 'flex', flexDirection: 'column', gap: 4
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--brand)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#27272a'}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fafafa' }}>Direct Rules-Based Parsing</span>
                <span style={{ fontSize: 11, color: '#71717a' }}>Fast, deterministic match by account name or code.</span>
              </button>

              <button 
                onClick={() => executeUpload(true)}
                style={{
                  background: 'rgba(124, 58, 237, 0.05)', border: '1px solid rgba(124, 58, 237, 0.3)',
                  borderRadius: 8, padding: '16px 20px', textAlign: 'left', cursor: 'pointer',
                  transition: 'border-color 0.2s', display: 'flex', flexDirection: 'column', gap: 4
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--brand)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.3)'}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  AI Semantic Mapping <Sparkles size={12}/>
                </span>
                <span style={{ fontSize: 11, color: '#a1a1aa' }}>Uses Gemini to match raw transaction details to the closest Chart of Accounts categories.</span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-ghost" 
                onClick={() => { setShowImportModal(false); setImportFile(null); }}
                style={{ fontSize: 13 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardView({ s, vouchers, companyName }) {
  const stats = [
    { label:'Total Assets', value: s.total_assets, color:'var(--brand)' },
    { label:'Net Profit', value: s.net_profit, color: s.net_profit >= 0 ? 'var(--green)' : 'var(--red)' },
    { label:'Revenue', value: s.total_revenue, color:'var(--blue)' },
    { label:'Expenses', value: s.total_expenses, color:'var(--red)' },
  ];
  const chartData = [
    { name:'Revenue', v: s.total_revenue },
    { name:'Expenses', v: s.total_expenses },
    { name:'Net', v: s.net_profit },
  ];
  const colors = ['#3b82f6','#ef4444', s.net_profit >= 0 ? '#22c55e' : '#ef4444'];

  return (
    <div>
      <div className="ws-header">
        <div><h2>Executive Overview</h2><p>Real-time financial position for {companyName}</p></div>
      </div>
      <div className="stat-grid">
        {stats.map((st,i) => (
          <div className="stat" key={i}>
            <div className="label">{st.label}</div>
            <div className="value" style={{color:st.color}}>
              {st.value < 0 ? '−' : ''}₹{Math.abs(st.value).toLocaleString('en-IN')}
            </div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>
        <div className="card">
          <div className="section-title">Performance</div>
          <div style={{height:280}}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false}/>
                <XAxis dataKey="name" tick={{fill:'#71717a',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'#71717a',fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip 
                  contentStyle={{background:'#18181b', border:'1px solid #27272a', borderRadius:8, fontSize:12}}
                  itemStyle={{color: '#fafafa', fontSize: 12}}
                  labelStyle={{color: '#fafafa', fontWeight: 600, marginBottom: 4}}
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                />
                <Bar dataKey="v" radius={[4,4,0,0]} barSize={40}>
                  {chartData.map((_,i)=><Cell key={i} fill={colors[i]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="section-title">Recent Vouchers</div>
          {vouchers.slice(0,5).map((v,i) => (
            <div key={i} style={{padding:'10px 0',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:13,fontWeight:600}}>{v.description}</div>
                <div style={{fontSize:11,color:'var(--text-2)'}}>{v.voucher_no} · {v.date?.split('T')[0]}</div>
              </div>
              <span className="badge badge-green">{v.status||'Approved'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function JournalView({ accounts, vouchers, parsed, setParsed, showForm, setShowForm, onUpload, reload, selectedCompanyId }) {
  const [posting, setPosting] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === vouchers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(vouchers.map(v => v.id));
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Are you sure you want to permanently delete all ${selectedIds.length} selected vouchers?`)) return;
    setPosting(true);
    let deleted = 0;
    for (const id of selectedIds) {
      try {
        await axios.delete(`${API}/jv/${id}`);
        deleted++;
      } catch (err) {
        console.error("Failed to delete voucher ID:", id, err);
      }
    }
    setPosting(false);
    setSelectedIds([]);
    setSelectedVoucher(null);
    reload();
  };

  const downloadTemplate = () => {
    const csv = "Date,Description,Account,Amount,Type,Reference,Department,Prepared By,Approved By\n2026-05-01,Consulting Services Revenue,Bank,500000,Debit,REF-001,Sales,John Doe,Jane Smith\n2026-05-01,Consulting Services Revenue,Service Income,500000,Credit,REF-001,Sales,John Doe,Jane Smith";
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'journal_template.csv'; a.click();
  };

  const deleteJV = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete this Journal Voucher?")) return;
    try {
      await axios.delete(`${API}/jv/${id}`);
      setSelectedVoucher(null);
      reload();
    } catch (err) {
      alert(err.response?.data?.detail || "Delete failed");
    }
  };

  const postAll = async () => {
    if (!parsed.length) return;
    setPosting(true);
    let successCount = 0;
    let errors = [];
    
    // 1. Gather all unique missing account names
    const missingAccountNames = [];
    for (const v of parsed) {
      for (const e of v.entries) {
        if (e.account_name) {
          const nameLower = e.account_name.trim().toLowerCase();
          const found = accounts.find(a => a.name.toLowerCase() === nameLower);
          if (!found && !missingAccountNames.includes(e.account_name.trim())) {
            missingAccountNames.push(e.account_name.trim());
          }
        }
      }
    }

    // 2. Dynamically create missing accounts
    let activeAccounts = [...accounts];
    for (const name of missingAccountNames) {
      try {
        const lower = name.toLowerCase();
        let category = 'Expenses';
        if (lower.includes('revenue') || lower.includes('income') || lower.includes('sales')) {
          category = 'Revenue';
        } else if (lower.includes('cash') || lower.includes('bank') || lower.includes('supplies') || lower.includes('receivable') || lower.includes('asset')) {
          category = 'Assets';
        } else if (lower.includes('payable') || lower.includes('loan') || lower.includes('liability')) {
          category = 'Liabilities';
        } else if (lower.includes('equity') || lower.includes('capital')) {
          category = 'Equity';
        } else if (lower.includes('suspense')) {
          category = 'Assets';
        }
        
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const res = await axios.post(`${API}/accounts/`, {
          name,
          code,
          category,
          company_id: selectedCompanyId
        });
        activeAccounts.push(res.data);
      } catch (err) {
        console.error("Failed to dynamically auto-create account:", name, err);
      }
    }

    // 3. Post each voucher using the corrected mapped account IDs
    for (const v of parsed) {
      try {
        const entries = v.entries.map(e => {
          let accId = e.account_id;
          if (!accId && e.account_name) {
            const found = activeAccounts.find(a => a.name.toLowerCase() === e.account_name.trim().toLowerCase());
            accId = found ? found.id : activeAccounts[0]?.id || 1;
          }
          return { account_id: parseInt(accId), debit: parseFloat(e.debit || 0), credit: parseFloat(e.credit || 0) };
        });
        await axios.post(`${API}/jv/`, { ...v, company_id: selectedCompanyId, entries });
        successCount++;
      } catch (err) { 
          console.error(err);
          errors.push(err.response?.data?.detail || err.message);
      }
    }
    
    setPosting(false); 
    if (errors.length > 0) {
        alert(`Failed to post ${errors.length} vouchers.\nFirst error: ${JSON.stringify(errors[0])}`);
    } else {
        alert(`Batch posting complete. ${successCount} vouchers posted.`);
        setParsed([]); 
    }
    reload(); 
  };

  const emptyJV = {
    description:'', date: new Date().toISOString().split('T')[0], reference:'',
    department:'', prepared_by:'', approved_by:'',
    entries:[{account_id:'',debit:0,credit:0},{account_id:'',debit:0,credit:0}]
  };
  const [form, setForm] = useState(emptyJV);
  const set = (k,v) => setForm({...form,[k]:v});
  const setEntry = (i,k,v) => { const e=[...form.entries]; e[i]={...e[i],[k]:v}; setForm({...form,entries:e}); };

  const postManual = async () => {
    try {
      await axios.post(`${API}/jv/`, { ...form, company_id: selectedCompanyId, entries: form.entries.map(e=>({...e, account_id: parseInt(e.account_id)})) });
      alert('Posted.'); setShowForm(false); setForm(emptyJV); reload();
    } catch(e) { alert('Failed.'); }
  };

  return (
    <div>
      <div className="ws-header">
        <div><h2>Journal Voucher Hub</h2><p>Authorize audit-ready transactions</p></div>
        <div className="ws-actions" style={{display:'flex',alignItems:'center',gap:12}}>
          <button className="btn btn-ghost" onClick={downloadTemplate}><Download size={14}/> Template</button>
          <button className="btn btn-ghost" onClick={() => window.open(`${API}/reports/export-excel?company_id=${selectedCompanyId}`)}><Download size={14}/> Export</button>
          <label htmlFor="csvUp" className="btn btn-ghost" style={{cursor:'pointer'}}><Upload size={14}/> Import CSV</label>
          <button className="btn btn-brand" onClick={()=>{setForm(emptyJV);setShowForm(true)}}><Plus size={14}/> New Voucher</button>
          <input type="file" id="csvUp" style={{display:'none'}} onChange={onUpload}/>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{marginBottom:24,borderColor:'var(--brand)'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div className="field"><label>Description</label><input value={form.description} onChange={e=>set('description',e.target.value)}/></div>
            <div className="field"><label>Date</label><input type="date" value={form.date} onChange={e=>set('date',e.target.value)}/></div>
            <div className="field"><label>Reference</label><input value={form.reference} onChange={e=>set('reference',e.target.value)}/></div>
            <div className="field"><label>Department</label><input value={form.department} onChange={e=>set('department',e.target.value)}/></div>
            <div className="field"><label>Prepared By</label><input value={form.prepared_by} onChange={e=>set('prepared_by',e.target.value)}/></div>
            <div className="field"><label>Approved By</label><input value={form.approved_by} onChange={e=>set('approved_by',e.target.value)}/></div>
          </div>
          <div style={{marginTop:16,display:'flex',justifyContent:'flex-end',gap:8}}>
            <button className="btn btn-ghost" onClick={()=>setShowForm(false)}>Cancel</button>
            <button className="btn btn-brand" onClick={postManual}>Post Voucher</button>
          </div>
        </div>
      )}

      {parsed.length > 0 && (
        <div style={{marginBottom:32}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div>
              <h3 style={{color:'var(--text-2)',textTransform:'uppercase',letterSpacing:1,fontSize:12,fontWeight:600}}>Verification Phase before Ledger Posting</h3>
            </div>
            <button className="btn btn-brand" onClick={postAll} disabled={posting}>{posting ? 'Posting...' : `Post All (${parsed.length})`}</button>
          </div>
          
          <div style={{display:'flex',flexDirection:'column',gap:24,maxHeight:'600px',overflowY:'auto',paddingRight:8}}>
            {parsed.map((v, i) => {
              const totalDebit = v.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
              const totalCredit = v.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
              
              return (
                <div key={i} style={{background:'#121214',border:'1px solid #27272a',borderRadius:12,padding:24}}>
                  <div style={{color:'var(--green)',fontWeight:700,fontSize:16,marginBottom:16}}>Voucher Draft #{i + 1}</div>
                  
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',gap:16,marginBottom:24}}>
                    <div style={{gridColumn:'span 2'}}>
                      <div style={{color:'var(--text-2)',fontSize:12,fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Narration / Description</div>
                      <div style={{color:'var(--text-1)',fontWeight:700,fontSize:14}}>{v.description}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{color:'var(--text-2)',fontSize:12,fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Transaction Date</div>
                      <div style={{color:'var(--text-1)',fontWeight:700,fontSize:14}}>{v.date?.split('T')[0]}</div>
                    </div>
                    <div>
                      <div style={{color:'var(--text-2)',fontSize:12,fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Prepared By</div>
                      <div style={{color:'var(--text-1)',fontWeight:700,fontSize:13}}>{v.prepared_by || 'System'}</div>
                    </div>
                    <div>
                      <div style={{color:'var(--text-2)',fontSize:12,fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Approved By</div>
                      <div style={{color:'var(--text-1)',fontWeight:700,fontSize:13}}>{v.approved_by || 'Pending'}</div>
                    </div>
                    <div>
                      <div style={{color:'var(--text-2)',fontSize:12,fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Reference / Proof</div>
                      <div style={{color:'var(--green)',fontWeight:700,fontSize:13}}>{v.reference || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{color:'var(--text-2)',fontSize:12,fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Cost Center / Dept</div>
                      <div style={{color:'var(--text-1)',fontWeight:700,fontSize:13}}>{v.department || 'General'}</div>
                    </div>
                  </div>

                  <div style={{border:'1px solid #27272a',borderRadius:8,overflow:'hidden'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',fontSize:13}}>
                      <thead style={{background:'#18181b',color:'var(--text-2)',fontSize:11,textTransform:'uppercase',letterSpacing:0.5}}>
                        <tr>
                          <th style={{padding:'12px 16px',fontWeight:600}}>GL Account</th>
                          <th style={{padding:'12px 16px',fontWeight:600,textAlign:'right'}}>Debit (₹)</th>
                          <th style={{padding:'12px 16px',fontWeight:600,textAlign:'right'}}>Credit (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.entries.map((e, idx) => (
                          <tr key={idx} style={{borderBottom:'1px solid #27272a'}}>
                            <td style={{padding:'12px 16px',color:'var(--text-1)',fontWeight:500}}>{e.account_name}</td>
                            <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'monospace',color:e.debit ? 'var(--green)' : '#27272a',fontWeight:e.debit ? 600 : 400}}>
                              {e.debit ? e.debit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                            </td>
                            <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'monospace',color:e.credit ? 'var(--red)' : '#27272a',fontWeight:e.credit ? 600 : 400}}>
                              {e.credit ? e.credit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot style={{background:'#161618',borderTop:'1px solid #27272a'}}>
                        <tr>
                          <td style={{padding:'12px 16px',color:'var(--text-2)',fontWeight:700}}>Voucher Total</td>
                          <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'monospace',color:'var(--green)',fontWeight:700}}>
                            ₹ {totalDebit.toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </td>
                          <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'monospace',color:'var(--red)',fontWeight:700}}>
                            ₹ {totalCredit.toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns: selectedVoucher ? '1fr 320px' : '1fr', gap: 20}}>
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
            <div className="section-title" style={{margin:0}}>Posted Ledger</div>
            {selectedIds.length > 0 && (
              <button className="btn" onClick={deleteSelected} style={{background:'rgba(239, 68, 68, 0.1)', color:'var(--red)', border:'1px solid var(--red)', padding:'6px 12px', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:6, borderRadius:6, cursor:'pointer'}}>
                <Trash2 size={12}/> Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{width: 40, textAlign:'center'}}>
                  <input type="checkbox" checked={vouchers.length > 0 && selectedIds.length === vouchers.length} onChange={toggleSelectAll} style={{cursor:'pointer'}} />
                </th>
                <th>Voucher #</th>
                <th>Date</th>
                <th>Description</th>
                <th style={{textAlign:'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map(v=>(
                <tr key={v.id} onClick={()=>setSelectedVoucher(v)} style={{cursor:'pointer', background: selectedVoucher?.id === v.id ? 'var(--brand-bg)' : 'transparent'}}>
                  <td style={{textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(v.id)} onChange={()=>toggleSelect(v.id)} style={{cursor:'pointer'}} />
                  </td>
                  <td className="mono">{v.voucher_no}</td>
                  <td>{v.date?.split('T')[0]}</td>
                  <td style={{fontWeight:600}}>{v.description}</td>
                  <td style={{textAlign:'right'}}>
                    <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
                      <button className="btn btn-ghost" onClick={(e)=>{e.stopPropagation(); setSelectedVoucher(v)}} style={{padding:6}}><Eye size={12}/></button>
                      <button className="btn btn-ghost" onClick={(e)=>{e.stopPropagation(); deleteJV(v.id)}} style={{padding:6, color:'var(--red)'}}><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedVoucher && (
          <div style={{position:'sticky',top:20,background:'#121214',border:'1px solid var(--brand)',borderRadius:12,padding:24,boxShadow:'0 8px 32px rgba(0,0,0,0.4)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
              <div style={{color:'var(--brand)',fontWeight:700,fontSize:16}}>{selectedVoucher.voucher_no || 'Posted Voucher'}</div>
              <button className="btn btn-ghost" onClick={()=>setSelectedVoucher(null)}><X size={16}/></button>
            </div>
            
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',gap:16,marginBottom:24}}>
              <div style={{gridColumn:'span 2'}}>
                <div style={{color:'var(--text-2)',fontSize:12,fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Narration / Description</div>
                <div style={{color:'var(--text-1)',fontWeight:700,fontSize:14}}>{selectedVoucher.description}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{color:'var(--text-2)',fontSize:12,fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Transaction Date</div>
                <div style={{color:'var(--text-1)',fontWeight:700,fontSize:14}}>{selectedVoucher.date?.split('T')[0]}</div>
              </div>
              <div>
                <div style={{color:'var(--text-2)',fontSize:12,fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Prepared By</div>
                <div style={{color:'var(--text-1)',fontWeight:700,fontSize:13}}>{selectedVoucher.prepared_by || 'System'}</div>
              </div>
              <div>
                <div style={{color:'var(--text-2)',fontSize:12,fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Approved By</div>
                <div style={{color:'var(--text-1)',fontWeight:700,fontSize:13}}>{selectedVoucher.approved_by || 'Pending'}</div>
              </div>
              <div>
                <div style={{color:'var(--text-2)',fontSize:12,fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Reference / Proof</div>
                <div style={{color:'var(--green)',fontWeight:700,fontSize:13}}>{selectedVoucher.reference || 'N/A'}</div>
              </div>
              <div>
                <div style={{color:'var(--text-2)',fontSize:12,fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Cost Center / Dept</div>
                <div style={{color:'var(--text-1)',fontWeight:700,fontSize:13}}>{selectedVoucher.department || 'General'}</div>
              </div>
            </div>

            <div style={{border:'1px solid #27272a',borderRadius:8,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',fontSize:13}}>
                <thead style={{background:'#18181b',color:'var(--text-2)',fontSize:11,textTransform:'uppercase',letterSpacing:0.5}}>
                  <tr>
                    <th style={{padding:'12px 16px',fontWeight:600}}>GL Account</th>
                    <th style={{padding:'12px 16px',fontWeight:600,textAlign:'right'}}>Debit (₹)</th>
                    <th style={{padding:'12px 16px',fontWeight:600,textAlign:'right'}}>Credit (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVoucher.entries?.map((e, idx) => (
                    <tr key={idx} style={{borderBottom:'1px solid #27272a'}}>
                      <td style={{padding:'12px 16px',color:'var(--text-1)',fontWeight:500}}>
                        {(() => {
                          const acc = accounts.find(a => a.id === e.account_id);
                          return acc ? `${acc.code} - ${acc.name}` : e.account_id;
                        })()}
                      </td>
                      <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'monospace',color:e.debit ? 'var(--green)' : '#27272a',fontWeight:e.debit ? 600 : 400}}>
                        {e.debit ? e.debit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                      </td>
                      <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'monospace',color:e.credit ? 'var(--red)' : '#27272a',fontWeight:e.credit ? 600 : 400}}>
                        {e.credit ? e.credit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot style={{background:'#161618',borderTop:'1px solid #27272a'}}>
                  <tr>
                    <td style={{padding:'12px 16px',color:'var(--text-2)',fontWeight:700}}>Voucher Total</td>
                    <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'monospace',color:'var(--green)',fontWeight:700}}>
                      ₹ {(selectedVoucher.entries?.reduce((sum, e) => sum + (e.debit || 0), 0) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                    <td style={{padding:'12px 16px',textAlign:'right',fontFamily:'monospace',color:'var(--red)',fontWeight:700}}>
                      ₹ {(selectedVoucher.entries?.reduce((sum, e) => sum + (e.credit || 0), 0) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{display:'flex', gap:8, marginTop:16}}>
              <button className="btn btn-brand" onClick={() => window.print()} style={{flex:1}}><Download size={14}/> Print PDF</button>
              <button className="btn" onClick={() => deleteJV(selectedVoucher.id)} style={{background:'rgba(239, 68, 68, 0.1)', color:'var(--red)', border:'1px solid var(--red)', flex:1, cursor:'pointer', borderRadius:6, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:4}}><Trash2 size={14}/> Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AccountsView({ accounts, reload, selectedCompanyId }) {
  const [showForm, setShowForm] = useState(false);
  const [newAcc, setNewAcc] = useState({ name: '', code: '', category: 'Assets' });

  const addAccount = async () => {
    try {
      await axios.post(`${API}/accounts/`, { ...newAcc, company_id: selectedCompanyId });
      setShowForm(false);
      setNewAcc({ name: '', code: '', category: 'Assets' });
      reload();
    } catch(e) { alert('Failed to add account'); }
  };

  const deleteAccount = async (id) => {
    if (!window.confirm("Delete this account?")) return;
    try {
      await axios.delete(`${API}/accounts/${id}`);
      reload();
    } catch(e) { alert(e.response?.data?.detail || 'Failed to delete'); }
  };

  const grouped = {};
  accounts.forEach(a => { if(!grouped[a.category]) grouped[a.category]=[]; grouped[a.category].push(a); });
  
  return (
    <div>
      <div className="ws-header">
        <div><h2>Chart of Accounts</h2><p>Entity classification</p></div>
        <button className="btn btn-brand" onClick={() => setShowForm(!showForm)}><Plus size={14}/> Add Account</button>
      </div>

      {showForm && (
        <div className="card" style={{marginBottom:24,borderColor:'var(--brand)'}}>
          <div style={{display:'flex',gap:12}}>
             <div className="field"><label>Code</label><input value={newAcc.code} onChange={e=>setNewAcc({...newAcc, code:e.target.value})} style={{width:80,background:'var(--surface-1)',border:'1px solid var(--border)',padding:10,borderRadius:6,color:'white'}}/></div>
             <div className="field" style={{flex:1}}><label>Name</label><input value={newAcc.name} onChange={e=>setNewAcc({...newAcc, name:e.target.value})} style={{background:'var(--surface-1)',border:'1px solid var(--border)',padding:10,borderRadius:6,color:'white',width:'100%',boxSizing:'border-box'}}/></div>
             <div className="field"><label>Category</label>
               <select value={newAcc.category} onChange={e=>setNewAcc({...newAcc, category:e.target.value})} style={{padding:10,borderRadius:6,background:'var(--surface-1)',color:'white',border:'1px solid var(--border)'}}>
                 {['Assets','Liabilities','Equity','Revenue','Expenses'].map(c=><option key={c} value={c} style={{background: '#18181b', color: 'white'}}>{c}</option>)}
               </select>
             </div>
             <div className="field" style={{justifyContent:'flex-end'}}>
               <button className="btn btn-brand" onClick={addAccount}>Save</button>
             </div>
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([cat, accs]) => (
        <div key={cat} className="card" style={{marginBottom:24}}>
          <div className="section-title">{cat}</div>
          <table className="tbl">
            <tbody>
              {accs.map(a=>(
                <tr key={a.id}>
                  <td className="mono" style={{width:80}}>{a.code}</td>
                  <td style={{fontWeight:600}}>{a.name}</td>
                  <td style={{textAlign:'right'}}>
                    <button className="btn btn-ghost" onClick={() => deleteAccount(a.id)} style={{color:'var(--red)'}}><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function PLView({ data = {income:[], expenses:[], total_income:0, total_expense:0, net_profit:0} }) {
  return (
    <div>
      <div className="ws-header">
        <div>
          <h2>Profit & Loss</h2>
          <p>Financial performance overview</p>
        </div>
        <button className="btn btn-ghost" onClick={() => window.print()}><Download size={14}/> Print Statement</button>
      </div>

      <div className="card" style={{textAlign:'center',padding:'24px 40px',marginBottom:24,border:'1px solid',borderColor:data.net_profit >= 0 ? 'var(--green)' : 'var(--red)',background:'linear-gradient(180deg, #131415 0%, #0e0f10 100%)'}}>
        <div style={{fontSize:11,color:'var(--text-2)',textTransform:'uppercase',letterSpacing:1,fontWeight:600,marginBottom:8}}>Net Profit / Loss</div>
        <div className="mono" style={{fontSize:44,fontWeight:800,color: data.net_profit>=0?'var(--green)':'var(--red)'}}>
          {data.net_profit < 0 ? '−' : ''}₹{Math.abs(data.net_profit).toLocaleString(undefined, {minimumFractionDigits: 2})}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div className="card">
          <div className="section-title" style={{color:'var(--green)',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <span>Revenue</span>
            <span className="mono" style={{fontSize:16,fontWeight:700}}>₹{(data.total_income || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <table className="tbl" style={{fontSize:13}}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th style={{textAlign:'right'}}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {(!data.income || data.income.length === 0) ? (
                <tr><td colSpan={3} style={{textAlign:'center',color:'var(--text-2)',padding:20}}>No revenue recorded</td></tr>
              ) : (
                data.income.map((i, idx) => (
                  <tr key={idx}>
                    <td className="mono" style={{color:'var(--text-2)'}}>{i.code}</td>
                    <td style={{fontWeight:600}}>{i.account}</td>
                    <td className="mono" style={{textAlign:'right',fontWeight:600,color:'var(--green)'}}>₹{(i.credit - i.debit).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="section-title" style={{color:'var(--red)',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <span>Expenses</span>
            <span className="mono" style={{fontSize:16,fontWeight:700}}>₹{(data.total_expense || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <table className="tbl" style={{fontSize:13}}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th style={{textAlign:'right'}}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {(!data.expenses || data.expenses.length === 0) ? (
                <tr><td colSpan={3} style={{textAlign:'center',color:'var(--text-2)',padding:20}}>No expenses recorded</td></tr>
              ) : (
                data.expenses.map((e, idx) => (
                  <tr key={idx}>
                    <td className="mono" style={{color:'var(--text-2)'}}>{e.code}</td>
                    <td style={{fontWeight:600}}>{e.account}</td>
                    <td className="mono" style={{textAlign:'right',fontWeight:600,color:'var(--red)'}}>₹{(e.debit - e.credit).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BSView({ data = {total_assets:0, total_liabilities:0, total_equity:0, profit_loss:{net_profit:0}} }) {
  const bs = data.balance_sheet || {assets:[], liabilities:[], equity:[], totals:{assets:0, equity:0, liabilities:0, equity_liabilities:0}};
  const assetsTotal = bs.totals?.assets || 0;
  const equityLiabilitiesTotal = bs.totals?.equity_liabilities || 0;
  const isBalanced = Math.abs(assetsTotal - equityLiabilitiesTotal) < 0.01;

  return (
    <div>
      <div className="ws-header">
        <div>
          <h2>Balance Sheet</h2>
          <p>Statement of financial position</p>
        </div>
        <button className="btn btn-ghost" onClick={() => window.print()}><Download size={14}/> Print Statement</button>
      </div>

      <div style={{
        background: isBalanced ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
        border: `1px solid ${isBalanced ? 'var(--green)' : 'var(--red)'}`,
        borderRadius: 8,
        padding: '12px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: isBalanced ? 'var(--green)' : 'var(--red)',
        fontWeight: 600,
        fontSize: 13
      }}>
        {isBalanced ? (
          <span>✓ Accounting Equation Verified: Total Assets (₹{assetsTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}) = Total Liabilities & Equity (₹{equityLiabilitiesTotal.toLocaleString(undefined, {minimumFractionDigits: 2})})</span>
        ) : (
          <span>⚠️ Unbalanced Ledger Detected: Total Assets (₹{assetsTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}) ≠ Total Liabilities & Equity (₹{equityLiabilitiesTotal.toLocaleString(undefined, {minimumFractionDigits: 2})})</span>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div className="card" style={{display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
          <div>
            <div className="section-title">Assets</div>
            <table className="tbl" style={{fontSize:13}}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account</th>
                  <th style={{textAlign:'right'}}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(bs.assets || []).length === 0 ? (
                  <tr><td colSpan={3} style={{textAlign:'center',color:'var(--text-2)',padding:20}}>No asset accounts recorded</td></tr>
                ) : (
                  (bs.assets || []).map((a, idx) => (
                    <tr key={idx}>
                      <td className="mono" style={{color:'var(--text-2)'}}>{a.code}</td>
                      <td style={{fontWeight:600}}>{a.account}</td>
                      <td className="mono" style={{textAlign:'right',fontWeight:600,color:'white'}}>₹{a.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{borderTop:'2px solid #27272a',paddingTop:16,marginTop:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontWeight:700,fontSize:14,color:'var(--text-1)'}}>Total Assets</span>
            <span className="mono" style={{fontWeight:800,fontSize:16,color:'var(--green)'}}>₹{assetsTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>

        <div className="card" style={{display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
          <div>
            <div className="section-title" style={{marginBottom:8}}>Liabilities</div>
            <table className="tbl" style={{fontSize:13,marginBottom:24}}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account</th>
                  <th style={{textAlign:'right'}}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(bs.liabilities || []).length === 0 ? (
                  <tr><td colSpan={3} style={{textAlign:'center',color:'var(--text-2)',padding:10}}>No liabilities recorded</td></tr>
                ) : (
                  (bs.liabilities || []).map((l, idx) => (
                    <tr key={idx}>
                      <td className="mono" style={{color:'var(--text-2)'}}>{l.code}</td>
                      <td style={{fontWeight:600}}>{l.account}</td>
                      <td className="mono" style={{textAlign:'right',fontWeight:600,color:'white'}}>₹{l.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="section-title" style={{marginBottom:8}}>Equity</div>
            <table className="tbl" style={{fontSize:13}}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account</th>
                  <th style={{textAlign:'right'}}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(bs.equity || []).length === 0 && !data.profit_loss?.net_profit ? (
                  <tr><td colSpan={3} style={{textAlign:'center',color:'var(--text-2)',padding:10}}>No equity recorded</td></tr>
                ) : (
                  <>
                    {(bs.equity || []).map((eq, idx) => (
                      <tr key={idx}>
                        <td className="mono" style={{color:'var(--text-2)'}}>{eq.code}</td>
                        <td style={{fontWeight:600}}>{eq.account}</td>
                        <td className="mono" style={{textAlign:'right',fontWeight:600,color:'white'}}>₹{eq.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                    ))}
                    {data.profit_loss?.net_profit !== undefined && (
                      <tr>
                        <td className="mono" style={{color:'var(--text-2)'}}>-</td>
                        <td style={{fontWeight:600,fontStyle:'italic'}}>Retained Earnings (Net Profit)</td>
                        <td className="mono" style={{textAlign:'right',fontWeight:600,color:data.profit_loss.net_profit >= 0 ? 'var(--green)' : 'var(--red)'}}>
                          ₹{data.profit_loss.net_profit.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div style={{borderTop:'2px solid #27272a',paddingTop:16,marginTop:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontWeight:700,fontSize:14,color:'var(--text-1)'}}>Total Liabilities & Equity</span>
            <span className="mono" style={{fontWeight:800,fontSize:16,color:'var(--green)'}}>₹{equityLiabilitiesTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrialBalanceView({ data = [] }) {
  const totalDebits = data.reduce((sum, r) => sum + (r.debit || 0), 0);
  const totalCredits = data.reduce((sum, r) => sum + (r.credit || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return (
    <div>
      <div className="ws-header">
        <div>
          <h2>Trial Balance</h2>
          <p>Audit and ledger verification</p>
        </div>
        <button className="btn btn-ghost" onClick={() => window.print()}><Download size={14}/> Print Statement</button>
      </div>

      <div style={{
        background: isBalanced ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
        border: `1px solid ${isBalanced ? 'var(--green)' : 'var(--red)'}`,
        borderRadius: 8,
        padding: '12px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: isBalanced ? 'var(--green)' : 'var(--red)',
        fontWeight: 600,
        fontSize: 13
      }}>
        {isBalanced ? (
          <span>✓ Trial Balance is perfectly in balance! Total Debits (₹{totalDebits.toLocaleString(undefined, {minimumFractionDigits: 2})}) = Total Credits (₹{totalCredits.toLocaleString(undefined, {minimumFractionDigits: 2})})</span>
        ) : (
          <span>⚠️ Unbalanced Trial Balance Detected! Total Debits (₹{totalDebits.toLocaleString(undefined, {minimumFractionDigits: 2})}) ≠ Total Credits (₹{totalCredits.toLocaleString(undefined, {minimumFractionDigits: 2})})</span>
        )}
      </div>

      <div className="card">
        <table className="tbl" style={{fontSize:13}}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account Name</th>
              <th>Category</th>
              <th style={{textAlign:'right'}}>Debit (₹)</th>
              <th style={{textAlign:'right'}}>Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={5} style={{textAlign:'center',color:'var(--text-2)',padding:20}}>No postings recorded</td></tr>
            ) : (
              data.map((r, idx) => (
                <tr key={idx}>
                  <td className="mono" style={{color:'var(--text-2)'}}>{r.code}</td>
                  <td style={{fontWeight:600}}>{r.account}</td>
                  <td><span className={`badge badge-ghost`}>{r.category}</span></td>
                  <td className="mono" style={{textAlign:'right',color:r.debit ? 'var(--green)' : '#27272a',fontWeight:r.debit ? 600 : 400}}>
                    {r.debit ? r.debit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                  </td>
                  <td className="mono" style={{textAlign:'right',color:r.credit ? 'var(--red)' : '#27272a',fontWeight:r.credit ? 600 : 400}}>
                    {r.credit ? r.credit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot style={{background:'#161618',borderTop:'2px solid #27272a'}}>
            <tr>
              <td colSpan={3} style={{fontWeight:700,color:'var(--text-2)',padding:'14px 16px'}}>Total Verification</td>
              <td className="mono" style={{textAlign:'right',fontWeight:800,fontSize:14,color:'var(--green)',padding:'14px 16px'}}>
                ₹{totalDebits.toLocaleString(undefined, {minimumFractionDigits: 2})}
              </td>
              <td className="mono" style={{textAlign:'right',fontWeight:800,fontSize:14,color:'var(--red)',padding:'14px 16px'}}>
                ₹{totalCredits.toLocaleString(undefined, {minimumFractionDigits: 2})}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function AICopilotView({ selectedCompanyId, messages, setMessages, input, setInput }) {
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim() || loading) return;
    setMessages([...messages, { role: 'user', text: input }]); setInput(''); setLoading(true);
    try {
      const r = await axios.post(`${API}/ai/query/`, { text: input }, { params: { company_id: selectedCompanyId } });
      setMessages(prev => [...prev, { role: 'ai', text: r.data.answer }]);
    } catch (err) { setMessages(prev => [...prev, { role: 'ai', text: 'Error.' }]); }
    setLoading(false);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 64px)'}}>
      <div className="ws-header"><div><h2>AI Financial Copilot</h2><p>Ask anything</p></div></div>
      <div className="card" style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:12}}>
          {messages.map((m, i) => (<div key={i} style={{padding:12,borderRadius:12,background:m.role==='user'?'var(--brand)':'var(--surface-2)',alignSelf:m.role==='user'?'flex-end':'flex-start',maxWidth:'70%'}}>{m.text}</div>))}
        </div>
        <div style={{padding:16,borderTop:'1px solid var(--border)',display:'flex',gap:10}}>
          <input value={input} onChange={e=>setInput(e.target.value)} style={{flex:1,padding:12,background:'var(--surface-0)',border:'1px solid var(--border)',borderRadius:8,color:'white'}}/>
          <button className="btn btn-brand" onClick={send} disabled={loading}><Send size={18}/></button>
        </div>
      </div>
    </div>
  );
}

function LoginView({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState('');
  
  useEffect(() => {
    axios.get(`${API}/companies/`).then(r => {
        setCompanies(r.data);
    }).catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        const r = await axios.post(`${API}/register/`, { username, password, company_name: companyName });
        onLogin(r.data);
      } else {
        const r = await axios.post(`${API}/login/`, { username, password, company_name: companyName });
        onLogin(r.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
    }
  };

  return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',background:'var(--surface-0)'}}>
      <div className="card" style={{width: 320, padding: 30, display:'flex', flexDirection:'column', gap: 20}}>
        <div style={{textAlign:'center'}}>
            <div className="logo" style={{margin:'0 auto 12px auto', width:48, height:48, fontSize:20}}>A</div>
            <h2 style={{margin:0,fontSize:20}}>{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
            <p style={{margin:'4px 0 0 0',fontSize:12,color:'var(--text-2)'}}>Enterprise Financial System</p>
        </div>
        {error && <div style={{background:'rgba(239,68,68,0.1)',color:'var(--red)',padding:10,borderRadius:8,fontSize:13}}>{error}</div>}
        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="field">
            <label>Username</label>
            <input required value={username} onChange={e=>setUsername(e.target.value)} style={{background:'var(--surface-1)',border:'1px solid var(--border)',padding:10,borderRadius:6,color:'white',width:'100%',boxSizing:'border-box'}}/>
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} style={{background:'var(--surface-1)',border:'1px solid var(--border)',padding:10,borderRadius:6,color:'white',width:'100%',boxSizing:'border-box'}}/>
          </div>
          <div className="field">
            <label>Company Name</label>
            <input list="company-list" required value={companyName} onChange={e=>setCompanyName(e.target.value)} style={{background:'var(--surface-1)',border:'1px solid var(--border)',padding:10,borderRadius:6,color:'white',width:'100%',boxSizing:'border-box'}} placeholder={isRegister ? "Enter new or existing company" : "Select your company"}/>
            <datalist id="company-list">
              {companies.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>
          <button type="submit" className="btn btn-brand" style={{width:'100%',marginTop:8,padding:10}}>
            {isRegister ? 'Register' : 'Login'}
          </button>
        </form>
        <div style={{textAlign:'center',fontSize:13,color:'var(--text-2)',cursor:'pointer'}} onClick={()=>setIsRegister(!isRegister)}>
          {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
        </div>
      </div>
    </div>
  );
}
