import functools
from typing import Callable

def retry_on_validation(attempts=3, validate_func:Callable[[str], bool]=lambda x: x is not None):
    """
    Decorator that retries a function a set number of times 
    until the validate_func returns True.
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_result = None
            
            for attempt in range(1, attempts + 1):
                last_result = func(*args, **kwargs, nth_retry=attempt-1)
                if validate_func(last_result):
                    return last_result
                
                print(f"Attempt {attempt} failed validation. Retrying...")
            
            print(f"All {attempts} attempts failed, here's the last result")
            return last_result
            
        return wrapper
    return decorator
