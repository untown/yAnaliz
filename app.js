const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const STORE_KEY = 'tytAnalizProV4';
const lessons = {
  'TÜRKÇE': {limit:40, group:'TYT'},
  'T.SOSYAL': {limit:25, group:'TYT'},
  'T.MATEMATİK': {limit:40, group:'TYT'},
  'T.FEN': {limit:20, group:'TYT'}
};
const reasonOptions = ['Konu eksiği','Dikkat hatası','Süre yetmedi','İki şık arasında kaldım','Soruyu yanlış okudum','İşlem hatası','Bilgiyi hatırlayamadım','Boş bıraktım'];
let state = load() || {attempts:[], pending:[], branches:[]};
let charts = {};

function load(){try{return JSON.parse(localStorage.getItem(STORE_KEY))}catch{return null}}
function save(){localStorage.setItem(STORE_KEY, JSON.stringify(state)); renderAll();}
function net(d,y){return +(Number(d||0)-Number(y||0)/4).toFixed(2)}
function totalNet(a){return Object.values(a.lessons||{}).reduce((s,l)=>s+Number(l.net||0),0)}
function normText(t){return (t||'').replace(/İ/g,'İ').replace(/I/g,'I').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\r/g,'').replace(/MATEMAT\s*İ\s*K/g,'MATEMATİK').replace(/T\.MATEMAT\s*İ\s*K/g,'T.MATEMATİK').replace(/D\s*İN/g,'DİN').replace(/F\s*İ\s*Z\s*İK/g,'FİZİK').replace(/K\s*İMYA/g,'KİMYA').replace(/B\s*İYOLOJİ/g,'BİYOLOJİ')}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function fmt(n){return Number(n||0).toFixed(2)}

$('#loginBtn').onclick = () => { if($('#password').value.trim()==='Yusuf'){ $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); renderAll(); } else alert('Şifre hatalı'); };
$('#password').addEventListener('keydown', e=>{if(e.key==='Enter')$('#loginBtn').click()});
$$('.nav').forEach(b=>b.onclick=()=>{ $$('.nav').forEach(x=>x.classList.remove('active')); b.classList.add('active'); $$('.page').forEach(p=>p.classList.remove('active')); $('#'+b.dataset.page).classList.add('active'); $('#pageTitle').textContent=b.textContent; if(b.dataset.page==='report') buildReport(); setTimeout(resizeCharts,60); });
$('#printBtn').onclick=()=>{showPage('report'); buildReport(); setTimeout(()=>window.print(),250)};
function showPage(p){$$('.nav').forEach(x=>x.classList.toggle('active',x.dataset.page===p)); $$('.page').forEach(x=>x.classList.toggle('active',x.id===p)); $('#pageTitle').textContent=$(`.nav[data-page="${p}"]`).textContent;}

$('#sampleBtn').onclick=()=>{state.attempts=[makeSample()]; save();};
function makeSample(){return {id:uid(),name:'O POZİTİF TYT+AYT',date:'2026-05-04',score:285.557,rank:327,lessons:{'TÜRKÇE':{total:40,correct:26,wrong:11,blank:3,net:23.25},'T.SOSYAL':{total:25,correct:14,wrong:5,blank:6,net:12.75},'T.MATEMATİK':{total:40,correct:11,wrong:2,blank:27,net:10.5},'T.FEN':{total:20,correct:13,wrong:6,blank:1,net:11.5}},questions:[q('TÜRKÇE',8,'PARAGRAF','Y'),q('TÜRKÇE',10,'YAZIM KURALLARI','Y'),q('T.MATEMATİK',3,'KÖKLÜ SAYI','Y'),q('T.MATEMATİK',14,'ORAN ORANTI','Y'),q('T.FEN',1,'FİZİK BİLİMİ','Y'),q('T.FEN',6,'OPTİK','Y'),q('T.SOSYAL',4,'MİLLİ MÜCADELE','Y')]}}
function q(lesson,no,topic,status){return {lesson,no,topic,status,reason: status==='B'?'Boş bıraktım':'',customReason:''}}

