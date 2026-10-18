
# Crop Doctor — frontend guide

Give this file to the farmer app. It is the full flow after the diagnosis change: the farmer confirms the result, then the price appears on the same diagnosis. The app never shows product names, product ids, packing ids, pack sizes, or shop stock.

Base URL: `http://127.0.0.1:8000`

Every JSON call uses:

```http
Authorization: Bearer <farmer access token>
Content-Type: application/json
```

Photo upload is the exception. That call is `multipart/form-data` and has no JSON body.

Every JSON response uses this envelope:

```json
{
  "success": true,
  "message": "Human readable summary",
  "data": {},
  "errors": null
}
```

`success: false` means show `message`, then the strings inside `errors`. Nothing was saved on `400`, `502`, or `503` for the create call.

## How the screens follow each other

1. Farmer picks a crop and uploads one photo.
2. Farmer fills the form and taps send.
3. The app reads `outcome`.
4. If `outcome` is `sure` and `confirmation_status` is `pending`, show the disease and two buttons: **Yes, this is correct** and **No, this is not correct**. Do not show a price yet.
5. Yes calls the confirm API with `confirmed: true`. The response is the updated diagnosis.
6. If that response has `price_status: "ready"`, show `price.amount` and `price.currency`, then the existing accept and reject buttons.
7. If Yes comes back with `price_status: "unavailable"`, show `farmer_message` and a call button for `contact_phone`. Do not show a price.
8. No calls the confirm API with `confirmed: false`. Show `farmer_message` and the call button. Do not show a price. Do not send Yes later for that same diagnosis.
9. `unsure` and `no_product` skip the Yes/No question. Show `farmer_message` and the call button.
10. `healthy` skips the Yes/No question and the call button. Show `farmer_message` only.
11. After the price is ready, load the offer for that `diagnosis_id`, then use the existing accept, reject, cart, and order calls.

The confirm call is synchronous. Do not poll for a price after Yes. The price is either on that response or it will not be prepared automatically.

A notification can still arrive with title `Your treatment price is ready`, category `diagnosis`, and `target_id` equal to the diagnosis id. Open `GET /api/v1/farmer/diagnoses/{id}/` when it arrives.

## What to render

Decide the screen from `outcome`, `confirmation_status`, and `price_status` together.

| State                                                                               | Show                                       | Price                                             | Buttons                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------- | -------------------------- |
| `sure` + `confirmation_status` `pending`                                      | Problem,`farmer_message`, `disclaimer` | No.`price_status` is `awaiting_confirmation`. | Yes and No                 |
| `sure` + `price_status` `ready`                                               | Problem,`farmer_message`, `disclaimer` | `price.amount` and `price.currency`           | Accept price, Reject price |
| `sure` + `confirmation_status` `confirmed` + `price_status` `unavailable` | `farmer_message`, `disclaimer`         | No                                                | Call`contact_phone`      |
| `sure` + `confirmation_status` `rejected`                                     | `farmer_message`, `disclaimer`         | No                                                | Call`contact_phone`      |
| `unsure`                                                                          | `farmer_message`, `disclaimer`         | No                                                | Call`contact_phone`      |
| `no_product`                                                                      | `farmer_message`, `disclaimer`         | No                                                | Call`contact_phone`      |
| `healthy`                                                                         | `farmer_message`, `disclaimer`         | No                                                | None                       |

Show `likely_conditions[].name` and `likely_conditions[].evidence`. Show `confidence_label` instead of any percentage.

Show `water_warning` under the water field when it is not an empty string.

Always show `disclaimer`.

Do not render these farmer fields: `likely_conditions[].confidence_percent`, `needs_expert_review`, product name, SKU, product id, packing id, dose, `recommendations`, or `calculation`. `status` is only a hint: `price_ready` means `price` is present.

`contact_phone` is empty except for `unsure`, `no_product`, a rejected confirmation, and a confirmed diagnosis whose price could not be prepared.

