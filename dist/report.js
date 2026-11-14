function e(e){let t=e.timing.queuedAt??e.timing.startedAt,n=e.timing.completedAt;if(t!==void 0&&n!==void 0&&Number.isFinite(t)&&Number.isFinite(n)&&!(t<0||n<t))return{startedAt:t,endedAt:n}}function t(t){let n=[];for(let r of t){let t=e(r);t!==void 0&&n.push(t)}n.sort((e,t)=>e.startedAt-t.startedAt||e.endedAt-t.endedAt);let r=n[0];if(r===void 0)return{requests:t.length,measured:0,busyMs:void 0,spanMs:void 0};let i=0,a=r.startedAt,o=r.endedAt,s=r.endedAt;for(let e=1;e<n.length;e+=1){let t=n[e];t!==void 0&&(t.endedAt>s&&(s=t.endedAt),t.startedAt>o?(i+=o-a,a=t.startedAt,o=t.endedAt):t.endedAt>o&&(o=t.endedAt))}return i+=o-a,{requests:t.length,measured:n.length,busyMs:i,spanMs:s-r.startedAt}}function n(e,t){if(e!==void 0&&t!==void 0&&Number.isFinite(e)&&Number.isFinite(t)&&!(t<e))return t-e}function r(e){return{queueMs:n(e.queuedAt,e.sentAt),durationMs:n(e.queuedAt??e.startedAt,e.completedAt),timeToResponseMs:n(e.sentAt??e.startedAt,e.responseStartedAt),responseBodyMs:n(e.responseStartedAt,e.responseCompletedAt)}}function i(e,t){for(let n of e.paints)if(n.name===t)return n.startedAt}function a(e){return e!==void 0&&Number.isFinite(e)&&e>=0?e:0}function o(e){let{navigation:t}=e,{startedAt:r}=t,a=n(r,t.loadEventAt),o=n(r,i(e,`first-contentful-paint`)),s=n(r,e.largestContentfulPaintAt),c=s??o;return{domContentLoadedMs:n(r,t.domContentLoadedAt),loadEventMs:a,durationMs:a??n(r,e.capturedAt),firstPaintMs:n(r,i(e,`first-paint`)),firstContentfulPaintMs:o,largestContentfulPaintMs:s,renderMs:c,renderBasis:c===void 0?void 0:s===void 0?`fcp`:`lcp`,stableMs:n(r,e.stableAt)}}function s(e){let t=e.navigation,n=e.resources,r=a(t.transferBytes),i=a(n.transferBytes);return{documentTransferBytes:r,resourceTransferBytes:i,totalTransferBytes:r+i,totalEncodedBodyBytes:a(t.encodedBodyBytes)+a(n.encodedBodyBytes),totalDecodedBodyBytes:a(t.decodedBodyBytes)+a(n.decodedBodyBytes),resourceRequests:n.requests,unknownResources:n.unknownRequests}}function c(e){let t=e.response?.contentLength;if(t!==void 0&&!(!Number.isSafeInteger(t)||t<0))return t}function l(e){return{declaredBytes:c(e)}}function u(e){let t=0,n=0,r=0;for(let i of e){let e=c(i);e===void 0?r+=1:(t+=e,n+=1)}return{declaredBytes:t,measuredResponses:n,unknownResponses:r,responses:e.length}}const d=Object.freeze({status:`unavailable`,reason:`missing`}),f=Object.freeze({status:`unavailable`,reason:`invalid-duration`});function p(e,t){if(typeof e!=`number`)throw TypeError(`${t} must be a number, received ${String(e)}`);if(!Number.isFinite(e))throw RangeError(`${t} must be a finite number, received ${String(e)}`);if(e<0)throw RangeError(`${t} must be greater than or equal to 0, received ${String(e)}`)}function m(e,t,n){if(p(t,`warningThresholdMs`),p(n,`criticalThresholdMs`),t>=n)throw RangeError(`warningThresholdMs must be less than criticalThresholdMs, received ${t} and ${n}`);if(e===void 0)return d;if(typeof e!=`number`||!Number.isFinite(e)||e<0)return f;let r;return r=e<t?`normal`:e<n?`warning`:`critical`,Object.freeze({status:r,durationMs:e})}function h(e){if(e.lifecycle===`completed`&&e.uiTiming!==void 0)return n(e.timing.completedAt,e.uiTiming.updatedAt)}function g(e,t){let n=r(e.timing),i=h(e);return Object.freeze({queueMs:m(n.queueMs,t.queueMs.warningMs,t.queueMs.criticalMs),timeToResponseMs:m(n.timeToResponseMs,t.timeToResponseMs.warningMs,t.timeToResponseMs.criticalMs),responseBodyMs:m(n.responseBodyMs,t.responseProcessingMs.warningMs,t.responseProcessingMs.criticalMs),uiUpdateMs:m(i,t.uiUpdateMs.warningMs,t.uiUpdateMs.criticalMs)})}const _=Object.freeze({unavailable:0,normal:1,warning:2,critical:3});function v(e){return e.lifecycle===`completed`||e.lifecycle===`failed`||e.lifecycle===`aborted`}function y(e,t){let n=[t.queueMs,t.timeToResponseMs,t.responseBodyMs,t.uiUpdateMs],r=`unavailable`;for(let e of n)_[e.status]>_[r]&&(r=e.status);return e.lifecycle===`failed`?`critical`:e.lifecycle===`aborted`?b(r,`warning`):e.outcome.kind===`http-error`?b(r,e.response.status>=500?`critical`:`warning`):r}function b(e,t){return _[e]>=_[t]?e:t}function ee(e){return[{key:`queueMs`,evaluation:e.queueMs},{key:`timeToResponseMs`,evaluation:e.timeToResponseMs},{key:`responseBodyMs`,evaluation:e.responseBodyMs},{key:`uiUpdateMs`,evaluation:e.uiUpdateMs}]}function x(e){let t;for(let n of ee(e)){let e=n.evaluation;if(e.status===`unavailable`||e.status===`normal`)continue;if(t===void 0){t=n;continue}let r=t.evaluation;if(r.status===`unavailable`||r.status===`normal`){t=n;continue}let i=_[e.status]-_[r.status];(i>0||i===0&&e.durationMs>r.durationMs)&&(t=n)}return t?.key}const S={queueMs:`queueMs`,timeToResponseMs:`timeToResponseMs`,responseBodyMs:`responseProcessingMs`,uiUpdateMs:`uiUpdateMs`};function C(e,t){if(e.lifecycle===`failed`){let n=e.outcome.kind;return n===`network-error`||n===`timeout`?t.ownership.failure:void 0}if(e.lifecycle===`completed`&&e.outcome.kind===`http-error`){let n=e.response.status;if(!Number.isFinite(n))return;if(n>=500)return t.ownership.serverError;if(n>=400)return t.ownership.clientError}}function w(e,t,n){let r=C(e,n);if(r!==void 0)return r;let i=x(t);return i===void 0?void 0:n.ownership[S[i]]}const T={unavailable:0,normal:1,warning:2,critical:3},E={queue:`Queue`,timeToResponse:`Time to response`,responseBody:`Response body`,uiUpdate:`UI render`},D=[`queue`,`timeToResponse`,`responseBody`,`uiUpdate`],O={queueMs:`queue`,timeToResponseMs:`timeToResponse`,responseBodyMs:`responseBody`,uiUpdateMs:`uiUpdate`},k={queue:`queueMs`,timeToResponse:`timeToResponseMs`,responseBody:`responseProcessingMs`,uiUpdate:`uiUpdateMs`};function A(e,t){switch(e){case`queue`:return t.queueMs;case`timeToResponse`:return t.timeToResponseMs;case`responseBody`:return t.responseProcessingMs;case`uiUpdate`:return t.uiUpdateMs}}function te(e,t,n){return Object.freeze({stage:e,label:E[e],durationMs:t.status===`unavailable`?void 0:t.durationMs,status:t.status,unavailableReason:t.status===`unavailable`?t.reason:void 0,warningMs:n.warningMs,criticalMs:n.criticalMs})}function ne(e,t){switch(e){case`queue`:return t.queueMs;case`timeToResponse`:return t.timeToResponseMs;case`responseBody`:return t.responseBodyMs;case`uiUpdate`:return t.uiUpdateMs}}function re(e,t){return Object.freeze(D.map(n=>te(n,ne(n,e),A(n,t))))}function ie(e,t,n){if(!v(e))return;let i=g(e,t),a=y(e,i),o=x(i),s=e.response,c=r(e.timing);return Object.freeze({id:e.id,method:e.method,url:e.url,transport:e.transport,lifecycle:e.lifecycle,outcome:e.outcome.kind,statusCode:s?.status,statusText:s?.statusText,declaredBytes:l(e).declaredBytes,durationMs:c.durationMs,severity:a,flaggedStage:o===void 0?void 0:O[o],owner:w(e,i,{ownership:n}),phases:re(i,t)})}function ae(e,t){let n=T[t.severity]-T[e.severity];if(n!==0)return n;let r=e.durationMs??-1;return(t.durationMs??-1)-r}function j(e,t,n,r){t[e.severity]+=1,e.flaggedStage!==void 0&&n.set(e.flaggedStage,(n.get(e.flaggedStage)??0)+1),e.owner!==void 0&&r.set(e.owner,(r.get(e.owner)??0)+1)}function M(e,t,n,r){let i={unavailable:0,normal:0,warning:0,critical:0},a=/* @__PURE__ */ new Map,o=/* @__PURE__ */ new Map,s=0,c=0;for(let t of e)j(t,i,a,o),t.lifecycle===`failed`&&(s+=1),t.owner===void 0&&(c+=1);let l=u(t),d=Object.freeze(D.map(e=>{let t=A(e,n);return Object.freeze({stage:e,label:E[e],count:a.get(e)??0,owner:r[k[e]],warningMs:t.warningMs,criticalMs:t.criticalMs})})),f=Object.freeze([...o.entries()].map(([e,t])=>Object.freeze({owner:e,count:t})).sort((e,t)=>t.count-e.count||e.owner.localeCompare(t.owner)));return Object.freeze({total:e.length,bySeverity:Object.freeze(i),failed:s,unassigned:c,byStage:d,byOwner:f,declaredBytes:l.declaredBytes,measuredResponses:l.measuredResponses,unknownResponses:l.unknownResponses})}function N(e,t,n,r){let i=m(n,r.warningMs,r.criticalMs);return Object.freeze({key:e,label:t,durationMs:i.status===`unavailable`?void 0:i.durationMs,status:i.status,warningMs:r.warningMs,criticalMs:r.criticalMs})}function P(e){let t=`unavailable`;for(let n of e)T[n]>T[t]&&(t=n);return t}function F(e,t){return e===`fcp`?t.firstContentfulPaintMs:t.largestContentfulPaintMs}function I(e,n,r){let i=o(e),a=Object.freeze([N(`load`,`Load`,i.loadEventMs,n.pageLoadMs),N(`render`,i.renderBasis===`fcp`?`Render (FCP)`:`Render (LCP)`,i.renderMs,F(i.renderBasis,n)),N(`fcp`,`First contentful paint`,i.firstContentfulPaintMs,n.firstContentfulPaintMs),N(`lcp`,`Largest contentful paint`,i.largestContentfulPaintMs,n.largestContentfulPaintMs),N(`stable`,`Stable`,i.stableMs,n.pageStableMs)]);return Object.freeze({url:e.url,kind:e.kind,navigationType:e.navigation.type,durations:i,bytes:s(e),api:t(r),metrics:a,severity:P(a.map(e=>e.status))})}function L(e){let{settings:t}=e,n=e.measurements.filter(v),r=[];for(let e of n){let n=ie(e,t.thresholds,t.ownership);n!==void 0&&r.push(n)}return r.sort(ae),Object.freeze({version:e.version,generatedAt:e.generatedAt,page:e.page===void 0?void 0:I(e.page,t.pageThresholds,n),entries:Object.freeze(r),summary:M(r,n,t.thresholds,t.ownership),settings:t})}const R={normal:`Normal`,warning:`Warning`,critical:`Critical`,unavailable:`Unavailable`},z={unavailable:0,normal:1,warning:2,critical:3},B={queue:`Queue`,timeToResponse:`Time to response`,responseBody:`Response body`,uiUpdate:`UI render`},V={"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`};function H(e){return e.replace(/[&<>"']/g,e=>V[e]??e)}function U(e,t){return/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(e)?e:t}function W(e){return e===void 0||!Number.isFinite(e)?`—`:`${String(Number.isInteger(e)?e:Number(e.toFixed(1)))} ms`}function G(e){if(e===void 0||!Number.isFinite(e)||e<0)return`—`;if(e<1024)return`${String(Math.round(e))} B`;let t=[`kB`,`MB`,`GB`],n=e/1024,r=t[0]??`kB`;for(let e=1;e<t.length&&n>=1024;e+=1)n/=1024,r=t[e]??r;return`${String(Number(n.toFixed(1)))} ${r}`}function K(e){let t=new Date(e);return Number.isNaN(t.getTime())?`unknown`:`${t.toISOString().replace(`T`,` `).replace(/\.\d{3}Z$/,``)} UTC`}function q(e,t){return e.phases.find(e=>e.stage===t)}function J(e){return e.statusCode===void 0?`—`:e.statusText===void 0||e.statusText===``?String(e.statusCode):`${String(e.statusCode)} ${e.statusText}`}function oe(e){return[e.method,e.url,e.transport,e.lifecycle,e.outcome,e.severity,e.statusCode===void 0?``:String(e.statusCode),e.owner??``,e.flaggedStage===void 0?``:B[e.flaggedStage]].join(` `).toLowerCase()}const Y=[{key:`severity`,label:`Severity`,numeric:!0,value:e=>R[e.severity],sortValue:e=>z[e.severity]},{key:`method`,label:`Method`,numeric:!1,value:e=>e.method},{key:`url`,label:`URL`,numeric:!1,value:e=>e.url},{key:`transport`,label:`Transport`,numeric:!1,value:e=>e.transport},{key:`status`,label:`Status`,numeric:!0,value:J,sortValue:e=>e.statusCode},{key:`lifecycle`,label:`Lifecycle`,numeric:!1,value:e=>e.lifecycle},{key:`outcome`,label:`Outcome`,numeric:!1,value:e=>e.outcome},X(`queue`,`Queue`),X(`timeToResponse`,`Time to response`),X(`responseBody`,`Response body`),X(`uiUpdate`,`UI render`),{key:`duration`,label:`Duration`,numeric:!0,value:e=>W(e.durationMs),sortValue:e=>e.durationMs},{key:`bytes`,label:`Bytes`,numeric:!0,value:e=>G(e.declaredBytes),sortValue:e=>e.declaredBytes},{key:`stage`,label:`Slow stage`,numeric:!1,value:e=>e.flaggedStage===void 0?`—`:B[e.flaggedStage]}];function X(e,t){return{key:e,label:t,numeric:!0,value:t=>W(q(t,e)?.durationMs),sortValue:t=>q(t,e)?.durationMs}}function se(e){return e.settings.hasOwners?[...Y,{key:`owner`,label:`Owner`,numeric:!1,value:e=>e.owner??`—`}]:Y}function ce(e,t){let n=e.sortValue?.(t),r=n!==void 0&&Number.isFinite(n)?` data-sort-value="${String(n)}"`:``;if(e.key===`severity`)return`<td data-col="severity"${r}><span class="severity severity--${t.severity}">${H(e.value(t))}</span></td>`;let i=e.value(t);return e.key===`url`?`<td data-col="url" title="${H(t.url)}"><span class="url">${H(i)}</span></td>`:`<td data-col="${e.key}"${r}${e.numeric?` class="num"`:``}>${H(i)}</td>`}function le(e){return`<th scope="col" data-col="${e.key}" aria-sort="none"><button type="button" data-sort-key="${e.key}" data-numeric="${e.numeric?`true`:`false`}">${H(e.label)}</button></th>`}function ue(e,t){return`<tr data-row data-severity="${e.severity}" data-search="${H(oe(e))}">${t.map(t=>ce(t,e)).join(``)}</tr>`}function de(e){let{summary:t}=e;return`<section aria-labelledby="summary-heading"><h2 id="summary-heading">Summary</h2><div class="grid">${[[String(t.total),`Requests`],[String(t.bySeverity.critical),`Critical`],[String(t.bySeverity.warning),`Warning`],[String(t.failed),`Failed`],[G(t.declaredBytes),`Declared bytes`]].map(([e,t])=>`<div class="card"><span class="card__value">${H(e)}</span><span class="card__label">${H(t)}</span></div>`).join(``)}</div></section>`}function fe(e){return`<section aria-labelledby="stages-heading"><h2 id="stages-heading">Slow stages and responsible team</h2><div class="panel"><div class="table-wrap"><table><thead><tr><th scope="col">Stage</th><th scope="col">Flagged</th><th scope="col">Owner</th><th scope="col">Warning</th><th scope="col">Critical</th></tr></thead><tbody>${e.summary.byStage.map(e=>`<tr><td>${H(e.label)}</td><td class="num">${String(e.count)}</td><td>${H(e.owner??`—`)}</td><td class="num">${H(W(e.warningMs))}</td><td class="num">${H(W(e.criticalMs))}</td></tr>`).join(``)}</tbody></table></div></div></section>`}function pe(e){return e.settings.hasOwners?`<div class="table-wrap"><table><thead><tr><th scope="col">Owner</th><th scope="col">Requests</th></tr></thead><tbody>${e.summary.byOwner.map(e=>`<tr><td>${H(e.owner)}</td><td class="num">${String(e.count)}</td></tr>`).join(``)}${`<tr><td>No declared owner</td><td class="num">${String(e.summary.unassigned)}</td></tr>`}</tbody></table></div>`:`<p class="note">No owner mapping was configured, so this report cannot name a responsible team. Ownership is always explicit; nothing is inferred from timings.</p><pre><code>createMonitor({
  ownership: {
    timeToResponseMs: 'Backend',
    responseProcessingMs: 'Frontend',
    uiUpdateMs: 'Frontend',
    failure: 'Network',
  },
})</code></pre>`}function me(e){let t=e.page;if(t===void 0)return``;let n=[[W(t.durations.domContentLoadedMs),`DOMContentLoaded`],[W(t.durations.loadEventMs),`Load`],[W(t.durations.renderMs),t.durations.renderBasis===`fcp`?`Render (FCP)`:`Render (LCP)`],[W(t.durations.firstContentfulPaintMs),`First paint`],[W(t.durations.largestContentfulPaintMs),`Largest paint`],[W(t.durations.stableMs),`Stable`],[W(t.api.busyMs),`API busy`],[W(t.api.spanMs),`API span`],[String(t.bytes.resourceRequests),`Resources`],[G(t.bytes.totalTransferBytes),`Transfer`]],r=t.metrics.map(e=>`<tr><td>${H(e.label)}</td><td class="num">${H(W(e.durationMs))}</td><td><span class="severity severity--${e.status}">${H(R[e.status])}</span></td><td class="num">${H(W(e.warningMs))}</td><td class="num">${H(W(e.criticalMs))}</td></tr>`).join(``);return`<section aria-labelledby="page-heading"><h2 id="page-heading">Page performance</h2><p class="meta">${H(t.url)} · ${H(t.kind)} · ${H(t.navigationType)}<span class="severity severity--${t.severity}">${H(R[t.severity])}</span></p><div class="grid">${n.map(([e,t])=>`<div class="card"><span class="card__value">${H(e)}</span><span class="card__label">${H(t)}</span></div>`).join(``)}</div><div class="panel"><div class="table-wrap"><table><thead><tr><th scope="col">Metric</th><th scope="col">Duration</th><th scope="col">Status</th><th scope="col">Warning</th><th scope="col">Critical</th></tr></thead><tbody>${r}</tbody></table></div></div></section>`}function he(e){let t=se(e),n=`<tr><td colspan="${String(t.length)}" class="empty">No requests were recorded. Create the monitor with <code>report.enabled</code> (the default) and make requests before calling <code>getReport()</code>.</td></tr>`,r=e.entries.length===0?n:e.entries.map(e=>ue(e,t)).join(``);return`<section aria-labelledby="requests-heading"><h2 id="requests-heading">Requests</h2><div class="panel"><div class="toolbar"><label for="tp-search">Search</label><input id="tp-search" type="search" placeholder="URL, method, owner, outcome…" autocomplete="off"><label for="tp-severity">Severity</label><select id="tp-severity"><option value="all">All</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="normal">Normal</option><option value="unavailable">Unavailable</option></select><output id="tp-count">${String(e.entries.length)}</output><span class="toolbar__hint">Click a column heading to sort</span></div><p id="tp-no-matches" class="note" hidden>No requests match the current filters.</p><div class="table-wrap"><table id="tp-requests"><caption class="visually-hidden">Recorded requests, sortable by every column</caption><thead><tr>${t.map(le).join(``)}</tr></thead><tbody>${r}</tbody></table></div></div></section>`}function Z(e){return`<footer><p>Generated by TracePulse <strong>v${H(e.version)}</strong> at ${H(K(e.generatedAt))}.</p><p>This file is self-contained. Nothing left the page to create it.</p></footer>`}function ge(e){return`:root {
  color-scheme: light dark;
  --bg: #f1f5f9;
  --surface: #ffffff;
  --surface-2: #f8fafc;
  --text: #0f172a;
  --muted: #64748b;
  --border: #e2e8f0;
  --accent: #2563eb;
  --normal: ${U(e.settings.colors.normal,`#16a34a`)};
  --warning: ${U(e.settings.colors.warning,`#d97706`)};
  --critical: ${U(e.settings.colors.critical,`#dc2626`)};
  --shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #070b14;
    --surface: #0f172a;
    --surface-2: #111c33;
    --text: #e2e8f0;
    --muted: #94a3b8;
    --border: #1e293b;
    --accent: #60a5fa;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.3);
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
main { max-width: 1440px; margin: 0 auto; padding: 40px 24px 64px; }
header.page h1 { margin: 0 0 6px; font-size: clamp(24px, 3vw, 34px); letter-spacing: -0.02em; }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; margin: 0 0 8px; }
section { margin-top: 34px; }
h2 { margin: 0 0 12px; font-size: 18px; letter-spacing: -0.01em; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; box-shadow: var(--shadow); }
.card__value { display: block; font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
.card__label { display: block; margin-top: 2px; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; }
.table-wrap { overflow: auto; max-height: 72vh; }
table { width: 100%; border-collapse: collapse; }
caption { text-align: left; }
th, td { padding: 9px 12px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
thead th { position: sticky; top: 0; z-index: 1; background: var(--surface-2); color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover { background: var(--surface-2); }
td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.url { overflow-wrap: anywhere; }
.severity { display: inline-block; padding: 1px 8px; border-radius: 999px; color: #ffffff; font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
.severity--normal { background: var(--normal); }
.severity--warning { background: var(--warning); }
.severity--critical { background: var(--critical); }
.severity--unavailable { background: var(--muted); }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--surface); }
.toolbar label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
.toolbar input[type="search"], .toolbar select { min-width: 180px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text); font: inherit; }
.toolbar input[type="search"] { flex: 1 1 260px; }
.toolbar input:focus-visible, .toolbar select:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.toolbar output { margin-left: auto; color: var(--muted); font-variant-numeric: tabular-nums; }
.toolbar__hint { color: var(--muted); font-size: 12px; }
th button { all: unset; cursor: pointer; font: inherit; color: inherit; text-transform: inherit; letter-spacing: inherit; }
th button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
th[aria-sort="ascending"] button::after { content: " ↑"; color: var(--accent); }
th[aria-sort="descending"] button::after { content: " ↓"; color: var(--accent); }
.note { color: var(--muted); font-size: 13px; padding: 12px 16px; margin: 0; }
.empty { padding: 22px 16px; color: var(--muted); }
pre { margin: 0; padding: 12px 16px 16px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; overflow: auto; font-size: 13px; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
footer { margin-top: 40px; color: var(--muted); font-size: 12px; }
footer p { margin: 4px 0; }
.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
@media print {
  :root { --bg: #ffffff; --surface: #ffffff; --surface-2: #ffffff; --text: #000000; --muted: #444444; --border: #cccccc; }
  main { max-width: none; padding: 0; }
  .toolbar { display: none; }
  .table-wrap { max-height: none; overflow: visible; }
  thead th { position: static; }
  tbody tr { break-inside: avoid; }
  body { font-size: 11px; }
}`}function Q(e,t={}){let n=L(e),r=t.title??`TracePulse performance report`,i=n.page?.url;return`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${H(r)}</title>
<style>${ge(n)}</style>
</head>
<body>
<main>
<header class="page">
<h1>${H(r)}</h1>
<p class="meta"><span>${H(K(n.generatedAt))}</span><span>TracePulse v${H(n.version)}</span>${i===void 0?``:`<span>${H(i)}</span>`}</p>
</header>
${de(n)}
${fe(n)}
<section aria-labelledby="owners-heading"><h2 id="owners-heading">Owners</h2><div class="panel">${pe(n)}</div></section>
${me(n)}
${he(n)}
${Z(n)}
</main>
<script>(function () {
  var table = document.getElementById('tp-requests');
  if (!table) { return; }
  var tbody = table.tBodies[0];
  var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr[data-row]'));
  var search = document.getElementById('tp-search');
  var filter = document.getElementById('tp-severity');
  var count = document.getElementById('tp-count');
  var noMatches = document.getElementById('tp-no-matches');

  function applyFilters() {
    var term = search ? search.value.toLowerCase() : '';
    var level = filter ? filter.value : 'all';
    var visible = 0;
    rows.forEach(function (row) {
      var matchesTerm = term === '' || (row.getAttribute('data-search') || '').indexOf(term) !== -1;
      var matchesLevel = level === 'all' || row.getAttribute('data-severity') === level;
      var show = matchesTerm && matchesLevel;
      row.hidden = !show;
      if (show) { visible += 1; }
    });
    if (count) { count.textContent = String(visible); }
    if (noMatches) { noMatches.hidden = visible !== 0 || rows.length === 0; }
  }

  function cellValue(row, key, numeric) {
    var cell = row.querySelector('[data-col="' + key + '"]');
    var raw = cell ? cell.getAttribute('data-sort-value') : null;
    if (numeric) {
      if (raw === null || raw === '') { return { missing: true }; }
      var value = Number(raw);
      return Number.isFinite(value) ? { missing: false, number: value } : { missing: true };
    }
    return { missing: false, text: cell ? cell.textContent.trim() : '' };
  }

  function sortRows(key, numeric) {
    var header = document.querySelector('th[data-col="' + key + '"]');
    if (!header) { return; }
    var direction = header.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
    document.querySelectorAll('th[data-sort-key]').forEach(function (th) {
      th.setAttribute('aria-sort', th === header ? direction : 'none');
    });
    rows.sort(function (left, right) {
      var a = cellValue(left, key, numeric);
      var b = cellValue(right, key, numeric);
      if (a.missing && b.missing) { return 0; }
      if (a.missing) { return 1; }
      if (b.missing) { return -1; }
      var result = numeric ? a.number - b.number : a.text.localeCompare(b.text);
      return direction === 'ascending' ? result : -result;
    });
    rows.forEach(function (row) { tbody.appendChild(row); });
  }

  document.querySelectorAll('th[data-sort-key] button').forEach(function (button) {
    button.addEventListener('click', function () {
      sortRows(button.getAttribute('data-sort-key'), button.getAttribute('data-numeric') === 'true');
    });
  });

  if (search) { search.addEventListener('input', applyFilters); }
  if (filter) { filter.addEventListener('change', applyFilters); }
  applyFilters();
})();<\/script>
</body>
</html>`}function _e(){let e=/* @__PURE__ */ new Date,t=e=>String(e).padStart(2,`0`);return`tracepulse-report-${String(e.getFullYear())}${t(e.getMonth()+1)}${t(e.getDate())}-${t(e.getHours())}${t(e.getMinutes())}.html`}function $(e,t){if(typeof document>`u`||typeof Blob>`u`||typeof URL>`u`||typeof URL.createObjectURL!=`function`)throw Error(`downloadHtmlReport requires a DOM environment`);let n=new Blob([e],{type:`text/html;charset=utf-8`}),r=URL.createObjectURL(n),i=document.createElement(`a`);i.href=r,i.download=t??_e(),i.rel=`noopener`,document.body.appendChild(i),i.click(),i.remove(),setTimeout(()=>{URL.revokeObjectURL(r)},0)}function ve(e,t={}){if(typeof window>`u`)throw Error(`installReportShortcut requires a DOM environment`);let n=(t.key??`e`).toLowerCase(),r=t.shiftKey??!0,i=t.altKey??!1,a=a=>{(a.ctrlKey||a.metaKey)&&a.shiftKey===r&&a.altKey===i&&a.key.toLowerCase()===n&&(a.preventDefault(),$(Q(e.getReport(),{title:t.title}),t.filename))};return window.addEventListener(`keydown`,a),()=>{window.removeEventListener(`keydown`,a)}}function ye(e,t={}){let n=L(e);return JSON.stringify(n,null,t.pretty===!1?void 0:2)??`null`}export{Q as createHtmlReport,ye as createJsonReport,L as createReportView,$ as downloadHtmlReport,ve as installReportShortcut};