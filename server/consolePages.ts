// Staff web pages served by this backend: /clinic and /admin/orders.
// Both sign in with a staff account (password, then the authenticator code) and call the normal
// API with the staff token. No shared secret is typed into either page. The token is held in page
// memory only, so closing the tab signs out.
import crypto from 'crypto';
import type { Request, Response } from 'express';

const STYLE = String.raw`
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F8FAFC;margin:0;padding:24px;color:#0F172A}
.wrap{max-width:760px;margin:0 auto}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:0 0 10px}
.sub{color:#64748B;font-size:13px;margin-bottom:20px}
.card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:16px}
label{display:block;font-size:12.5px;font-weight:600;margin:10px 0 4px}
input,select,textarea{width:100%;padding:9px 11px;border:1px solid #CBD5E1;border-radius:8px;font-size:14px;font-family:inherit}
button{background:#041E42;color:#fff;border:0;padding:10px 16px;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;margin-top:12px}
button.alt{background:#fff;color:#041E42;border:1px solid #CBD5E1}
button.ok{background:#059669}button.no{background:#fff;color:#B91C1C;border:1px solid #FECACA}
.err{color:#B91C1C;font-size:13px;margin-top:8px}
.msg{font-size:13px;padding:9px 12px;border-radius:8px;margin-bottom:12px}
.msg.good{background:#ECFDF5;color:#065F46;border:1px solid #A7F3D0}
.msg.bad{background:#FEF2F2;color:#991B1B;border:1px solid #FECACA}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mono{font-family:ui-monospace,Menlo,monospace;font-size:15px;background:#F1F5F9;padding:8px 10px;border-radius:8px;word-break:break-all}
.item{border-top:1px solid #EEF2F6;padding:8px 0;font-size:13.5px}
.tag{display:inline-block;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;margin-left:6px}
.tag.v{background:#DCFCE7;color:#166534}.tag.p{background:#FEF3C7;color:#92400E}
.nt{margin-top:0}.sp{margin-left:8px}details{margin-top:10px}#rcodes{white-space:pre-line}#list{margin-top:14px}.gap{margin-top:18px}.hide{display:none}.top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.muted{color:#64748B;font-size:12.5px}
input.chk{width:auto;margin-right:6px}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.step{background:#F1F5F9;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.45}
.step strong{display:block;margin-bottom:2px}
h3.sec{font-size:14px;margin:22px 0 4px;padding-top:14px;border-top:1px solid #EEF2F6}
label.inl{display:flex;align-items:center;gap:6px;font-weight:600;margin:10px 0 4px}
label.inl input.chk{margin:0}
.opt{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:4px 12px 12px}
.days{display:grid}
.day{display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:center;padding:8px 0;border-top:1px solid #EEF2F6}
.day label.inl{margin:0}
.win{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13.5px;margin:2px 0}
.win input{width:auto}
.closed{color:#94A3B8;font-size:13px}
.vid{background:#0F172A;border-radius:10px;min-height:240px;overflow:hidden;margin-bottom:10px}.vid video{width:100%;max-height:420px;display:block}.vid.small{min-height:0;max-width:200px}.vid.small video{max-height:140px}
button.sm{padding:5px 10px;margin:0 0 0 6px;font-size:12px}
.ready{list-style:none;padding:0;margin:8px 0}
.ready li{font-size:13.5px;padding:3px 0}
.ready li.okk{color:#065F46}.ready li.bad{color:#991B1B}
.preview{background:#F8FAFC;border:1px dashed #CBD5E1;border-radius:10px;padding:12px;font-size:13.5px;line-height:1.6}
@media(max-width:560px){.row,.steps{grid-template-columns:1fr}.day{grid-template-columns:1fr}}
`;

// Sign-in flow shared by both pages. Calls window.onSignedIn(staff) once a full session exists.
const AUTH_HTML = String.raw`
<div id="auth">
  <div class="card" id="v-login">
    <h2>Staff sign-in</h2>
    <label for="em">Email</label><input id="em" type="email" autocomplete="username">
    <label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password">
    <button id="b-login">Continue</button><div class="err" id="e-login"></div>
  </div>
  <div class="card hide" id="v-mfa">
    <h2>Second step</h2>
    <p class="muted">Enter the 6-digit code from your authenticator app.</p>
    <label for="mc">Code</label><input id="mc" inputmode="numeric" autocomplete="one-time-code" maxlength="8">
    <button id="b-mfa">Sign in</button>
    <details><summary class="muted">Lost your phone? Use a recovery code</summary>
      <label for="rc">Recovery code</label><input id="rc" autocomplete="off">
      <button class="alt" id="b-rec">Use recovery code</button></details>
    <div class="err" id="e-mfa"></div>
  </div>
  <div class="card hide" id="v-pass">
    <h2>Choose a new password</h2>
    <p class="muted">Your password was set by an admin. Pick one only you know (at least 12 characters).</p>
    <label for="p0">Current password</label><input id="p0" type="password" autocomplete="current-password">
    <label for="p1">New password</label><input id="p1" type="password" autocomplete="new-password">
    <button id="b-pass">Change password</button><div class="err" id="e-pass"></div>
  </div>
  <div class="card hide" id="v-setup">
    <h2>Set up your authenticator</h2>
    <p class="muted">Add a new account in an authenticator app (Google Authenticator, Microsoft Authenticator, Authy). Choose "enter a setup key" and type this key. Time-based, 6 digits.</p>
    <div class="mono" id="sk"></div>
    <p class="muted">On a phone you can also <a id="sl" href="#">open the key in your authenticator</a>.</p>
    <label for="sc">First code from the app</label><input id="sc" inputmode="numeric" maxlength="8">
    <button id="b-setup">Turn on</button><div class="err" id="e-setup"></div>
  </div>
  <div class="card hide" id="v-codes">
    <h2>Save your recovery codes</h2>
    <p class="muted">Each code works once if you lose your phone. They are shown only now. Store them somewhere safe, not on the same phone.</p>
    <div class="mono" id="rcodes"></div>
    <button id="b-codes">I have saved them</button>
  </div>
</div>`;

const AUTH_JS = String.raw`
var S={token:null,staff:null,mfaToken:null};
function $(i){return document.getElementById(i)}
function show(id){['v-login','v-mfa','v-pass','v-setup','v-codes'].forEach(function(v){$(v).classList.toggle('hide',v!==id)})}
function say(id,t){$(id).textContent=t||''}
async function api(path,opts){
  opts=opts||{};var h={'Content-Type':'application/json'};
  if(S.token)h['Authorization']='Bearer '+S.token;
  var r=await fetch('/api/v1'+path,{method:opts.method||'GET',headers:h,body:opts.body?JSON.stringify(opts.body):undefined});
  var d={};try{d=await r.json()}catch(e){}
  d._status=r.status;return d;
}
function signedIn(d){
  S.token=d.token;S.staff=d.staff;
  if(S.staff.mustChangePassword){show('v-pass');return}
  if(d.mfaSetupRequired&&!S.staff.mfaEnabled){startSetup();return}
  $('auth').classList.add('hide');window.onSignedIn(S.staff);
}
async function startSetup(){
  show('v-setup');var d=await api('/staff/mfa/setup',{method:'POST',body:{}});
  if(!d.success){say('e-setup',d.message||'Could not start setup');return}
  $('sk').textContent=d.secret;$('sl').setAttribute('href',d.otpauthUrl);
}
$('b-login').onclick=async function(){
  say('e-login','');
  var d=await api('/staff/auth/login',{method:'POST',body:{email:$('em').value,password:$('pw').value}});
  if(!d.success){say('e-login',d.message||'Could not sign in');return}
  $('pw').value='';
  if(d.mfaRequired){S.mfaToken=d.mfaToken;show('v-mfa');return}
  signedIn(d);
};
async function mfaStep(body){
  say('e-mfa','');body.mfaToken=S.mfaToken;
  var d=await api('/staff/auth/mfa',{method:'POST',body:body});
  if(!d.success){say('e-mfa',d.message||'That code is not right.');return}
  signedIn(d);
}
$('b-mfa').onclick=function(){mfaStep({code:$('mc').value})};
$('b-rec').onclick=function(){mfaStep({recoveryCode:$('rc').value})};
$('b-pass').onclick=async function(){
  say('e-pass','');
  var d=await api('/staff/auth/change-password',{method:'POST',body:{currentPassword:$('p0').value,newPassword:$('p1').value}});
  if(!d.success){say('e-pass',d.message||'Could not change the password');return}
  $('p0').value='';$('p1').value='';
  S.token=d.token;S.staff=d.staff;
  if(!S.staff.mfaEnabled){startSetup();return}
  $('auth').classList.add('hide');window.onSignedIn(S.staff);
};
$('b-setup').onclick=async function(){
  say('e-setup','');
  var d=await api('/staff/mfa/enable',{method:'POST',body:{code:$('sc').value}});
  if(!d.success){say('e-setup',d.message||'That code is not right.');return}
  S.token=d.token;S.staff=d.staff;
  $('rcodes').textContent=d.recoveryCodes.join('\n');show('v-codes');
};
$('b-codes').onclick=function(){$('rcodes').textContent='';$('auth').classList.add('hide');window.onSignedIn(S.staff)};
function signOut(){S.token=null;S.staff=null;location.reload()}
`;