$('#parseBtn').onclick = async()=>{
  const files=[...$('#fileInput').files];
  if(!files.length) return alert('Önce dosya seçmelisin.');
  $('#parseStatus').textContent='Dosyalar okunuyor...';
  let added=[];
  for(const f of files){
    try{let text='';
      if(f.name.toLowerCase().endsWith('.json')){const obj=JSON.parse(await f.text()); if(obj.attempts){state.attempts.push(...obj.attempts); continue;} else state.pending.push(obj);}
      else if(f.name.toLowerCase().endsWith('.pdf')) text = await readPdf(f);
      else text = await f.text();
      const parsed=parseExamText(text, f.name); state.pending.push(parsed); added.push(parsed.name);
    }catch(e){console.error(e); $('#parseStatus').textContent += `\n${f.name}: okunamadı (${e.message})`;}
  }
  save(); $('#parseStatus').textContent=`${files.length} dosya işlendi. Kontrol & Düzelt ekranına geç.`; showPage('review'); renderReview();
};
$('#clearPendingBtn').onclick=()=>{state.pending=[]; save();};
async function readPdf(file){
  const data = new Uint8Array(await file.arrayBuffer());
  const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.worker.min.mjs';
  const pdf=await pdfjsLib.getDocument({data}).promise;
  let out='';
  for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i); const txt=await page.getTextContent(); out += '\n' + txt.items.map(it=>it.str).join(' ');}
  return out;
}

function parseExamText(raw, filename='Dosya'){
  const text=normText(raw);
  const name = pick(text,/Sınav Adı\s*:?\s*([^\n]+?)\s*Sınav Tarihi/i) || filename.replace(/\.[^.]+$/,'');
  const dateRaw = pick(text,/Sınav Tarihi\s*:?\s*(\d{2}[-.]\d{2}[-.]\d{4})/i);
  const date = dateRaw ? dateRaw.replace(/(\d{2})[-.](\d{2})[-.](\d{4})/,'$3-$2-$1') : new Date().toISOString().slice(0,10);
  const score = Number((pick(text,/TYT\s+(\d+[.,]\d+)\s+\d+[.,]\d+\s+\d+/i)||0).toString().replace(',','.'));
  const rank = Number(pick(text,/TYT\s+\d+[.,]\d+\s+\d+[.,]\d+\s+(\d+)\s+\d+/i)||0);
  const a={id:uid(),name:name.trim(),date,score,rank,lessons:{},questions:[],sourceName:filename};
  const summaryRe=/(TÜRKÇE|T\.SOSYAL|T\.MATEMATİK|T\.FEN)\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+([\d.,]+)/g;
  let m; while((m=summaryRe.exec(text))){a.lessons[m[1]]={total:+m[2],correct:+m[3],wrong:+m[4],blank:+m[5],net:+m[6].replace(',','.')};}
  if(!Object.keys(a.lessons).length){ // fallback count from question list
    Object.keys(lessons).forEach(l=>a.lessons[l]={total:lessons[l].limit,correct:0,wrong:0,blank:0,net:0});
  }
  const sections=['TÜRKÇE','T.SOSYAL','T.MATEMATİK','T.FEN'];
  for(let i=0;i<sections.length;i++){
    const sec=sections[i], next=sections[i+1]||'EDEBİYAT';
    const part = sliceSection(text, sec, next);
    const rows=parseQuestionRows(part, sec);
    if(rows.length) a.questions.push(...rows);
  }
  // Recalculate lesson counts from question rows when reliable.
  for(const sec of sections){const rows=a.questions.filter(x=>x.lesson===sec); if(rows.length>=5){const c=rows.filter(x=>x.status==='D').length,w=rows.filter(x=>x.status==='Y').length,b=rows.filter(x=>x.status==='B').length; a.lessons[sec]={total:rows.length,correct:c,wrong:w,blank:b,net:net(c,w)};}}
  return a;
}
function pick(t,re){const m=t.match(re);return m?m[1].trim():''}
function sliceSection(text, start, end){
  const s=text.indexOf(start); if(s<0)return''; const e=text.indexOf(end, s+start.length); return text.slice(s, e>0?e:text.length);
}
function parseQuestionRows(part, lesson){
  let clean=part.replace(/Cev\.A\..*?Öğr\.C\..*?(?=\s+[DYB]\s+\d+_|$)/i,' ');
  const re=/\b([DYB])\s+(\d{1,2})_([^DYB\n]+?)(?=\s+[DYB]\s+\d{1,2}_|$)/g;
  let rows=[], m;
  while((m=re.exec(clean))){
    const topic=m[3].replace(/\s+/g,' ').trim();
    if(topic && +m[2]<=80) rows.push({lesson,no:+m[2],topic,status:m[1],reason:m[1]==='B'?'Boş bıraktım':'',customReason:''});
  }
  // Strong fallback for badly spaced PDF text.
  if(rows.length<3){
    const re2=/([DYB])\s*(\d{1,2})_([A-ZÇĞİÖŞÜ0-9 .]+?)(?=\s*[DYB]\s*\d{1,2}_|$)/g;
    while((m=re2.exec(clean))){rows.push({lesson,no:+m[2],topic:m[3].trim(),status:m[1],reason:m[1]==='B'?'Boş bıraktım':'',customReason:''});}
  }
  return rows.sort((a,b)=>a.no-b.no);
}

