// The shared .html file: a self-contained, view-only page that shows the design (every page,
// arrow keys to move), with its pictures and fonts embedded as data URLs. A Content Security
// Policy forbids every network request. In "review" mode viewers can drop numbered pins with
// notes and download them as a small .json for the designer to import.

export const COMMENTS_KIND = "oddlyclever-review-comments";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Inline <svg> markup without its XML prolog, sized by the page box. */
export function inlineSvg(svg) {
  return String(svg).replace(/^\s*<\?xml[^>]*\?>\s*/i, "").replace(/<!DOCTYPE[^>]*>\s*/i, "")
    .replace(/<svg\b([^>]*)>/i, (m, attrs) => `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, "")} preserveAspectRatio="xMidYMid meet" role="img">`);
}

const CSS = `
:root{--bg:#0d0a10;--bg2:#151019;--bg3:#1e1724;--line:rgba(255,230,240,.12);--text:#f7eff4;--muted:#b2a5b6;--accent:#ff2e7e;--paper:#f3ead8;--ink:#16121b;--cyan:#8fe3ff}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--bg);color:var(--text);font:14px/1.45 system-ui,"Segoe UI",Roboto,sans-serif}
body{display:flex;flex-direction:column;overflow:hidden}
header{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--bg2);flex:none;flex-wrap:wrap}
.title{padding:3px 10px 2px;background:var(--paper);color:var(--ink);font-weight:800;border-radius:2px;transform:rotate(-1deg);max-width:40vw;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.grow{flex:1}button,input,textarea{font:inherit;color:inherit}
button{cursor:pointer;height:34px;padding:0 12px;border-radius:8px;border:1px solid var(--line);background:var(--bg3)}
button:hover{border-color:rgba(255,230,240,.3)}button:disabled{opacity:.35;cursor:default}
button.on,button.primary{border-color:var(--accent);background:rgba(255,46,126,.2)}button.primary{background:var(--accent);color:#fff;font-weight:700}
.count{color:var(--muted);min-width:64px;text-align:center}
main{flex:1;display:flex;min-height:0}
.stage{flex:1;display:grid;place-items:center;padding:20px;min-width:0;overflow:auto}
.pg{display:none;position:relative;background:#fff;box-shadow:0 20px 60px -20px #000,0 0 0 1px var(--line)}
.pg.cur{display:block}.pg>svg,.pg>img{display:block;width:100%;height:100%}
.made{position:fixed;left:12px;bottom:8px;font-size:11px;color:var(--muted);opacity:.7}
.review .pg{cursor:default}.review.adding .pg{cursor:crosshair}
.pin{position:absolute;width:28px;height:28px;margin:-34px 0 0 -14px;border-radius:50% 50% 50% 2px;border:2px solid #fff;background:var(--accent);color:#fff;
 font:800 12px system-ui;display:grid;place-items:center;padding:0;box-shadow:0 4px 12px #0008;transform:rotate(-45deg)}
.pin span{transform:rotate(45deg)}.pin.sel{background:var(--cyan);color:var(--ink)}
.note{position:absolute;z-index:5;width:260px;padding:10px;border-radius:12px;background:var(--bg2);border:1px solid var(--line);box-shadow:0 18px 40px -12px #000;cursor:default}
.note textarea{width:100%;min-height:80px;resize:vertical;border-radius:8px;border:1px solid var(--line);background:#0008;padding:8px}
.note .row{display:flex;gap:6px;justify-content:flex-end;margin-top:8px}
aside{width:290px;flex:none;border-left:1px solid var(--line);background:var(--bg2);display:flex;flex-direction:column;min-height:0}
aside h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin:14px 14px 6px;color:var(--muted)}
aside .who{margin:0 14px 10px}aside .who input{width:100%;height:34px;border-radius:8px;border:1px solid var(--line);background:#0008;padding:0 10px}
.list{flex:1;overflow:auto;padding:0 10px}.item{display:flex;gap:8px;padding:8px;border-radius:8px;cursor:pointer;border:1px solid transparent}
.item:hover{background:var(--bg3)}.item b{flex:none;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font-size:11px}
.item p{margin:0;word-break:break-word}.item small{color:var(--muted)}.empty{color:var(--muted);padding:8px 4px}
.foot{padding:12px 14px;border-top:1px solid var(--line);display:grid;gap:6px}.foot small{color:var(--muted)}
.help{color:var(--muted);font-size:12.5px}
@media (max-width:760px){aside{display:none}.title{max-width:50vw}}
`;

