from pathlib import Path
import hashlib
p=Path('fireworks.js');s=p.read_bytes().decode();assert hashlib.sha256(s.encode()).hexdigest()=='e8726070de374e4dee82187fa4bb524818638cf2213168123aa9ce03cc656664'
a="function releasePreparedSourceView(state,reason){state.invalid=reason;state.ordered=null;state.rays=null;state.snapshot=null;state.args=null;livePreparedSourceViews.delete(state);}"
b="function releasePreparedSourceView(state,reason){state.invalid=reason;for(const key of ['ordered','rays','snapshot','args','key','densityKey','clusters','eye','stats'])state[key]=null;livePreparedSourceViews.delete(state);}"
assert s.count(a)==1;s=s.replace(a,b)
a="  function getPreparedSourceViewInfo(handle){const state=preparedSourceViews.get(handle);if(!state)throw new RangeError('Unknown prepared source view');return requirePreparedSourceView(handle,state.args).info;}"
b=a+"\r\n  function discardPreparedSourceView(handle){const state=preparedSourceViews.get(handle);if(!state)throw new RangeError('Unknown prepared source view');if(state.invalid||state.used)return false;releasePreparedSourceView(state,'discarded');return true;}"
assert s.count(a)==1;s=s.replace(a,b)
a='    prepareSourceView,getPreparedSourceViewInfo,';b='    prepareSourceView,getPreparedSourceViewInfo,discardPreparedSourceView,';assert s.count(a)==1;s=s.replace(a,b)
p.write_bytes(s.encode());print(hashlib.sha256(s.encode()).hexdigest())
