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
@media(max-width:560px){.row{grid-template-columns:1fr}}
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
  <div class="top"><div><h1>Consultation booking</h1><div class="sub">Fees, weekly hours and HMO confirmations for patient bookings.</div></div><div id="who" class="muted hide"></div></div>
  ${'__AUTH__'}
  <div id="app" class="hide">
    <div id="note" class="msg hide"></div>
    <button class="alt" id="b-out">Sign out</button>
    <div class="card gap">
      <div class="top"><h2>Awaiting HMO confirmation</h2><button class="alt nt" id="b-href">Refresh</button></div>
      <div id="hmo"></div>
    </div>
    <div class="card">
      <h2>Providers</h2>
      <div id="plist"></div>
    </div>
    <div class="card" id="form">
      <h2 id="ft">Provider settings</h2>
      <p class="muted">Only an admin can save. Fees are in naira. Patients see only the fee for the visit type they choose.</p>
      <label for="fp">Pick a facility</label><select id="fp"></select>
      <div class="row">
        <div><label for="fn">Name</label><input id="fn"></div>
        <div><label for="fa">Address</label><input id="fa"></div>
        <div><label for="fs">Specialty</label><input id="fs" placeholder="Primary care"></div>
        <div><label for="fi">Facility ID (set by the picker)</label><input id="fi"></div>
      </div>
      <div class="row">
        <div><label><input type="checkbox" class="chk" id="oi" checked> Offers in-person visits</label><label for="fpi">In-person fee (naira)</label><input id="fpi" inputmode="decimal"></div>
        <div><label><input type="checkbox" class="chk" id="ov"> Offers virtual visits</label><label for="fpv">Virtual fee (naira)</label><input id="fpv" inputmode="decimal"></div>
      </div>
      <label for="fh">HMOs accepted (separated by commas, spelled as patients' plans are)</label><input id="fh" placeholder="Hygeia, AXA Mansard">
      <div class="row">
        <div><label><input type="checkbox" class="chk" id="pv"> Allow pay at the visit</label></div>
        <div><label><input type="checkbox" class="chk" id="po" checked> Allow online payment</label></div>
      </div>
      <label for="fm">Slot length (minutes)</label><input id="fm" value="30" inputmode="numeric">
      <label for="fw">Weekly hours, one window per line, Lagos time. Example: Mon 09:00-13:00</label>
      <textarea id="fw" rows="6" placeholder="Mon 09:00-13:00&#10;Mon 14:00-17:00&#10;Wed 09:00-13:00"></textarea>
      <label><input type="checkbox" class="chk" id="fz" checked> Taking bookings</label>
      <button id="b-save">Save provider</button><div class="err" id="e-save"></div>
    </div>
  </div>
</div>`;

const CONSULT_JS = String.raw`
var DAYS=['sun','mon','tue','wed','thu','fri','sat'];
function add(parent,tag,text,cls){var e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;parent.appendChild(e);return e}
function note(t,good){var n=$('note');n.textContent=t;n.className='msg '+(good?'good':'bad');setTimeout(function(){n.className='msg hide'},6000)}
function naira(minor){return minor==null?'':String(minor/100)}
function toMinor(v){v=String(v||'').replace(/[^0-9.]/g,'');if(!v)return undefined;return Math.round(parseFloat(v)*100)}
function parseHours(text){
  var out=[];var lines=String(text||'').split('\n');
  for(var i=0;i<lines.length;i++){
    var l=lines[i].trim().toLowerCase();if(!l)continue;
    var m=/^([a-z]{3})[a-z]*\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/.exec(l);
    var d=m?DAYS.indexOf(m[1]):-1;
    if(!m||d<0)return {error:'Line '+(i+1)+' should look like: Mon 09:00-13:00'};
    out.push({day:d,start:m[2],end:m[3]});
  }
  return {weekly:out};
}
function hoursText(w){return (w||[]).map(function(x){var n=DAYS[x.day];return n.charAt(0).toUpperCase()+n.slice(1)+' '+x.start+'-'+x.end}).join('\n')}
var FAC=[];
window.onSignedIn=function(staff){
  $('app').classList.remove('hide');$('who').classList.remove('hide');$('who').textContent=staff.name+' ('+staff.role.replace('_',' ')+')';
  loadFacilities();loadProviders();loadHmo();
};
$('b-out').onclick=signOut;$('b-href').onclick=function(){loadHmo()};
async function loadFacilities(){
  var d=await api('/staff/facility-options');FAC=d.success?d.facilities:[];
  var s=$('fp');s.textContent='';var o=add(s,'option','Choose...');o.value='';
  FAC.forEach(function(f,i){var e=add(s,'option',f.name+(f.address?' - '+f.address:''));e.value=String(i)});
}
$('fp').onchange=function(){
  var f=FAC[Number($('fp').value)];if(!f)return;
  $('fi').value=f.id;$('fn').value=f.name;$('fa').value=f.address||'';
};
function fill(p){
  $('fi').value=p.facilityId;$('fn').value=p.facilityName;$('fa').value=p.facilityAddress||'';$('fs').value=p.specialty||'';
  $('oi').checked=!!p.offersInPerson;$('ov').checked=!!p.offersVirtual;
  $('fpi').value=naira(p.feeInPersonMinor);$('fpv').value=naira(p.feeVirtualMinor);
  $('fh').value=(p.acceptsHmo||[]).join(', ');$('pv').checked=!!p.payAtVisit;$('po').checked=p.onlinePayment!==false;
  $('fm').value=String(p.slotMinutes||30);$('fw').value=hoursText(p.weekly);$('fz').checked=p.active!==false;
  $('form').scrollIntoView();
}
async function loadProviders(){
  var l=$('plist');l.textContent='Loading...';
  var d=await api('/staff/providers');l.textContent='';
  if(!d.success){add(l,'div',d.message||'Could not load providers.','msg bad');return}
  if(!d.providers.length){add(l,'div','No provider is set up yet. Use the form below.','muted');return}
  d.providers.forEach(function(p){
    var it=add(l,'div',null,'item');
    add(it,'strong',p.facilityName);
    add(it,'span',p.active===false?'paused':'live','tag '+(p.active===false?'p':'v'));
    var bits=[];
    if(p.offersInPerson)bits.push('In person '+naira(p.feeInPersonMinor));
    if(p.offersVirtual)bits.push('Virtual '+naira(p.feeVirtualMinor));
    add(it,'div',bits.join(' · ')+' · '+(p.weekly||[]).length+' time windows','muted');
    var b=add(it,'button','Edit','alt');b.onclick=function(){fill(p)};
  });
}
$('b-save').onclick=async function(){
  say('e-save','');
  var h=parseHours($('fw').value);if(h.error){say('e-save',h.error);return}
  var id=$('fi').value.trim();if(!id){say('e-save','Pick a facility first.');return}
  var body={
    facilityName:$('fn').value,facilityAddress:$('fa').value,specialty:$('fs').value,
    offersInPerson:$('oi').checked,offersVirtual:$('ov').checked,
    feeInPersonMinor:toMinor($('fpi').value),feeVirtualMinor:toMinor($('fpv').value),
    acceptsHmo:$('fh').value.split(',').map(function(x){return x.trim()}).filter(Boolean),
    payAtVisit:$('pv').checked,onlinePayment:$('po').checked,
    slotMinutes:Number($('fm').value),weekly:h.weekly,active:$('fz').checked
  };
  var d=await api('/staff/providers/'+encodeURIComponent(id)+'/service',{method:'PUT',body:body});
  if(!d.success){say('e-save',d.message||'Could not save');return}
  note('Saved.',true);loadProviders();
};
async function loadHmo(){
  var l=$('hmo');l.textContent='Loading...';
  var d=await api('/staff/bookings?status=awaiting_hmo');l.textContent='';
  if(!d.success){add(l,'div',d.message||'Could not load bookings.','msg bad');return}
  if(!d.bookings.length){add(l,'div','Nothing is waiting.','muted');return}
  d.bookings.forEach(function(b){
    var it=add(l,'div',null,'item');
    add(it,'strong',b.facilityName+' · ref '+b.bookingRef);
    add(it,'div',new Date(b.startsAt).toLocaleString()+' · '+(b.visitType==='video'?'Virtual':'In person')+' · fee '+naira(b.feeMinor),'muted');
    if(b.hmo)add(it,'div','Plan: '+(b.hmo.policyLabel||'-')+' · pre-authorisation '+(b.hmo.preAuthId||'none')+(b.hmo.clientStatus?' ('+b.hmo.clientStatus+' on the patient phone, not verified)':''),'muted');
    var a=add(it,'button','Approve cover','ok');a.onclick=function(){decide(b.id,'approve')};
    var n=add(it,'button','Decline','no');n.className='no sp';n.onclick=function(){decide(b.id,'decline')};
  });
}
async function decide(id,what){
  var body={decision:what};
  if(what==='approve'){var c=prompt('Approval code from the HMO (optional):');if(c===null)return;body.approvalCode=c}
  else if(!confirm('Decline? The patient is told and the time is released.'))return;
  var d=await api('/staff/bookings/'+encodeURIComponent(id)+'/hmo',{method:'POST',body:body});
  if(d.success){note(what==='approve'?'Cover approved. The booking is confirmed.':'Declined. The time was released.',true);loadHmo()}else note(d.message||'Failed.',false);
}
`;

function page(title: string, body: string, js: string, nonce: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex">
<title>${title}</title><style nonce="${nonce}">${STYLE}</style></head><body>${body.replace('__AUTH__', AUTH_HTML)}
<script nonce="${nonce}">${AUTH_JS}${js}</script></body></html>`;
}

function send(res: Response, title: string, body: string, js: string) {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
  );
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.type('html').send(page(title, body, js, nonce));
}

export const clinicPage = (_req: Request, res: Response) => send(res, 'WelliRecord clinic', CLINIC_HTML, CLINIC_JS);
export const consultationsPage = (_req: Request, res: Response) => send(res, 'WelliRecord consultation booking', CONSULT_HTML, CONSULT_JS);
export const ordersPage = (_req: Request, res: Response) => send(res, 'WelliRecord order review', ORDERS_HTML, ORDERS_JS);
