"""Python 3.6-compatible static release: additive staging, CAS entry promotion/rollback.
Never restarts services. Never deletes application data. All mutations take the shared lock.
"""
if not __debug__:
 raise RuntimeError('Optimized Python disables release safety checks; refusing execution')
import argparse, fcntl, hashlib, json, os, pathlib, shutil, tempfile
ROOT='/var/lib/cofco/releases/cofco-map-performance-20260912/web/enterprise-portal/depth-7'
LOCK='/run/lock/cofco-market-news-release.lock'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(mode,release,root,lock):
 manifest=json.loads((release/'manifest.json').read_text())
 assert manifest['schema']==1
 assert digest(release/'index.before.html')==manifest['portalBefore']
 assert digest(release/'index.next.html')==manifest['portalAfter']
 root=root.resolve();assert root.is_dir()
 # All release paths are plain regular files below the isolated namespace or named entry files.
 for name,h in manifest['files'].items():
  p=pathlib.PurePosixPath(name)
  assert not p.is_absolute() and '..' not in p.parts
  assert (p.parts[0]=='gods-eye-view' or (len(p.parts)==1 and name.startswith(('applicationCatalog-gev-','portal-gev-','gev-preview-'))))
  src=release/'files'/name;assert src.is_file() and not src.is_symlink() and digest(src)==h
  dest=root/name
  for parent in [dest]+list(dest.parents):
   if parent==root:break
   assert not parent.is_symlink(),'Symlink destination '+str(parent)
 with open(str(lock),'a') as guard:
  fcntl.flock(guard,fcntl.LOCK_EX|fcntl.LOCK_NB)
  current=digest(root/'index.html')
  if mode=='stage':
   assert current==manifest['portalBefore'],'Production entry changed; stop and rebase'
   # Validate entire destination before writing even one file.
   for name,h in manifest['files'].items():
    dest=root/name
    assert not dest.exists() or (dest.is_file() and digest(dest)==h),'Existing different file '+name
   for name,h in manifest['files'].items():
    dest=root/name
    if not dest.exists():
     dest.parent.mkdir(parents=True,exist_ok=True)
     with open(str(dest),'xb') as f:f.write((release/'files'/name).read_bytes())
     os.chmod(str(dest),0o644)
   assert digest(root/'index.html')==manifest['portalBefore']
  elif mode in ('promote','rollback'):
   before,after=(manifest['portalBefore'],manifest['portalAfter']) if mode=='promote' else (manifest['portalAfter'],manifest['portalBefore'])
   assert current==before,'CAS failed; later edits will not be overwritten'
   if mode=='promote':
    for name,h in manifest['files'].items():assert digest(root/name)==h,'Asset not staged: '+name
   src=release/('index.next.html' if mode=='promote' else 'index.before.html')
   fd,tmp=tempfile.mkstemp(prefix='.gev-entry-',dir=str(root))
   try:
    with os.fdopen(fd,'wb') as f:f.write(src.read_bytes());f.flush();os.fsync(f.fileno())
    os.chmod(tmp,0o644);os.replace(tmp,str(root/'index.html'))
   finally:
    if os.path.exists(tmp):os.unlink(tmp)
   assert digest(root/'index.html')==after
  elif mode=='verify':
   for name,h in manifest['files'].items():assert digest(root/name)==h,name
  return {'mode':mode,'indexSha256':digest(root/'index.html'),'assetCount':len(manifest['files']),'preview':manifest['preview'],'servicesChanged':False}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('mode',choices=['stage','promote','rollback','verify']);p.add_argument('release',type=pathlib.Path);p.add_argument('--root',type=pathlib.Path,default=pathlib.Path(ROOT));p.add_argument('--lock',type=pathlib.Path,default=pathlib.Path(LOCK));a=p.parse_args()
 print(json.dumps(run(a.mode,a.release,a.root,a.lock)))
