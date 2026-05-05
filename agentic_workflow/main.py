import requests
import base64
import io
from PIL import Image
import sys

from langchain_openai import ChatOpenAI
from langchain.messages import HumanMessage
from cache_image_result import disk_cache
from utilities import retry_on_validation

llm_model = ChatOpenAI(
    openai_api_base="http://127.0.0.1:8080/v1", # Point to local server
    openai_api_key="openclaw_secure",        # Dummy key for local use
    
    # llama.cpp doesn't need to specify
    # model_name = "", # use endpoint default loaded model
    # disable thinking speed up dramatically. Note that append `/no_think` at the end of prompt did not work
    extra_body={
        "chat_template_kwargs": {"enable_thinking": False}
    },
    timeout=300, # analyzing an image shouldn't take 5min

    # required by oMLX
    model_name="qwen3.5-9b-fp16",
    # model_name="qwen3.5-9b"
)

def url_to_jpg_base64(url):
    # 1. Fetch the image from the remote URL
    response = requests.get(url, stream=True)
    response.raise_for_status() # Ensure the request was successful
    
    # 2. Load the image content into Pillow
    img = Image.open(io.BytesIO(response.content))
    
    # 3. Convert to RGB (required for JPG if original is RGBA/PNG)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    # 4. Save the image to an in-memory buffer as JPEG
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    
    # 5. Encode the buffer content to Base64
    base64_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    # Optional: Return as a Data URI
    return f"data:image/jpeg;base64,{base64_str}"

'''Detecting error response - an example error result:

The provided text appears to be corrupted or improperly formatted. However, based on the structure and content, I can infer that it is intended to extract structured information (such as class name, instructor, location, time, etc.) from an image. Since you mentioned "base64-encoded image", but no actual base64 string or image data was included in your message — only a description of what to extract — I cannot process any real image data.

Please provide:
1. The actual **base64-encoded image data**, OR
2. A valid image file (if supported by the interface), OR
3. Clarify if this is a test request — in which case, please confirm how you’d like me to proceed.

Without the actual image content, no extraction can be performed. If you meant to upload an image and only described it verbally, kindly describe its visible text/content so I can help extract the required fields manually.

Alternatively, if this was a formatting error and you intended to paste base64 data — please resend with the correct base64 string enclosed in quotes or as plain text within code blocks.

⚠️ Note: As an AI model, I cannot view images directly unless they are encoded in base64 or provided via supported image upload (which may not be active here). So if you’re expecting me to “see” an image, you must supply the base64 payload.

Let me know how you’d like to proceed! SCHEDLE FOR FRIDAY MAY 1

'''
@disk_cache
@retry_on_validation(
    attempts=3,
    validate_func=lambda response: response and 'base64-encoded image' not in response.lower(),
    show_retry_log=True
)
def extract_text_from_image_by_remote_url(url: str):
    base64 = url_to_jpg_base64(url)

    ask_image_message = HumanMessage(
        content=[
            # {"type": "text", "text": "hello how are you"},

            {"type": "text", "text": f'''
This base64-encoded image contains some class or event information. Extract all **Class difficulty level|time|instructor full name|class name|location|other info**, if any.
            '''.strip()},
            {"type": "text", "text": '''
For each class, output as a new line, with each value separated by delimiter "|". For example: Kpop|Switch Villa|All Levels|7:30-8:30pm|60 Brady|New Popping Class
            '''.strip()},
            {"type": "text", "text": '''
Class difficulty guidance: use full word "intermediate" for int or INT, "advance" for adv or ADV, and "beginner" for beg or BEG.
            '''.strip()},
            {
                "type": "image_url",
                "image_url": {"url": base64},
                # "image_url": {"url": url},
            },

            # {"type": "input_text", "text": "describe the text in this image"},
            # {
            #     "type": "input_image",
            #     "image_url": "https://images.squarespace-cdn.com/content/v1/5738b9abab48de6e3b53189b/41cac531-5268-4552-a1ab-91c23624ad34/SILA+POE+FOR+2025+TUESDAYS.jpg?format=500w",
            # },
        ]
    )

    # response = llm_model.invoke('I love programming')
    response = llm_model.invoke(
        [
            ask_image_message
        ]
    )
    return response.content


for _newline in sys.stdin:
    newline = _newline.strip()
    if not newline:
        continue
    url, alt = newline.split(' ', maxsplit=1)

    print("\n\n 🏞️ Processing result(s):")
    llm_image_result = extract_text_from_image_by_remote_url(url)
    
    print(llm_image_result + ' ' + alt.replace('|', ''))


'''Manual piped

echo '

https://images.squarespace-cdn.com/content/v1/5738b9abab48de6e3b53189b/97da6a56-8795-43ad-9b9c-81f74dd4aa58/FRIDAY+NEW+TYPE+may+1.jpg SCHEDLE FOR FRIDAY MAY 1

' | FORCE_CACHE_MISS=1 python main.py

'''


'''Automated script command

DAY=Wednesday
cd ~/Documents/repos/citydancesf
. ./agentic_workflow/venv/bin/activate
DAY=${DAY:-MONDAY} npm start | tail -n 1 | jq -r '.[] | "\(.thumbnailImageUrl) \(.alt)"' | python agentic_workflow/main.py


'''