const CLINIC_HTML = String.raw`
<div class="wrap">
  <div class="top"><div><h1>WelliRecord clinic</h1><div class="sub">Open a child's record with the WelliID and the code the parent gives you.</div></div>
    <div id="who" class="muted hide"></div></div>
  ${'__AUTH__'}
  <div id="app" class="hide">
    <div id="note" class="msg hide"></div>
    <div class="card" id="open">
      <h2>Open a record</h2>
      <div class="row">
        <div><label for="wr">WelliID</label><input id="wr" autocomplete="off"></div>
        <div><label for="cd">Parent's code (8 characters)</label><input id="cd" autocomplete="off" maxlength="12"></div>
      </div>
      <button id="b-open">Open record</button><button class="alt sp" id="b-out">Sign out</button>
      <div class="err" id="e-open"></div>
    </div>
    <div id="rec" class="hide">
      <div class="card">
        <div class="top"><h2 id="cn"></h2><button class="alt nt" id="b-close">Close record</button></div>
        <div class="muted" id="cm"></div>
        <div class="muted" id="ce"></div>
      </div>
      <div class="card"><h2>Vaccinations</h2><div id="vl"></div></div>
      <div class="card"><h2>Measurements</h2><div id="gl"></div></div>
      <div class="card" id="f-vax">
        <h2>Record a vaccine</h2>
        <label for="vc">Vaccine</label><select id="vc"></select>
        <div class="row">
          <div><label for="vd">Date given (YYYY-MM-DD)</label><input id="vd" placeholder="2026-10-17"></div>
          <div><label for="vl2">Batch or lot number</label><input id="vl2"></div>
          <div><label for="vm">Manufacturer</label><input id="vm"></div>
          <div><label for="ve">Expiry date (YYYY-MM-DD)</label><input id="ve"></div>
          <div><label for="vs">Site</label><input id="vs" placeholder="left thigh"></div>
          <div><label for="vr">Reaction, if any</label><input id="vr"></div>
        </div>
        <p class="muted">If the parent already recorded this dose, saving confirms it with your values.</p>
        <button id="b-vax">Save vaccine</button><div class="err" id="e-vax"></div>
      </div>
      <div class="card" id="f-gr">
        <h2>Record a measurement</h2>
        <div class="row">
          <div><label for="gd">Date measured (YYYY-MM-DD)</label><input id="gd" placeholder="2026-10-17"></div>
          <div><label for="gw">Weight (kg)</label><input id="gw" inputmode="decimal"></div>
          <div><label for="gl2">Length or height (cm)</label><input id="gl2" inputmode="decimal"></div>
          <div><label for="gh">Head circumference (cm)</label><input id="gh" inputmode="decimal"></div>
        </div>
        <label for="gn">Notes</label><input id="gn">
        <button id="b-gr">Save measurement</button><div class="err" id="e-gr"></div>
      </div>
    </div>

    <div id="admin" class="hide">
      <div class="card">
        <h2>Staff accounts</h2>
        <div id="sl-list"></div>
        <h2 class="gap">Add a person</h2>
        <div class="row">
          <div><label for="an">Name</label><input id="an"></div>
          <div><label for="ae">Email</label><input id="ae" type="email"></div>
          <div><label for="ar">Role</label><select id="ar"><option>clinician</option><option>records_officer</option><option>pharmacist</option><option>admin</option></select></div>
          <div><label for="ao">Organisation</label><input id="ao"></div>
        </div>
        <button id="b-add">Create account</button><div class="err" id="e-add"></div>
        <div id="temp" class="hide"><p class="muted">Give this one-time password to the person. They must change it at first sign-in. It will not be shown again.</p><div class="mono" id="tp"></div></div>
      </div>
      <div class="card"><div class="top"><h2>Recent staff actions</h2><button class="alt nt" id="b-log">Refresh</button></div><div id="log"></div></div>
    </div>
  </div>
</div>`;

const CLINIC_JS = String.raw`
var cur={wrId:'',code:''};
function add(parent,tag,text,cls){var e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;parent.appendChild(e);return e}
function note(t,good){var n=$('note');n.textContent=t;n.className='msg '+(good?'good':'bad');setTimeout(function(){n.className='msg hide'},6000)}
window.onSignedIn=async function(staff){
  $('app').classList.remove('hide');$('who').classList.remove('hide');
  $('who').textContent=staff.name+' ('+staff.role.replace('_',' ')+')';
  if(staff.role==='admin')showAdmin();
  if(['admin','clinician','records_officer'].indexOf(staff.role)<0){
    $('open').classList.add('hide');note('This account cannot open child records. Ask an admin for the clinician or records officer role.',false);return}
  var s=await fetch('/api/v1/immunization/schedule').then(function(r){return r.json()}).catch(function(){return null});
  if(s&&s.success){
    var sel=$('vc');s.schedule.doses.forEach(function(d){var o=document.createElement('option');o.value=d.code;o.textContent=d.vaccine+(d.doseNumber?' dose '+d.doseNumber:'');sel.appendChild(o)});
    if(s.schedule.reviewStatus!=='reviewed')note('The vaccine list is waiting for clinical review. Check each dose against the national schedule.',false);
  }
};
$('b-out').onclick=signOut;
// ----- admin: staff accounts and action log -----
function showAdmin(){$('admin').classList.remove('hide');loadStaff();loadLog()}
async function loadStaff(){
  var d=await api('/staff/users');var l=$('sl-list');l.textContent='';
  if(!d.success){add(l,'div',d.message||'Could not load staff.','msg bad');return}
  d.staff.forEach(function(u){
    var i=add(l,'div',null,'item');
    add(i,'b',u.name);add(i,'span',' '+u.email+' · '+u.role.replace('_',' ')+(u.organization?' · '+u.organization:''),'muted');
    add(i,'span',u.status==='active'?'Active':'Disabled','tag '+(u.status==='active'?'v':'p'));
    add(i,'span',u.mfaEnabled?'MFA on':'MFA off','tag '+(u.mfaEnabled?'v':'p'));
    var row=add(i,'div');
    var sel=add(row,'select');['clinician','records_officer','pharmacist','admin'].forEach(function(r){var o=add(sel,'option',r);o.value=r;if(r===u.role)o.selected=true});
    sel.onchange=function(){act(u,'/staff/users/'+u.id,'PATCH',{role:sel.value},'Role changed. Their open sessions ended.')};
    var t=add(row,'button',u.status==='active'?'Disable':'Enable','alt sp');
    t.onclick=function(){act(u,'/staff/users/'+u.id,'PATCH',{status:u.status==='active'?'disabled':'active'},'Account updated.')};
    var p=add(row,'button','Reset password','alt sp');
    p.onclick=async function(){if(!confirm('Reset the password for '+u.name+'? Their sessions end.'))return;
      var r=await api('/staff/users/'+u.id+'/reset-password',{method:'POST',body:{}});
      if(r.success){tempShow(r.temporaryPassword)}else note(r.message||'Failed.',false)};
    if(u.mfaEnabled){var m=add(row,'button','Reset MFA','alt sp');
      m.onclick=function(){if(confirm('Remove the authenticator for '+u.name+'? They set it up again at next sign-in.'))act(u,'/staff/users/'+u.id+'/reset-mfa','POST',{},'MFA reset.')}}
  });
}
function tempShow(pw){$('tp').textContent=pw;$('temp').classList.remove('hide')}
async function act(u,path,method,body,okText){
  var r=await api(path,{method:method,body:body});
  if(r.success){note(okText,true)}else note(r.message||'Failed.',false);
  loadStaff();loadLog();
}
$('b-add').onclick=async function(){
  say('e-add','');$('temp').classList.add('hide');
  var r=await api('/staff/users',{method:'POST',body:{name:$('an').value,email:$('ae').value,role:$('ar').value,organization:$('ao').value}});
  if(!r.success){say('e-add',r.message||'Could not create the account');return}
  ['an','ae','ao'].forEach(function(i){$(i).value=''});tempShow(r.temporaryPassword);loadStaff();loadLog();
};
async function loadLog(){
  var d=await api('/staff/actions');var l=$('log');l.textContent='';
  if(!d.success){add(l,'div',d.message||'Could not load the log.','muted');return}
  if(!d.actions.length)add(l,'div','Nothing yet.','muted');
  d.actions.slice(0,50).forEach(function(a){
    var i=add(l,'div',null,'item');
    add(i,'span',new Date(a.createdAt).toLocaleString()+'  '+a.staffName+' ('+a.role+'): '+a.action);
    var bits=[a.target,a.detail,a.legacy?'legacy secret':''].filter(Boolean).join(' · ');
    if(bits)add(i,'div',bits,'muted');
  });
}
$('b-log').onclick=loadLog;
async function openRec(){
  say('e-open','');
  var d=await api('/facility/child/lookup',{method:'POST',body:{wrId:cur.wrId,code:cur.code}});
  if(!d.success){say('e-open',d.message||'Could not open the record');return false}
  render(d);return true;
}
$('b-open').onclick=async function(){
  cur.wrId=$('wr').value.trim();cur.code=$('cd').value.trim();
  if(await openRec()){$('cd').value=''}
};
$('b-close').onclick=function(){cur={wrId:'',code:''};$('rec').classList.add('hide');$('open').classList.remove('hide');$('wr').value=''};
function render(d){
  $('open').classList.add('hide');$('rec').classList.remove('hide');
  $('cn').textContent=d.child.name;
  $('cm').textContent='WelliID '+(d.child.wrId||'')+' · Born '+(d.child.dateOfBirth||'unknown');
  $('ce').textContent='Allergies: '+(d.child.allergies||'none recorded')+' · Code valid until '+new Date(d.expiresAt).toLocaleString();
  var vl=$('vl');vl.textContent='';var gl=$('gl');gl.textContent='';
  var res=(d.bundle.entry||[]).map(function(e){return e.resource});
  var imm=res.filter(function(r){return r.resourceType==='Immunization'}).sort(function(a,b){return String(a.occurrenceDateTime).localeCompare(String(b.occurrenceDateTime))});
  if(!imm.length)add(vl,'div','None recorded.','muted');
  imm.forEach(function(r){var i=add(vl,'div',null,'item');add(i,'span',(r.occurrenceDateTime||'')+'  '+r.vaccineCode.text);
    add(i,'span',r.primarySource?'Confirmed':'Reported by parent','tag '+(r.primarySource?'v':'p'));
    var bits=[r.lotNumber&&'lot '+r.lotNumber,r.manufacturer&&r.manufacturer.display,r.location&&r.location.display].filter(Boolean).join(' · ');
    if(bits)add(i,'div',bits,'muted')});
  var obs=res.filter(function(r){return r.resourceType==='Observation'}).sort(function(a,b){return String(b.effectiveDateTime).localeCompare(String(a.effectiveDateTime))});
  if(!obs.length)add(gl,'div','None recorded.','muted');
  obs.forEach(function(r){var i=add(gl,'div',null,'item');add(i,'span',r.effectiveDateTime+'  '+r.code.text+': '+r.valueQuantity.value+' '+r.valueQuantity.unit);
    var v=(r.meta&&r.meta.tag||[]).some(function(t){return /provider/.test(t.code||'')});
    add(i,'span',v?'Clinic':'Parent','tag '+(v?'v':'p'))});
}
async function save(path,body,errId,okText,clear){
  say(errId,'');body.wrId=cur.wrId;body.code=cur.code;
  var d=await api(path,{method:'POST',body:body});
  if(!d.success){say(errId,d.message||'Could not save');return}
  clear.forEach(function(i){$(i).value=''});note(okText,true);openRec();
}
$('b-vax').onclick=function(){save('/facility/child/vaccinations',{vaccineCode:$('vc').value,administeredDate:$('vd').value.trim(),lotNumber:$('vl2').value,manufacturer:$('vm').value,expiryDate:$('ve').value.trim(),site:$('vs').value,reaction:$('vr').value},'e-vax','Vaccine saved. The parent has been told.',['vd','vl2','vm','ve','vs','vr'])};
$('b-gr').onclick=function(){save('/facility/child/growth',{measuredOn:$('gd').value.trim(),weightKg:$('gw').value,lengthCm:$('gl2').value,headCircumferenceCm:$('gh').value,notes:$('gn').value},'e-gr','Measurement saved. The parent has been told.',['gd','gw','gl2','gh','gn'])};
`;