export const VIEWER_JS = `
(function(){
var pages=[].slice.call(document.querySelectorAll('.pg')),cur=0,count=document.querySelector('.count');
var prev=document.getElementById('prev'),next=document.getElementById('next');
function go(i){if(!pages.length)return;cur=Math.max(0,Math.min(pages.length-1,i));
pages.forEach(function(p,k){p.classList.toggle('cur',k===cur)});
if(count)count.textContent=(cur+1)+' / '+pages.length;if(prev)prev.disabled=cur===0;if(next)next.disabled=cur===pages.length-1;
if(window.__ocReview)window.__ocReview.paint();}
if(prev)prev.onclick=function(){go(cur-1)};if(next)next.onclick=function(){go(cur+1)};
document.addEventListener('keydown',function(e){var t=e.target;if(t&&(t.tagName==='TEXTAREA'||t.tagName==='INPUT'))return;
if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){e.preventDefault();go(cur+1)}
else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(cur-1)}
else if(e.key==='Home')go(0);else if(e.key==='End')go(pages.length-1);});
window.__ocGo=go;window.__ocCur=function(){return cur};go(0);
})();`;

export const REVIEW_JS = `
(function(){
var meta=JSON.parse(document.getElementById('oc-meta').textContent);
var KEY='oc-review-'+meta.exportId,list=[],saved=true,adding=false,open=null;
try{var d=JSON.parse(localStorage.getItem(KEY)||'null');if(d&&Array.isArray(d.list))list=d.list.filter(function(c){return c&&typeof c.text==='string'});}catch(e){}
var who=document.getElementById('who'),add=document.getElementById('add'),save=document.getElementById('save'),box=document.querySelector('.list'),state=document.getElementById('state');
try{who.value=localStorage.getItem('oc-review-name')||''}catch(e){}
who.oninput=function(){try{localStorage.setItem('oc-review-name',who.value)}catch(e){}};
function store(){saved=false;try{localStorage.setItem(KEY,JSON.stringify({list:list}))}catch(e){}paint()}
function el(t,c,txt){var n=document.createElement(t);if(c)n.className=c;if(txt!=null)n.textContent=txt;return n}
function setAdding(v){adding=v;document.body.classList.toggle('adding',v);add.classList.toggle('on',v);add.textContent=v?'Click the design…':'+ Add a comment'}
add.onclick=function(){setAdding(!adding)};
document.addEventListener('keydown',function(e){if(e.key==='Escape'){setAdding(false);open=null;paint()}else if((e.key==='c'||e.key==='C')&&e.target===document.body)setAdding(!adding)});
[].slice.call(document.querySelectorAll('.pg')).forEach(function(pg,pi){pg.addEventListener('click',function(e){
if(e.target.closest('.pin')||e.target.closest('.note')||!adding)return;var r=pg.getBoundingClientRect();
var c={id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),page:pi,x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)),text:'',at:new Date().toISOString()};
list.push(c);open=c.id;setAdding(false);paint();var ta=document.querySelector('.note textarea');if(ta)ta.focus();});});
function note(c,pg){var n=el('div','note');n.style.left=Math.min(c.x*100,70)+'%';n.style.top=Math.min(c.y*100+3,80)+'%';
var ta=el('textarea');ta.value=c.text;ta.placeholder='What should change here?';ta.maxLength=2000;n.appendChild(ta);
var row=el('div','row'),del=el('button',null,'Delete'),ok=el('button','primary','Save');
del.onclick=function(){list=list.filter(function(x){return x.id!==c.id});open=null;store()};
ok.onclick=function(){var v=ta.value.trim();if(!v){del.onclick();return}c.text=v;open=null;store()};
ta.addEventListener('keydown',function(e){if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))ok.onclick()});
row.appendChild(del);row.appendChild(ok);n.appendChild(row);pg.appendChild(n)}
function paint(){var pgs=[].slice.call(document.querySelectorAll('.pg'));
pgs.forEach(function(pg){[].slice.call(pg.querySelectorAll('.pin,.note')).forEach(function(x){x.remove()})});
list.forEach(function(c,i){var pg=pgs[c.page];if(!pg)return;var p=el('button','pin'+(open===c.id?' sel':''));p.style.left=c.x*100+'%';p.style.top=c.y*100+'%';
p.title=c.text||'New comment';p.appendChild(el('span',null,String(i+1)));p.onclick=function(e){e.stopPropagation();open=open===c.id?null:c.id;paint()};pg.appendChild(p);
if(open===c.id)note(c,pg)});
box.textContent='';var done=list.filter(function(c){return c.text});
if(!done.length)box.appendChild(el('p','empty','No comments yet. Click “+ Add a comment”, then click the spot on the design.'));
list.forEach(function(c,i){if(!c.text)return;var it=el('div','item');it.appendChild(el('b',null,String(i+1)));var t=el('div');t.appendChild(el('p',null,c.text));
if(pgs.length>1)t.appendChild(el('small',null,'Page '+(c.page+1)));it.appendChild(t);it.onclick=function(){window.__ocGo(c.page);open=c.id;paint()};box.appendChild(it)});
save.disabled=!done.length;state.textContent=!done.length?'':saved?'Saved to a file.':done.length+' comment'+(done.length>1?'s':'')+' not saved to a file yet.'}
save.onclick=function(){var done=list.filter(function(c){return c.text});if(!done.length)return;
var out={app:'oddlyclever-design',kind:'${COMMENTS_KIND}',version:1,design:{id:meta.designId,name:meta.name,exportId:meta.exportId,pages:meta.pages},
reviewer:who.value.trim().slice(0,80),savedAt:new Date().toISOString(),
comments:done.map(function(c,i){return{n:i+1,page:c.page,x:+c.x.toFixed(4),y:+c.y.toFixed(4),text:c.text,at:c.at}})};
var b=new Blob([JSON.stringify(out,null,1)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);
var nm=(meta.name||'design').replace(/[^\\w\\- ]+/g,'').trim()||'design';a.download='comments - '+nm+(out.reviewer?' - '+out.reviewer.replace(/[^\\w\\- ]+/g,''):'')+'.json';
document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);saved=true;paint()};
window.addEventListener('beforeunload',function(e){if(!saved&&list.some(function(c){return c.text})){e.preventDefault();e.returnValue=''}});
window.__ocReview={paint:paint,list:function(){return list}};paint();
})();`;