## 1. Crop list

`GET /api/v1/farmer/crop-catalog/`

No body.

`200`

```json
{
  "success": true,
  "message": "Crop catalog retrieved.",
  "data": {
    "results": [
      {
        "id": 3,
        "name": "Tomato",
        "description": "",
        "varieties": [],
        "stages": []
      }
    ]
  },
  "errors": null
}
```

Send `results[].id` as `crop_id` in the diagnosis request.

## 2. Upload the photo

`POST /api/v1/farmer/images/`

`Content-Type: multipart/form-data`

| Field     | Required | Rules                              |
| --------- | -------- | ---------------------------------- |
| `image` | Yes      | JPEG, PNG, or WebP. Maximum 10 MB. |

`200`

```json
{
  "success": true,
  "message": "Image uploaded.",
  "data": {
    "image": {
      "id": 18,
      "content_type": "image/jpeg",
      "width": 1200,
      "height": 1600
    }
  },
  "errors": null
}
```

Keep `data.image.id`. That is `image_id` on the next call.

`400` for a bad file. Keep the form. Ask for another photo.

```json
{
  "success": false,
  "message": "Request validation failed.",
  "data": null,
  "errors": {
    "image": ["Upload a valid JPEG, PNG, or WebP image."]
  }
}
```

## 3. Send the diagnosis

`POST /api/v1/farmer/diagnoses/`

Limited to 5 creates per farmer per hour. A second tap must not send a second request.

| Field                     | Required | Rules                                                                                  |
| ------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `image_id`              | Yes      | The id from the upload. Must belong to this farmer.                                    |
| `branch_id`             | Yes      | The shop branch that will price the result.                                            |
| `crop_id`               | Yes      | An id from the crop list.                                                              |
| `sowing_date`           | Yes      | `YYYY-MM-DD`. Not a future date.                                                     |
| `area_acres`            | Yes      | Greater than 0 and at most 500. Decimals are allowed.                                  |
| `water_litres_per_acre` | Yes      | Greater than 0. Litres used to spray one acre.                                         |
| `application_method`    | No       | `spray`, `soil_drench`, or `drip`. Leave it out when the farmer does not choose. |
| `symptoms`              | No       | If present, 10 to 500 characters.                                                      |
| `farm_crop_id`          | No       | Only when the app already has a planting id for this farmer.                           |

### Request

```json
{
  "image_id": 18,
  "branch_id": 1,
  "crop_id": 3,
  "sowing_date": "2026-08-15",
  "area_acres": "2.0",
  "water_litres_per_acre": "200",
  "application_method": "spray",
  "symptoms": "Leaves have brown spots and are curling. Started 4 days ago."
}
```

### `201` — sure, waiting for Yes or No

`message`: `Diagnosis created. Please confirm whether this result is correct.`

```json
{
  "success": true,
  "message": "Diagnosis created. Please confirm whether this result is correct.",
  "data": {
    "diagnosis": {
      "id": 41,
      "image_id": 18,
      "crop_name": "Tomato",
      "sowing_date": "2026-08-15",
      "area_acres": "2.000",
      "water_litres_per_acre": "200.00",
      "water_warning": "",
      "application_method": "spray",
      "outcome": "sure",
      "summary": "Brown round spots with rings are visible on the older leaves.",
      "likely_conditions": [
        {
          "name": "Early blight",
          "confidence_percent": 92,
          "evidence": "Brown round spots with rings on the older leaves."
        }
      ],
      "observations": ["Brown round spots with rings are visible on the older leaves."],
      "severity": "moderate",
      "confidence_label": "We are quite sure about this.",
      "farmer_message": "We are quite sure about this. Please confirm whether this crop problem is correct.",
      "disclaimer": "AI Crop Doctor gives guidance based on your photo and details. It can be wrong. If the problem gets worse or you are unsure, please talk to a local agriculture expert.",
      "contact_phone": "",
      "price_status": "awaiting_confirmation",
      "confirmation_status": "pending",
      "needs_expert_review": false,
      "status": "needs_review",
      "price": null,
      "created_at": "2026-10-12T10:30:00+05:30"
    }
  },
  "errors": null
}
```

