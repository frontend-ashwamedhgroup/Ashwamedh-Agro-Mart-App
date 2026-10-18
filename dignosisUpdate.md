
# Bilingual diagnosis APIs

Only the farmer diagnosis responses changed. Requests are the same. Product, offer, cart, and order APIs are unchanged.

Auth: `Authorization: Bearer <access token>`

Base path: `/api/v1/farmer/`

Envelope:

```json
{
  "success": true,
  "message": "Short result.",
  "data": {},
  "errors": null
}
```

The new object is `diagnosis_details`. It has `en` and `mr`. Existing fields such as `summary`, `disease`, `severity`, and `farmer_message` stay English.

## Endpoints that return both languages

| Method   | Path                                                 | Request change | Response change                                                               |
| -------- | ---------------------------------------------------- | -------------- | ----------------------------------------------------------------------------- |
| `GET`  | `/api/v1/farmer/diagnoses/`                        | None           | Each item includes `diagnosis_details`                                      |
| `POST` | `/api/v1/farmer/diagnoses/`                        | None           | `diagnosis.diagnosis_details` added. Photo errors also include `photo_mr` |
| `GET`  | `/api/v1/farmer/diagnoses/{diagnosis_id}/`         | None           | `diagnosis.diagnosis_details` added                                         |
| `POST` | `/api/v1/farmer/diagnoses/{diagnosis_id}/confirm/` | None           | `diagnosis.diagnosis_details` added                                         |

## POST `/api/v1/farmer/diagnoses/`

Request is unchanged.

```json
{
  "image_id": 105,
  "branch_id": 1,
  "crop_id": 1,
  "sowing_date": "2026-09-06",
  "area_acres": "1.000",
  "water_litres_per_acre": "200.00",
  "application_method": "spray",
  "symptoms": "The leaves do not look healthy."
}
```

**201.** Message is `Diagnosis created. Please confirm whether this result is correct.` when `outcome` is `sure`. Otherwise the message is `Diagnosis created.`

```json
{
  "success": true,
  "message": "Diagnosis created. Please confirm whether this result is correct.",
  "data": {
    "diagnosis": {
      "id": 75,
      "image_id": 105,
      "crop_name": "Onion",
      "sowing_date": "2026-09-06",
      "area_acres": "1.000",
      "water_litres_per_acre": "200.00",
      "water_warning": "",
      "application_method": "spray",
      "outcome": "sure",
      "summary": "Pale streaks and dry tips are visible on the onion leaves.",
      "likely_conditions": [
        {
          "name": "Onion thrips",
          "confidence_percent": 80,
          "evidence": "Pale streaks and dry tips across many leaves."
        }
      ],
      "observations": ["Leaves are bent and drying from the tips."],
      "severity": "moderate",
      "disease": {
        "name": "Onion thrips",
        "affected_crop": "Onion",
        "symptoms": ["Seen in this photo: pale streaks on the leaves."],
        "causes": ["A tiny insect scrapes the leaf and sucks the sap."],
        "severity": "moderate",
        "severity_label": "Medium",
        "potential_impact": "Leaves dry back and bulbs can stay small.",
        "preventive_measures": ["Keep the field clean."],
        "recommended_treatment": "Ask the shop for a product whose notes say it treats onion thrips.",
        "precautions": "Do not spray in strong wind.",
        "sources": []
      },
      "diagnosis_details": {
        "en": {
          "summary": "Pale streaks and dry tips are visible on the onion leaves.",
          "disease_name": "Onion thrips",
          "affected_crop": "Onion",
          "symptoms": ["Seen in this photo: pale streaks on the leaves."],
          "causes": ["A tiny insect scrapes the leaf and sucks the sap."],
          "severity": "moderate",
          "severity_label": "Medium",
          "confidence_label": "We are quite sure about this.",
          "preventive_measures": ["Keep the field clean."],
          "recommended_treatment": "Ask the shop for a product whose notes say it treats onion thrips.",
          "precautions": "Do not spray in strong wind.",
          "potential_impact": "Leaves dry back and bulbs can stay small.",
          "farmer_message": "We are quite sure about this. Please confirm whether this crop problem is correct."
        },
        "mr": {
          "summary": "कांद्याच्या पानांवर फिकट पट्टे आणि वाळलेली टोके दिसतात.",
          "disease_name": "कांदा थ्रिप्स (Onion thrips)",
          "affected_crop": "कांदा",
          "symptoms": ["या फोटोत दिसले: पानांवर फिकट पट्टे."],
          "causes": ["अतिशय लहान कीड पान खरवडून रस शोषते."],
          "severity": "moderate",
          "severity_label": "मध्यम",
          "confidence_label": "आम्हाला बरीच खात्री आहे.",
          "preventive_measures": ["शेत स्वच्छ ठेवा."],
          "recommended_treatment": "ज्या उत्पादनाच्या नोंदीत कांदा थ्रिप्स आहे, ते उत्पादन दुकानात विचारा.",
          "precautions": "जोराच्या वाऱ्यात फवारणी करू नका.",
          "potential_impact": "पाने टोकाकडून वाळतात आणि कांदे लहान राहू शकतात.",
          "farmer_message": "आम्हाला या समस्येबद्दल बरीच खात्री आहे. ही ओळख बरोबर आहे का, कृपया पुष्टी करा."
        }
      },
      "confidence_label": "We are quite sure about this.",
      "farmer_message": "We are quite sure about this. Please confirm whether this crop problem is correct.",
      "disclaimer": "AI Crop Doctor gives guidance based on your photo and details. It can be wrong. If the problem gets worse or you are unsure, please talk to a local agriculture expert.",
      "contact_phone": "",
      "price_status": "awaiting_confirmation",
      "confirmation_status": "pending",
      "needs_expert_review": false,
      "status": "draft",
      "price": null,
      "created_at": "2026-10-16T13:19:32+05:30"
    }
  },
  "errors": null
}
```

