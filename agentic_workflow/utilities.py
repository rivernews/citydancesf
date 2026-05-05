import functools
from typing import Callable
from openai import APITimeoutError

def retry_on_validation(attempts=3, validate_func:Callable[[str], bool]=lambda x: x is not None, show_retry_log=True):
    """
    Decorator that retries a function a set number of times 
    until the validate_func returns True.
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_result = ''
            for attempt in range(1, attempts + 1):
                try:
                  last_result = func(*args, **kwargs)
                  if validate_func(last_result):
                      return last_result
                except APITimeoutError:
                    print('Request timeout')
                print(f"Attempt {attempt}/{attempts} failed validation. Retrying...") if show_retry_log else None
            
            print(f"All {attempts} attempts failed, here's the last result")
            return last_result
            
        return wrapper
    return decorator
