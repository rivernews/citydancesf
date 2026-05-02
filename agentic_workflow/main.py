import requests
import base64
import io
from PIL import Image
import sys

from langchain_openai import ChatOpenAI
from langchain.messages import HumanMessage
from cache_image_result import disk_cache

llm_model = ChatOpenAI(
    openai_api_base="http://127.0.0.1:8080/v1", # Point to local server
    openai_api_key="openclaw_secure",        # Dummy key for local use
    model_name = "", # use endpoint default loaded model
    # model_name="lmstudio-community/Qwen3.5-9B-GGUF"                  # Some servers require a placeholder name
    # model_name="qwen3.5-9b-fp16"                  # Some servers require a placeholder name
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


@disk_cache
def extract_text_from_image_by_remote_url(url: str):
    base64 = url_to_jpg_base64(url)

    ask_image_message = HumanMessage(
        content=[
            # {"type": "text", "text": "hello how are you"},

            {"type": "text", "text": f'''
Extract **Class diificulty level|time|instructor full name|class name|location|other info**, if any, from this base64-encoded image.
            '''.strip()},
            {"type": "text", "text": '''
For each class, output as a single line, with each value separated by delimiter "|". For example: Kpop|Switch Villa|All Levels|7:30-8:30pm|60 Brady|New Popping Class
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
    print("\n\n 🏞️  Results:")
    print(extract_text_from_image_by_remote_url(
        url
    ) + ' ' + alt.replace('|', ''))


'''Manual piped
echo '

https://images.squarespace-cdn.com/content/v1/5738b9abab48de6e3b53189b/1091ddee-6dfb-4fb4-b9ca-811865c098d4/SILA+POE+FOR+2025+FRI.jpg?format=750w CLICK ON PIC TO SIGN UP ^ This is a great class for Beginners! Poe is a fantastic teacher!


' | python main.py
'''


'''Automated script command

DAY=Wednesday
cd ~/Documents/repos/citydancesf
. ./agentic_workflow/venv/bin/activate
DAY=${DAY:-MONDAY} npm start | tail -n 1 | jq -r '.[] | "\(.thumbnailImageUrl) \(.alt)"' | python agentic_workflow/main.py


'''