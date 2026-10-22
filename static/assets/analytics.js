(() => {
  const config=document.currentScript;
  if(!config||location.protocol!=='https:'||location.hostname!==config.dataset.analyticsHost)return;
  if(!/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.goatcounter\.com\/count$/.test(config.dataset.analyticsEndpoint))return;
  if(window.goatcounter||document.querySelector('script[data-goatcounter]'))return;

  // Keep search terms, URL fragments and full referral URLs out of statistics.
  window.goatcounter={
    no_onload:true,
    no_events:true,
    path:()=>location.pathname,
    referrer:()=>{
      try {
        const source=new URL(document.referrer);
        return source.origin!==location.origin&&['https:','http:'].includes(source.protocol)?source.origin:'';
      } catch {return '';}
    }
  };
  const script=document.createElement('script');
  script.src='/assets/goatcounter-count.js';
  script.async=true;
  script.referrerPolicy='origin';
  script.setAttribute('data-goatcounter',config.dataset.analyticsEndpoint);
  // The upstream script also sends location.search in its separate q field.
  // Configure and scrub its payload before the first count is sent.
  script.onload=()=>{
    const client=window.goatcounter;
    if(typeof client.get_data!=='function'||typeof client.count!=='function')return;
    const getData=client.get_data;
    client.get_data=vars=>{const data=getData(vars);delete data.q;return data;};
    let counted=false;
    const countOnce=()=>{
      if(counted||['hidden','prerender'].includes(document.visibilityState))return;
      counted=true;
      client.count();
      document.removeEventListener('visibilitychange',countOnce);
    };
    document.addEventListener('visibilitychange',countOnce);
    countOnce();
  };
  document.head.appendChild(script);
})();
