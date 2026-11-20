"""Prepare private block10 configuration from block9 without printing credentials."""
from pathlib import Path
import re,secrets
r=Path(__file__).resolve().parents[1]
source=r.parent/'block9/api/.env'
target=r/'api/.env'
if not target.exists() and source.exists():
 text=source.read_text(encoding='utf-8')
 text=text.replace('schema=block9','schema=block10').replace('3009','3010').replace('5179','5180')
 # Set these explicitly: source configuration may use ports from earlier blocks.
 for key,value in {'PORT':'3010','APP_BASE_URL':'http://localhost:5180','SPA_ORIGIN':'http://localhost:5180'}.items():
  line=key+'='+value
  if re.search(r'^'+key+r'=',text,re.M):text=re.sub(r'^'+key+r'=.*$',line,text,flags=re.M)
  else:text+='\n'+line+'\n'
 for key in ['SESSION_SECRET','AUTH_TOKEN_SECRET','JWT_SECRET','MFA_ENCRYPTION_KEY']:
  value=key+'='+secrets.token_hex(32)
  if re.search(r'^'+key+r'=',text,re.M):text=re.sub(r'^'+key+r'=.*$',value,text,flags=re.M)
  else:text+='\n'+value+'\n'
 target.write_text(text,encoding='utf-8')
front=r/'web/.env'
if not front.exists():
 source=r.parent/'block9/web/.env'
 if source.exists():
  text=source.read_text(encoding='utf-8')
  line='VITE_API_BASE_URL=http://localhost:3010/api'
  if re.search(r'^VITE_API_BASE_URL=',text,re.M):text=re.sub(r'^VITE_API_BASE_URL=.*$',line,text,flags=re.M)
  else:text+='\n'+line+'\n'
  front.write_text(text,encoding='utf-8')
print('Private configuration prepared; existing block10 configuration retained.')