/**
 * CSP sources that allow exactly our own scripts (so nothing that slipped into a page's markup
 * can run). Uses the browser's SubtleCrypto.
 */
export async function scriptHashes(mode = "view") {
  const list = mode === "review" ? [VIEWER_JS, REVIEW_JS] : [VIEWER_JS];
  const out = [];
  for (const js of list) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(js));
    let bin = "";
    for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
    out.push(`'sha256-${btoa(bin)}'`);
  }
  return out;
}

/**
 * The whole .html file as a string. Pass `hashes` from scriptHashes() to lock scripts down
 * (without them inline scripts are allowed).
 * @param {{title: string, mode: "view"|"review", designId?: string, exportId: string,
 *   pages: {width: number, height: number, markup: string}[], fontCSS?: string}} o
 */
export function buildShareHtml({ title, mode = "view", designId = "", exportId, pages, fontCSS = "", hashes = null }) {
  if (!Array.isArray(pages) || !pages.length) throw new Error("There's nothing to share.");
  const review = mode === "review";
  const multi = pages.length > 1;
  const meta = JSON.stringify({ designId, name: title, exportId, pages: pages.length }).replace(/</g, "\\u003c");
  const pageHtml = pages.map((p, i) => {
    const w = Math.max(1, Math.round(p.width)), h = Math.max(1, Math.round(p.height));
    const room = review ? "100vw - 340px" : "100vw - 40px";
    return `<section class="pg" data-page="${i}" aria-label="Page ${i + 1}" style="aspect-ratio:${w}/${h};width:min(calc(${room}),calc((100vh - 110px) * ${w} / ${h}))">${p.markup}</section>`;
  }).join("\n");
  const csp = `default-src 'none'; img-src data: blob:; font-src data:; style-src 'unsafe-inline'; script-src ${hashes?.length ? hashes.join(" ") : "'unsafe-inline'"}; base-uri 'none'; form-action 'none'`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="generator" content="OddlyClever Design">
<title>${esc(title)}${review ? " (review copy)" : ""}</title>
<style>${CSS}${fontCSS ? `\n${fontCSS}` : ""}</style>
</head><body class="${review ? "review" : "view"}">
<header><span class="title" title="${esc(title)}">${esc(title)}</span>${review ? `<span class="help">Review copy: add comments, then save them and send the file back.</span>` : ""}<span class="grow"></span>
${multi ? `<button id="prev" aria-label="Previous page">&#8592;</button><span class="count" aria-live="polite"></span><button id="next" aria-label="Next page">&#8594;</button>` : ""}
${review ? `<button id="add">+ Add a comment</button>` : ""}</header>
<main><div class="stage">
${pageHtml}
</div>${review ? `<aside aria-label="Comments"><h2>Your name</h2><div class="who"><input id="who" maxlength="80" placeholder="So the designer knows who you are"></div>
<h2>Comments</h2><div class="list"></div><div class="foot"><button id="save" class="primary">Save my comments</button><small id="state"></small><small>Saves a small .json file. Send it to the designer.</small></div></aside>` : ""}</main>
<span class="made">Made with OddlyClever Design</span>
<script type="application/json" id="oc-meta">${meta}</script>
<script>${VIEWER_JS}</script>${review ? `\n<script>${REVIEW_JS}</script>` : ""}
</body></html>`;
}