Save `data.diagnosis.id`. The confirm call uses it. Do not show a rupee amount. Ask:

**Is this the disease or crop problem detected by AI correct?**

### `201` — not sure

`message`: `Diagnosis created.`

```json
{
  "success": true,
  "message": "Diagnosis created.",
  "data": {
    "diagnosis": {
      "id": 42,
      "outcome": "unsure",
      "confirmation_status": "pending",
      "confidence_label": "We are not fully sure.",
      "farmer_message": "Sorry, I am not sure about this. Please contact us.",
      "contact_phone": "+912012345678",
      "price_status": "unavailable",
      "price": null,
      "needs_expert_review": true
    }
  },
  "errors": null
}
```

Do not show Yes/No. Do not call confirm. Show the call button.

`no_product` uses this same screen. `farmer_message` names the problem and says to contact the shop. `contact_phone` is set. `price` is null.

### `201` — crop looks healthy

`outcome` is `healthy`. `farmer_message` says the crop looks healthy and no spray is needed. `contact_phone` is empty. `price` is null. `price_status` is `unavailable`. Do not show Yes/No.

### `400` — photo rejected

The form was valid. Nothing was saved. Keep every answer and ask for a new photo.

```json
{
  "success": false,
  "message": "Please take a new photo.",
  "data": null,
  "errors": {
    "photo": "The photo is too dark. Please take it in daylight and try again."
  }
}
```

Show `errors.photo`. The same shape is used for blur, glare, distance, no plant, the wrong crop, a photo of a screen, and a file that cannot be opened.

### `400` — form errors

```json
{
  "success": false,
  "message": "Request validation failed.",
  "data": null,
  "errors": {
    "sowing_date": ["This date has not come yet. Please check it."],
    "area_acres": ["Please enter an area above 0."]
  }
}
```

Show the first string in each field. Nothing was saved.

### `502` and `503` — AI did not answer

Nothing was saved. Keep the form and let the farmer try again.

```json
{
  "success": false,
  "message": "AI diagnosis is temporarily unavailable.",
  "data": null,
  "errors": {
    "diagnosis": "No diagnosis was saved. Please try again later."
  }
}
```

`503` uses `message` `AI diagnosis is not configured.` Treat both as "try again later".

`429` means this farmer already sent 5 diagnoses in the last hour.

## 4. Confirm the result

Call this only when `outcome` is `sure` and `confirmation_status` is `pending`.

`POST /api/v1/farmer/diagnoses/41/confirm/`

The body is only the farmer's answer. Do not send product ids, packing ids, quantities, or prices.

Yes:

```json
{ "confirmed": true }
```

No:

```json
{ "confirmed": false }
```

### `200` — Yes, price is ready

`message`: `Treatment price is ready.`

```json
{
  "success": true,
  "message": "Treatment price is ready.",
  "data": {
    "diagnosis": {
      "id": 41,
      "outcome": "sure",
      "confirmation_status": "confirmed",
      "price_status": "ready",
      "status": "price_ready",
      "farmer_message": "We are quite sure about this.",
      "disclaimer": "AI Crop Doctor gives guidance based on your photo and details. It can be wrong. If the problem gets worse or you are unsure, please talk to a local agriculture expert.",
      "contact_phone": "",
      "price": {
        "quote_id": 9,
        "amount": "250.00",
        "currency": "INR",
        "quoted_at": "2026-10-12T11:00:00+05:30"
      }
    }
  },
  "errors": null
}
```

Show `price.amount` with `price.currency`. `price` has only `quote_id`, `amount`, `currency`, and `quoted_at`.

