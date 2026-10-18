// Public page a provider opens from a WelliBridge link. No account. Steps: see who shared it,
// get a code, enter the code, read the record. All text is written with textContent.
const STYLE = `
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f7f6;color:#0f172a;line-height:1.45}
main{max-width:720px;margin:0 auto;padding:20px 16px 48px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 8px;color:#0f766e}
.card{background:#fff;border:1px solid #dbe4e1;border-radius:12px;padding:16px;margin-top:14px}
.muted{color:#52625e;font-size:14px}.err{color:#b91c1c;font-size:14px;margin-top:8px;min-height:18px}
input{font-size:22px;letter-spacing:6px;text-align:center;width:100%;padding:12px;border:1px solid #9fb3ad;border-radius:10px;margin-top:10px}
button{font-size:16px;padding:12px 18px;border-radius:10px;border:0;background:#0f766e;color:#fff;margin-top:12px;cursor:pointer}
button.alt{background:#fff;color:#0f766e;border:1px solid #0f766e;margin-left:8px}
button:disabled{opacity:.5;cursor:default}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e5ecea;vertical-align:top}
.row{display:flex;gap:8px;flex-wrap:wrap}.row div{flex:1 1 140px}.lbl{font-size:12px;color:#52625e;text-transform:uppercase}
.hidden{display:none}.note{font-size:13px;color:#52625e;margin-top:18px}
@media print{button,.noprint{display:none!important}body{background:#fff}.card{border:0;padding:0}}
`;

