export const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const articlePath = p => `/articles/${p.slug}/`;
export const tagPath = tag => `/tags/${encodeURIComponent(tag)}/`;
export const categoryPath = category => `/categories/${encodeURIComponent(category)}/`;
export function card(p, featured=false) {
  return `<article class="post-card ${featured?'featured':''}"><div class="post-meta"><a href="${categoryPath(p.category)}">${esc(p.category)}</a><span>${p.date.replaceAll('-','.')}</span><span>${p.minutes} 分钟阅读</span></div><h${featured?'2':'2'}><a href="${articlePath(p)}">${esc(p.title)}</a></h2><p>${esc(p.description)}</p><div class="card-bottom"><div class="tags">${p.tags.map(t=>`<a href="${tagPath(t)}">#${esc(t)}</a>`).join('')}</div><a class="text-link" href="${articlePath(p)}" aria-label="阅读：${esc(p.title)}">阅读全文 <span aria-hidden="true">↗</span></a></div></article>`;
}
export function toc(headings) {
  return `<details class="toc" open><summary>文章目录</summary><nav aria-label="文章目录"><ol>${headings.filter(h=>h.depth===2).map(h=>`<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ol></nav></details>`;
}