Sending Yes again for the same diagnosis returns this same price. It does not create a second offer. Disable the button while the request is in flight, then treat a second `200` as the same screen.

### `200` — Yes, price could not be prepared

`message`: `A treatment price could not be prepared automatically.`

`confirmation_status` is `confirmed`. `price_status` is `unavailable`. `price` is `null`. `contact_phone` is set. `farmer_message` is `We could not prepare a price automatically. Please contact us.`

Show that message and the call button. Do not show a price. Do not send Yes again.

### `200` — No

`message`: `Diagnosis marked for review.`

```json
{
  "success": true,
  "message": "Diagnosis marked for review.",
  "data": {
    "diagnosis": {
      "id": 41,
      "outcome": "sure",
      "confirmation_status": "rejected",
      "price_status": "unavailable",
      "farmer_message": "You told us this result is not correct. We will not prepare a price. Please contact us.",
      "contact_phone": "+912012345678",
      "price": null
    }
  },
  "errors": null
}
```

Show the message and the call button. A later Yes on this diagnosis returns `400`. Do not switch the same diagnosis back to Yes.

### `400` — this diagnosis cannot be confirmed

```json
{
  "success": false,
  "message": "Only a sure diagnosis can be confirmed.",
  "data": null,
  "errors": {
    "confirmed": "Only a sure diagnosis can be confirmed."
  }
}
```

The other `400` message is `This diagnosis has already been answered.` Show `message`. Do not change the screen to a price.

`404` means this diagnosis is not this farmer's. Do not show another farmer's result.

## 5. Read the diagnosis again

`GET /api/v1/farmer/diagnoses/`

`200` message: `Farmer diagnoses retrieved.` `data.results` is a list of the same diagnosis object.

`GET /api/v1/farmer/diagnoses/41/`

`200` message: `Diagnosis retrieved.` `data.diagnosis` is the same object as create and confirm.

Use the same screen rules as the table above. If the farmer leaves the app on the Yes/No screen and comes back, read the diagnosis and follow `confirmation_status` instead of showing the question again.

## 6. Accept or reject the price

Do this only when `price_status` is `ready`.

`GET /api/v1/farmer/offers/`

Find the object whose `diagnosis_id` equals this diagnosis id.

```json
{
  "id": 7,
  "diagnosis_id": 41,
  "quote_id": 9,
  "status": "offer_available",
  "offer_price": "250.00",
  "currency": "INR",
  "expires_at": "2026-10-19T11:00:00+05:30",
  "created_at": "2026-10-12T11:00:00+05:30"
}
```

`offer_price` matches `price.amount`. There is still no product name.

| `status`                               | What the farmer can do                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `pending`                              | Wait. The price is not ready. This is the state before a successful Yes. |
| `offer_available`                      | Accept or reject.                                                        |
| `accepted`                             | Add it to the treatment cart and place the order.                        |
| `rejected`, `expired`, `converted` | No further action.                                                       |

`POST /api/v1/farmer/offers/7/accept/`

`POST /api/v1/farmer/offers/7/reject/`

Neither call has a body.

`200` returns `data.offer` with the new `status` (`accepted` or `rejected`).

`400` means the offer is not `offer_available` (still pending, already answered, or expired). Show `message`.

## 7. Cart and order

These calls did not change. Use them only after the offer `status` is `accepted`.

`POST /api/v1/farmer/cart/`

```json
{ "offer_id": 7 }
```

`POST /api/v1/farmer/orders/`

```json
{ "address_id": 4, "note": "Deliver to the farm gate" }
```

`note` is optional. `address_id` is one of the farmer's saved addresses.

## Fields the app must ignore

The diagnosis and offer payloads do not contain a product list. If a future field appears with a product name, SKU, product id, or packing id, do not render it.

Ignore `likely_conditions[].confidence_percent` and `needs_expert_review`.
