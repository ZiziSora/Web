"""Prepare private block10 configuration from block9 without printing credentials."""
from pathlib import Path
import re,secrets
r=Path(__file__).resolve().parents[1]
source=r.parent/'block9/api/.env'
target=r/'api/.env'
if not target.exists() and source.exists():
 text=source.read_text(encoding='utf-8')
 text=text.replace('schema=block9','schema=block10').replace('3009','3010').replace('5179','5180')
 for key in ['SESSION_SECRET','AUTH_TOKEN_SECRET','JWT_SECRET','MFA_ENCRYPTION_KEY']:
  value=key+'='+secrets.token_hex(32)
  if re.search(r'^'+key+r'=',text,re.M):text=re.sub(r'^'+key+r'=.*$',value,text,flags=re.M)
  else:text+='\n'+value+'\n'
 target.write_text(text,encoding='utf-8')
front=r/'web/.env'
if not front.exists():
 source=r.parent/'block9/web/.env'
 if source.exists():front.write_text(source.read_text(encoding='utf-8').replace('3009','3010').replace('5179','5180'),encoding='utf-8')
print('Private configuration prepared; existing block10 configuration retained.')