function renderAll(){renderSummary(); renderCharts(); renderReview(); renderTopics(); renderCompareOptions(); renderHistory(); renderBranches();}
function renderSummary(){
  const last=state.attempts.at(-1); const box=$('#summaryCards');
  if(!last){box.innerHTML='<div class="panel">Henüz deneme yok. PDF yükle veya örnek veri ekle.</div>'; $('#smartWarnings').innerHTML=''; return;}
  const data=[['Toplam Net',fmt(totalNet(last))],['TYT Puan',last.score||'-'],['Kayıtlı Deneme',state.attempts.length],['Kritik Konu',topTopics()[0]?.topic||'-']];
  box.innerHTML=data.map(x=>`<div class="card"><h3>${x[0]}</h3><div class="big">${x[1]}</div><p>Son kayıt: ${last.name}</p></div>`).join('');
  const tops=topTopics().slice(0,5);
  $('#smartWarnings').innerHTML = tops.length ? tops.map(t=>`<div class="warn-item"><b>${t.topic}</b> ${t.count} kez hata/boş. Öncelik puanı: ${t.score}. ${t.note}</div>`).join('') : '<div class="ok-item">Şu an kritik tekrar eden hata görünmüyor.</div>';
}
function makeChart(id,type,data,options={}){if(charts[id])charts[id].destroy(); const ctx=$('#'+id); if(!ctx)return; charts[id]=new Chart(ctx,{type,data,options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{labels:{color:'#cbd5e1'}}},scales:{x:{ticks:{color:'#cbd5e1'},grid:{color:'rgba(148,163,184,.12)'}},y:{ticks:{color:'#cbd5e1'},grid:{color:'rgba(148,163,184,.12)'},beginAtZero:true}},...options}})}
function renderCharts(){
  const labels=state.attempts.map((a,i)=>`${i+1}. ${a.date||''}`); const nets=state.attempts.map(totalNet);
  makeChart('netTimeChart','line',{labels,datasets:[{label:'Toplam Net',data:nets,tension:.35,fill:false}]});
  const last=state.attempts.at(-1); const lLabels=last?Object.keys(last.lessons):[]; const lData=last?lLabels.map(k=>last.lessons[k].net):[];
  makeChart('lessonChart','bar',{labels:lLabels,datasets:[{label:'Net',data:lData}]});
  const tops=topTopics().slice(0,12); makeChart('topicErrorChart','bar',{labels:tops.map(t=>t.topic),datasets:[{label:'Yanlış + Boş Tekrarı',data:tops.map(t=>t.count)}]}, {indexAxis:'y'});
}
function resizeCharts(){Object.values(charts).forEach(c=>c.resize())}

