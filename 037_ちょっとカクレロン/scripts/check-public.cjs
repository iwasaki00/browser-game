// Read-only baseline probe. No uploads, authentication or browser execution.
const fs=require('node:fs');
const path=require('node:path');
const {VERSION}=require('./release-config.cjs');
const release=process.argv.includes('--release');
const base=new URL('https://iwasaki00.github.io/browser-game/037_ちょっとカクレロン/');
async function get(relative){
  const url=new URL(relative,base);
  if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))throw new Error('Probe outside application');
  const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
  const text=await response.text();
  return {url:url.href,status:response.status,contentType:response.headers.get('content-type'),cacheControl:response.headers.get('cache-control'),lastModified:response.headers.get('last-modified'),text};
}
(async()=>{
  const html=await get('index.html'),assets=[];
  if(html.status===200){
    const refs=[...html.text.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m=>m[1]);
    for(const ref of [...new Set(refs)]){
      const result=await get(ref);assets.push({url:result.url,status:result.status});
      if(/poses[^/]*\.js/.test(ref))for(const [,svg]of result.text.matchAll(/silhouette: "([^"]+)"/g)){
        const asset=await get(svg);assets.push({url:asset.url,status:asset.status});
      }
    }
  }
  const development=[];
  for(const file of ['tests/app.test.cjs','docs/QA_REPORT_v0.7.0.md',...(release?['tests/release.test.cjs','scripts/build-release.cjs','README.md','docs/RELEASE_PREP_v0.7.1.md']:[])]){
    const result=await get(file);development.push({file,status:result.status});
  }
  const {text,...headers}=html;
  const version=text.match(/application-version" content="([^"]+)/)?.[1]||null;
  const status=html.status===200&&version===VERSION&&assets.length>0&&assets.every(a=>a.status===200)&&development.every(d=>d.status===404)?'PASS':'FAIL';
  const report={observedAt:new Date().toISOString(),mode:release?'read-only release HTTP validation':'read-only baseline observation; not a release acceptance test',...(release?{status,expectedVersion:VERSION}:{}),index:headers,version,assets,development};
  const directory=path.resolve(__dirname,'../docs/qa-v071');fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,release?'public-release.json':'public-baseline.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
  if(release&&status!=='PASS')process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
