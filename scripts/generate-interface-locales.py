"""Generate reviewable UI-language drafts from public repository strings only.
Never use this development script for user messages or runtime translation.
"""
import concurrent.futures, json, re, subprocess, time, urllib.parse, urllib.request
from pathlib import Path
source = json.loads(subprocess.check_output(['node','--input-type=module','-e',"import en from './mail-vue/src/i18n/en.js'; import server from './mail-worker/src/i18n/en.js'; import fs from 'node:fs'; const extra=JSON.parse(fs.readFileSync('shared/additional-interface-en.json')); const errors=Object.fromEntries(Object.entries(server).map(([k,v])=>['server_'+k,v.replace(/\{\{(\w+)\}\}/g,'{$1}')])); console.log(JSON.stringify({...en,...extra,...errors}))"], text=True))
langs = ['zh-TW','ja','ko','fr','de','es','pt','ru','ar','hi','id','vi','th','tr','it','nl','uk','ms']
path = Path('mail-vue/src/i18n/locales'); path.mkdir(exist_ok=True)

def request(text, target):
    url = 'https://translate.googleapis.com/translate_a/single?' + urllib.parse.urlencode({'client':'gtx','sl':'en','tl':target,'dt':'t','q':text})
    last = None
    for attempt in range(6):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
            data=json.load(urllib.request.urlopen(req,timeout=45))
            return ''.join(item[0] or '' for item in data[0])
        except Exception as error:
            last=error
            time.sleep(min(30, 2**attempt))
    raise RuntimeError('UI draft generation failed: '+target) from last

def generate(lang):
    # Numbered boundaries and protected interpolation parameters are validated before writing.
    items=list(source.items()); translated={}; batch=[]; length=0
    def flush():
        if not batch:return
        text='\n'.join(f'[{index:04d}] {value}' for index,key,value in batch)
        result=request(text,lang)
        pieces=re.split(r'\[\s*(\d{4})\s*\]',result)
        found={int(pieces[i]):pieces[i+1].strip() for i in range(1,len(pieces)-1,2)}
        for index,key,value in batch:
            output=found.get(index)
            if not source[key]:
                translated[key]='';continue
            required=set(re.findall(r'\{\w+\}',source[key]))
            if output is None or set(re.findall(r'\{\w+\}',output)) != required:
                output=request(source[key],lang).strip()
            if set(re.findall(r'\{\w+\}',output)) != required:
                # Restore translated placeholder names by position; values never reach the provider.
                translated_params=re.findall(r'\{[^{}]+\}',output)
                original_params=re.findall(r'\{[^{}]+\}',source[key])
                if len(translated_params)==len(original_params):
                    for old,new in zip(translated_params,original_params):output=output.replace(old,new)
            if set(re.findall(r'\{\w+\}',output)) != required:raise RuntimeError('Invalid placeholders '+lang+':'+key)
            if not source[key]:output=''
            # Keep the administrator's literal confirmation token and product/protocol names stable.
            if key=='delInputPattern':output=source[key]
            translated[key]=output
    for index,(key,value) in enumerate(items):
        if length+len(value)>2600:
            flush();batch=[];length=0
        batch.append((index,key,value));length+=len(value)+8
    flush()
    (path/(('pt-BR' if lang == 'pt' else lang)+'.json')).write_text(json.dumps(translated,ensure_ascii=False,indent=2)+'\n')
    print('Generated',lang,len(translated),flush=True)

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(generate,langs))
(path/'draft-status.json').write_text(json.dumps({'source':'en','review':'machine-draft-not-human-reviewed','languages':langs},indent=2)+'\n')