function renderReview(){
  const root=$('#reviewList'); if(!root)return;
  if(!state.pending.length){root.innerHTML='<div class="panel">Bekleyen dosya yok. PDF yüklediğinde burada kontrol ekranı açılır.</div>'; return;}
  root.innerHTML=state.pending.map((a,ai)=>`<div class="panel attempt-review"><h3>${a.name}</h3><p>${a.date} • Kaynak: ${a.sourceName||''}</p>${Object.entries(a.lessons||{}).map(([k,l])=>lessonEditor(a,ai,k,l)).join('')}<button class="primary" onclick="approveAttempt(${ai})">Bu Denemeyi Kaydet</button> <button class="ghost" onclick="removePending(${ai})">Sil</button></div>`).join('');
}
function lessonEditor(a,ai,k,l){const qs=(a.questions||[]).filter(q=>q.lesson===k);return `<div class="lesson-block"><div class="lesson-head"><b>${k}</b><span class="pill">${l.correct}D ${l.wrong}Y ${l.blank}B • ${fmt(l.net)} net</span></div><div class="q-grid">${qs.map((q,qi)=>qEditor(ai,k,qi,q)).join('')}</div></div>`}
function qEditor(ai,lesson,idx,q){const cls=q.status==='Y'?'bad':q.status==='B'?'blank':'good';return `<div class="q-card ${cls}"><div class="q-row"><select onchange="editQ(${ai},'${lesson}',${idx},'status',this.value)"><option ${q.status==='D'?'selected':''}>D</option><option ${q.status==='Y'?'selected':''}>Y</option><option ${q.status==='B'?'selected':''}>B</option></select><input value="${esc(q.topic)}" onchange="editQ(${ai},'${lesson}',${idx},'topic',this.value)"></div><label>${lesson} ${q.no}. soru hata nedeni</label><select onchange="editQ(${ai},'${lesson}',${idx},'reason',this.value)"><option value="">Seç</option>${reasonOptions.map(r=>`<option ${q.reason===r?'selected':''}>${r}</option>`).join('')}</select><label>Kendi notun</label><textarea onchange="editQ(${ai},'${lesson}',${idx},'customReason',this.value)" placeholder="Bu soruda neden zorlandığını kendin yaz...">${esc(q.customReason||'')}</textarea></div>`}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
window.editQ=(ai,lesson,idx,field,val)=>{const rows=state.pending[ai].questions.filter(q=>q.lesson===lesson); rows[idx][field]=val; recalcAttempt(state.pending[ai]); save();};
window.approveAttempt=(ai)=>{const a=state.pending.splice(ai,1)[0]; recalcAttempt(a); state.attempts.push(a); save(); showPage('overview');};
window.removePending=(ai)=>{state.pending.splice(ai,1); save();};
function recalcAttempt(a){for(const sec of Object.keys(lessons)){const rows=(a.questions||[]).filter(q=>q.lesson===sec); if(rows.length){const c=rows.filter(q=>q.status==='D').length,w=rows.filter(q=>q.status==='Y').length,b=rows.filter(q=>q.status==='B').length; a.lessons[sec]={total:rows.length,correct:c,wrong:w,blank:b,net:net(c,w)}}}}

function collectTopicStats(){const map={}; state.attempts.forEach(a=>(a.questions||[]).forEach(q=>{if(q.status==='D')return; const key=q.topic.toUpperCase(); map[key]??={topic:key,count:0,wrong:0,blank:0,lessons:{},notes:[]}; map[key].count++; if(q.status==='Y')map[key].wrong++; if(q.status==='B')map[key].blank++; map[key].lessons[q.lesson]=(map[key].lessons[q.lesson]||0)+1; if(q.reason||q.customReason)map[key].notes.push(`${a.name} ${q.lesson} ${q.no}. soru: ${q.reason||''} ${q.customReason||''}`.trim());})); return Object.values(map)}
function topTopics(){return collectTopicStats().map(t=>{t.score=t.count*20+t.wrong*8+t.blank*5+(t.notes.length?5:0);t.note=t.blank>t.wrong?'Boş sayısı yüksek: süre/cesaret problemi olabilir.':'Yanlış sayısı yüksek: konu veya dikkat hatası incelenmeli.';return t}).sort((a,b)=>b.score-a.score)}
function renderTopics(){const tops=topTopics(); $('#priorityList').innerHTML=tops.slice(0,10).map(t=>`<div class="priority-row"><div><b>${t.topic}</b><div class="bar"><span style="width:${Math.min(100,t.score)}%"></span></div><small>${t.wrong} yanlış, ${t.blank} boş • ${t.note}</small></div><b>${t.score}</b></div>`).join('')||'Konu hatası yok.'; $('#topicDetails').innerHTML=`<table class="topic-table"><thead><tr><th>Konu</th><th>Tekrar</th><th>Yanlış</th><th>Boş</th><th>Notlar</th></tr></thead><tbody>${tops.map(t=>`<tr><td>${t.topic}</td><td>${t.count}</td><td>${t.wrong}</td><td>${t.blank}</td><td>${t.notes.slice(0,3).join('<br>')}</td></tr>`).join('')}</tbody></table>`}

function renderCompareOptions(){const opts=state.attempts.map((a,i)=>`<option value="${i}">${i+1}. ${a.name} (${a.date})</option>`).join(''); $('#compareA').innerHTML=opts; $('#compareB').innerHTML=opts; if(state.attempts.length>1)$('#compareB').value=state.attempts.length-1;}
$('#compareBtn').onclick=()=>{const a=state.attempts[$('#compareA').value],b=state.attempts[$('#compareB').value]; if(!a||!b)return; const keys=[...new Set([...Object.keys(a.lessons||{}),...Object.keys(b.lessons||{})])]; $('#compareResult').innerHTML=[['Toplam Net',totalNet(b)-totalNet(a)],...keys.map(k=>[k,(b.lessons[k]?.net||0)-(a.lessons[k]?.net||0)])].map(x=>`<div class="card"><h3>${x[0]}</h3><div class="big">${x[1]>=0?'+':''}${fmt(x[1])}</div><p>${x[1]>=0?'Artış':'Düşüş'}</p></div>`).join('')};

