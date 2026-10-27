import {calculateMarketing} from './marketing-economics.mjs';

const root=document.querySelector('[data-marketing-calculator]');
if(root){
 const form=root.querySelector('form');
 const fields=[...form.querySelectorAll('input')];
 const error=root.querySelector('.mv-calc-error');
 const results=root.querySelector('.mv-calc-results');
 const names={spend:'营销费用',leads:'有效线索',rate:'线索成交率',margin:'每单营销前贡献'};
 const numbers=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2});
 const money=value=>value===null?'暂无成交':`${value<0?'−':''}¥${numbers.format(Math.abs(value))}`;
 let announcement;
 function update(){
  clearTimeout(announcement);
  const invalid=fields.filter(field=>!field.validity.valid);
  fields.forEach(field=>{
   if(invalid.includes(field)){field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby','marketing-calculator-error');}
   else {field.removeAttribute('aria-invalid');field.removeAttribute('aria-describedby');}
  });
  error.id='marketing-calculator-error';
  error.hidden=!invalid.length;
  results.hidden=!!invalid.length;
  if(invalid.length){error.textContent=`请检查${invalid.map(field=>names[field.name]).join('、')}：填写完整数字，并符合字段下方的范围要求。`;return;}
  const values=Object.fromEntries(fields.map(field=>[field.name,field.valueAsNumber]));
  let result;
  try{result=calculateMarketing(values);}catch{
   error.hidden=false;error.textContent='参数暂时无法计算，请检查线索是否为整数，以及各项数值是否在规定范围内。';results.hidden=true;return;
  }
  const text={leads:`${numbers.format(result.leads)} 条`,orders:`${numbers.format(result.orders)} 单`,rate:`${numbers.format(result.rate)}%`,cpl:result.cpl===null?'暂无线索':money(result.cpl),cac:money(result.cac),profit:money(result.profit),contribution:money(result.contribution),spend:money(result.spend)};
  for(const [key,value] of Object.entries(text))root.querySelectorAll(`[data-value="${key}"]`).forEach(node=>{node.textContent=value;});
  root.querySelector('.mv-funnel-orders').style.width=`${result.leads>0?result.rate:0}%`;
  root.querySelector('.mv-funnel-leads').style.width=result.leads>0?'100%':'0%';
  root.classList.toggle('is-negative',result.profit<0);
  announcement=setTimeout(()=>{root.querySelector('[role="status"]').textContent=`演示结果：预计成交 ${text.orders}，每单获客成本${text.cac}，营销后贡献${text.profit}。${result.profit<0?'本次演示投入后的贡献为负。':''}`;},250);
 }
 form.addEventListener('submit',event=>{event.preventDefault();update();});
 form.addEventListener('input',update);
 update();
}
