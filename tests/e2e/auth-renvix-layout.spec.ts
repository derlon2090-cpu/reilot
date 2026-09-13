import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const source = readFileSync("src/app/app.js", "utf8");
const css = readFileSync("src/styles/globals.css", "utf8");
const logoData = "data:image/png;base64," + readFileSync("public/assets/renvix-logo-primary.png").toString("base64");
const baselineSource = execFileSync("git", ["show", "f8a0102:src/app/app.js"], {encoding:"utf8",maxBuffer:8e6});
const baselineCss = execFileSync("git", ["show", "f8a0102:src/styles/globals.css"], {encoding:"utf8",maxBuffer:8e6});
function extract(text:string, name:string) {
  const start = text.indexOf("function " + name + "(");
  const next = /\n(?:async )?function /.exec(text.slice(start + 10));
  const end = next ? start + 10 + next.index : text.length;
  return text.slice(start,end);
}
async function fixture(page:Page, kind:string, width:number, old=false, language="ar") {
  const text = old ? baselineSource : source;
  await page.setViewportSize({width,height:1000});
  await page.goto("about:blank");
  await page.setContent("<html><head></head><body></body></html>");
  await page.addStyleTag({content:readFileSync("src/styles/tokens.css","utf8")});
  await page.addStyleTag({content:old ? baselineCss : css});
  for(const file of ["dark-system.css","approved-templates-reference.css","identity-system.css"]) await page.addStyleTag({content:readFileSync("src/styles/"+file,"utf8")});
  if(!old) await page.addStyleTag({content:readFileSync("src/styles/auth-renvix.css","utf8")});
  const names = ["authSuiteFrame","authModeTabs","authMobileMark","authMobileScene","registrationPlatformPicker","authPublicPage","forgotPublicPage","emailOtpPage","mfaLoginPage"];
  if(old) names.push("authReferenceVisual","authDashboardScene","prioritizeAuthReference");
  else names.push("authReferenceVisual","authBrandIllustration");
  await page.addScriptTag({content:`
    const state = {route:"/${kind}",query:new URLSearchParams(),authDisplayLanguage:"${language}",authDisplayTheme:"light",resetStep:${kind === "forgot" ? 1 : 2},resetEmail:"example@renvix.app",emailOtpStatus:{purpose:"signup",maskedEmail:"ex***@renvix.app"},mfaLoginStatus:{}};
    const localizedCopy = (ar,en) => state.authDisplayLanguage === "en" ? en : ar;
    const escapeHtml = value => String(value || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
    const stackedLogo = () => '<div class="brand-logo-stacked"><img class="brand-logo-image brand-logo-image--primary" src="${logoData}" width="814" height="228"></div>';
    const dashboardIcon = () => '<svg class="line-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg>';
    const authScene = () => '<svg viewBox="0 0 100 100"></svg>';
    const authIntroIcon = dashboardIcon, authRecoveryIcon = dashboardIcon;
    ${names.map(name => extract(text,name)).join("\n")}
    document.body.innerHTML = ${kind === "login" || kind === "register" ? "authPublicPage()" : kind === "mfa" ? "mfaLoginPage()" : kind === "email" ? "emailOtpPage()" : "forgotPublicPage()"};
  `});
}
for(const width of [1440,1024,768]){
  for(const kind of ["login","register","email","mfa","forgot","reset"]){
    test(`${kind} branded layout at ${width}px`,async({page})=>{
      await fixture(page,kind,width);
      await expect(page.locator(".renvix-auth-card-header")).toBeVisible();
      await expect(page.locator(".renvix-auth-illustration")).toBeVisible();
      const card=await page.locator(".auth-suite-shell>article").boundingBox();
      const art=await page.locator(".auth-suite-shell>aside").boundingBox();
      expect(card!.x).toBeGreaterThan(art!.x+art!.width);
      expect(card!.width/art!.width).toBeCloseTo(1.5,1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await expect(page.locator(".auth-suite-stage>.auth-suite-brandbar")).toBeHidden();
      await expect(page.locator("aside image, aside img, .auth-feature-strip")).toHaveCount(0);
      if(width===1440 && kind==="login") await page.screenshot({path:"test-results/renvix-auth-desktop.png",fullPage:true});
      if(width===768 && kind==="register") await page.screenshot({path:"test-results/renvix-auth-ipad.png",fullPage:true});
    });
  }
}
for(const kind of ["login","register","email","mfa","forgot","reset"]){
  test(`${kind} mobile preserves existing control geometry and styles`,async({page})=>{
    const measurements=()=>page.locator("article input,article button,article h1").evaluateAll(nodes=>nodes.map(node=>{
      const r=node.getBoundingClientRect(),s=getComputedStyle(node);
      return {text:node.textContent,name:node.getAttribute("name"),x:r.x,y:r.y,w:r.width,h:r.height,font:s.fontSize,color:s.color,background:s.backgroundColor};
    }).filter(node=>node.w && node.h));
    await fixture(page,kind,390,true);
    const before=await measurements();
    await fixture(page,kind,390);
    await expect(page.locator(".renvix-auth-card-header")).toBeHidden();
    expect(await measurements()).toEqual(before);
  });
}
test("English keeps the form on the right and fields editable",async({page})=>{
  await fixture(page,"login",1440,false,"en");
  await expect(page.locator("main")).toHaveAttribute("dir","ltr");
  await page.locator('input[name="email"]').fill("hello@renvix.app");
  await expect(page.locator('input[name="email"]')).toHaveValue("hello@renvix.app");
});
test("short iPad viewports can scroll to the complete registration form",async({page})=>{
  await fixture(page,"register",768);
  await page.setViewportSize({width:768,height:600});
  const submit=page.locator('form[data-submit="register"] .auth-submit');
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY)).toBe("auto");
});
test("dark mode keeps shared card controls and branded artwork visible",async({page})=>{
  await fixture(page,"login",1024);
  await page.locator("main").evaluate(node=>node.setAttribute("data-auth-theme","dark"));
  await expect(page.locator(".renvix-auth-card-header")).toBeVisible();
  await expect(page.locator(".renvix-auth-illustration")).toBeVisible();
  expect(await page.locator(".auth-suite-shell>article").evaluate(node=>getComputedStyle(node).backgroundColor)).toBe("rgb(21, 43, 43)");
});
