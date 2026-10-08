# Weekly competitor prices — real-Chrome runbook

You are collecting this week's self-storage prices for Metro Storage's competitor dashboard, using the
Chrome browser tools (Sam's own Chrome). Since Oct 2026 these sites block automated browsers (Big Yellow
shows an hCaptcha, Safestore's reCAPTCHA fails), but they load normally in Sam's real Chrome.

## Hard rules
- Only visit bigyellow.co.uk, safestore.co.uk and accessstorage.com.
- Use ONLY this enquiry identity (no real person — Sam does not want his own details used):
  first name **Ethan**, last name **Brown**, email **ethan.brown.quote@example.com**,
  phone **07700900461** (Ofcom drama range), postcode **N1 8QZ**.
- Never tick marketing/newsletter boxes. Never press Reserve, Book, Buy, Pay or Checkout. Never enter payment details.
- Cookie banners: choose Reject All / essential only (Safestore: "Cookie settings" → "Save settings").
- If ANY CAPTCHA or "I am human"/security-check page appears: do NOT try to solve or bypass it. Stop that
  provider and record `"status": "captcha"`. Same for anything else unexpected: record what you saw and move on.
- Close any chat pop-ups that get in the way. Create your own tab (tabs_create_mcp) and close it at the end.
- Prices are £ per week inc. VAT. Read numbers from the page text (get_page_text / javascript), not from memory.

## Big Yellow — Kings Cross (one enquiry gives every size)
1. Open https://www.bigyellow.co.uk/quote/estimate/store/kings-cross/
2. Size carousel: click the slide whose text contains "50 sq ft" (`a.slick-slide:not(.slick-cloned)`), then the
   "Next" button (`button.btn-primary.btn-block`).
3. Storage details (/quote/enterdetails/): tick Home (`#input_type_home`); set `#enquiry_reason` = "Moving" and
   `#whenNeedStorage` = "WNS1" (set the native select value, dispatch `change`, then
   `jQuery('.selectpicker').selectpicker('refresh')`); click the submit button.
4. Your details (/quote/additionaldetails/): fill `#name_first`, `#name_last`, `#email`, `#phone1` (7700900461 —
   the +44 is pre-set), `#postcode`; click "View your quote".
5. Quote page (/quote/yourquote): the block "Kings Cross : <N> sq ft Room" shows
   HALF PRICE OPENING OFFER £intro … ONGOING PRICE £standard £ongoing (ongoing = after the "INCLUDES x% DISCOUNT").
   Use the size carousel arrows beside the room image (‹ ›) to move between sizes WITHOUT re-submitting; read
   25, 50, 75, 100 and 150 sq ft (skip 30/40/125 etc.).

## Safestore — Kings Cross (one enquiry per size)
1. Open https://www.safestore.co.uk/self-storage/london/north/kings-cross/ → cookie settings → Save settings →
   close the "55% off" pop-up → click "Get a quote" (wizard: Type → Size → Duration → When → Details).
2. Type: Personal (pre-ticked) → Next.
3. Size: the carousel starts on 10 sq ft. Use the RIGHT arrow (not the size cards): 25 = 2 clicks, 50 = 4,
   75 = 5, 100 = 6, 150 = 8. Confirm the highlighted card says the right size, then the green "Next" of the size
   step (not the carousel arrow).
4. Duration: "6 months" → Next. When: "Not sure yet" is usually pre-ticked → Next (don't untick it).
5. Details: `#inputFirstName`, `#inputSurname`, `#inputEmail`, `#inputPostcode`, `#inputContactNumber`;
   leave `#checkbox-marketing` unticked → "Your Quote".
6. Quote page: read "Standard Price £x per week", "Online Price £y per week" (ongoing = Online Price) and the
   intro offer line (e.g. "50% OFF FOR THE FIRST 8 WEEKS" or "£1 FOR THE FIRST MONTH").
7. Next size: scroll to top, click the orange pencil "Edit Quote" → the wizard reopens with details EMPTY and the
   carousel back on 10 sq ft → repeat steps 2-6 (re-type the details each time).

## Access Self Storage — Islington (one enquiry, then +/− re-prices)
1. Open https://www.accessstorage.com/storage?storeid=26 → Reject All → click the "25 sq.ft." size button →
   "Continue".
2. Your details: First name, Last name, Contact number (07700900461), Email, Reason for storing = "Moving home"
   → "See my price".
3. Quote page: "then £x per week thereafter" = ongoing; also note the intro line ("50% off your first 8 weeks").
   Use the + button beside "<N> sq.ft." to step 25 → 35 → 50 → 75 → 100 → 125 → 150 (the page re-prices, no
   re-submit). The + button can move after "Limited availability" boxes appear — re-find it. Record 25, 50, 75,
   100, 150 and whether "Limited availability" shows for that size.

## Output
Reply with ONLY one JSON object (no prose), exactly this shape; use null where a value could not be read:
```
{"bigyellow": {"status": "ok|captcha|failed", "note": "",
               "sizes": {"25": {"ongoing": 0, "standard": 0, "intro": 0, "deal": ""}, "50": {...}, "75": {...}, "100": {...}, "150": {...}}},
 "safestore": {"status": "...", "note": "", "sizes": {...same...}},
 "access":    {"status": "...", "note": "", "sizes": {"25": {"ongoing": 0, "intro": 0, "deal": "", "limited": false}, ...}}}
```