const ORDERS_HTML = String.raw`
<div class="wrap">
  <div class="top"><div><h1>Medication order review</h1><div class="sub">Orders pending pharmacist approval.</div></div><div id="who" class="muted hide"></div></div>
  ${'__AUTH__'}
  <div id="app" class="hide">
    <div id="note" class="msg hide"></div>
    <button class="alt" id="b-ref">Refresh</button> <button class="alt" id="b-out">Sign out</button>
    <div id="list"></div>
  </div>
</div>`;

const ORDERS_JS = String.raw`
function add(parent,tag,text,cls){var e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;parent.appendChild(e);return e}
function note(t,good){var n=$('note');n.textContent=t;n.className='msg '+(good?'good':'bad');setTimeout(function(){n.className='msg hide'},5000)}
window.onSignedIn=function(staff){
  $('app').classList.remove('hide');$('who').classList.remove('hide');$('who').textContent=staff.name+' ('+staff.role.replace('_',' ')+')';load();
};
$('b-out').onclick=signOut;$('b-ref').onclick=function(){load()};
async function load(){
  var l=$('list');l.textContent='Loading...';
  var d=await api('/pharmacy/orders/pending');
  l.textContent='';
  if(!d.success){add(l,'div',d.message||'Could not load orders.','msg bad');return}
  if(!d.orders.length){add(l,'div','No orders pending review.','muted');return}
  d.orders.forEach(function(o){
    var c=add(l,'div',null,'card');
    add(c,'h2',o.medicationName||'Unnamed medication');
    add(c,'div','Submitted '+(o.createdAt?new Date(o.createdAt).toLocaleString():''),'muted');
    add(c,'div','Dosage: '+(o.dosage||'-')+' · Quantity: '+(o.quantity||1));
    add(c,'div','Delivery: '+(o.deliveryAddress||'-')+' ('+(o.deliveryType||'home')+')');
    if(o.notes)add(c,'div','Notes: '+o.notes);
    var a=add(c,'button','Approve','ok');a.onclick=function(){decide(o._id,'approve')};
    var r=add(c,'button','Reject','no');r.className='no sp';r.onclick=function(){decide(o._id,'reject')};
  });
}
async function decide(id,what){
  var body={};
  if(what==='approve'){if(!confirm('Approve this order?'))return}
  else{var why=prompt('Reason for rejection (required):');if(!why||!why.trim())return;body.reason=why}
  var d=await api('/pharmacy/orders/'+encodeURIComponent(id)+'/'+what,{method:'POST',body:body});
  if(d.success){note(what==='approve'?'Order approved.':'Order rejected.',true);load()}else note(d.message||'Failed.',false);
}
`;


const CONSULT_HTML = String.raw`
<div class="wrap">
  <div class="top"><div><h1>Consultation booking</h1><div class="sub">Set your prices and opening hours so patients can book you in the app.</div></div><div id="who" class="muted hide"></div></div>
  ${'__AUTH__'}
  <div id="app" class="hide">
    <div id="note" class="msg hide"></div>
    <div class="card">
      <h2>How this works</h2>
      <div class="steps">
        <div class="step"><strong>1. Choose your clinic</strong>Pick it from the list below, or add it if you are the admin.</div>
        <div class="step"><strong>2. Fill in prices and hours</strong>Tick the days you are open and set the times. Fees are in naira.</div>
        <div class="step"><strong>3. Check and save</strong>The checklist shows what patients will see and what is still missing.</div>
      </div>
      <p class="muted gap">You can change only the clinics assigned to you. Every save is recorded under your name.</p>
    </div>
    <div class="card">
      <div class="top"><h2>Your clinics</h2><button class="nt hide" id="b-new">Add a clinic</button></div>
      <div id="waiting" class="hide"></div>
      <div id="plist"></div>
    </div>
    <div class="card hide" id="form">
      <div class="top"><h2 id="ft">Clinic settings</h2><button class="alt nt" id="b-close">Close</button></div>

      <div id="adminpick" class="hide">
        <label for="fp">Start from a listed facility (optional)</label><select id="fp"></select>
      </div>
      <h3 class="sec">About the clinic</h3>
      <div class="row">
        <div><label for="fn">Clinic name</label><input id="fn" autocomplete="off"></div>
        <div><label for="fa">Address</label><input id="fa" autocomplete="off"></div>
      </div>
      <label for="fs">What kind of care (for example, Primary care)</label><input id="fs" autocomplete="off">
      <p class="muted hide" id="lockedNote">Name and address are set by an admin. Ask them if these are wrong.</p>

      <h3 class="sec">Visits and prices</h3>
      <div class="row">
        <div class="opt">
          <label class="inl"><input type="checkbox" class="chk" id="oi" checked> In-person visits</label>
          <label for="fpi">Price (naira)</label><input id="fpi" inputmode="decimal" placeholder="5000">
        </div>
        <div class="opt">
          <label class="inl"><input type="checkbox" class="chk" id="ov"> Video visits</label>
          <label for="fpv">Price (naira)</label><input id="fpv" inputmode="decimal" placeholder="3000">
        </div>
      </div>
      <label for="fm">Length of each visit</label>
      <select id="fm">
        <option value="15">15 minutes</option><option value="20">20 minutes</option><option value="30" selected>30 minutes</option>
        <option value="45">45 minutes</option><option value="60">1 hour</option>
      </select>

      <h3 class="sec">Opening hours</h3>
      <p class="muted">Tick the days you see patients. Times are Nigerian time. Use "Add a break" if you close for lunch.</p>
      <div class="days" id="days"></div>
      <button class="alt" id="b-copy">Copy Monday to Tuesday-Friday</button>

      <h3 class="sec">How patients can pay</h3>
      <label class="inl"><input type="checkbox" class="chk" id="po" checked> Online, by card or transfer</label>
      <label class="inl"><input type="checkbox" class="chk" id="pv"> At the clinic, when they arrive</label>
      <label for="fh">Health plans (HMOs) you accept</label><input id="fh" placeholder="Hygeia, AXA Mansard" autocomplete="off">
      <p class="muted">Type the plan names the way patients see them, separated by commas. Leave empty if you accept none. Your team confirms each plan booking below.</p>

      <div id="staffwrap" class="hide">
        <h3 class="sec">Who can manage this clinic</h3>
        <p class="muted">These people can change prices and hours and answer plan bookings for this clinic only.</p>
        <div id="staffbox"></div>
      </div>

      <h3 class="sec">Checklist</h3>
      <ul class="ready" id="ready"></ul>
      <div class="preview" id="preview"></div>

      <label class="inl gap"><input type="checkbox" class="chk" id="fz" checked> Patients can book this clinic</label>
      <button id="b-save">Save</button><div class="err" id="e-save"></div>
    </div>
    <div class="card gap">
      <div class="top"><h2>Plan bookings waiting for you</h2><button class="alt nt" id="b-href">Refresh</button></div>
      <p class="muted">Patients who chose a health plan. Approve once the plan confirms cover. Decline to free the time.</p>
      <div id="hmo"></div>
    </div>
    <button class="alt" id="b-out">Sign out</button>
  </div>
</div>`;

