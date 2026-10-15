// Netlify's observed pretty-URL postprocessing changes this single anchor's
// URL, quote style and attribute order. Permit only that exact transformation;
// every other byte, including all script bodies, must match checked-out source.
const original='<a class="login-link" href="/guide.html" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:10px">Read Member User Guide</a>';
const rewritten="<a class='login-link' href='/guide' rel='noopener noreferrer' style='display:inline-block;margin-top:10px' target='_blank'>Read Member User Guide</a>";
export function matchesPublishedAsset(file,actual,expected){
 if(actual.equals(expected))return true;
 if(file!=='index.html')return false;
 const source=expected.toString('utf8');
 if(source.split(original).length!==2)return false;
 return actual.equals(Buffer.from(source.replace(original,rewritten),'utf8'));
}