const JS = `
(function(){
var token=location.pathname.split('/').pop();
var base='/api/v1/provider-share/'+encodeURIComponent(token);
var session=null;
var $=function(id){return document.getElementById(id)};
function show(id){['s-load','s-dead','s-code','s-rec'].forEach(function(x){$(x).classList.toggle('hidden',x!==id)})}
function el(tag,text,cls){var e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=String(text);if(cls)e.className=cls;return e}
function api(method,path,body,auth){
  var h={'Content-Type':'application/json'};if(auth)h.Authorization='Bearer '+auth;
  return fetch(base+path,{method:method,headers:h,body:body?JSON.stringify(body):undefined}).then(function(r){
    return r.json().catch(function(){return {}}).then(function(j){j.__status=r.status;return j})});
}
function dead(msg){$('dead-msg').textContent=msg;show('s-dead')}
var info=null;
function loadInfo(){
  api('GET','/info').then(function(j){
    if(!j.success){dead(j.message||'This link is not valid.');return}
    info=j;
    $('who').textContent=j.recipientName;
    $('exp').textContent='This link works until '+new Date(j.expiresAt).toLocaleString()+'.';
    if(j.mode==='passcode'){
      $('code-help').textContent='Enter the 6-digit passcode the patient gave you.';
      $('send').classList.add('hidden');
    }else{
      $('code-help').textContent='We send a 6-digit code to '+j.sentTo+'. Press the button to get it.';
    }
    show('s-code');
  }).catch(function(){dead('Could not reach the server. Check your connection and reload.')});
}
$('send').addEventListener('click',function(){
  $('code-err').textContent='';$('send').disabled=true;
  api('POST','/otp').then(function(j){
    $('send').disabled=false;
    if(j.success){$('code-help').textContent='Code sent to '+j.sentTo+'. It works for 10 minutes.';$('send').textContent='Send a new code'}
    else $('code-err').textContent=j.message||'Could not send the code.';
  });
});
$('go').addEventListener('click',function(){
  var code=$('code').value.replace(/\\D/g,'');
  if(code.length!==6){$('code-err').textContent='Enter the 6-digit code.';return}
  $('go').disabled=true;$('code-err').textContent='';
  api('POST','/verify',{code:code}).then(function(j){
    $('go').disabled=false;
    if(j.success){session=j.session;$('code').value='';loadRecord()}
    else if(j.__status===410){dead(j.message)}
    else{$('code-err').textContent=(j.message||'That code is not right.')+(typeof j.attemptsLeft==='number'?' Tries left: '+j.attemptsLeft+'.':'')}
  });
});
function kv(parent,label,val){if(!val)return;var d=el('div');d.appendChild(el('div',label,'lbl'));d.appendChild(el('div',val));parent.appendChild(d)}
function table(parent,heads,rows){
  var t=el('table'),tr=el('tr');heads.forEach(function(h){tr.appendChild(el('th',h))});t.appendChild(tr);
  rows.forEach(function(r){var x=el('tr');r.forEach(function(c){x.appendChild(el('td',c))});t.appendChild(x)});parent.appendChild(t);
}
function section(root,title){root.appendChild(el('h2',title))}
function render(r){
  var root=$('rec');root.textContent='';
  var p=r.patient||{};
  root.appendChild(el('h1',p.name||'Patient'));
  var row=el('div',null,'row');
  kv(row,'WelliID',p.wrId);kv(row,'Date of birth',p.dateOfBirth);kv(row,'Sex',p.sex);kv(row,'Blood group',p.bloodType);kv(row,'Genotype',p.genotype);
  root.appendChild(row);
  if(r.purpose)root.appendChild(el('p','Reason shared: '+r.purpose,'muted'));
  if(r.allergies!==undefined){section(root,'Allergies');root.appendChild(el('p',r.allergies||'None recorded'))}
  if(r.conditions!==undefined){section(root,'Conditions');root.appendChild(el('p',r.conditions||'None recorded'))}
  if(r.medications){section(root,'Medications');
    if(!r.medications.length)root.appendChild(el('p','None recorded'));
    else table(root,['Medicine','Dose','How often','Prescriber'],r.medications.map(function(m){return [m.name,m.dosage,m.frequency,m.prescriber]}))}
  if(r.vaccinations){section(root,'Vaccines');
    if(!r.vaccinations.length)root.appendChild(el('p','None recorded'));
    else table(root,['Vaccine','Date','Checked by a clinic'],r.vaccinations.map(function(v){return [v.name,v.date,v.confirmed?'Yes':'Parent reported']}))}
  if(r.growth){section(root,'Growth');
    if(!r.growth.length)root.appendChild(el('p','None recorded'));
    else table(root,['Date','Weight kg','Length/height cm','Head cm'],r.growth.map(function(g){return [g.date,g.weightKg==null?'':g.weightKg,g.lengthCm==null?'':g.lengthCm,g.headCm==null?'':g.headCm]}))}
  if(r.records){section(root,'Records');
    if(!r.records.length)root.appendChild(el('p','None recorded'));
    r.records.forEach(function(x){
      var c=el('div',null,'card');c.appendChild(el('strong',x.title));
      c.appendChild(el('div',[x.type,x.date,x.provider].filter(Boolean).join(' · '),'muted'));
      if(x.summary)c.appendChild(el('p',x.summary));
      if(x.lab){
        if(x.lab.interpretation)c.appendChild(el('p',x.lab.interpretation));
        if(x.lab.biomarkers&&x.lab.biomarkers.length)table(c,['Test','Result','Range'],x.lab.biomarkers.map(function(b){return [b.name||b.biomarker||'',[b.value,b.unit].filter(Boolean).join(' '),b.referenceRange||b.range||'']}));
      }
      if(x.hasAttachment)c.appendChild(el('p','The patient holds a scan or document for this entry that is not included in this link.','muted'));
      root.appendChild(c);
    })}
  root.appendChild(el('p',r.note,'note'));
}
function loadRecord(){
  api('GET','/record',null,session).then(function(j){
    if(j.success){render(j);show('s-rec');
      var left=Math.round(15);$('sess').textContent='This view closes after '+left+' minutes. Print or save what you need, then close the page.'}
    else if(j.__status===410)dead(j.message);
    else{session=null;show('s-code');$('code-err').textContent=j.message||'Enter the code again.'}
  });
}
$('print').addEventListener('click',function(){window.print()});
loadInfo();
})();
`;

export function providerSharePage(nonce: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Shared health record</title><style nonce="${nonce}">${STYLE}</style></head><body><main>
<div id="s-load" class="card">Loading…</div>
<div id="s-dead" class="card hidden"><h1>Link not available</h1><p id="dead-msg" class="muted"></p></div>
<div id="s-code" class="card hidden">
<h1>A patient shared health information with <span id="who"></span></h1>
<p class="muted" id="exp"></p>
<p id="code-help"></p>
<button id="send" type="button">Send me the code</button>
<input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000" aria-label="6-digit code">
<div><button id="go" type="button">Open record</button></div>
<div id="code-err" class="err" role="alert"></div>
</div>
<div id="s-rec" class="hidden"><div class="noprint"><button id="print" type="button">Print</button> <span id="sess" class="muted"></span></div><div id="rec" class="card"></div></div>
</main><script nonce="${nonce}">${JS}</script></body></html>`;
}
