
1. Create a diagnosis
   POST /api/v1/farmer/diagnoses/
   {
   "image_id": 18,
   "branch_id": 1,
   "crop_id": 4,
   "sowing_date": "2026-08-15",
   "area_acres": "2.000",
   "water_litres_per_acre": "200.00",
   "application_method": "spray",
   "symptoms": "Leaves have brown spots and are curling."
   }
   application_method and symptoms are optional. application_method is spray, soil_drench, or drip. farm_crop_id is also optional.
   201 when the result is sure. message is Diagnosis created. Please confirm whether this result is correct.
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
   "observations": [
   "Brown round spots with rings are visible on the older leaves."
   ],
   "severity": "moderate",
   "disease": {
   "name": "Early blight, a fungus disease",
   "symptoms": [
   "Brown round spots with rings on the older leaves."
   ],
   "causes": [
   "A fungus that spreads when the leaves stay wet."
   ],
   "severity": "moderate",
   "severity_label": "Medium",
   "preventive_measures": [
   "Remove the badly spotted leaves."
   ],
   "recommended_treatment": "A fungicide spray can help after you confirm this result. The shop prepares the product and the price."
   },
   "confidence_label": "We are quite sure about this.",
   "farmer_message": "We are quite sure about this. Please confirm whether this crop problem is correct.",
   "disclaimer": "AI Crop Doctor gives guidance based on your photo and details. It can be wrong. If the problem gets worse or you are unsure, please talk to a local agriculture expert.",
   "contact_phone": "",
   "price_status": "awaiting_confirmation",
   "confirmation_status": "pending",
   "needs_expert_review": false,
   "status": "needs_review",
   "price": null,
   "created_at": "2026-10-15T09:49:00+05:30"
   }
   },
   "errors": null
   }
   disease is the only new field. Show that card to the farmer. Do not show likely_conditions[].confidence_percent. There is still no product name, product id, or packing id.
   For unsure, healthy, or no_product, the same object comes back with message Diagnosis created., price_status unavailable, and price null. contact_phone is filled for unsure and no_product.
2. List and read again
   GET /api/v1/farmer/diagnoses/
3. message is Farmer diagnoses retrieved. data.results is a list of the same diagnosis object.
   GET /api/v1/farmer/diagnoses/41/
4. message is Diagnosis retrieved. data.diagnosis is that same object.
5. Confirm
   POST /api/v1/farmer/diagnoses/41/confirm/
   { "confirmed": true }
   200 when the price is ready. message is Treatment price is ready. The diagnosis object is the same, with these fields changed:
   {
   "confirmation_status": "confirmed",
   "price_status": "ready",
   "status": "price_ready",
   "farmer_message": "We are quite sure about this.",
   "contact_phone": "",
   "price": {
   "quote_id": 15,
   "amount": "440.00",
   "currency": "INR",
   "quoted_at": "2026-10-15T09:55:00+05:30"
   }
   }
   price.amount is the total for every saved product. The product list is still hidden.
   If yes cannot be priced, message is A treatment price could not be prepared automatically., price is null, price_status is unavailable, and contact_phone has the shop number.
   If the farmer sends { "confirmed": false }, message is Diagnosis marked for review., confirmation_status is rejected, price is null, and contact_phone is set.
6. Offer after the price is ready
   GET /api/v1/farmer/offers/
7. message is Farmer offers retrieved.
   {
   "success": true,
   "message": "Farmer offers retrieved.",
   "data": {
   "results": [
   {
   "id": 9,
   "diagnosis_id": 41,
   "quote_id": 15,
   "status": "offer_available",
   "offer_price": "440.00",
   "currency": "INR",
   "expires_at": "2026-10-22T09:55:00+05:30",
   "created_at": "2026-10-15T09:55:00+05:30"
   }
   ]
   },
   "errors": null
   }
