import os
import hashlib
import json
from pathlib import Path
from datetime import datetime, timedelta
from functools import wraps

# env var
TTL_HOURS = int(os.environ.get('TTL_HOURS', '48'))
FORCE_CACHE_MISS = True if os.environ.get('FORCE_CACHE_MISS', '').lower() in ('true', '1', 'yes', 'on') else False

def disk_cache(func):
  @wraps(func)
  def wrapper(*args, **kwargs):
      url = kwargs.get('url') or args[0]
      result = _read_cache(url)
      if not result:
        result = func(*args, **kwargs)
        if isinstance(result, str):
          result = result.strip()

        # only cache if there's a result
        if result:
          _write_cache(url, result)

      return result
  return wrapper


'''Cache Design
We don't need day of week because url is the only varying part

cache/
  filename_in_url.hash(url).json
    ttl: <cache_at> + 6h
    value:

'''

CACHE_DIR = Path(__file__).parent / 'cache'
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def _assign_ttl():
  return datetime.now() + timedelta(hours=TTL_HOURS)

def _get_cache_key(url: str):
  filename_in_url = url.rsplit('/', maxsplit=1)[-1]
  hash_value = hashlib.sha256(url.strip().lower().encode('utf-8')).hexdigest()
  return f'{filename_in_url}.{hash_value}.json'

'''
cache hit or miss
'''
def _read_cache(url):
  if FORCE_CACHE_MISS:
    return

  key = _get_cache_key(url)
  cache_file = CACHE_DIR / key
  if cache_file.exists():
    with cache_file.open('r') as f:
      cache = json.load(f)

      # check expire or not
      if not cache.get('ttl'):
        return
      ttl = datetime.fromisoformat(cache.get('ttl'))
      if not (datetime.now() <= ttl):
        return
      
      return cache.get('value')
  else:
    return

def _purge_expired_cache():
  for item in CACHE_DIR.iterdir():
    if item.is_file():
      try:
        with item.open('r') as f:
          cache = json.load(f)
          ttl = cache.get('ttl')
          if not ttl:
            item.unlink()
          else:
            ttl = datetime.fromisoformat(ttl)
            if ttl <= datetime.now():
              item.unlink()
      except (json.JSONDecodeError, ValueError):
        continue

'''
always write cache right after computing result
'''
def _write_cache(url: str, result: str):
  key = _get_cache_key(url)
  cache = CACHE_DIR / key
  with cache.open('w') as f:
    json.dump({
      'ttl': _assign_ttl().isoformat(),
      'value': result
    }, f, indent=2)

_purge_expired_cache()