$('#saveBranch').onclick=()=>{const total=+$(' #branchTotal'.trim()).value,c=+$('#branchCorrect').value,w=+$('#branchWrong').value; if(c+w>total||total<1)return alert('Doğru + yanlış soru sayısını geçemez.'); state.branches.push({id:uid(),name:$('#branchName').value||'Branş Denemesi',lesson:$('#branchLesson').value,total,correct:c,wrong:w,blank:total-c-w,net:net(c,w),date:new Date().toISOString().slice(0,10)}); save();};
function renderBranches(){ $('#branchList').innerHTML=(state.branches||[]).map(b=>`<div class="panel"><b>${b.name}</b> <span class="pill">${b.lesson}</span><p>${b.correct}D ${b.wrong}Y ${b.blank}B • ${fmt(b.net)} net • ${b.date}</p></div>`).join('')||'<div class="panel">Branş denemesi yok.</div>';}
function renderHistory(){ $('#historyList').innerHTML=state.attempts.map((a,i)=>`<div class="history-item"><div><b>${i+1}. ${a.name}</b><br><small>${a.date} • ${fmt(totalNet(a))} net</small></div><button class="ghost" onclick="deleteAttempt(${i})">Sil</button></div>`).join('')||'Kayıt yok.';}
window.deleteAttempt=i=>{if(confirm('Bu deneme silinsin mi?')){state.attempts.splice(i,1);save();}}
$('#exportBtn').onclick=()=>download('tyt-analiz-yedek.json', JSON.stringify(state,null,2));
$('#importBackupBtn').onclick=async()=>{const f=$('#backupInput').files[0]; if(!f)return; state=JSON.parse(await f.text()); save();};
function download(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;a.click();URL.revokeObjectURL(a.href)}

$('#buildReportBtn').onclick=buildReport;
function buildReport(){const last=state.attempts.at(-1); const tops=topTopics(); const area=$('#reportArea'); if(!last){area.innerHTML='<h1>Rapor için önce deneme yükle.</h1>';return;} area.innerHTML=`<h1>TYT Detaylı Deneme Analiz Raporu</h1><p><b>Son deneme:</b> ${last.name} • ${last.date} • <b>Toplam net:</b> ${fmt(totalNet(last))}</p><div class="report-grid">${Object.entries(last.lessons).map(([k,l])=>`<div class="report-card"><h3>${k}</h3><p>${l.correct} doğru, ${l.wrong} yanlış, ${l.blank} boş, ${fmt(l.net)} net.</p></div>`).join('')}</div><h2 class="page-break">Öncelikli Çalışılacak Konular</h2><table class="report-table"><tr><th>Konu</th><th>Tekrar</th><th>Yanlış</th><th>Boş</th><th>Yorum</th></tr>${tops.slice(0,20).map(t=>`<tr><td>${t.topic}</td><td>${t.count}</td><td>${t.wrong}</td><td>${t.blank}</td><td>${t.note}</td></tr>`).join('')}</table><h2 class="page-break">Soru Soru Hata Nedeni</h2>${state.attempts.map(a=>`<h3>${a.name} - ${a.date}</h3><table class="report-table"><tr><th>Ders</th><th>Soru</th><th>Konu</th><th>Durum</th><th>Neden</th><th>Kendi Notun</th></tr>${(a.questions||[]).filter(q=>q.status!=='D').map(q=>`<tr><td>${q.lesson}</td><td>${q.no}</td><td>${q.topic}</td><td>${q.status}</td><td>${q.reason||'-'}</td><td>${q.customReason||'-'}</td></tr>`).join('')}</table>`).join('')}<h2 class="page-break">Çalışma Yorumu</h2><p>En sık tekrar eden konular ilk sırada çalışılmalı. Yanlış nedeni çoğunlukla “konu eksiği” ise önce kısa konu tekrarı, sonra kolay-orta-zor test sırası uygulanmalı. “Dikkat hatası” çoğunluktaysa çözümden önce altı çizilecek anahtar kelime, işlem kontrolü ve şık eleme alışkanlığı kullanılmalı. “Boş” fazlaysa süre yönetimi ve orta seviye pratik artırılmalı.</p>`;}

function validateAll(){state.attempts.forEach(recalcAttempt)}
window.addEventListener('resize',()=>setTimeout(resizeCharts,80));
validateAll(); renderAll();
