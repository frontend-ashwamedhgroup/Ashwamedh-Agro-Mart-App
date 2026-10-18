
# Crop, branch, and product image APIs

Base URL: `http://127.0.0.1:8000`

Every JSON call sends:

```http
Authorization: Bearer <access token>
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

`success: false` means show `message`, then the strings inside `errors`.

## Who can call what

| Caller                                       | Token               | What they can do                                                                                     |
| -------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| Farmer                                       | Farmer access token | Read the crop list. Create, read, and update a planting on their own farm.                           |
| Employee with`organizations.view_branch`   | Staff access token  | List and read the branches assigned to them.                                                         |
| Employee with`organizations.change_branch` | Staff access token  | Update a branch assigned to them.                                                                    |
| Superuser                                    | Staff access token  | Create a branch. List and read every branch. Update any branch. Upload or replace one product image. |

A crop name such as Soybean or Onion is already stored. There is no API to create, rename, or delete that crop name. The farmer chooses an `id` from the crop list and records a planting.

There is no delete call for a planting.

## 1. List crops

`GET /api/v1/farmer/crop-catalog/`

Farmer token. No body. Inactive crops are left out.

`200`

```json
{
  "success": true,
  "message": "Crop catalog retrieved.",
  "data": {
    "results": [
      {
        "id": 2,
        "name": "Soybean",
        "description": "",
        "varieties": [
          {
            "id": 4,
            "name": "JS 335",
            "description": ""
          }
        ],
        "stages": [
          {
            "id": 7,
            "name": "Flowering",
            "sequence": 3,
            "typical_duration_days": null
          }
        ]
      }
    ]
  },
  "errors": null
}
```

Use `results[].id` as `crop` when creating a planting. Use `varieties[].id` as `variety` and `stages[].id` as `current_stage`. A variety or stage from a different crop is rejected.

## 2. List plantings on a farm

`GET /api/v1/farmer/farms/{farm_id}/crops/`

Farmer token. No body. `404` when the farm is not this farmer’s active farm.

`200`

```json
{
  "success": true,
  "message": "Farm crop plantings retrieved.",
  "data": {
    "results": [
      {
        "id": 11,
        "farm_id": 3,
        "crop": 2,
        "crop_name": "Soybean",
        "variety": 4,
        "variety_name": "JS 335",
        "current_stage": 7,
        "current_stage_name": "Flowering",
        "planting_date": "2026-08-15",
        "expected_harvest_date": null,
        "area": "2.000",
        "area_unit": "acre",
        "status": "growing",
        "notes": "",
        "created_at": "2026-08-15T10:00:00+05:30",
        "updated_at": "2026-08-15T10:00:00+05:30"
      }
    ]
  },
  "errors": null
}
```

## 3. Create a planting

`POST /api/v1/farmer/farms/{farm_id}/crops/`

Farmer token.

| Field                     | Required | Rules                                                                               |
| ------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `crop`                  | Yes      | An`id` from the crop list.                                                        |
| `planting_date`         | Yes      | `YYYY-MM-DD`.                                                                     |
| `area`                  | Yes      | Greater than 0.                                                                     |
| `area_unit`             | No       | `acre` or `hectare`. Defaults to `acre`.                                      |
| `variety`               | No       | Must belong to`crop`. Send `null` when there is no variety.                     |
| `current_stage`         | No       | Must belong to`crop`. Send `null` when there is no stage.                       |
| `expected_harvest_date` | No       | `YYYY-MM-DD`. Cannot be before `planting_date`.                                 |
| `status`                | No       | `planned`, `growing`, `harvested`, or `cancelled`. Defaults to `growing`. |
| `notes`                 | No       | Up to 500 characters.                                                               |

### Request

```json
{
  "crop": 2,
  "variety": 4,
  "current_stage": 7,
  "planting_date": "2026-08-15",
  "expected_harvest_date": "2026-11-20",
  "area": "2.000",
  "area_unit": "acre",
  "status": "growing",
  "notes": "North field"
}
```

### `201`

`message`: `Farm crop planting created.`

```json
{
  "success": true,
  "message": "Farm crop planting created.",
  "data": {
    "planting": {
      "id": 11,
      "farm_id": 3,
      "crop": 2,
      "crop_name": "Soybean",
      "variety": 4,
      "variety_name": "JS 335",
      "current_stage": 7,
      "current_stage_name": "Flowering",
      "planting_date": "2026-08-15",
      "expected_harvest_date": "2026-11-20",
      "area": "2.000",
      "area_unit": "acre",
      "status": "growing",
      "notes": "North field",
      "created_at": "2026-08-15T10:00:00+05:30",
      "updated_at": "2026-08-15T10:00:00+05:30"
    }
  },
  "errors": null
}
```

### `400`

```json
{
  "success": false,
  "message": "Request validation failed.",
  "data": null,
  "errors": {
    "variety": ["Variety must belong to the selected crop."]
  }
}
```

## 4. Read one planting

`GET /api/v1/farmer/crop-plantings/{planting_id}/`

Farmer token. No body. `404` when the planting is not on this farmer’s farm.

`200`

`message`: `Farm crop planting retrieved.`

`data.planting` has the same fields as the create response.

## 5. Update a planting

`PATCH /api/v1/farmer/crop-plantings/{planting_id}/`

Farmer token. Send only the fields that changed. The same rules as create apply.

### Request

```json
{
  "current_stage": 8,
  "status": "growing",
  "area": "2.500"
}
```

### `200`

`message`: `Farm crop planting updated.`

`data.planting` is the updated planting.

## 6. Upload a product image

A product has one image. A second upload replaces that image. There is no separate delete call.

`POST /api/v1/management/catalog/products/{product_id}/image/`

Superuser token.

```http
Authorization: Bearer <superuser access token>
Content-Type: multipart/form-data
```

| Field     | Required | Rules                                                     |
| --------- | -------- | --------------------------------------------------------- |
| `image` | Yes      | JPEG, PNG, or WebP. Maximum 10 MB. Maximum 20 megapixels. |

Do not send the file as JSON. The form field name is `image`.

### `200`

`message`: `Product image saved.`

The product object is returned. `image` is metadata. The file bytes are not in this JSON. `packings` stays whatever was added by hand. Uploading an image does not create a packing.

```json
{
  "success": true,
  "message": "Product image saved.",
  "data": {
    "product": {
      "id": 15,
      "sku": "PRD-000015",
      "name": "Pseudo-f",
      "image": {
        "content_type": "image/jpeg",
        "width": 1200,
        "height": 900,
        "size_bytes": 240331
      },
      "packings": []
    }
  },
  "errors": null
}
```

The live product object also includes the other product fields (`category`, `sale_unit`, `presentation`, and the rest). `sku` is generated by the server when the product is created. Do not send `sku` on create.

### `400`

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

Other image errors: `Image must not exceed 10 MB.` and `Image dimensions must not exceed 20 megapixels.`

`404` when `product_id` does not exist. `403` when the token is not a superuser.

## 7. Show the product image

The upload response does not contain a URL. Load the bytes from the image URL and send the same bearer token. The response body is the file, not JSON. Use the `Content-Type` header as the image type.

Staff, superuser token:

`GET /api/v1/management/catalog/products/{product_id}/image/`

Farmer shop, farmer token:

`GET /api/v1/farmer/catalog/products/{product_id}/image/`

On the farmer shop product, `image` already contains that farmer URL:

```json
"image": {
  "content_type": "image/jpeg",
  "width": 1200,
  "height": 900,
  "content_url": "http://127.0.0.1:8000/api/v1/farmer/catalog/products/15/image/"
}
```

`image` is `null` when the product has no photo.

### `404` when there is no photo

```json
{
  "success": false,
  "message": "This product has no image.",
  "data": null,
  "errors": {
    "image": "This product has no image."
  }
}
```

Show the picture from `content_url` with the farmer token. After a staff upload, call the staff image URL, or reload the product, to display the new file.

## 8. List branches

`GET /api/v1/management/branches/`

Staff token. No body.

A superuser receives every branch. An employee receives only active branches of active organizations where that employee has `organizations.view_branch`. `403` when the token has neither.

Optional query parameters:

| Parameter           | Values                              |
| ------------------- | ----------------------------------- |
| `organization_id` | Limit the list to one organization. |
| `is_active`       | `true` or `false`.              |

`200`

`message`: `Branches retrieved.`

```json
{
  "success": true,
  "message": "Branches retrieved.",
  "data": {
    "results": [
      {
        "id": 1,
        "organization": 1,
        "organization_name": "Ashwamedh Agro Mart",
        "code": "KOP",
        "name": "Kopargaon",
        "address_line1": "Main Road",
        "address_line2": "",
        "city": "Kopargaon",
        "district": "",
        "state": "Maharashtra",
        "postal_code": "423601",
        "contact_phone": "8806521971",
        "is_main_branch": false,
        "is_active": true,
        "created_at": "2026-08-01T10:00:00+05:30",
        "updated_at": "2026-08-01T10:00:00+05:30"
      }
    ]
  },
  "errors": null
}
```

The same list for one organization is `GET /api/v1/management/organizations/{organization_id}/branches/`. `message`: `Organization branches retrieved.` `404` when that organization id does not exist.

## 9. Create a branch

`POST /api/v1/management/organizations/{organization_id}/branches/`

Superuser token. An employee token receives `403` on this call. Do not send `organization`. The organization is the id in the URL.

| Field              | Required | Rules                                                                                                     |
| ------------------ | -------- | --------------------------------------------------------------------------------------------------------- |
| `code`           | Yes      | Up to 20 characters. Stored in uppercase. Unique inside this organization.`kop` is saved as `KOP`.    |
| `name`           | Yes      | Up to 160 characters.                                                                                     |
| `address_line1`  | Yes      | Up to 200 characters.                                                                                     |
| `city`           | Yes      | Up to 100 characters.                                                                                     |
| `state`          | Yes      | Up to 100 characters.                                                                                     |
| `postal_code`    | Yes      | Up to 12 characters.                                                                                      |
| `address_line2`  | No       | Up to 200 characters.                                                                                     |
| `district`       | No       | Up to 100 characters.                                                                                     |
| `contact_phone`  | No       | Up to 24 characters. This is the shop phone Crop Doctor shows.                                            |
| `is_main_branch` | No       | `true` or `false`. Only one branch in the organization can be the main branch. Defaults to `false`. |
| `is_active`      | No       | Defaults to`true`.                                                                                      |

A branch cannot be added to an inactive organization.

### Request

```json
{
  "code": "KOP",
  "name": "Kopargaon",
  "address_line1": "Main Road",
  "address_line2": "",
  "city": "Kopargaon",
  "district": "Ahilyanagar",
  "state": "Maharashtra",
  "postal_code": "423601",
  "contact_phone": "8806521971",
  "is_main_branch": true
}
```

### `201`

`message`: `Branch created.`

```json
{
  "success": true,
  "message": "Branch created.",
  "data": {
    "branch": {
      "id": 1,
      "organization": 1,
      "organization_name": "Ashwamedh Agro Mart",
      "code": "KOP",
      "name": "Kopargaon",
      "address_line1": "Main Road",
      "address_line2": "",
      "city": "Kopargaon",
      "district": "Ahilyanagar",
      "state": "Maharashtra",
      "postal_code": "423601",
      "contact_phone": "8806521971",
      "is_main_branch": true,
      "is_active": true,
      "created_at": "2026-08-01T10:00:00+05:30",
      "updated_at": "2026-08-01T10:00:00+05:30"
    }
  },
  "errors": null
}
```

Use `data.branch.id` as `branch_id` on a diagnosis.

### `400`

```json
{
  "success": false,
  "message": "Request validation failed.",
  "data": null,
  "errors": {
    "code": ["This code is already used by a branch in this organization."]
  }
}
```

A second main branch returns `errors.is_main_branch`: `This organization already has a main branch.`

## 10. Read one branch

`GET /api/v1/management/branches/{branch_id}/`

Staff token. No body.

`200`

`message`: `Branch retrieved.`

`data.branch` has the same fields as the create response.

`403` when this employee is not allowed to view that branch. `404` when a superuser asks for a branch id that does not exist.

## 11. Update a branch

`PATCH /api/v1/management/branches/{branch_id}/`

Superuser, or an employee with `organizations.change_branch` on that branch. Send only the fields that changed. There is no delete call. Set `is_active` to `false` to close the branch and keep its history.

`organization` cannot be changed.

### Request

```json
{
  "contact_phone": "8806521971",
  "is_active": false
}
```

### `200`

`message`: `Branch updated.`

`data.branch` is the updated branch.

### `400`

```json
{
  "success": false,
  "message": "Request validation failed.",
  "data": null,
  "errors": {
    "is_main_branch": ["This organization already has a main branch."]
  }
}
```
