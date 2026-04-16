# README 배너 이미지 생성 — Nano Banana (Gemini 2.5 Flash Image) 프롬프트

Google AI Studio(aistudio.google.com) 또는 Gemini API에서 **Nano Banana** (모델 ID: `gemini-2.5-flash-image-preview`) 를 사용해 README 상단 배너를 생성한다.

**권장 스펙**: 가로 1280–1400px × 세로 320–400px (GitHub README 기준). 필요 시 이미지 업샘플링.

---

## 메인 프롬프트 (영어가 가장 잘 파싱됨)

```
A wide horizontal banner illustration for the README of an open-source pharmacy software called "pharmsq-ndsd". Aspect ratio 16:4 (wide cinematic banner, approximately 1400 x 400 pixels).

CENTERPIECE (left third of canvas):
The app mascot — a rounded-square icon with mint-teal gradient background (#2DD4BF to #10B981), inside it a stylized white medicine pill/capsule floating between soft pastel cloud shapes, with a subtle upward arrow indicating secure cloud upload. Keep the icon glossy and soft, not flat.

MIDDLE SECTION (center of canvas):
Bold typography of the product name "pharmsq-ndsd" in a modern sans-serif (Pretendard or Inter feel). Color: deep ink #0F172A on light background, OR white on mint gradient. Below it a smaller Korean tagline: "대체조제 NDSD 자동 업로드 모듈" in medium weight.

RIGHT SECTION (right third of canvas):
A stylized abstract flow — a prescription document icon flowing into arrows, then into a shield/cloud representing the NDSD portal (심평원). The flow reads left-to-right: pharmacy → upload → secure reporting. Use subtle line art, not heavy.

STYLE:
- Flat illustration with soft gradients, NOT photorealistic
- Korean pharmaceutical / medical-tech aesthetic, clean and trustworthy
- Minimal, airy composition with generous whitespace
- NO overly decorative elements, no photographic textures, no 3D realism

COLOR PALETTE (strict):
- Primary: mint-teal #2DD4BF and #10B981
- Ink: #0F172A
- Neutral: #F8FAFC (background), #E2E8F0 (dividers), #64748B (secondary text)
- Accent: soft success green #16A34A (sparingly)
- DO NOT use red, orange, purple, or saturated blue

BACKGROUND:
Very light neutral (#F8FAFC) with a subtle mint-teal gradient washing from the left side toward center. Keep it calm.

TYPOGRAPHY:
- "pharmsq-ndsd" — 56–72pt bold
- Korean tagline — 22–26pt medium
- All text sharp and readable

DO NOT:
- Include pharmacists' faces or any human figures
- Add any real brand logos (no HIRA logo, no 심평원 logo, no Korean government seal)
- Use glossy 3D renders or photorealistic pills
- Add clutter — the banner must feel calm and professional
```

---

## 변형 프롬프트 (다크 모드 버전)

위 프롬프트에서 다음만 교체:

```
BACKGROUND:
Deep navy #0F172A with subtle mint-teal glow on the left side.

TYPOGRAPHY:
- "pharmsq-ndsd" in white (#FFFFFF)
- Korean tagline in #CBD5E1
```

---

## 사용법

### A. Google AI Studio (가장 간단)

1. https://aistudio.google.com/ 접속
2. 모델 선택: `Gemini 2.5 Flash Image` (Nano Banana)
3. 위 메인 프롬프트 전체를 붙여넣기
4. 생성 후 **Download** 로 PNG 저장
5. `assets/banner.png` 로 저장

### B. Gemini API (Python 스크립트)

```bash
pip install google-genai pillow
```

```python
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO

client = genai.Client(api_key="YOUR_GEMINI_API_KEY")

with open("scripts/banner-prompt.md", "r", encoding="utf-8") as f:
    full_doc = f.read()
prompt = full_doc.split("```")[1]  # 첫 번째 코드 블록만 추출

response = client.models.generate_content(
    model="gemini-2.5-flash-image-preview",
    contents=[prompt],
    config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
)

for part in response.candidates[0].content.parts:
    if part.inline_data:
        img = Image.open(BytesIO(part.inline_data.data))
        img.save("assets/banner.png")
        print("saved: assets/banner.png")
```

생성 후 `git add assets/banner.png && git commit -m "배너 이미지 추가" && git push`.

---

## 품질 체크리스트 (수락 기준)

- [ ] 가로형이고 세로는 전체의 약 1/4 (cinematic)
- [ ] 민트-틸 팔레트 외 튀는 색 없음
- [ ] 텍스트가 선명하게 읽힘 (렌더링 아티팩트 없음)
- [ ] 한국 의료·소프트웨어 톤 (산뜻·전문)
- [ ] HIRA·심평원·정부 로고 없음
- [ ] 얼굴·인물 없음
- [ ] 단순·여백 충분

첫 시도가 만족스럽지 않으면 **seed 바꿔서 3–5회 재생성**. Nano Banana 는 동일 프롬프트라도 실행마다 결과가 다름.
