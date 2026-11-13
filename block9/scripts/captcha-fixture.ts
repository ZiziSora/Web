import type { BrowserContext } from 'playwright-core';

export async function installCaptcha(context: BrowserContext, f: { captcha(): string }) {
  await context.exposeBinding('block9TestCaptcha', () => f.captcha());
  await context.route('https://www.google.com/recaptcha/api.js?**', route => route.fulfill({
    status: 200, contentType: 'application/javascript', body: `
    let nextId=0;const widgets=new Map();
    window.grecaptcha={
      render(target,options){
        const id=nextId++;widgets.set(id,options);
        const button=document.createElement('button');button.type='button';button.textContent='Tôi không phải người máy';
        button.style.cssText='width:304px;max-width:100%;height:78px;background:#fafafa;border:1px solid #d3d3d3;border-radius:3px;color:#222;font:14px Arial';
        button.onclick=async()=>{options.callback(await window.block9TestCaptcha());button.textContent='Đã xác minh';button.disabled=true;};
        target.append(button);window.block9TestExpire=()=>options['expired-callback']();window.block9TestError=()=>options['error-callback']();return id;
      },reset(id){widgets.delete(id);}
    };window.block9RecaptchaReady();`,
  }));
}
