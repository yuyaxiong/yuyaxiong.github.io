(() => {
  const config=document.currentScript;
  if(!config||location.protocol!=='https:'||location.hostname!==config.dataset.analyticsHost)return;
  if(!/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.goatcounter\.com\/count$/.test(config.dataset.analyticsEndpoint))return;
  if(window.goatcounter||document.querySelector('script[data-goatcounter]'))return;

  // Keep search terms, URL fragments and full referral URLs out of statistics.
  window.goatcounter={
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
  script.src='https://gc.zgo.at/count.js';
  script.async=true;
  script.referrerPolicy='origin';
  script.setAttribute('data-goatcounter',config.dataset.analyticsEndpoint);
  document.head.appendChild(script);
})();