const CONSULT_JS = String.raw`
var DAYNAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var ORDER=[1,2,3,4,5,6,0];
var DAYROWS={};
var CUR=null,ME=null,CANADMIN=false,STAFFLIST=[];
function add(parent,tag,text,cls){var e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;parent.appendChild(e);return e}
function note(t,good){var n=$('note');n.textContent=t;n.className='msg '+(good?'good':'bad');n.scrollIntoView();setTimeout(function(){n.className='msg hide'},6000)}
function naira(minor){return minor==null?'':String(minor/100)}
function money(minor){return '₦'+(Number(minor||0)/100).toLocaleString()}
function toMinor(v){v=String(v||'').replace(/[^0-9.]/g,'');if(!v)return undefined;return Math.round(parseFloat(v)*100)}
function newId(){var a=new Uint8Array(8);crypto.getRandomValues(a);return 'svc-'+Array.prototype.map.call(a,function(x){return ('0'+x.toString(16)).slice(-2)}).join('')}
function timeInput(v){var i=document.createElement('input');i.type='time';i.value=v||'';i.step='300';return i}

function buildDays(){
  var box=$('days');box.textContent='';DAYROWS={};
  ORDER.forEach(function(d){
    var row=add(box,'div',null,'day');
    var lab=add(row,'label',null,'inl');var cb=add(lab,'input');cb.type='checkbox';cb.className='chk';lab.appendChild(document.createTextNode(DAYNAMES[d]));
    var cell=add(row,'div');
    var closed=add(cell,'span','Closed','closed');
    var w1=add(cell,'div',null,'win hide');w1.appendChild(document.createTextNode('From '));var a1=timeInput('09:00');w1.appendChild(a1);w1.appendChild(document.createTextNode(' to '));var b1=timeInput('17:00');w1.appendChild(b1);
    var more=add(w1,'button','Add a break','alt sm');
    var w2=add(cell,'div',null,'win hide');w2.appendChild(document.createTextNode('Back from '));var a2=timeInput('14:00');w2.appendChild(a2);w2.appendChild(document.createTextNode(' to '));var b2=timeInput('17:00');w2.appendChild(b2);
    var less=add(w2,'button','Remove break','alt sm');
    var r={cb:cb,closed:closed,w1:w1,w2:w2,a1:a1,b1:b1,a2:a2,b2:b2,two:false};
    function show(){closed.classList.toggle('hide',cb.checked);w1.classList.toggle('hide',!cb.checked);w2.classList.toggle('hide',!(cb.checked&&r.two));more.classList.toggle('hide',r.two);refresh()}
    r.show=show;
    cb.onchange=show;more.onclick=function(){r.two=true;if(b1.value==='17:00')b1.value='13:00';show()};
    less.onclick=function(){r.two=false;show()};
    [a1,b1,a2,b2].forEach(function(i){i.onchange=refresh});
    DAYROWS[d]=r;
  });
}
function setDay(d,windows){
  var r=DAYROWS[d];r.cb.checked=windows.length>0;r.two=windows.length>1;
  if(windows[0]){r.a1.value=windows[0].start;r.b1.value=windows[0].end}
  if(windows[1]){r.a2.value=windows[1].start;r.b2.value=windows[1].end}
  r.show();
}
function readHours(){
  var out=[];
  for(var k=0;k<ORDER.length;k++){
    var d=ORDER[k],r=DAYROWS[d];if(!r.cb.checked)continue;
    var wins=[[r.a1.value,r.b1.value]];if(r.two)wins.push([r.a2.value,r.b2.value]);
    for(var j=0;j<wins.length;j++){
      var s=wins[j][0],e=wins[j][1];
      if(!s||!e)return {error:DAYNAMES[d]+': set both a start and an end time.'};
      if(e<=s)return {error:DAYNAMES[d]+': the end time must be after the start time.'};
      out.push({day:d,start:s,end:e});
    }
    if(r.two&&wins[1][0]<wins[0][1])return {error:DAYNAMES[d]+': the break must come before the second period starts.'};
  }
  return {weekly:out};
}
function hmoList(){return $('fh').value.split(',').map(function(x){return x.trim()}).filter(Boolean)}
function summaryHours(w){
  if(!w.length)return 'No opening hours yet';
  var by={};w.forEach(function(x){(by[x.day]=by[x.day]||[]).push(x.start+'-'+x.end)});
  return ORDER.filter(function(d){return by[d]}).map(function(d){return DAYNAMES[d].slice(0,3)+' '+by[d].join(', ')}).join(' · ');
}
function refresh(){
  var issues=[],good=[];
  var h=readHours();
  var name=$('fn').value.trim();
  (name?good:issues).push(name?'Clinic name is set':'Add the clinic name');
  var oi=$('oi').checked,ov=$('ov').checked;
  if(!oi&&!ov)issues.push('Turn on at least one kind of visit');
  if(oi){(toMinor($('fpi').value)?good:issues).push(toMinor($('fpi').value)?'In-person price is set':'Enter the in-person price')}
  if(ov){(toMinor($('fpv').value)?good:issues).push(toMinor($('fpv').value)?'Video price is set':'Enter the video price')}
  if(h.error)issues.push(h.error);else if(!h.weekly.length)issues.push('Tick at least one day you are open');else good.push('Opening hours are set');
  if(!$('po').checked&&!$('pv').checked&&!hmoList().length)issues.push('Choose at least one way for patients to pay');else good.push('Payment is set');
  var ul=$('ready');ul.textContent='';
  issues.forEach(function(t){add(ul,'li','Needs attention: '+t,'bad')});
  good.forEach(function(t){add(ul,'li','Done: '+t,'okk')});
  var pv=$('preview');pv.textContent='';
  add(pv,'div',name||'Your clinic');
  var fees=[];if(oi&&toMinor($('fpi').value))fees.push('In person '+money(toMinor($('fpi').value)));if(ov&&toMinor($('fpv').value))fees.push('Video '+money(toMinor($('fpv').value)));
  add(pv,'div',fees.join(' · ')||'No prices yet','muted');
  add(pv,'div',h.weekly?summaryHours(h.weekly)+' · '+$('fm').value+' minute visits':'Check the opening hours','muted');
  var pay=[];if($('po').checked)pay.push('online');if($('pv').checked)pay.push('at the clinic');if(hmoList().length)pay.push('health plan: '+hmoList().join(', '));
  add(pv,'div','Pay '+(pay.join(' · ')||'-'),'muted');
  return {ok:!issues.length,issues:issues};
}
['fn','fpi','fpv','fh'].forEach(function(id){$(id).oninput=refresh});
['oi','ov','po','pv','fm','fz'].forEach(function(id){$(id).onchange=refresh});

window.onSignedIn=function(staff){
  ME=staff;$('app').classList.remove('hide');$('who').classList.remove('hide');$('who').textContent=staff.name+' ('+staff.role.replace('_',' ')+')';
  buildDays();loadProviders();loadHmo();
};
$('b-out').onclick=signOut;$('b-href').onclick=function(){loadHmo()};$('b-close').onclick=function(){$('form').classList.add('hide')};
$('b-copy').onclick=function(){
  var m=DAYROWS[1];
  [2,3,4,5].forEach(function(d){var r=DAYROWS[d];r.cb.checked=m.cb.checked;r.two=m.two;r.a1.value=m.a1.value;r.b1.value=m.b1.value;r.a2.value=m.a2.value;r.b2.value=m.b2.value;r.show()});
  refresh();
};
$('b-new').onclick=function(){openForm(null)};

var FAC=[],PROVS=[];
function renderWaiting(){
  var w=$('waiting');w.textContent='';
  var have={};PROVS.forEach(function(p){have[p.facilityId]=true});
  var todo=FAC.map(function(f,i){return {f:f,i:i}}).filter(function(x){return x.f.registered&&x.f.type!=='pharmacy'&&!have[x.f.id]});
  if(!CANADMIN||!todo.length){w.classList.add('hide');return}
  w.classList.remove('hide');
  add(w,'h3','Registered on the website, not set up here yet','sec');
  add(w,'div','These providers signed up on the website. Patients can find them but cannot book a time or pay until you set them up.','muted');
  todo.forEach(function(x){var r=add(w,'div',null,'item');add(r,'strong',x.f.name);add(r,'div',x.f.address||'','muted');var b=add(r,'button','Set up','alt sm');b.onclick=function(){openForm(null);$('fp').value=String(x.i);$('fp').onchange()}});
}
async function loadAdminLists(){
  var f=await api('/staff/facility-options');FAC=f.success?f.facilities:[];
  var s=$('fp');s.textContent='';var o=add(s,'option','Type a new clinic below');o.value='';
  FAC.forEach(function(x,i){var e=add(s,'option',x.name+(x.address?' - '+x.address:''));e.value=String(i)});
  var u=await api('/staff/users');STAFFLIST=(u.success&&u.staff||[]).filter(function(x){return (x.role==='clinician'||x.role==='records_officer')&&x.status!=='disabled'});
  renderWaiting();
}
$('fp').onchange=function(){var f=FAC[Number($('fp').value)];if(!f)return;$('fn').value=f.name;$('fa').value=f.address||'';CUR.pickedId=f.id;refresh()};

function openForm(p){
  CUR={id:p?p.facilityId:newId(),isNew:!p,pickedId:null};
  $('form').classList.remove('hide');
  $('ft').textContent=p?p.facilityName:'Add a clinic';
  $('adminpick').classList.toggle('hide',!(CANADMIN&&!p));
  var locked=!CANADMIN;
  ['fn','fa','fs'].forEach(function(id){$(id).disabled=locked});
  $('lockedNote').classList.toggle('hide',!locked);
  $('staffwrap').classList.toggle('hide',!CANADMIN);
  $('fn').value=p?p.facilityName:'';$('fa').value=p?(p.facilityAddress||''):'';$('fs').value=p?(p.specialty||''):'';
  $('oi').checked=p?!!p.offersInPerson:true;$('ov').checked=p?!!p.offersVirtual:false;
  $('fpi').value=p?naira(p.feeInPersonMinor):'';$('fpv').value=p?naira(p.feeVirtualMinor):'';
  $('fm').value=String(p?(p.slotMinutes||30):30);
  if(![].some.call($('fm').options,function(o){return o.value===$('fm').value})){var o=add($('fm'),'option',$('fm').value+' minutes');o.value=$('fm').value}
  $('fh').value=p?(p.acceptsHmo||[]).join(', '):'';
  $('pv').checked=p?!!p.payAtVisit:false;$('po').checked=p?p.onlinePayment!==false:true;
  $('fz').checked=p?p.active!==false:true;
  buildDays();
  var by={};((p&&p.weekly)||[]).forEach(function(x){(by[x.day]=by[x.day]||[]).push(x)});
  ORDER.forEach(function(d){var w=(by[d]||[]).sort(function(a,b){return a.start<b.start?-1:1}).slice(0,2);setDay(d,w)});
  if(!p)setDay(1,[]);
  var box=$('staffbox');box.textContent='';
  if(CANADMIN){
    var ids=(p&&p.staffIds)||[];
    STAFFLIST.forEach(function(u){var l=add(box,'label',null,'inl');var c=add(l,'input');c.type='checkbox';c.className='chk';c.value=String(u.id);c.checked=ids.indexOf(String(u.id))>=0;l.appendChild(document.createTextNode(u.name+' ('+u.email+')'))});
    if(!STAFFLIST.length)add(box,'div','No clinician accounts yet. Add one in the clinic console first.','muted');
  }
  $('e-save').textContent='';
  refresh();$('form').scrollIntoView();
}
async function loadProviders(){
  var l=$('plist');l.textContent='Loading...';
  var d=await api('/staff/providers');l.textContent='';
  if(!d.success){add(l,'div',d.message||'Could not load clinics.','msg bad');return}
  var first=!CANADMIN&&d.canManageStaff;
  CANADMIN=!!d.canManageStaff;PROVS=d.providers||[];
  if(CANADMIN){$('b-new').classList.remove('hide');if(first||!STAFFLIST.length)loadAdminLists();else renderWaiting()}
  if(!d.providers.length){add(l,'div',CANADMIN?'No clinic is set up yet. Choose "Add a clinic".':'No clinic is assigned to you yet. Ask an admin to assign you.','muted');return}
  d.providers.forEach(function(p){
    var it=add(l,'div',null,'item');
    add(it,'strong',p.facilityName);
    add(it,'span',p.active===false?'paused':'open to bookings','tag '+(p.active===false?'p':'v'));
    var bits=[];
    if(p.offersInPerson)bits.push('In person '+money(p.feeInPersonMinor));
    if(p.offersVirtual)bits.push('Video '+money(p.feeVirtualMinor));
    add(it,'div',(bits.join(' · ')||'No prices')+' · '+summaryHours(p.weekly||[]),'muted');
    var b=add(it,'button','Edit','alt');b.onclick=function(){openForm(p)};
  });
}
$('b-save').onclick=async function(){
  say('e-save','');
  var h=readHours();if(h.error){say('e-save',h.error);return}
  var st=refresh();
  if($('fz').checked&&!st.ok){say('e-save','Fix the items marked "Needs attention", or untick "Patients can book this clinic" to save a draft.');return}
  var body={
    facilityName:$('fn').value,facilityAddress:$('fa').value,specialty:$('fs').value,
    offersInPerson:$('oi').checked,offersVirtual:$('ov').checked,
    feeInPersonMinor:$('oi').checked?toMinor($('fpi').value):undefined,feeVirtualMinor:$('ov').checked?toMinor($('fpv').value):undefined,
    acceptsHmo:hmoList(),payAtVisit:$('pv').checked,onlinePayment:$('po').checked,
    slotMinutes:Number($('fm').value),weekly:h.weekly,active:$('fz').checked
  };
  if(CANADMIN){var ids=[];Array.prototype.forEach.call($('staffbox').querySelectorAll('input'),function(c){if(c.checked)ids.push(c.value)});body.staffIds=ids}
  var id=CUR.pickedId||CUR.id;
  var d=await api('/staff/providers/'+encodeURIComponent(id)+'/service',{method:'PUT',body:body});
  if(!d.success){say('e-save',d.message||'Could not save');return}
  note('Saved.',true);$('form').classList.add('hide');loadProviders();
};
async function loadHmo(){
  var l=$('hmo');l.textContent='Loading...';
  var d=await api('/staff/bookings?status=awaiting_hmo');l.textContent='';
  if(!d.success){add(l,'div',d.message||'Could not load bookings.','msg bad');return}
  if(!d.bookings.length){add(l,'div','Nothing is waiting.','muted');return}
  d.bookings.forEach(function(b){
    var it=add(l,'div',null,'item');
    add(it,'strong',b.facilityName+' · ref '+b.bookingRef);
    add(it,'div',new Date(b.startsAt).toLocaleString()+' · '+(b.visitType==='video'?'Video':'In person')+' · fee '+money(b.feeMinor),'muted');
    if(b.hmo)add(it,'div','Plan: '+(b.hmo.policyLabel||'-')+' · pre-authorisation '+(b.hmo.preAuthId||'none')+(b.hmo.clientStatus?' ('+b.hmo.clientStatus+' on the patient phone, not checked by us)':''),'muted');
    var a=add(it,'button','Approve cover','ok');a.onclick=function(){decide(b.id,'approve')};
    var n=add(it,'button','Decline','no');n.className='no sp';n.onclick=function(){decide(b.id,'decline')};
  });
}
async function decide(id,what){
  var body={decision:what};
  if(what==='approve'){var c=prompt('Approval code from the health plan (optional):');if(c===null)return;body.approvalCode=c}
  else if(!confirm('Decline? The patient is told and the time is released.'))return;
  var d=await api('/staff/bookings/'+encodeURIComponent(id)+'/hmo',{method:'POST',body:body});
  if(d.success){note(what==='approve'?'Cover approved. The booking is confirmed.':'Declined. The time was released.',true);loadHmo()}else note(d.message||'Failed.',false);
}
`;

