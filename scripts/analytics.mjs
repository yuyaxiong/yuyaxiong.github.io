import {esc} from './components.mjs';

export function analyticsConfig(site) {
  const config=site.analytics;
  if(config===undefined)return null;
  if(config?.provider!=='goatcounter'||typeof config.enabled!=='boolean')throw Error('analytics 需要 goatcounter provider 和 enabled 开关');
  if(!config.enabled)return null;
  if(typeof config.code!=='string'||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(config.code))throw Error('启用统计前需填写有效的 GoatCounter 站点名');
  const url=new URL(site.url);
  if(url.protocol!=='https:'||url.username||url.password)throw Error('访问统计需要有效的 HTTPS 正式站点地址');
  return {host:url.hostname,endpoint:`https://${config.code}.goatcounter.com/count`};
}

export function analyticsScript(site) {
  const config=analyticsConfig(site);
  return config?`<script src="/assets/analytics.js" data-analytics-host="${esc(config.host)}" data-analytics-endpoint="${esc(config.endpoint)}" defer></script>`:'';
}

export function analyticsPrivacy(site) {
  if(!analyticsConfig(site))return '本站使用静态页面，无账户、评论表单或第三方访问统计脚本。搜索在浏览器本地完成。';
  return '本站使用静态页面，无账户和评论表单，搜索在浏览器本地完成。本站使用 <a href="https://www.goatcounter.com/">GoatCounter</a> 统计页面浏览次数、估算访客数及来源网站，以了解哪些文章受到关注。统计只在正式域名启用；发送的页面路径不包含查询参数或锚点，来源链接仅保留网站来源，不发送站内搜索词或完整来源页面地址。服务还可能根据请求信息汇总浏览器、系统、语言、屏幕尺寸及国家或地区。根据 <a href="https://www.goatcounter.com/help/privacy">GoatCounter 隐私说明</a>，默认统计不在访客浏览器中写入 Cookie 或持久标识，服务会短暂使用请求信息估算独立访客；这不等于完整读完文章的人数。服务由第三方提供，统计数据存储在芬兰及德国。浏览器拦截或网络故障可能造成少计，不影响文章阅读。';
}
