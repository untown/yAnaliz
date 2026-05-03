const LESSONS = {
  "Türkçe": { max: 40, topics: ["Paragraf", "Sözcükte Anlam", "Cümlede Anlam", "Dil Bilgisi", "Yazım-Noktalama", "Anlatım Bozukluğu"] },
  "Matematik": { max: 40, topics: ["Temel Kavramlar", "Sayı Basamakları", "Problemler", "Rasyonel Sayılar", "Denklem-Eşitsizlik", "Fonksiyon", "Geometri", "Veri-İstatistik"] },
  "Sosyal": { max: 20, topics: ["Tarih", "Coğrafya", "Felsefe", "Din Kültürü", "Harita-Yorum", "Kavram Bilgisi"] },
  "Fen": { max: 20, topics: ["Fizik Bilimine Giriş", "Kuvvet-Hareket", "Enerji", "Optik", "Elektrik", "Kimya", "Biyoloji", "Canlılar-Ortak Özellikler"] }
};
let exams = JSON.parse(localStorage.getItem("tytExamsPro") || "[]");
let activeMistakes = [];
let charts = {};
const $ = id => document.getElementById(id);
function net(d,y){ return +(Number(d || 0) - Number(y || 0)/4).toFixed(2); }
function totalNet(exam){ return +(Object.values(exam.scores).reduce((a,s)=>a+net(s.d,s.y),0)).toFixed(2); }
function save(){ localStorage.setItem("tytExamsPro", JSON.stringify(exams)); }
function setup(){
  $("examDate").valueAsDate = new Date();
  const wrap = $("scoreInputs"), tpl = $("lessonScoreTemplate");
  Object.entries(LESSONS).forEach(([lesson,info])=>{
    const node = tpl.content.cloneNode(true); const box = node.querySelector(".lesson-box");
    box.querySelector("h4").textContent = `${lesson} (${info.max})`;
    const inputs = box.querySelectorAll("input");
    inputs[0].id = `${lesson}-d`; inputs[1].id = `${lesson}-y`; inputs[2].id = `${lesson}-b`;
    inputs.forEach(i=>i.value=0); wrap.appendChild(node);
  });
  Object.keys(LESSONS).forEach(l=>$("mistakeLesson").add(new Option(l,l)));
  updateTopicSelect(); render();
}
function updateTopicSelect(){ const lesson=$("mistakeLesson").value; $("mistakeTopic").innerHTML=""; LESSONS[lesson].topics.forEach(t=>$("mistakeTopic").add(new Option(t,t))); }
$("mistakeLesson").addEventListener("change", updateTopicSelect);
$("addMistakeBtn").addEventListener("click",()=>{
  const item={lesson:$("mistakeLesson").value,topic:$("mistakeTopic").value,reason:$("mistakeReason").value,count:+$("mistakeCount").value||1};
  activeMistakes.push(item); renderMistakes();
});
function renderMistakes(){ $("mistakeList").innerHTML = activeMistakes.map((m,i)=>`<span class="tag">${m.lesson} / ${m.topic} / ${m.reason} ×${m.count} <button type="button" onclick="removeMistake(${i})" class="ghost" style="padding:2px 6px;margin-left:6px">x</button></span>`).join(""); }
window.removeMistake=i=>{activeMistakes.splice(i,1);renderMistakes();};
$("examForm").addEventListener("submit",e=>{
  e.preventDefault();
  const scores={}; let ok=true;
  Object.entries(LESSONS).forEach(([lesson,info])=>{
    const d=+$(`${lesson}-d`).value||0, y=+$(`${lesson}-y`).value||0, b=+$(`${lesson}-b`).value||0;
    if(d+y+b>info.max){ alert(`${lesson} için doğru+yanlış+boş toplamı ${info.max} soruyu geçemez.`); ok=false; }
    scores[lesson]={d,y,b,n:net(d,y)};
  });
  if(!ok) return;
  exams.push({id:Date.now(), name:$("examName").value, date:$("examDate").value, time:$("timeStatus").value, note:$("examNote").value, scores, mistakes:activeMistakes});
  activeMistakes=[]; renderMistakes(); e.target.reset(); $("examDate").valueAsDate = new Date(); Object.keys(LESSONS).forEach(l=>[$(`${l}-d`),$(`${l}-y`),$(`${l}-b`)].forEach(i=>i.value=0)); save(); render();
});
function aggregateMistakes(){ const map={}; exams.forEach(ex=>ex.mistakes.forEach(m=>{ const k=`${m.lesson} > ${m.topic}`; if(!map[k]) map[k]={key:k, lesson:m.lesson, topic:m.topic, count:0, reasons:{}}; map[k].count+=m.count; map[k].reasons[m.reason]=(map[k].reasons[m.reason]||0)+m.count; })); return Object.values(map).sort((a,b)=>priorityScore(b)-priorityScore(a)); }
function priorityScore(x){ const reasonWeight=Object.entries(x.reasons).reduce((a,[r,c])=>a+c*({"Konu eksiği":3,"Bilgi hatası":2.7,"Boş bıraktım":2.3,"Süre yetmedi":2,"İki şık arasında kaldım":1.8,"İşlem hatası":1.5,"Dikkat hatası":1.2}[r]||1),0); return +(x.count*2 + reasonWeight).toFixed(1); }
function makeChart(id,type,data,options={}){ if(charts[id]) charts[id].destroy(); charts[id]=new Chart($(id),{type,data,options:{responsive:true,plugins:{legend:{labels:{color:'#dbeafe'}}},scales:{x:{ticks:{color:'#9fb0c8'},grid:{color:'rgba(255,255,255,.08)'}},y:{ticks:{color:'#9fb0c8'},grid:{color:'rgba(255,255,255,.08)'}}},...options}}); }
function render(){
  const sorted=[...exams].sort((a,b)=>new Date(a.date)-new Date(b.date)); const last=sorted.at(-1); const prev=sorted.at(-2);
  $("examCount").textContent=exams.length; $("printDate").textContent = new Date().toLocaleDateString('tr-TR') + ' tarihinde oluşturuldu';
  const totals=sorted.map(totalNet); const best=totals.length?Math.max(...totals):0; $("bestNet").textContent=best.toFixed(2); $("lastNet").textContent=last?totalNet(last).toFixed(2):"0.00";
  $("lastNetDiff").textContent = last&&prev ? `${totalNet(last)-totalNet(prev)>=0?'+':''}${(totalNet(last)-totalNet(prev)).toFixed(2)} net önceki denemeye göre` : "Henüz karşılaştırma yok";
  const priorities=aggregateMistakes(); $("priorityTopic").textContent=priorities[0]?.topic || "-"; $("priorityReason").textContent=priorities[0]?`${priorities[0].count} tekrar / skor ${priorityScore(priorities[0])}`:"Veri bekleniyor";
  makeChart('netChart','line',{labels:sorted.map(e=>e.name),datasets:[{label:'Toplam Net',data:totals,tension:.35,fill:true}]});
  makeChart('lessonChart','bar',{labels:Object.keys(LESSONS),datasets:[{label:'Son deneme neti',data:Object.keys(LESSONS).map(l=>last?last.scores[l].n:0)}]});
  const reasonMap={}; exams.forEach(e=>e.mistakes.forEach(m=>reasonMap[m.reason]=(reasonMap[m.reason]||0)+m.count)); makeChart('reasonChart','doughnut',{labels:Object.keys(reasonMap),datasets:[{label:'Yanlış nedeni',data:Object.values(reasonMap)}]},{scales:{}});
  renderPriorities(priorities); renderTable(sorted); renderAnalysis(sorted,priorities);
}
function renderPriorities(list){ const max=Math.max(1,...list.map(priorityScore)); $("priorityList").innerHTML = list.slice(0,8).map(x=>`<div class="priority-item"><b>${x.key}</b><br><small>${x.count} tekrar • nedenler: ${Object.entries(x.reasons).map(([r,c])=>`${r} ${c}`).join(', ')}</small><div class="bar"><span style="width:${priorityScore(x)/max*100}%"></span></div></div>`).join('') || '<p>Henüz konu yanlış verisi yok.</p>'; }
function renderTable(sorted){ $("examTable").innerHTML = `<thead><tr><th>Tarih</th><th>Deneme</th><th>Türkçe</th><th>Matematik</th><th>Sosyal</th><th>Fen</th><th>Toplam</th><th>Fark</th><th>Süre</th></tr></thead><tbody>` + sorted.map((e,i)=>{ const diff=i? totalNet(e)-totalNet(sorted[i-1]):0; return `<tr><td>${e.date}</td><td>${e.name}</td>${Object.keys(LESSONS).map(l=>`<td>${e.scores[l].n}</td>`).join('')}<td><b>${totalNet(e)}</b></td><td>${i? (diff>=0?'+':'')+diff.toFixed(2):'-'}</td><td>${e.time}</td></tr>`}).join('') + `</tbody>`; }
function renderAnalysis(sorted,priorities){
  if(!sorted.length){ $("smartAnalysis").innerHTML='<p>Örnek veri yükleyerek sistemi görebilirsin. Kendi denemelerini ekleyince analiz gerçek veriye göre değişir.</p>'; return; }
  const last=sorted.at(-1), prev=sorted.at(-2); const total=totalNet(last); const weakLesson=Object.entries(last.scores).sort((a,b)=>a[1].n-b[1].n)[0]; const trend=prev?total-totalNet(prev):0;
  const top=priorities[0];
  $("smartAnalysis").innerHTML = `<p><b>Genel durum:</b> Son denemede toplam netin <b>${total.toFixed(2)}</b>. ${prev?`Önceki denemeye göre <b>${trend>=0?'+':''}${trend.toFixed(2)}</b> net değişim var.`:'Karşılaştırma için en az iki deneme gerekir.'}</p><p><b>En zayıf ders sinyali:</b> ${weakLesson[0]} şu an ${weakLesson[1].n} net ile en çok dikkat isteyen alan görünüyor. Bu dersin yanlışlarını konu bazında girersen sistem daha keskin karar verir.</p>${top?`<p><b>Öncelikli çalışma konusu:</b> ${top.lesson} dersinde <b>${top.topic}</b>. Bu konu ${top.count} kez tekrar etmiş. En baskın neden: <b>${Object.entries(top.reasons).sort((a,b)=>b[1]-a[1])[0][0]}</b>. Bu yüzden önce kısa konu tekrarı, sonra 20-30 soru hedefli mini test önerilir.</p>`:''}<p><b>Karar:</b> Dikkat hatası çoğalıyorsa çözüm sonrası kontrol rutini; konu eksiği çoğalıyorsa özet + temel test; süre yetmiyorsa branş denemesi ve zaman blokları uygulanmalı.</p>`;
}
$("loadDemoBtn").addEventListener("click",()=>{ exams=[
{id:1,name:'TYT Deneme 1',date:'2026-04-05',time:'Yetişmedi',note:'Matematik zorladı',scores:{'Türkçe':{d:25,y:8,b:7,n:23},'Matematik':{d:9,y:0,b:31,n:9},'Sosyal':{d:15,y:4,b:1,n:14},'Fen':{d:14,y:5,b:1,n:12.75}},mistakes:[{lesson:'Matematik',topic:'Problemler',reason:'Konu eksiği',count:4},{lesson:'Fizik',topic:'Fizik Bilimine Giriş',reason:'Dikkat hatası',count:1},{lesson:'Türkçe',topic:'Paragraf',reason:'Süre yetmedi',count:3}]},
{id:2,name:'TYT Deneme 2',date:'2026-04-18',time:'Son 10 dk zorladı',note:'Fen biraz daha iyi',scores:{'Türkçe':{d:27,y:6,b:7,n:25.5},'Matematik':{d:12,y:2,b:26,n:11.5},'Sosyal':{d:16,y:3,b:1,n:15.25},'Fen':{d:15,y:4,b:1,n:14}},mistakes:[{lesson:'Matematik',topic:'Problemler',reason:'İki şık arasında kaldım',count:3},{lesson:'Kimya',topic:'Kimya',reason:'Bilgi hatası',count:2},{lesson:'Türkçe',topic:'Yazım-Noktalama',reason:'Dikkat hatası',count:2}]},
{id:3,name:'TYT Deneme 3',date:'2026-05-01',time:'Yetişti',note:'Türkçe toparladı',scores:{'Türkçe':{d:30,y:5,b:5,n:28.75},'Matematik':{d:15,y:3,b:22,n:14.25},'Sosyal':{d:17,y:2,b:1,n:16.5},'Fen':{d:15,y:3,b:2,n:14.25}},mistakes:[{lesson:'Matematik',topic:'Problemler',reason:'Konu eksiği',count:2},{lesson:'Matematik',topic:'Geometri',reason:'Boş bıraktım',count:3},{lesson:'Fen',topic:'Optik',reason:'Konu eksiği',count:2}]}]; save(); render(); });
$("clearBtn").addEventListener("click",()=>{ if(confirm('Tüm kayıtlar silinsin mi?')){exams=[];save();render();} });
$("printBtn").addEventListener("click",()=>window.print());
setup();