`diagnosis_details.en.disease_name` matches `disease.name`. `diagnosis_details.en.severity` and `diagnosis_details.mr.severity` are the same value. Marathi text is in Devanagari.

When the result is not sure enough, both languages withhold a definite treatment:

- `diagnosis_details.en.recommended_treatment`: `This photo is not enough to confirm a disease or a treatment. Please contact the shop.`
- `diagnosis_details.mr.recommended_treatment`: `या फोटोवरून रोग किंवा उपचार निश्चित करता येत नाही. कृपया दुकानाशी संपर्क साधा.`
- `diagnosis_details.mr.farmer_message`: `माफ करा, या फोटोवरून आम्हाला खात्री नाही. कृपया आमच्याशी संपर्क साधा.`

### Photo rejected, 400

The request is unchanged. No diagnosis is saved. `errors.photo` is unchanged. `errors.photo_mr` is new.

```json
{
  "success": false,
  "message": "Please take a new photo.",
  "data": null,
  "errors": {
    "photo": "This photo does not look like Onion. Please check the crop name or upload the right photo.",
    "photo_mr": "हा फोटो Onion सारखा दिसत नाही. पिकाचे नाव तपासा किंवा योग्य फोटो अपलोड करा."
  }
}
```

## GET `/api/v1/farmer/diagnoses/`

No request body.

**200.** Message: `Farmer diagnoses retrieved.`

```json
{
  "success": true,
  "message": "Farmer diagnoses retrieved.",
  "data": {
    "results": [
      {
        "id": 75,
        "outcome": "sure",
        "summary": "Pale streaks and dry tips are visible on the onion leaves.",
        "disease": { "name": "Onion thrips" },
        "diagnosis_details": {
          "en": { "disease_name": "Onion thrips" },
          "mr": { "disease_name": "कांदा थ्रिप्स (Onion thrips)" }
        }
      }
    ]
  },
  "errors": null
}
```

Each result uses the same diagnosis object as create, including the full `diagnosis_details.en` and `diagnosis_details.mr` objects.

## GET `/api/v1/farmer/diagnoses/{diagnosis_id}/`

No request body.

**200.** Message: `Diagnosis retrieved.`

`data.diagnosis` is the same object as create, including `diagnosis_details`.

## POST `/api/v1/farmer/diagnoses/{diagnosis_id}/confirm/`

Request is unchanged.

```json
{ "confirmed": true }
```

**200.** Message is `Treatment price is ready.` when a price was created. The diagnosis object again includes `diagnosis_details`. After confirmation, `diagnosis_details.en.farmer_message` and `diagnosis_details.mr.farmer_message` follow the same confirmation state.

```json
{
  "success": true,
  "message": "Treatment price is ready.",
  "data": {
    "diagnosis": {
      "id": 75,
      "confirmation_status": "confirmed",
      "price_status": "ready",
      "price": {
        "quote_id": 7,
        "amount": "996.00",
        "currency": "INR"
      },
      "diagnosis_details": {
        "en": {
          "farmer_message": "We are quite sure about this."
        },
        "mr": {
          "farmer_message": "आम्हाला याबद्दल बरीच खात्री आहे."
        }
      }
    }
  },
  "errors": null
}
```

`confirmed: false` does not create a price. Both languages then say the result was rejected and no price will be prepared.

## Frontend

Read both languages from the same diagnosis response:

- English: `data.diagnosis.diagnosis_details.en`
- Marathi: `data.diagnosis.diagnosis_details.mr`

Do not remove the existing `disease` or `summary` fields. Product, offer, cart, and order requests and responses are the same.
