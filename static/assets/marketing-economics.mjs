export const limits={spend:[0,1e9],leads:[0,1e7],rate:[0,100],margin:[0,1e7]};

export function calculateMarketing(values){
 for(const [key,[min,max]] of Object.entries(limits)){
  if(typeof values[key]!=='number'||!Number.isFinite(values[key])||values[key]<min||values[key]>max)throw new RangeError(`Invalid ${key}`);
 }
 if(!Number.isInteger(values.leads))throw new RangeError('Leads must be an integer');
 const {spend,leads,rate,margin}=values;
 const orders=leads*rate/100;
 return {spend,leads,rate,orders,cpl:leads>0?spend/leads:null,cac:orders>0?spend/orders:null,contribution:orders*margin,profit:orders*margin-spend};
}
