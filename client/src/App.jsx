import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { api } from './api';

function SignIn({ onDone }){
  const [name,setName]=useState('');
  const [mode,setMode]=useState('register');
  const go = async () => {
    if (!name.trim()) return;
    try {
      if (mode==='register') await api('/api/register',{method:'POST', body:JSON.stringify({displayName:name.trim()})});
      else await api('/api/login',{method:'POST', body:JSON.stringify({displayName:name.trim()})});
      onDone();
    } catch(e){ alert(e.message); }
  };
  return (
    <div className="container">
      <div className="card">
        <h2>heterodox</h2>
        <p className="muted">A daily spark: ask a question in the morning, read anonymized answers from your circle at 20:00.</p>
        <div className="row">
          <input placeholder="Display name" value={name} onChange={e=>setName(e.target.value)} />
          <button onClick={go}>{mode==='register'?'Register':'Sign in'}</button>
        </div>
        <div style={{marginTop:8}}>
          <button className="secondary" onClick={()=>setMode(mode==='register'?'login':'register')}>
            Switch to {mode==='register'?'Sign in':'Register'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** NEW: Welcome screen for invite links (unauthenticated) */
function WelcomeInvite({ token }) {
  const [answer, setAnswer] = useState('');
  const [error, setError]   = useState(null);
  const [busy, setBusy]     = useState(false);

  const minLen = 10;

  const shareAndJoin = async () => {
    setError(null);
    const a = answer.trim();
    if (a.length < minLen) {
      setError(`Please write at least ${minLen} characters.`);
      return;
    }
    try {
      setBusy(true);
      // Stash the answer so we can finish after Google auth redirects back.
      localStorage.setItem('pendingInvite', JSON.stringify({ token, answer: a }));
      // Kick off Google Sign-In (server will redirect back to frontend root)
      window.location.href = '/api/auth/google';
    } catch (e) {
      setBusy(false);
      setError(e.message || 'Something went wrong.');
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Welcome to heterodox</h2>
        <p className="muted">
          To join this community, first share your answer to the starter prompt below.
        </p>
        <div style={{marginTop:12}}>
          <div className="pill">Prompt</div>
          <h3 style={{marginTop:8}}>What is the most interesting question you’ve ever been asked?</h3>
        </div>
        <div style={{marginTop:8}}>
          <textarea
            rows="5"
            placeholder="Write your answer…"
            value={answer}
            onChange={e=>setAnswer(e.target.value)}
          />
          <div className="muted" style={{marginTop:6}}>
            {answer.trim().length}/{minLen} minimum
          </div>
        </div>
        {error && <div className="muted" style={{color:'crimson', marginTop:8}}>{error}</div>}
        <div style={{marginTop:12}}>
          <button onClick={shareAndJoin} disabled={busy || answer.trim().length < minLen}>
            {busy ? 'Redirecting…' : 'Share & Join with Google'}
          </button>
        </div>
        <div className="muted" style={{marginTop:8}}>
          You’ll be prompted to sign in with Google to create your account and save your answer.
        </div>
      </div>
    </div>
  );
}

function Connections(){
  const [list,setList]=useState([]);
  const [query,setQuery]=useState('');
  const [results,setResults]=useState([]);

  const load = async()=>{
    const j = await api('/api/connections');
    setList(j.connections);
  };
  useEffect(()=>{ load(); },[]);

  const search = async (q)=>{
    setQuery(q);
    if (!q.trim()) return setResults([]);
    const j = await api('/api/users/search?q='+encodeURIComponent(q.trim()));
    setResults(j.users);
  };
  const add = async (name)=>{
    try{
      await api('/api/connections/add',{method:'POST', body:JSON.stringify({peerDisplayName:name})});
      setQuery(''); setResults([]); load();
    }catch(e){ alert(e.message); }
  };

  return (
    <div className="card">
      <h3>Connections</h3>
      <div className="row">
        <input placeholder="Search names…" value={query} onChange={e=>search(e.target.value)} />
      </div>
      {results.length>0 && (
        <div className="list">
          {results.map(u=>(
            <div key={u.id} className="row">
              <div>{u.display_name}</div>
              <div style={{flex:'none'}}>
                <button onClick={()=>add(u.display_name)}>Add</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{marginTop:12}} className="list">
        {list.map(c=>(<div key={c.id} className="pill">{c.display_name}</div>))}
        {list.length===0 && <div className="muted">No connections yet. Add some to exchange answers.</div>}
      </div>
    </div>
  );
}

function Ask(){
  const [mine,setMine]=useState(null);
  const [text,setText]=useState('');

  const load = async()=>{
    const j = await api('/api/questions/mine');
    setMine(j.question);
  };
  useEffect(()=>{ load(); },[]);

  const post = async()=>{
    if (text.trim().length<5) return alert('Min 5 chars');
    try{
      await api('/api/questions',{method:'POST', body:JSON.stringify({text:text.trim()})});
      setText(''); load();
    }catch(e){ alert(e.message); }
  };

  return (
    <div className="card">
      <h3>Ask (today)</h3>
      {mine ? (
        <div>
          <div className="pill">Posted {mine.qdate}</div>
          <p style={{marginTop:8}}>{mine.text}</p>
        </div>
      ):(
        <div>
          <textarea rows="3" placeholder="What question are you putting to your circle today?" value={text} onChange={e=>setText(e.target.value)} />
          <div style={{marginTop:8}}>
            <button onClick={post}>Post question</button>
          </div>
          <div className="muted" style={{marginTop:8}}>You can post one question per day.</div>
        </div>
      )}
    </div>
  );
}

function Answer(){
  const [feed,setFeed]=useState([]);
  const [drafts,setDrafts]=useState({});

  const load = async()=>{
    const j = await api('/api/questions/feed');
    setFeed(j.feed);
  };
  useEffect(()=>{ load(); },[]);

  const submit = async (q)=>{
    const body = drafts[q.id];
    if (!body || body.trim().length<3) return alert('Min 3 chars');
    try{
      await api('/api/answers',{method:'POST', body:JSON.stringify({questionId:q.id, text:body.trim()})});
      setDrafts(d=>({...d,[q.id]:''})); load();
    }catch(e){ alert(e.message); }
  };

  return (
    <div className="card">
      <h3>Answer (until 20:00)</h3>
      {feed.length===0 && <div className="muted">No questions from your connections for today yet.</div>}
      <div className="list">
        {feed.map(q=>(
          <div key={q.id} className="answer">
            <div className="pill">{q.owner_name} • {q.qdate}</div>
            <div style={{marginTop:6, marginBottom:6}}>{q.text}</div>
            {q.iAnswered ? (
              <div className="muted">You already answered.</div>
            ):(
              <div>
                <textarea rows="3" placeholder="Your answer…" value={drafts[q.id]||''} onChange={e=>setDrafts(d=>({...d, [q.id]:e.target.value}))} />
                <div style={{marginTop:8}}>
                  <button onClick={()=>submit(q)}>Submit</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Reveal(){
  const [mine,setMine]=useState(null);
  const [answers,setAnswers]=useState([]);
  const [err,setErr]=useState(null);

  const loadMine = async()=>{
    const j = await api('/api/questions/mine');
    setMine(j.question);
    setErr(null);
  };
  const loadAnswers = async()=>{
    if (!mine) return;
    try{
      const j = await api('/api/questions/'+mine.id+'/answers');
      setAnswers(j.answers);
      setErr(null);
    }catch(e){ setErr(e.message); }
  };

  useEffect(()=>{ loadMine(); },[]);
  useEffect(()=>{ if (mine) loadAnswers(); },[mine]);

  const upvote = async (id)=>{
    try{
      await api('/api/answers/'+id+'/vote', {method:'POST'});
      loadAnswers();
    }catch(e){ alert(e.message); }
  };

  return (
    <div className="card">
      <h3>Reveal (after 20:00)</h3>
      {!mine && <div className="muted">Post a question in Ask to see answers here later today.</div>}
      {mine && (
        <div>
          <div className="pill">Your question • {mine.qdate}</div>
          <div style={{marginTop:6, marginBottom:6}}>{mine.text}</div>
          {err && <div className="muted">Not available yet: {err}</div>}
          <div className="list">
            {answers.map(a=>(
              <div key={a.id} className="answer">
                <div className="muted">Anonymous • {dayjs(a.created_at).format('HH:mm')}</div>
                <div style={{marginTop:6, marginBottom:6}}>{a.text}</div>
                <div className="row" style={{alignItems:'center'}}>
                  <div className="pill">{a.votes} upvotes</div>
                  <div style={{flex:'none'}}><button onClick={()=>upvote(a.id)}>Upvote</button></div>
                </div>
              </div>
            ))}
            {answers.length===0 && !err && <div className="muted">No answers yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Nav({ me, onLogout, tab, setTab }){
  return (
    <div className="card" style={{position:'sticky', top:0, zIndex:10}}>
      <div className="row" style={{alignItems:'center'}}>
        <div style={{fontWeight:700}}>Asa</div>
        <div style={{flex:1}}></div>
        <div className="pill">{me?.displayName}</div>
        <button className="secondary" onClick={onLogout}>Log out</button>
      </div>
      <div style={{marginTop:8, display:'flex', gap:8}}>
        {['Ask','Answer','Reveal','Connections'].map(t=> (
          <button key={t} className={tab===t?'':'secondary'} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>
    </div>
  );
}

export default function App(){
  const [me,setMe]=useState(null);
  const [tab,setTab]=useState('Ask');

  const inviteToken = new URLSearchParams(window.location.search).get('invite') || null;
  if (!me && inviteToken) return <WelcomeInvite token={inviteToken} />;

  // After login, finalize any pending invite we stashed before auth.
  const finishPendingInvite = async () => {
    const raw = localStorage.getItem('pendingInvite');
    if (!raw) return;
    try {
      const { token, answer } = JSON.parse(raw);
      if (!token || !answer) return;
      await api('/api/invite/accept', {
        method: 'POST',
        body: JSON.stringify({ token, answer })
      });
    } catch (e) {
      // You may want to surface this in UI; for now, log it.
      console.error('Failed to finalize invite:', e);
    } finally {
      localStorage.removeItem('pendingInvite');
    }
  };

  const load = async()=>{
    const j = await api('/api/me'); 
    setMe(j.user);
    if (j.user) {
      await finishPendingInvite();
    }
  };
  useEffect(()=>{ load(); },[]);

  const logout = async()=>{ await api('/api/logout',{method:'POST'}); setMe(null); };

  // NEW: If unauthenticated AND invite token exists → show WelcomeInvite first.
  if (!me && inviteToken) return <WelcomeInvite token={inviteToken} />;

  if (!me) return (
    <div className="container">
      <SignIn onDone={load} />
      {/* Optional: keep a Google CTA for non-invite users */}
      <div style={{marginTop:16, textAlign:'center'}}>
        <a href="/api/auth/google" className="btn">Continue with Google</a>
      </div>
    </div>
  );

  return (
    <div className="container">
      <Nav me={me} onLogout={logout} tab={tab} setTab={setTab} />
      {/* Moved Google CTA out of the logged-in view; not needed once authenticated */}
      {tab==='Ask' && <Ask />}
      {tab==='Answer' && <Answer />}
      {tab==='Reveal' && <Reveal />}
      {tab==='Connections' && <Connections />}
    </div>
  );
}