const PHARMACY_HTML = String.raw`
<div class="wrap">
  <div class="top"><div><h1>Pharmacy orders</h1><div class="sub">Review prescriptions, send quotes, dispatch and confirm handover.</div></div><div id="who" class="muted hide"></div></div>
  ${'__AUTH__'}
  <div id="app" class="hide">
    <div id="note" class="msg hide"></div>
    <button class="alt" id="b-out">Sign out</button>
    <div class="card gap">
      <div class="top"><h2>Orders</h2><button class="alt nt" id="b-ref">Refresh</button></div>
      <label for="st">Show</label>
      <select id="st">
        <option value="awaiting_review">Awaiting review</option>
        <option value="awaiting_hmo">Awaiting HMO</option>
        <option value="confirmed">Confirmed, to dispatch or ready</option>
        <option value="dispatched">Out for delivery</option>
        <option value="ready_for_pickup">Ready for pickup</option>
        <option value="quoted">Quoted, waiting for the patient</option>
        <option value="awaiting_payment">Awaiting payment</option>
        <option value="delivered">Delivered</option>
        <option value="collected">Collected</option>
        <option value="cancelled">Cancelled</option>
        <option value="rejected">Rejected</option>
        <option value="expired">Expired</option>
      </select>
      <div id="list"></div>
    </div>
    <div class="card gap hide" id="detail"></div>
    <div class="card gap hide" id="setup">
      <div class="top"><h2>Your pharmacies</h2><button class="nt hide" id="b-new">Add a pharmacy</button></div>
      <p class="muted">Set your delivery prices and how patients can pay. You can change only the pharmacies assigned to you.</p>
      <div id="swaiting" class="hide"></div>
      <div id="slist"></div>
    </div>
    <div class="card gap hide" id="sform">
      <div class="top"><h2 id="ft">Pharmacy settings</h2><button class="alt nt" id="b-close">Close</button></div>
      <div id="adminpick" class="hide">
        <label for="fp">Start from a listed facility (optional)</label><select id="fp"></select>
      </div>
      <h3 class="sec">About the pharmacy</h3>
      <div class="row">
        <div><label for="fn">Pharmacy name</label><input id="fn" autocomplete="off"></div>
        <div><label for="fph">Phone number patients can call</label><input id="fph" inputmode="tel" autocomplete="off"></div>
      </div>
      <label for="fa">Address</label><input id="fa" autocomplete="off">
      <div id="locwrap">
        <label>Map position (used to work out delivery distance)</label>
        <button class="alt" id="b-loc">Use my current location</button>
        <div class="muted" id="locsay">No position saved.</div>
        <details><summary class="muted">Enter the position by hand</summary>
          <div class="row"><div><label for="flat">Latitude</label><input id="flat" inputmode="decimal" placeholder="9.0765"></div>
          <div><label for="flng">Longitude</label><input id="flng" inputmode="decimal" placeholder="7.3986"></div></div>
        </details>
      </div>
      <p class="muted hide" id="lockedNote">Name, address and map position are set by an admin. Ask them if these are wrong.</p>

      <h3 class="sec">Delivery and pickup</h3>
      <label class="inl"><input type="checkbox" class="chk" id="pe" checked> Patients can collect from the pharmacy</label>
      <label class="inl"><input type="checkbox" class="chk" id="de" checked> We deliver</label>
      <div id="delivery">
        <label>Delivery price by distance</label>
        <p class="muted">Each row is a distance from the pharmacy and the price up to that distance. Orders farther than the last row cannot be delivered.</p>
        <div id="bands"></div>
        <button class="alt" id="b-band">Add a row</button>
        <label for="eta">Delivery time shown to patients</label>
        <select id="eta"><option>Within 1 to 2 hours</option><option selected>Within 2 to 4 hours</option><option>Same day</option><option>Next day</option></select>
      </div>

      <h3 class="sec">How patients can pay</h3>
      <label class="inl"><input type="checkbox" class="chk" id="po" checked> Online, by card or transfer</label>
      <label class="inl"><input type="checkbox" class="chk" id="pd"> Cash when the order is delivered</label>
      <label class="inl"><input type="checkbox" class="chk" id="pp" checked> Cash when collected at the pharmacy</label>
      <label for="fh">Health plans (HMOs) you accept</label><input id="fh" placeholder="Hygeia, AXA Mansard" autocomplete="off">
      <p class="muted">Type the plan names separated by commas. Leave empty if you accept none.</p>

      <div id="staffwrap" class="hide">
        <h3 class="sec">Who can manage this pharmacy</h3>
        <p class="muted">These pharmacists see this pharmacy's orders and can change its prices.</p>
        <div id="staffbox"></div>
      </div>

      <h3 class="sec">Checklist</h3>
      <ul class="ready" id="ready"></ul>
      <div class="preview" id="preview"></div>
      <label class="inl gap"><input type="checkbox" class="chk" id="fz" checked> Patients can order from this pharmacy</label>
      <button id="b-save">Save</button><div class="err" id="e-save"></div>
    </div>
  </div>
</div>`;

