const form=document.querySelector('.search');
if(form){
  const input=document.getElementById('q');
  const apply=()=>{
    const q=input.value.trim().toLowerCase();let count=0;
    document.querySelectorAll('[data-post]').forEach(p=>{p.hidden=!p.dataset.search.includes(q);if(!p.hidden)count++;});
    document.getElementById('result-count').textContent=`找到 ${count} 篇文章`;
    document.getElementById('empty-result').hidden=count!==0;
    const url=new URL(location.href);q?url.searchParams.set('q',input.value.trim()):url.searchParams.delete('q');history.replaceState(null,'',url);
  };
  input.value=new URLSearchParams(location.search).get('q')?.slice(0,100)||'';
  form.addEventListener('submit',e=>{e.preventDefault();apply();});
  input.addEventListener('input',apply);apply();
}
const progress=document.querySelector('.reading-progress');
if(progress){
  const update=()=>{const length=document.documentElement.scrollHeight-innerHeight;progress.style.width=`${length>0?Math.min(100,Math.max(0,scrollY/length*100)):100}%`;};
  addEventListener('scroll',update,{passive:true});addEventListener('resize',update);update();
  const toc=document.querySelector('.toc');const media=matchMedia('(max-width: 900px)');
  const adapt=()=>{toc.open=!media.matches;};adapt();media.addEventListener('change',adapt);
  document.querySelector('.print-button').addEventListener('click',()=>window.print());
}