const PHARMACY_JS = String.raw`
function add(parent,tag,text,cls){var e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;parent.appendChild(e);return e}
function note(t,good){var n=$('note');n.textContent=t;n.className='msg '+(good?'good':'bad');setTimeout(function(){n.className='msg hide'},6000)}
function naira(minor){return minor==null?'':String(minor/100)}
function money(minor){return '₦'+(Number(minor||0)/100).toLocaleString()}
function toMinor(v){v=String(v||'').replace(/[^0-9.]/g,'');if(!v)return undefined;return Math.round(parseFloat(v)*100)}
var ME=null,FAC=[],STAFF=[],OPEN=null,SERVS=[];
function renderWaiting(){
  var w=$('swaiting');w.textContent='';
  var have={};SERVS.forEach(function(p){have[p.facilityId]=true});
  var todo=FAC.map(function(f,i){return {f:f,i:i}}).filter(function(x){return x.f.registered&&x.f.type==='pharmacy'&&!have[x.f.id]});
  if(!CANADMIN||!todo.length){w.classList.add('hide');return}
  w.classList.remove('hide');
  add(w,'h3','Registered on the website, not set up here yet','sec');
  add(w,'div','These pharmacies signed up on the website. Patients can find them but cannot order until you set them up.','muted');
  todo.forEach(function(x){var r=add(w,'div',null,'item');add(r,'strong',x.f.name);add(r,'div',x.f.address||'','muted');var b=add(r,'button','Set up','alt sm');b.onclick=function(){openForm(null);$('fp').value=String(x.i);$('fp').onchange()}});
}
window.onSignedIn=function(staff){
  ME=staff;$('app').classList.remove('hide');$('who').classList.remove('hide');$('who').textContent=staff.name+' ('+staff.role.replace('_',' ')+')';
  CANADMIN=staff.role==='admin';
  loadList();loadSettings();
  if(CANADMIN){$('b-new').classList.remove('hide');loadFacilities();loadStaff()}
};
$('b-out').onclick=signOut;$('b-ref').onclick=function(){loadList()};$('st').onchange=function(){loadList()};
async function loadList(){
  var l=$('list');l.textContent='Loading...';
  var st=$('st').value;
  var d=await api('/staff/pharmacy/orders?status='+encodeURIComponent(st));l.textContent='';
  if(!d.success){add(l,'div',d.message||'Could not load orders.','msg bad');return}
  if(!d.orders.length){add(l,'div','Nothing here.','muted');return}
  d.orders.forEach(function(o){
    var it=add(l,'div',null,'item');
    add(it,'strong',o.pharmacyName+' · ref '+o.ref);
    add(it,'div',o.subjectName+' · '+o.itemCount+' item(s) · '+o.fileCount+' file(s) · '+new Date(o.createdAt).toLocaleString()+(o.totalMinor?' · '+money(o.totalMinor):''),'muted');
    var b=add(it,'button','Open','alt');b.onclick=function(){openOrder(o.id)};
  });
}
async function act(id,what,body,msg){
  var d=await api('/staff/pharmacy/orders/'+encodeURIComponent(id)+'/'+what,{method:'POST',body:body||{}});
  if(d.success){note(msg,true);loadList();openOrder(id)}else note(d.message||'Failed.',false);
}
async function showFile(id,fid){
  var d=await api('/staff/pharmacy/orders/'+encodeURIComponent(id)+'/files/'+encodeURIComponent(fid));
  if(!d.success){note(d.message||'Could not open the file.',false);return}
  var bin=atob(d.dataBase64),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  var url=URL.createObjectURL(new Blob([u],{type:d.contentType}));
  var box=$('filebox');box.textContent='';
  if(d.contentType==='application/pdf'){var a=add(box,'a','Download the PDF');a.href=url;a.download='prescription.pdf'}
  else{var img=add(box,'img');img.src=url;img.style.maxWidth='100%';img.alt='Prescription'}
}
async function openOrder(id){
  var c=$('detail');c.classList.remove('hide');c.textContent='Loading...';
  var d=await api('/staff/pharmacy/orders/'+encodeURIComponent(id));
  c.textContent='';
  if(!d.success){add(c,'div',d.message||'Could not load the order.','msg bad');return}
  var o=d.order;OPEN=o;
  add(c,'h2',o.pharmacy.name+' · ref '+o.ref);
  add(c,'div','Status: '+o.status.replace(/_/g,' ')+' · patient '+o.subjectName+(o.patientPhone?' · '+o.patientPhone:''),'muted');
  add(c,'h2','Requested');
  o.requested.forEach(function(r){add(c,'div',r.name+(r.strength?' '+r.strength:'')+' x '+r.quantity+(r.notes?' ('+r.notes+')':''),'item')});
  if(o.files.length){
    add(c,'h2','Prescription');
    o.files.forEach(function(f,i){var b=add(c,'button','View file '+(i+1)+' ('+f.contentType.split('/')[1]+')','alt');b.onclick=function(){showFile(o.id,f.id)}});
    add(c,'div',null,'').id='filebox';
    add(c,'div','Opening a file is recorded in the patient\'s access log.','muted');
  }
  if(o.linkToRecord)add(c,'div','The patient agreed to add the dispensed medication to their record.','muted');
  if(o.quote){
    add(c,'h2','Quote');
    o.quote.lines.forEach(function(l){add(c,'div',(l.available?'':'Not available: ')+l.name+(l.strength?' '+l.strength:'')+' x '+l.quantity+' · '+money(l.unitPriceMinor)+(l.alternative?' · alternative':''),'item')});
  }
  if(o.fulfilment){
    add(c,'h2',o.fulfilment==='delivery'?'Delivery':'Pickup');
    if(o.address){add(c,'div',o.address.text+(o.address.landmark?' (near '+o.address.landmark+')':''));add(c,'div','Recipient '+(o.address.recipientName||'')+' '+(o.address.recipientPhone||''),'muted')}
    add(c,'div','Medication '+money(o.medsMinor)+' · delivery '+money(o.deliveryFeeMinor)+(o.feeEstimated?' (estimate)':'')+' · total '+money(o.totalMinor)+' · due '+money(o.dueMinor),'muted');
    add(c,'div','Payment: '+(o.paymentMethod||'-').replace(/_/g,' ')+' · '+(o.paymentStatus||'-').replace(/_/g,' '),'muted');
    if(o.hmo)add(c,'div','HMO '+o.hmo.provider+' · member '+(o.hmoMemberId||'-')+' · '+o.hmo.status,'muted');
  }
  if(o.dispatch)add(c,'div','Rider '+o.dispatch.riderName+' '+o.dispatch.riderPhone,'muted');
  if(o.status==='awaiting_review')reviewForm(c,o);
  if(o.status==='awaiting_hmo')hmoForm(c,o);
  if(o.status==='confirmed'&&o.fulfilment==='delivery')dispatchForm(c,o);
  if(o.status==='confirmed'&&o.fulfilment==='pickup'){var rb=add(c,'button','Mark ready for pickup','ok');rb.onclick=function(){act(o.id,'ready',{},'Marked ready. The patient was told.')}}
  if(o.status==='dispatched')codeForm(c,o,'deliver','Confirm delivery');
  if(o.status==='ready_for_pickup')codeForm(c,o,'collect','Confirm pickup');
  if(['awaiting_payment','awaiting_hmo','confirmed','ready_for_pickup'].indexOf(o.status)>=0){
    var cb=add(c,'button','Cancel order','no');cb.className='no sp';
    cb.onclick=function(){var why=prompt('Reason for the patient (required):');if(!why||!why.trim())return;act(o.id,'cancel',{reason:why},'Order cancelled.')};
  }
  c.scrollIntoView();
}
function reviewForm(c,o){
  add(c,'h2','Send a quote');
  add(c,'div','Enter the price for each unit in naira. Tick "alternative" for a substitute the patient may leave out. Untick "available" for anything you cannot supply.','muted');
  var rows=[];var box=add(c,'div');
  function addRow(r){
    var w=add(box,'div',null,'item');
    var n=add(w,'input');n.placeholder='Medication';n.value=(r.name||'')+(r.strength?' '+r.strength:'');
    var q=add(w,'input');q.placeholder='Quantity';q.value=r.quantity||1;q.inputMode='numeric';
    var p=add(w,'input');p.placeholder='Price per unit (naira)';p.inputMode='decimal';
    var a=add(w,'label');var av=add(a,'input');av.type='checkbox';av.className='chk';av.checked=true;a.appendChild(document.createTextNode('available'));
    var b=add(w,'label');var al=add(b,'input');al.type='checkbox';al.className='chk';b.appendChild(document.createTextNode('alternative'));
    rows.push({n:n,q:q,p:p,av:av,al:al,strength:r.strength||''});
  }
  o.requested.forEach(addRow);
  var more=add(c,'button','Add an alternative line','alt');more.onclick=function(){addRow({name:'',quantity:1})};
  var nl=add(c,'label','Note to the patient (optional)');nl.setAttribute('for','qn');var nn=add(c,'textarea');nn.id='qn';nn.rows=2;
  var s=add(c,'button','Send quote','ok');var e=add(c,'div',null,'err');
  s.onclick=function(){
    var lines=rows.map(function(r){return {name:r.n.value,strength:'',quantity:Number(r.q.value),unitPriceMinor:toMinor(r.p.value)||0,available:r.av.checked,alternative:r.al.checked}});
    e.textContent='';
    api('/staff/pharmacy/orders/'+encodeURIComponent(o.id)+'/quote',{method:'POST',body:{lines:lines,note:nn.value}}).then(function(d){
      if(d.success){note('Quote sent. The patient was told.',true);loadList();openOrder(o.id)}else e.textContent=d.message||'Could not send the quote.';
    });
  };
  var rj=add(c,'button','Reject order','no');rj.className='no sp';
  rj.onclick=function(){var why=prompt('Reason for the patient (required):');if(!why||!why.trim())return;act(o.id,'reject',{reason:why},'Order rejected.')};
}
function hmoForm(c,o){
  add(c,'h2','HMO cover');
  var l=add(c,'label','Amount the HMO covers (naira)');l.setAttribute('for','hc');var i=add(c,'input');i.id='hc';i.inputMode='decimal';
  var a=add(c,'button','Approve cover','ok');a.onclick=function(){var m=toMinor(i.value);if(!m){note('Enter the covered amount.',false);return}act(o.id,'hmo',{decision:'approve',coveredMinor:m},'Cover approved.')};
  var n=add(c,'button','Decline','no');n.className='no sp';n.onclick=function(){var why=prompt('Reason (optional):');if(why===null)return;act(o.id,'hmo',{decision:'decline',reason:why},'Declined. The patient can choose another way to pay.')};
}
function dispatchForm(c,o){
  add(c,'h2','Dispatch');
  add(c,'div','Assign your rider or logistics partner. WelliRecord does not dispatch for you.','muted');
  var a=add(c,'input');a.placeholder='Rider name';var b=add(c,'input');b.placeholder='Rider phone';var t=add(c,'input');t.placeholder='Arrival note, e.g. about 45 minutes';
  var s=add(c,'button','Dispatch','ok');s.onclick=function(){act(o.id,'dispatch',{riderName:a.value,riderPhone:b.value,etaNote:t.value},'Dispatched. The patient was told.')};
}
function codeForm(c,o,what,label){
  add(c,'h2','Handover');
  add(c,'div','Ask the patient for their six digit code. Five wrong codes lock this step for 15 minutes.','muted');
  var i=add(c,'input');i.placeholder='Six digit code';i.inputMode='numeric';i.maxLength=6;
  var s=add(c,'button',label,'ok');s.onclick=function(){act(o.id,what,{code:i.value},'Done.')};
}
// ----- settings (assigned pharmacist or admin) -----
var CUR=null,CANADMIN=false;
function bandRow(km,fee){
  var box=$('bands');var row=add(box,'div',null,'win');
  row.appendChild(document.createTextNode('Up to '));
  var k=add(row,'input');k.inputMode='decimal';k.value=km==null?'':km;k.placeholder='5';
  row.appendChild(document.createTextNode(' km costs ₦'));
  var f=add(row,'input');f.inputMode='decimal';f.value=fee==null?'':fee;f.placeholder='1500';
  var x=add(row,'button','Remove','alt sm');x.onclick=function(){box.removeChild(row);refresh()};
  k.oninput=refresh;f.oninput=refresh;
}
function readBands(){
  var out=[],rows=$('bands').children;
  for(var i=0;i<rows.length;i++){
    var ins=rows[i].querySelectorAll('input');
    var km=parseFloat(String(ins[0].value).replace(/[^0-9.]/g,'')),fee=toMinor(ins[1].value);
    if(!(km>0)||fee===undefined)return {error:'Row '+(i+1)+': enter a distance in km and a price in naira.'};
    out.push({maxKm:km,feeMinor:fee});
  }
  return {bands:out};
}
function readPos(){
  var a=String($('flat').value).trim(),b=String($('flng').value).trim();
  if(!a&&!b)return {};
  var la=Number(a),lo=Number(b);
  if(!(Math.abs(la)<=90)||!(Math.abs(lo)<=180)||!a||!b)return {error:'The map position is not valid. Use the button, or enter both numbers.'};
  return {lat:la,lng:lo};
}
function hmoList(){return $('fh').value.split(',').map(function(x){return x.trim()}).filter(Boolean)}
function refresh(){
  var issues=[],good=[];
  var name=$('fn').value.trim();(name?good:issues).push(name?'Pharmacy name is set':'Add the pharmacy name');
  var de=$('de').checked,pe=$('pe').checked;
  $('delivery').classList.toggle('hide',!de);
  if(!de&&!pe)issues.push('Turn on delivery, pickup, or both');
  var pos=readPos();
  if(de){
    var bd=readBands();
    if(bd.error)issues.push(bd.error);else if(!bd.bands.length)issues.push('Add at least one delivery price row');else good.push('Delivery prices are set');
    if(pos.error||pos.lat===undefined)issues.push('Save the pharmacy map position so delivery distance can be worked out');else good.push('Map position is set');
  }
  var pay=[];if($('po').checked)pay.push('online');if(de&&$('pd').checked)pay.push('cash on delivery');if(pe&&$('pp').checked)pay.push('cash at pickup');if(hmoList().length)pay.push('health plan: '+hmoList().join(', '));
  if(!pay.length)issues.push('Choose at least one way for patients to pay');else good.push('Payment is set');
  var ul=$('ready');ul.textContent='';
  issues.forEach(function(t){add(ul,'li','Needs attention: '+t,'bad')});
  good.forEach(function(t){add(ul,'li','Done: '+t,'okk')});
  var pv=$('preview');pv.textContent='';
  add(pv,'div',name||'Your pharmacy');
  var how=[];if(pe)how.push('pickup');if(de)how.push('delivery ('+$('eta').value.toLowerCase()+')');
  add(pv,'div',how.join(' and ')||'No way to receive orders yet','muted');
  if(de){var b2=readBands();if(b2.bands)add(pv,'div',b2.bands.map(function(x){return 'up to '+x.maxKm+' km: '+money(x.feeMinor)}).join(' · ')||'No delivery prices yet','muted')}
  add(pv,'div','Pay '+(pay.join(' · ')||'-'),'muted');
  return {ok:!issues.length};
}
['fn','fph','fh','flat','flng'].forEach(function(id){$(id).oninput=function(){posSay();refresh()}});
['de','pe','po','pd','pp','eta','fz'].forEach(function(id){$(id).onchange=refresh});
function posSay(){var p=readPos();$('locsay').textContent=p.lat===undefined?'No position saved.':'Position set ('+p.lat.toFixed(4)+', '+p.lng.toFixed(4)+').'}
$('b-band').onclick=function(){bandRow('','');refresh()};
$('b-close').onclick=function(){$('sform').classList.add('hide')};
$('b-new').onclick=function(){openForm(null)};
$('b-loc').onclick=function(){
  if(!navigator.geolocation){note('This browser cannot share a location. Enter the numbers by hand.',false);return}
  say('locsay','Finding your position...');
  navigator.geolocation.getCurrentPosition(function(pos){$('flat').value=pos.coords.latitude.toFixed(6);$('flng').value=pos.coords.longitude.toFixed(6);posSay();refresh()},function(){say('locsay','Could not get your position. Allow location for this page, or enter it by hand.')},{enableHighAccuracy:true,timeout:15000});
};
async function loadFacilities(){
  var d=await api('/staff/pharmacy/facility-options');FAC=d.success?d.facilities:[];
  var s=$('fp');s.textContent='';var o=add(s,'option','Type a new pharmacy below');o.value='';
  FAC.forEach(function(f,i){var e=add(s,'option',f.name+(f.address?' - '+f.address:''));e.value=String(i)});
  renderWaiting();
}
async function loadStaff(){
  var d=await api('/staff/users');STAFF=(d.success&&d.staff)||[];
}
$('fp').onchange=function(){var f=FAC[Number($('fp').value)];if(!f)return;$('fn').value=f.name;$('fa').value=f.address||'';CUR.pickedId=f.id;if(f.lat!=null&&f.lng!=null){$('flat').value=f.lat;$('flng').value=f.lng;posSay()}refresh()};
function newId(){var a=new Uint8Array(8);crypto.getRandomValues(a);return 'svc-'+Array.prototype.map.call(a,function(x){return ('0'+x.toString(16)).slice(-2)}).join('')}
function openForm(p){
  CUR={id:p?p.facilityId:newId(),pickedId:null};
  $('sform').classList.remove('hide');$('ft').textContent=p?p.name:'Add a pharmacy';
  $('adminpick').classList.toggle('hide',!(CANADMIN&&!p));
  var locked=!CANADMIN;
  ['fn','fa','flat','flng'].forEach(function(id){$(id).disabled=locked});
  $('b-loc').classList.toggle('hide',locked);$('lockedNote').classList.toggle('hide',!locked);$('staffwrap').classList.toggle('hide',!CANADMIN);
  $('fn').value=p?p.name:'';$('fa').value=p?(p.address||''):'';$('fph').value=p?(p.phone||''):'';
  $('flat').value=p&&p.lat!=null?p.lat:'';$('flng').value=p&&p.lng!=null?p.lng:'';
  $('de').checked=p?!!p.deliveryEnabled:true;$('pe').checked=p?p.pickupEnabled!==false:true;
  $('bands').textContent='';
  ((p&&p.feeBands)||[]).forEach(function(b){bandRow(b.maxKm,b.feeMinor/100)});
  if(!p){bandRow(3,1000);bandRow(8,2000);bandRow(15,3500)}
  var eta=p?(p.deliveryEta||'Within 2 to 4 hours'):'Within 2 to 4 hours';
  if(![].some.call($('eta').options,function(o){return o.value===eta})){var o=add($('eta'),'option',eta);o.value=eta}
  $('eta').value=eta;
  $('po').checked=p?p.onlinePayment!==false:true;$('pd').checked=p?!!p.payOnDelivery:false;$('pp').checked=p?p.payAtPickup!==false:true;
  $('fh').value=p?(p.acceptsHmo||[]).join(', '):'';$('fz').checked=p?p.active!==false:true;
  var box=$('staffbox');box.textContent='';
  if(CANADMIN){
    var ids=(p&&p.staffIds)||[];var list=STAFF.filter(function(u){return u.role==='pharmacist'&&u.status!=='disabled'});
    list.forEach(function(u){var l=add(box,'label',null,'inl');var c=add(l,'input');c.type='checkbox';c.className='chk';c.value=String(u.id);c.checked=ids.indexOf(String(u.id))>=0;l.appendChild(document.createTextNode(u.name+' ('+u.email+')'))});
    if(!list.length)add(box,'div','No pharmacist accounts yet. Add one in the clinic console first.','muted');
  }
  $('e-save').textContent='';posSay();refresh();$('sform').scrollIntoView();
}
async function loadSettings(){
  var l=$('slist');l.textContent='';
  var d=await api('/staff/pharmacy/services');
  if(!d.success)return;
  SERVS=d.services||[];renderWaiting();
  $('setup').classList.remove('hide');
  if(!d.services.length)add(l,'div',CANADMIN?'No pharmacy is set up yet. Choose "Add a pharmacy".':'No pharmacy is assigned to you yet. Ask an admin to assign you.','muted');
  d.services.forEach(function(p){
    var it=add(l,'div',null,'item');add(it,'strong',p.name);add(it,'span',p.active===false?'paused':'open to orders','tag '+(p.active===false?'p':'v'));
    add(it,'div',[p.deliveryEnabled?'Delivers':'No delivery',p.pickupEnabled!==false?'Pickup':'No pickup'].join(' · '),'muted');
    var b=add(it,'button','Edit','alt');b.onclick=function(){openForm(p)};
  });
}
$('b-save').onclick=async function(){
  say('e-save','');
  var bd=readBands();if(bd.error){say('e-save',bd.error);return}
  var pos=readPos();if(pos.error){say('e-save',pos.error);return}
  var st=refresh();
  if($('fz').checked&&!st.ok){say('e-save','Fix the items marked "Needs attention", or untick "Patients can order from this pharmacy" to save a draft.');return}
  var ids=[];Array.prototype.forEach.call($('staffbox').querySelectorAll('input'),function(c){if(c.checked)ids.push(c.value)});
  var body={
    name:$('fn').value,address:$('fa').value,phone:$('fph').value,lat:pos.lat===undefined?'':pos.lat,lng:pos.lng===undefined?'':pos.lng,
    deliveryEnabled:$('de').checked,pickupEnabled:$('pe').checked,feeBands:bd.bands,deliveryEta:$('eta').value,
    onlinePayment:$('po').checked,payOnDelivery:$('pd').checked,payAtPickup:$('pp').checked,
    acceptsHmo:hmoList(),active:$('fz').checked
  };
  if(CANADMIN)body.staffIds=ids;
  var d=await api('/staff/pharmacy/services/'+encodeURIComponent(CUR.pickedId||CUR.id),{method:'PUT',body:body});
  if(!d.success){say('e-save',d.message||'Could not save');return}
  note('Saved.',true);$('sform').classList.add('hide');loadSettings();
};
`;


const VISITS_HTML = String.raw`
<div class="wrap">
  <div class="top"><div><h1>Visits</h1><div class="sub">Today and upcoming visits for your clinic. Confirm requests, join virtual visits and file the summary.</div></div><div id="who" class="muted hide"></div></div>
  ${'__AUTH__'}
  <div id="app" class="hide">
    <div id="note" class="msg hide"></div>
    <div id="room" class="card hide">
      <div class="top"><h2 id="rt">Video visit</h2><button class="no" id="b-leave">Leave</button></div>
      <div id="remote" class="vid"></div>
      <div id="local" class="vid small"></div>
      <div><button class="alt" id="b-mic">Mute</button><button class="alt sp" id="b-cam">Camera off</button></div>
      <div class="muted gap">The patient joins from the app. Leave the room, then file the summary below.</div>
    </div>
    <div class="card">
      <div class="top"><h2>Visits</h2><button class="alt" id="b-ref">Refresh</button></div>
      <div id="list">Loading...</div>
    </div>
    <div id="sumcard" class="card hide">
      <h2 id="st">Visit summary</h2>
      <p class="muted">This is filed in the patient's record and the visit is marked completed. Add a diagnosis, notes, or both.</p>
      <label for="sd">Diagnosis</label><input id="sd" maxlength="300">
      <label for="sn">Notes</label><textarea id="sn" rows="6" maxlength="4000"></textarea>
      <button id="b-sum">File summary</button><button class="alt sp" id="b-sumx">Cancel</button>
      <div class="err" id="e-sum"></div>
    </div>
    <button class="alt" id="b-out">Sign out</button>
  </div>
</div>`;

const VISITS_JS = String.raw`
function add(parent,tag,text,cls){var e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;parent.appendChild(e);return e}
function note(t,good){var n=$('note');n.textContent=t;n.className='msg '+(good?'good':'bad');n.scrollIntoView();setTimeout(function(){n.className='msg hide'},6000)}
var ROOM=null,SUMID=null;
window.onSignedIn=function(staff){
  $('app').classList.remove('hide');$('who').classList.remove('hide');$('who').textContent=staff.name+' ('+staff.role.replace('_',' ')+')';load();
};
$('b-out').onclick=function(){leave();signOut()};$('b-ref').onclick=function(){load()};
var STATUS={requested:'waiting for you to confirm',awaiting_payment:'waiting for payment',awaiting_hmo:'waiting for HMO cover',confirmed:'confirmed'};
function when(v){if(!v)return '';var d=new Date(v);return d.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Lagos'})}
async function load(){
  var l=$('list');l.textContent='Loading...';
  var d=await api('/staff/visits');l.textContent='';
  if(!d.success){add(l,'div',d.message||'Could not load visits.','msg bad');return}
  if(!d.visits.length){add(l,'div','No visits from today onward.','muted');return}
  d.visits.forEach(function(v){
    var it=add(l,'div',null,'item');
    add(it,'strong',v.patientName+' · '+(v.visitType==='video'?'virtual':'in person'));
    add(it,'span',STATUS[v.status]||v.status,'tag '+(v.status==='confirmed'?'v':'p'));
    add(it,'div',when(v.startsAt)+(v.startsAt?'':' '+v.timeSlot)+(v.bookingRef?' · ref '+v.bookingRef:'')+' · '+v.facilityName,'muted');
    if(v.paymentStatus)add(it,'div','Payment: '+v.paymentStatus.replace(/_/g,' '),'muted');
    if(v.reason)add(it,'div','Reason: '+v.reason,'muted');
    if(v.status==='requested'){var c=add(it,'button','Confirm','ok sm');c.onclick=function(){act(v.id,'confirm')}}
    if(v.visitType==='video'&&v.status==='confirmed'){
      var j=add(it,'button','Join video visit','sm');j.disabled=!v.canJoin;j.onclick=function(){join(v)};
      if(!v.canJoin)add(it,'div',v.joinMessage,'muted');
      var f=add(it,'button',v.summaryDone?'Summary filed':'File summary','alt sm');f.disabled=v.summaryDone;f.onclick=function(){openSummary(v)};
    }
    var x=add(it,'button','Cancel visit','no sm');x.onclick=function(){if(confirm('Cancel this visit? The patient is told.'))act(v.id,'cancel')};
  });
}
async function act(id,what){
  var d=await api('/staff/visits/'+encodeURIComponent(id)+'/'+what,{method:'POST',body:{}});
  if(d.success){note(what==='confirm'?'Confirmed. The patient is told within a minute.':(d.refundDue?'Cancelled. This visit was paid, so it is marked for a refund.':'Cancelled.'),true);load()}else note(d.message||'Failed.',false);
}
async function join(v){
  if(ROOM)return;
  if(!window.LivekitClient){note('The video library did not load. Refresh the page.',false);return}
  var d=await api('/staff/visits/'+encodeURIComponent(v.id)+'/video-token',{method:'POST',body:{}});
  if(!d.success){note(d.message||'Could not start the visit.',false);return}
  var L=window.LivekitClient;
  var room=new L.Room({adaptiveStream:true,dynacast:true});
  room.on(L.RoomEvent.TrackSubscribed,function(track){var el=track.attach();$('remote').appendChild(el)});
  room.on(L.RoomEvent.TrackUnsubscribed,function(track){track.detach().forEach(function(e){e.remove()})});
  room.on(L.RoomEvent.Disconnected,function(){cleanup()});
  try{
    await room.connect(d.url,d.token);
    await room.localParticipant.enableCameraAndMicrophone();
  }catch(e){
    try{room.disconnect()}catch(x){}
    note('Could not join. Allow the camera and microphone for this page, then try again.',false);return;
  }
  ROOM=room;$('rt').textContent='Video visit with '+v.patientName;$('room').classList.remove('hide');$('room').scrollIntoView();
  var pub=room.localParticipant.getTrackPublication(L.Track.Source.Camera);
  if(pub&&pub.track){var lv=pub.track.attach();lv.muted=true;$('local').appendChild(lv)}
  $('b-mic').textContent='Mute';$('b-cam').textContent='Camera off';
}
function cleanup(){ROOM=null;$('remote').textContent='';$('local').textContent='';$('room').classList.add('hide')}
function leave(){if(ROOM){try{ROOM.disconnect()}catch(e){}}cleanup()}
$('b-leave').onclick=function(){leave();load()};
$('b-mic').onclick=async function(){if(!ROOM)return;var on=ROOM.localParticipant.isMicrophoneEnabled;await ROOM.localParticipant.setMicrophoneEnabled(!on);$('b-mic').textContent=on?'Unmute':'Mute'};
$('b-cam').onclick=async function(){if(!ROOM)return;var on=ROOM.localParticipant.isCameraEnabled;await ROOM.localParticipant.setCameraEnabled(!on);$('b-cam').textContent=on?'Camera on':'Camera off'};
window.addEventListener('beforeunload',function(){if(ROOM){try{ROOM.disconnect()}catch(e){}}});
function openSummary(v){SUMID=v.id;$('st').textContent='Summary for '+v.patientName;$('sd').value='';$('sn').value='';say('e-sum','');$('sumcard').classList.remove('hide');$('sumcard').scrollIntoView()}
$('b-sumx').onclick=function(){$('sumcard').classList.add('hide')};
$('b-sum').onclick=async function(){
  say('e-sum','');
  var d=await api('/telehealth/appointments/'+encodeURIComponent(SUMID)+'/summary',{method:'POST',body:{diagnosis:$('sd').value,notes:$('sn').value}});
  if(!d.success){say('e-sum',d.message||'Could not file the summary');return}
  $('sumcard').classList.add('hide');note('Summary filed. The patient is told.',true);load();
};
`;

function page(title: string, body: string, js: string, nonce: string, video = false) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex">
<title>${title}</title><style nonce="${nonce}">${STYLE}</style></head><body>${body.replace('__AUTH__', AUTH_HTML)}
${video ? '<script src="/vendor/livekit-client.umd.js"></script>' : ''}<script nonce="${nonce}">${AUTH_JS}${js}</script></body></html>`;
}

function send(res: Response, title: string, body: string, js: string, video = false) {
  const nonce = crypto.randomBytes(16).toString('base64');
  // The video page also loads the LiveKit client from this server and connects to the LiveKit project.
  let connect = "'self'";
  let script = `'nonce-${nonce}'`;
  let media = '';
  if (video) {
    script += " 'self'";
    media = "; media-src 'self' blob: mediastream:";
    try {
      const u = new URL(process.env.LIVEKIT_URL || '');
      const host = u.host;
      connect += ` wss://${host} https://${host}`;
    } catch {
      /* LIVEKIT_URL not set: the page loads, joining reports that video is not set up */
    }
  }
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'none'; script-src ${script}; style-src 'nonce-${nonce}'; connect-src ${connect}; img-src 'self' blob:${media}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
  );
  res.setHeader('Permissions-Policy', video ? 'camera=(self), microphone=(self)' : 'camera=(), microphone=()');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.type('html').send(page(title, body, js, nonce, video));
}

export const clinicPage = (_req: Request, res: Response) => send(res, 'WelliRecord clinic', CLINIC_HTML, CLINIC_JS);
export const consultationsPage = (_req: Request, res: Response) => send(res, 'WelliRecord consultation booking', CONSULT_HTML, CONSULT_JS);
export const ordersPage = (_req: Request, res: Response) => send(res, 'WelliRecord order review', ORDERS_HTML, ORDERS_JS);
export const pharmacyPage = (_req: Request, res: Response) => send(res, 'WelliRecord pharmacy orders', PHARMACY_HTML, PHARMACY_JS);
export const visitsPage = (_req: Request, res: Response) => send(res, 'WelliRecord visits', VISITS_HTML, VISITS_JS, true);
